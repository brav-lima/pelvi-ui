import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly client: Twilio.Twilio | null = null;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    this.from =
      this.config.get<string>('TWILIO_WHATSAPP_FROM') ??
      'whatsapp:+14155238886';

    this.enabled = !!(accountSid && authToken);

    if (this.enabled) {
      this.client = Twilio(accountSid, authToken);
    } else {
      this.logger.warn(
        'Twilio credentials not configured — WhatsApp notifications disabled',
      );
    }
  }

  async sendWhatsApp(to: string, message: string): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    const normalized = this.normalizePhone(to);
    if (!normalized) {
      this.logger.warn(`Invalid or missing phone number: "${to}" — skipping`);
      return;
    }

    try {
      await this.client.messages.create({
        from: this.from,
        to: `whatsapp:${normalized}`,
        body: message,
      });
      this.logger.log(`WhatsApp sent to ${normalized}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown Twilio error';
      this.logger.error(`Failed to send WhatsApp to ${normalized}: ${message}`);
    }
  }

  private normalizePhone(phone: string | null | undefined): string | null {
    if (!phone) return null;

    // Strip everything except digits and leading +
    const digits = phone.replace(/[^\d+]/g, '');

    // Must have at least 10 digits
    const onlyDigits = digits.replace(/\D/g, '');
    if (onlyDigits.length < 10) return null;

    // If already starts with +, return as-is
    if (digits.startsWith('+')) return digits;

    // Brazilian numbers: add +55 country code
    return `+55${onlyDigits}`;
  }
}
