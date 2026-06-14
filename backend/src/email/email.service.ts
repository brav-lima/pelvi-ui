import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(config.getOrThrow<string>('RESEND_API_KEY'));
    this.from = config.getOrThrow<string>('RESEND_FROM');
  }

  async sendPasswordReset(to: string, name: string, resetUrl: string): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Redefinição de senha — Pelvi',
      html: `
        <p>Olá, ${name}!</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta no Pelvi.</p>
        <p><a href="${resetUrl}">Clique aqui para redefinir sua senha</a></p>
        <p>O link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail.</p>
        <p>Equipe Pelvi</p>
      `,
    });

    if (error) {
      this.logger.error('Falha ao enviar e-mail de reset de senha', error);
    }
  }
}
