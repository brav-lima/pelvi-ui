import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const sendMock = jest.fn().mockResolvedValue({ error: null });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;
  let config: { getOrThrow: jest.Mock };

  beforeEach(async () => {
    sendMock.mockClear();
    config = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          RESEND_API_KEY: 'resend-key',
          RESEND_FROM: 'contato@soupelvi.com',
          RESEND_TEMPLATE_PASSWORD_RESET_ID: 'tpl-reset',
          RESEND_TEMPLATE_PATIENT_INVITE_ID: 'tpl-invite',
        };
        return values[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: ConfigService, useValue: config }],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('envia o convite com o template e as variáveis corretas', async () => {
    await service.sendPatientInvite(
      'paciente@email.com',
      'Maria Silva',
      'Clínica A',
      'https://app.soupelvi.com/paciente/ativar-conta?token=abc',
    );

    expect(sendMock).toHaveBeenCalledWith({
      from: 'contato@soupelvi.com',
      to: 'paciente@email.com',
      template: {
        id: 'tpl-invite',
        variables: {
          first_name: 'Maria',
          company_name: 'Sou Pelvi',
          organization_name: 'Clínica A',
          activate_url: 'https://app.soupelvi.com/paciente/ativar-conta?token=abc',
        },
      },
    });
  });
});
