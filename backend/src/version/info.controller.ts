import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';

// Exposição pública do controlador e DPO — LGPD Art. 41
@Public()
@Controller('info')
export class InfoController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  getInfo() {
    return {
      controller: {
        name: this.config.get('DPO_CONTROLLER_NAME', 'Pelvi Tecnologia Ltda'),
        cnpj: this.config.get<string>('DPO_CONTROLLER_CNPJ'),
      },
      dpo: {
        name: this.config.get<string>('DPO_NAME'),
        email: this.config.get<string>('DPO_EMAIL'),
      },
      privacyPolicyUrl: this.config.get<string>('PRIVACY_POLICY_URL'),
      termsUrl: this.config.get<string>('TERMS_URL'),
    };
  }
}
