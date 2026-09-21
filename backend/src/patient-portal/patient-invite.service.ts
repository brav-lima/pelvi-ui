import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PatientLookupService } from '../patient/patient-lookup.service';
import { EmailService } from '../email/email.service';
import { RedisService } from '../redis/redis.service';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';

const INVITE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

@Injectable()
export class PatientInviteService {
  constructor(
    private readonly patientLookup: PatientLookupService,
    private readonly accounts: PatientAccountService,
    private readonly links: PatientAccountLinkService,
    private readonly audits: PatientConsentAuditService,
    private readonly emailService: EmailService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async invite(actorPersonId: string, organizationId: string, patientId: string): Promise<void> {
    const patient = await this.patientLookup.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      throw new NotFoundException('Paciente não encontrada');
    }
    if (!patient.cpf) {
      throw new BadRequestException('Paciente não tem CPF cadastrado');
    }

    const existingLink = await this.links.findByPatientId(patientId);
    if (existingLink) {
      throw new ConflictException('Paciente já convidada');
    }

    const existingAccount = await this.accounts.findByCpf(patient.cpf);
    const isNewAccount = !existingAccount;
    if (isNewAccount && !patient.email) {
      throw new BadRequestException('Paciente não tem e-mail cadastrado');
    }

    const account = existingAccount ?? (await this.accounts.createPending(patient.cpf));
    const link = await this.links.create({
      patientAccountId: account.id,
      patientId,
      organizationId,
    });

    await this.audits.record({
      patientAccountLinkId: link.id,
      action: 'REQUESTED',
      actorType: 'PROFESSIONAL',
      actorId: actorPersonId,
    });

    if (isNewAccount) {
      await this.sendActivationEmail(
        account.id,
        link.id,
        patient.email as string,
        patient.name,
        patient.organizationName,
      );
    }
  }

  async resend(actorPersonId: string, organizationId: string, linkId: string): Promise<void> {
    const link = await this.links.findById(linkId);
    if (!link || link.organizationId !== organizationId) {
      throw new NotFoundException('Vínculo não encontrado');
    }

    if (link.status === 'DECLINED') {
      await this.links.updateStatus(linkId, 'PENDING_CONSENT');
      await this.audits.record({
        patientAccountLinkId: linkId,
        action: 'RESENT',
        actorType: 'PROFESSIONAL',
        actorId: actorPersonId,
      });
      return;
    }

    if (link.status === 'PENDING_CONSENT') {
      const account = await this.accounts.findById(link.patientAccountId);
      if (!account || account.activatedAt) {
        throw new ConflictException('Não há convite por e-mail pendente para reenviar');
      }

      const patient = await this.patientLookup.findById(link.patientId);
      if (!patient || !patient.email) {
        throw new BadRequestException('Paciente não tem e-mail cadastrado');
      }

      await this.sendActivationEmail(
        account.id,
        link.id,
        patient.email,
        patient.name,
        patient.organizationName,
      );
      await this.audits.record({
        patientAccountLinkId: linkId,
        action: 'RESENT',
        actorType: 'PROFESSIONAL',
        actorId: actorPersonId,
      });
      return;
    }

    throw new ConflictException('Só é possível reenviar um convite pendente ou recusado');
  }

  private async sendActivationEmail(
    patientAccountId: string,
    linkId: string,
    email: string,
    patientName: string,
    organizationName: string,
  ): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.redis.setJson(
      `patient-invite:${token}`,
      { patientAccountId, linkId },
      INVITE_TOKEN_TTL_SECONDS,
    );
    const appUrl = this.config.getOrThrow<string>('APP_URL');
    const activateUrl = `${appUrl}/paciente/ativar-conta?token=${token}`;
    await this.emailService.sendPatientInvite(email, patientName, organizationName, activateUrl);
  }
}
