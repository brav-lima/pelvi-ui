import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PersonService } from '../person/person.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { SelectOrganizationDto } from './dto/select-organization.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import type { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';
import * as Sentry from '@sentry/nestjs';

const REFRESH_TTL_DAYS = 7;
const REFRESH_TTL_SECONDS = REFRESH_TTL_DAYS * 24 * 60 * 60;
const ACCESS_TTL_SECONDS = 60 * 60;

const redisKey = {
  refresh: (hash: string) => `refresh:${hash}`,
  blacklist: (jti: string) => `blacklist:${jti}`,
  passwordReset: (token: string) => `pwd-reset:${token}`,
};

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personService: PersonService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly emailService: EmailService,
  ) {}

  async login(dto: LoginDto) {
    const person = await this.prisma.person.findUnique({
      where: { cpf: dto.cpf },
    });

    if (!person || !person.active) {
      this.logLoginFailure();
      throw new UnauthorizedException('CPF ou senha inválidos');
    }

    const passwordValid = await bcrypt.compare(dto.password, person.passwordHash);
    if (!passwordValid) {
      this.logLoginFailure();
      throw new UnauthorizedException('CPF ou senha inválidos');
    }

    const organizations = await this.personService.findOrganizations(person.id);

    if (organizations.length === 0) {
      throw new UnauthorizedException(
        'Nenhuma clínica vinculada a este usuário',
      );
    }

    const personData = {
      id: person.id,
      cpf: person.cpf,
      name: person.name,
      email: person.email,
    };

    if (organizations.length === 1) {
      const org = organizations[0];
      const tokens = await this.issueTokens(
        person.id,
        org.organization.id,
        org.role,
      );

      return {
        ...tokens,
        person: personData,
        organization: org.organization,
        role: org.role,
      };
    }

    return {
      accessToken: null,
      refreshToken: null,
      preAuthToken: this.issuePreAuthToken(person.id),
      person: personData,
      organizations,
    };
  }

  async selectOrganization(dto: SelectOrganizationDto) {
    const personId = this.verifyPreAuthToken(dto.preAuthToken);

    const link = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_personId: {
          organizationId: dto.organizationId,
          personId,
        },
      },
      include: {
        organization: true,
        person: {
          select: {
            id: true,
            cpf: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!link || !link.active) {
      throw new UnauthorizedException(
        'Vínculo inválido ou inativo',
      );
    }

    const tokens = await this.issueTokens(
      personId,
      dto.organizationId,
      link.role,
    );

    return {
      ...tokens,
      person: link.person,
      organization: link.organization,
      role: link.role,
    };
  }

  async switchOrganization(
    currentUser: JwtPayload,
    organizationId: string,
    refreshJti?: string,
    accessJti?: string,
  ) {
    const link = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_personId: {
          organizationId,
          personId: currentUser.sub,
        },
      },
      include: {
        organization: true,
        person: {
          select: {
            id: true,
            cpf: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!link || !link.active) {
      throw new UnauthorizedException('Vínculo inválido ou inativo');
    }

    if (refreshJti) {
      await this.revokeRefreshToken(refreshJti, accessJti);
    }

    const tokens = await this.issueTokens(currentUser.sub, organizationId, link.role);
    const organizations = await this.personService.findOrganizations(currentUser.sub);

    return {
      ...tokens,
      person: link.person,
      organization: link.organization,
      role: link.role,
      organizations,
    };
  }

  async getProfile(payload: JwtPayload) {
    const person = await this.prisma.person.findUnique({
      where: { id: payload.sub },
      select: { id: true, cpf: true, name: true, email: true, phone: true },
    });

    const orgUser = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_personId: {
          organizationId: payload.organizationId,
          personId: payload.sub,
        },
      },
      include: { organization: true },
    });

    return {
      person,
      organization: orgUser?.organization ?? null,
      role: payload.role,
    };
  }

  async updateProfile(payload: JwtPayload, dto: UpdateProfileDto) {
    if (dto.email) {
      const existing = await this.prisma.person.findFirst({
        where: { email: dto.email, NOT: { id: payload.sub } },
      });
      if (existing) {
        throw new ConflictException('Email já cadastrado');
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;

    return this.prisma.person.update({
      where: { id: payload.sub },
      data,
      select: { id: true, cpf: true, name: true, email: true, phone: true },
    });
  }

  async changePassword(payload: JwtPayload, dto: ChangePasswordDto) {
    const person = await this.prisma.person.findUnique({
      where: { id: payload.sub },
    });

    if (!person) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const valid = await bcrypt.compare(dto.currentPassword, person.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.person.update({
      where: { id: payload.sub },
      data: { passwordHash },
    });

    return { message: 'Senha alterada com sucesso' };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const person = await this.prisma.person.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, active: true },
    });

    if (!person || !person.active) {
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const appUrl = this.config.getOrThrow<string>('APP_URL');
    const resetUrl = `${appUrl}/redefinir-senha?token=${token}`;

    await this.redis.set(redisKey.passwordReset(token), person.id, 1800);
    await this.emailService.sendPasswordReset(person.email, person.name, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const personId = await this.redis.get(redisKey.passwordReset(token));

    if (!personId) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.person.update({
      where: { id: personId },
      data: { passwordHash },
    });
    await this.redis.del(redisKey.passwordReset(token));
  }

  async rotateRefreshToken(
    personId: string,
    organizationId: string,
    jti: string,
  ): Promise<IssuedTokens> {
    const tokenHash = this.hashJti(jti);
    const storedPersonId = await this.redis.get(redisKey.refresh(tokenHash));

    if (!storedPersonId || storedPersonId !== personId) {
      this.logRefreshFailure(personId, 'invalid_token');
      throw new UnauthorizedException('Refresh token inválido');
    }

    const link = await this.prisma.organizationUser.findUnique({
      where: { organizationId_personId: { organizationId, personId } },
      select: { active: true, role: true, person: { select: { active: true } } },
    });
    if (!link || !link.active || !link.person.active) {
      await this.redis.del(redisKey.refresh(tokenHash));
      this.logRefreshFailure(personId, 'inactive_link');
      throw new UnauthorizedException('Vínculo inválido ou inativo');
    }

    // Revoke the consumed token before issuing the next one (rotation)
    await this.redis.del(redisKey.refresh(tokenHash));

    return this.issueTokens(personId, organizationId, link.role);
  }

  async revokeRefreshToken(jti: string, accessJti?: string): Promise<void> {
    const tokenHash = this.hashJti(jti);
    await this.redis.del(redisKey.refresh(tokenHash));

    if (accessJti) {
      await this.redis.set(redisKey.blacklist(accessJti), '1', ACCESS_TTL_SECONDS);
    }
  }

  async isAccessTokenRevoked(jti: string): Promise<boolean> {
    return this.redis.exists(redisKey.blacklist(jti));
  }

  private issuePreAuthToken(personId: string): string {
    return this.jwtService.sign({ sub: personId, type: 'pre-auth' }, { expiresIn: '5m' });
  }

  private verifyPreAuthToken(token: string): string {
    try {
      const payload = this.jwtService.verify<{ sub?: string; type?: string }>(token);
      if (!payload.sub || payload.type !== 'pre-auth') {
        throw new UnauthorizedException('Token de pré-autenticação inválido');
      }
      return payload.sub;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Token de pré-autenticação inválido ou expirado');
    }
  }

  private async issueTokens(
    personId: string,
    organizationId: string,
    role: string,
  ): Promise<IssuedTokens> {
    const jti = crypto.randomUUID();
    const accessJti = crypto.randomUUID();

    const accessPayload = { sub: personId, organizationId, role, jti: accessJti };
    const accessToken = this.jwtService.sign(accessPayload, { expiresIn: '15m' });

    const refreshPayload: JwtRefreshPayload = {
      sub: personId,
      organizationId,
      role,
      jti,
      type: 'refresh',
    };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: `${REFRESH_TTL_DAYS}d`,
    });

    await this.redis.set(
      redisKey.refresh(this.hashJti(jti)),
      personId,
      REFRESH_TTL_SECONDS,
    );

    return { accessToken, refreshToken };
  }

  private hashJti(jti: string): string {
    return crypto.createHash('sha256').update(jti).digest('hex');
  }

  private logLoginFailure(): void {
    Sentry.addBreadcrumb({ category: 'auth', message: 'login failed', level: 'warning' });
    Sentry.logger.warn('login failed');
  }

  private logRefreshFailure(personId: string, reason: string): void {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: `refresh rejected: ${reason}`,
      level: 'warning',
      data: { personId },
    });
    Sentry.logger.warn(`refresh rejected: ${reason}`, { personId });
  }
}
