import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PatientLookupService } from '../patient/patient-lookup.service';
import { RedisService } from '../redis/redis.service';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService, PatientAccountLinkSummary } from './patient-account-link.service';
import { PatientJwtPayload } from './strategies/patient-jwt.strategy';

const REFRESH_TTL_DAYS = 7;
const REFRESH_TTL_SECONDS = REFRESH_TTL_DAYS * 24 * 60 * 60;
const ACCESS_TTL_SECONDS = 15 * 60;

export const patientRedisKey = {
  refresh: (hash: string) => `patient-refresh:${hash}`,
  blacklist: (jti: string) => `patient-blacklist:${jti}`,
};

export interface PatientOrganizationSummary {
  linkId: string;
  organizationId: string;
  organizationName: string;
}

export interface PatientPendingConsentSummary {
  linkId: string;
  organizationId: string;
  organizationName: string;
  requestedAt: Date;
}

export interface PatientLoginResult {
  accessToken: string | null;
  refreshToken: string | null;
  preAuthToken: string | null;
  scope: 'patient' | 'patient-consent' | null;
  patientId: string | null;
  organizationId: string | null;
  organizations: PatientOrganizationSummary[];
  pendingConsents: PatientPendingConsentSummary[];
}

@Injectable()
export class PatientAuthService {
  constructor(
    protected readonly accounts: PatientAccountService,
    protected readonly links: PatientAccountLinkService,
    protected readonly patientLookup: PatientLookupService,
    protected readonly jwtService: JwtService,
    protected readonly config: ConfigService,
    protected readonly redis: RedisService,
  ) {}

  async login(cpf: string, password: string): Promise<PatientLoginResult> {
    const account = await this.accounts.findByCpf(cpf);
    if (!account || account.status === 'BLOCKED' || !account.passwordHash) {
      throw new UnauthorizedException('CPF ou senha inválidos');
    }

    const passwordValid = await bcrypt.compare(password, account.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('CPF ou senha inválidos');
    }

    const allLinks = await this.links.findAllByAccountId(account.id);
    const activeLinks = allLinks.filter((link) => link.status === 'ACTIVE');
    const pendingLinks = allLinks.filter((link) => link.status === 'PENDING_CONSENT');
    const pendingConsents = await this.toPendingConsentSummaries(pendingLinks);

    if (activeLinks.length === 0 && pendingLinks.length === 0) {
      throw new UnauthorizedException('Sem vínculo com nenhuma clínica');
    }

    if (activeLinks.length === 0) {
      return {
        accessToken: this.issueConsentOnlyToken(account.id),
        refreshToken: null,
        preAuthToken: null,
        scope: 'patient-consent',
        patientId: null,
        organizationId: null,
        organizations: [],
        pendingConsents,
      };
    }

    if (activeLinks.length === 1) {
      const tokens = await this.issueSessionTokens(account.id, activeLinks[0]);
      return {
        ...tokens,
        preAuthToken: null,
        scope: 'patient',
        patientId: activeLinks[0].patientId,
        organizationId: activeLinks[0].organizationId,
        organizations: await this.toOrganizationSummaries(activeLinks),
        pendingConsents,
      };
    }

    return {
      accessToken: null,
      refreshToken: null,
      preAuthToken: this.issuePreAuthToken(account.id),
      scope: null,
      patientId: null,
      organizationId: null,
      organizations: await this.toOrganizationSummaries(activeLinks),
      pendingConsents,
    };
  }

  async selectLink(preAuthToken: string, linkId: string): Promise<PatientLoginResult> {
    const accountId = this.verifyPreAuthToken(preAuthToken);
    const link = await this.links.findById(linkId);
    if (!link || link.patientAccountId !== accountId || link.status !== 'ACTIVE') {
      throw new UnauthorizedException('Vínculo inválido ou inativo');
    }

    const tokens = await this.issueSessionTokens(accountId, link);
    const allLinks = await this.links.findAllByAccountId(accountId);
    const activeLinks = allLinks.filter((l) => l.status === 'ACTIVE');
    const pendingLinks = allLinks.filter((l) => l.status === 'PENDING_CONSENT');

    return {
      ...tokens,
      preAuthToken: null,
      scope: 'patient',
      patientId: link.patientId,
      organizationId: link.organizationId,
      organizations: await this.toOrganizationSummaries(activeLinks),
      pendingConsents: await this.toPendingConsentSummaries(pendingLinks),
    };
  }

