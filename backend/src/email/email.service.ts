import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly passwordResetTemplateId: string;
  private readonly patientInviteTemplateId: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(config.getOrThrow<string>('RESEND_API_KEY'));
    this.from = config.getOrThrow<string>('RESEND_FROM');
    this.passwordResetTemplateId = config.getOrThrow<string>('RESEND_TEMPLATE_PASSWORD_RESET_ID');
    this.patientInviteTemplateId = config.getOrThrow<string>('RESEND_TEMPLATE_PATIENT_INVITE_ID');
  }

  async sendPasswordReset(to: string, name: string, resetUrl: string): Promise<void> {
    const firstName = name.split(' ')[0];
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      template: {
        id: this.passwordResetTemplateId,
        variables: {
          first_name: firstName,
          company_name: 'Sou Pelvi',
          reset_password_url: resetUrl,
        },
      },
    });

    if (error) {
      this.logger.error('Falha ao enviar e-mail de reset de senha', error);
    }
  }

  async sendPatientInvite(
    to: string,
    patientName: string,
    organizationName: string,
    activateUrl: string,
  ): Promise<void> {
    const firstName = patientName.split(' ')[0];
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      template: {
        id: this.patientInviteTemplateId,
        variables: {
          first_name: firstName,
          company_name: 'Sou Pelvi',
          organization_name: organizationName,
          activate_url: activateUrl,
        },
      },
    });

    if (error) {
      this.logger.error('Falha ao enviar e-mail de convite da paciente', error);
    }
  }
}
