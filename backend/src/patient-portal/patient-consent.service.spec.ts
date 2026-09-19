import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PatientConsentService } from './patient-consent.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';

describe('PatientConsentService', () => {
  let service: PatientConsentService;
  let links: { findById: jest.Mock; updateStatus: jest.Mock };
  let audits: { record: jest.Mock };

  beforeEach(async () => {
    links = { findById: jest.fn(), updateStatus: jest.fn().mockResolvedValue({}) };
    audits = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientConsentService,
        { provide: PatientAccountLinkService, useValue: links },
        { provide: PatientConsentAuditService, useValue: audits },
      ],
    }).compile();

    service = module.get<PatientConsentService>(PatientConsentService);
  });

  describe('accept', () => {
    it('rejeita quando o vínculo não existe ou é de outra conta', async () => {
      links.findById.mockResolvedValue({ id: 'link-1', patientAccountId: 'outra-conta', status: 'PENDING_CONSENT' });

      await expect(service.accept('acc-1', 'link-1')).rejects.toThrow(NotFoundException);
    });

    it('rejeita quando o vínculo não está pendente', async () => {
      links.findById.mockResolvedValue({ id: 'link-1', patientAccountId: 'acc-1', status: 'ACTIVE' });

      await expect(service.accept('acc-1', 'link-1')).rejects.toThrow(ConflictException);
    });

    it('ativa o vínculo e grava audit ACCEPTED', async () => {
      links.findById.mockResolvedValue({ id: 'link-1', patientAccountId: 'acc-1', status: 'PENDING_CONSENT' });

      await service.accept('acc-1', 'link-1');

      expect(links.updateStatus).toHaveBeenCalledWith('link-1', 'ACTIVE', expect.any(Date));
      expect(audits.record).toHaveBeenCalledWith({
        patientAccountLinkId: 'link-1', action: 'ACCEPTED', actorType: 'PATIENT', actorId: 'acc-1',
      });
    });
  });

  describe('decline', () => {
    it('recusa o vínculo e grava audit DECLINED', async () => {
      links.findById.mockResolvedValue({ id: 'link-1', patientAccountId: 'acc-1', status: 'PENDING_CONSENT' });

      await service.decline('acc-1', 'link-1');

      expect(links.updateStatus).toHaveBeenCalledWith('link-1', 'DECLINED');
      expect(audits.record).toHaveBeenCalledWith({
        patientAccountLinkId: 'link-1', action: 'DECLINED', actorType: 'PATIENT', actorId: 'acc-1',
      });
    });
  });
});