  async getSession(patient: PatientJwtPayload): Promise<{
    patientId: string | null;
    organizationId: string | null;
    organizations: PatientOrganizationSummary[];
    pendingConsents: PatientPendingConsentSummary[];
  }> {
    const allLinks = await this.links.findAllByAccountId(patient.sub);
    const activeLinks = allLinks.filter((link) => link.status === 'ACTIVE');
    const pendingLinks = allLinks.filter((link) => link.status === 'PENDING_CONSENT');

    return {
      patientId: patient.patientId ?? null,
      organizationId: patient.organizationId ?? null,
      organizations: await this.toOrganizationSummaries(activeLinks),
      pendingConsents: await this.toPendingConsentSummaries(pendingLinks),
    };
  }

  async rotateRefreshToken(
    accountId: string,
    linkId: string,
    jti: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = this.hashJti(jti);
    const storedAccountId = await this.redis.get(patientRedisKey.refresh(tokenHash));

    if (!storedAccountId || storedAccountId !== accountId) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const link = await this.links.findById(linkId);
    if (!link || link.status !== 'ACTIVE' || link.patientAccountId !== accountId) {
      await this.redis.del(patientRedisKey.refresh(tokenHash));
      throw new UnauthorizedException('Vínculo inválido ou inativo');
    }

    await this.redis.del(patientRedisKey.refresh(tokenHash));
    return this.issueSessionTokens(accountId, link);
  }

  async logout(refreshToken: string, accessJti: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<{ jti: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      await this.redis.del(patientRedisKey.refresh(this.hashJti(payload.jti)));
    } catch {
      // refresh token já inválido/expirado — segue para revogar o access token
    }

    await this.redis.set(patientRedisKey.blacklist(accessJti), '1', ACCESS_TTL_SECONDS);
  }

  protected async toOrganizationSummaries(
    links: PatientAccountLinkSummary[],
  ): Promise<PatientOrganizationSummary[]> {
    const patients = await Promise.all(links.map((link) => this.patientLookup.findById(link.patientId)));
    return links.map((link, index) => ({
      linkId: link.id,
      organizationId: link.organizationId,
      organizationName: patients[index]?.organizationName ?? '',
    }));
  }

  protected async toPendingConsentSummaries(
    links: PatientAccountLinkSummary[],
  ): Promise<PatientPendingConsentSummary[]> {
    const patients = await Promise.all(links.map((link) => this.patientLookup.findById(link.patientId)));
    return links.map((link, index) => ({
      linkId: link.id,
      organizationId: link.organizationId,
      organizationName: patients[index]?.organizationName ?? '',
      requestedAt: link.invitedAt,
    }));
  }

  protected issueConsentOnlyToken(accountId: string): string {
    const payload: PatientJwtPayload = { sub: accountId, scope: 'patient-consent', jti: crypto.randomUUID() };
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  protected issuePreAuthToken(accountId: string): string {
    return this.jwtService.sign({ sub: accountId, type: 'patient-pre-auth' }, { expiresIn: '5m' });
  }

  protected verifyPreAuthToken(token: string): string {
    try {
      const payload = this.jwtService.verify<{ sub?: string; type?: string }>(token);
      if (!payload.sub || payload.type !== 'patient-pre-auth') {
        throw new UnauthorizedException('Token de pré-autenticação inválido');
      }
      return payload.sub;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Token de pré-autenticação inválido ou expirado');
    }
  }

  protected async issueSessionTokens(
    accountId: string,
    link: PatientAccountLinkSummary,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const jti = crypto.randomUUID();
    const accessJti = crypto.randomUUID();

    const accessPayload: PatientJwtPayload = {
      sub: accountId,
      scope: 'patient',
      linkId: link.id,
      patientId: link.patientId,
      organizationId: link.organizationId,
      jti: accessJti,
    };
    const accessToken = this.jwtService.sign(accessPayload, { expiresIn: '15m' });

    const refreshPayload = {
      sub: accountId,
      scope: 'patient' as const,
      linkId: link.id,
      patientId: link.patientId,
      organizationId: link.organizationId,
      jti,
      type: 'patient-refresh' as const,
    };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: `${REFRESH_TTL_DAYS}d`,
    });

    await this.redis.set(patientRedisKey.refresh(this.hashJti(jti)), accountId, REFRESH_TTL_SECONDS);

    return { accessToken, refreshToken };
  }

  protected hashJti(jti: string): string {
    return crypto.createHash('sha256').update(jti).digest('hex');
  }
}
