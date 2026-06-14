import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly passwordResetTemplateId: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(config.getOrThrow<string>('RESEND_API_KEY'));
    this.from = config.getOrThrow<string>('RESEND_FROM');
    this.passwordResetTemplateId = config.getOrThrow<string>('RESEND_TEMPLATE_PASSWORD_RESET_ID');
  }

  async sendPasswordReset(to: string, name: string, resetUrl: string): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      templateId: this.passwordResetTemplateId,
      variables: {
        name,
        reset_url: resetUrl,
      },
    });

    if (error) {
      this.logger.error('Falha ao enviar e-mail de reset de senha', error);
    }
  }
}
