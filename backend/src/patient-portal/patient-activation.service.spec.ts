import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PatientActivationService } from './patient-activation.service';
import { RedisService } from '../redis/redis.service';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';

describe('PatientActivationService', () => {
  let service: PatientActivationService;
  let redis: { getJson: jest.Mock; del: jest.Mock };
  let accounts: { activate: jest.Mock };
  let links: { updateStatus: jest.Mock };
  let audits: { record: jest.Mock };

  beforeEach(async () => {
    redis = { getJson: jest.fn(), del: jest.fn() };
    accounts = { activate: jest.fn().mockResolvedValue({}) };
    links = { updateStatus: jest.fn().mockResolvedValue({}) };
    audits = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientActivationService,
        { provide: RedisService, useValue: redis },
        { provide: PatientAccountService, useValue: accounts },
        { provide: PatientAccountLinkService, useValue: links },
        { provide: PatientConsentAuditService, useValue: audits },
      ],
    }).compile();

    service = module.get<PatientActivationService>(PatientActivationService);
  });

  it('rejeita token inválido ou expirado', async () => {
    redis.getJson.mockResolvedValue(null);

    await expect(service.activate('bad-token', 'novaSenha123')).rejects.toThrow(BadRequestException);
    expect(accounts.activate).not.toHaveBeenCalled();
  });

  it('ativa a conta, o vínculo, grava audit e apaga o token', async () => {
    redis.getJson.mockResolvedValue({ patientAccountId: 'acc-1', linkId: 'link-1' });

    await service.activate('good-token', 'novaSenha123');

    expect(accounts.activate).toHaveBeenCalledWith('acc-1', expect.any(String));
    expect(links.updateStatus).toHaveBeenCalledWith('link-1', 'ACTIVE', expect.any(Date));
    expect(audits.record).toHaveBeenCalledWith({
      patientAccountLinkId: 'link-1', action: 'ACCEPTED', actorType: 'PATIENT', actorId: 'acc-1',
    });
    expect(redis.del).toHaveBeenCalledWith('patient-invite:good-token');
  });
});
