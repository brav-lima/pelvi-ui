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
    // SDK v4 types don't include `template` yet — cast required
    const { error } = await (this.resend.emails.send as any)({
      from: this.from,
      to,
      template: {
        id: this.passwordResetTemplateId,
        variables: {
          name,
          reset_url: resetUrl,
        },
      },
    });

    if (error) {
      this.logger.error('Falha ao enviar e-mail de reset de senha', error);
    }
  }
}
