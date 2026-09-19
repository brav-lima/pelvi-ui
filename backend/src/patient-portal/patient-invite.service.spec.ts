import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PatientInviteService } from './patient-invite.service';
import { PatientLookupService } from '../patient/patient-lookup.service';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';
import { EmailService } from '../email/email.service';
import { RedisService } from '../redis/redis.service';

describe('PatientInviteService', () => {
  let service: PatientInviteService;
  let patientLookup: { findById: jest.Mock };
  let accounts: { findByCpf: jest.Mock; createPending: jest.Mock };
  let links: { findByPatientId: jest.Mock; findById: jest.Mock; create: jest.Mock; updateStatus: jest.Mock };
  let audits: { record: jest.Mock };
  let emailService: { sendPatientInvite: jest.Mock };
  let redis: { setJson: jest.Mock };
  let config: { getOrThrow: jest.Mock };

  beforeEach(async () => {
    patientLookup = { findById: jest.fn() };
    accounts = { findByCpf: jest.fn(), createPending: jest.fn() };
    links = {
      findByPatientId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
    };
    audits = { record: jest.fn() };
    emailService = { sendPatientInvite: jest.fn() };
    redis = { setJson: jest.fn() };
    config = { getOrThrow: jest.fn().mockReturnValue('https://app.soupelvi.com') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientInviteService,
        { provide: PatientLookupService, useValue: patientLookup },
        { provide: PatientAccountService, useValue: accounts },
        { provide: PatientAccountLinkService, useValue: links },
        { provide: PatientConsentAuditService, useValue: audits },
        { provide: EmailService, useValue: emailService },
        { provide: RedisService, useValue: redis },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<PatientInviteService>(PatientInviteService);
  });

  describe('invite', () => {
    const patient = {
      id: 'patient-1', name: 'Maria Silva', cpf: '12345678901', email: 'maria@email.com',
      phone: null, birthDate: null, organizationId: 'org-1', organizationName: 'Clínica A',
    };

    it('rejeita quando a paciente não existe ou não é da organização', async () => {
      patientLookup.findById.mockResolvedValue(null);

      await expect(service.invite('person-1', 'org-1', 'patient-1')).rejects.toThrow(NotFoundException);
    });

    it('rejeita quando a paciente não tem CPF', async () => {
      patientLookup.findById.mockResolvedValue({ ...patient, cpf: null });

      await expect(service.invite('person-1', 'org-1', 'patient-1')).rejects.toThrow(BadRequestException);
    });

    it('rejeita quando a paciente não tem e-mail e a conta ainda não existe', async () => {
      patientLookup.findById.mockResolvedValue({ ...patient, email: null });
      links.findByPatientId.mockResolvedValue(null);
      accounts.findByCpf.mockResolvedValue(null);

      await expect(service.invite('person-1', 'org-1', 'patient-1')).rejects.toThrow(BadRequestException);
    });

    it('rejeita quando já existe vínculo para esse registro de paciente', async () => {
      patientLookup.findById.mockResolvedValue(patient);
      links.findByPatientId.mockResolvedValue({ id: 'link-1' });

      await expect(service.invite('person-1', 'org-1', 'patient-1')).rejects.toThrow(ConflictException);
    });

    it('cria conta nova, vínculo e envia e-mail quando o CPF ainda não tem conta', async () => {
      patientLookup.findById.mockResolvedValue(patient);
      links.findByPatientId.mockResolvedValue(null);
      accounts.findByCpf.mockResolvedValue(null);
      accounts.createPending.mockResolvedValue({ id: 'acc-1', cpf: '12345678901' });
      links.create.mockResolvedValue({ id: 'link-1' });

      await service.invite('person-1', 'org-1', 'patient-1');

      expect(accounts.createPending).toHaveBeenCalledWith('12345678901');
      expect(links.create).toHaveBeenCalledWith({
        patientAccountId: 'acc-1', patientId: 'patient-1', organizationId: 'org-1',
      });
      expect(audits.record).toHaveBeenCalledWith({
        patientAccountLinkId: 'link-1', action: 'REQUESTED', actorType: 'PROFESSIONAL', actorId: 'person-1',
      });
      expect(redis.setJson).toHaveBeenCalledWith(
        expect.stringMatching(/^patient-invite:/),
        { patientAccountId: 'acc-1', linkId: 'link-1' },
        60 * 60 * 24 * 7,
      );
      expect(emailService.sendPatientInvite).toHaveBeenCalledWith(
        'maria@email.com', 'Maria Silva', 'Clínica A',
        expect.stringContaining('/paciente/ativar-conta?token='),
      );
    });

    it('cria só um novo vínculo, sem e-mail, quando o CPF já tem conta', async () => {
      patientLookup.findById.mockResolvedValue(patient);
      links.findByPatientId.mockResolvedValue(null);
      accounts.findByCpf.mockResolvedValue({ id: 'acc-existing', cpf: '12345678901' });
      links.create.mockResolvedValue({ id: 'link-2' });

      await service.invite('person-1', 'org-1', 'patient-1');

      expect(accounts.createPending).not.toHaveBeenCalled();
      expect(links.create).toHaveBeenCalledWith({
        patientAccountId: 'acc-existing', patientId: 'patient-1', organizationId: 'org-1',
      });
      expect(audits.record).toHaveBeenCalledWith({
        patientAccountLinkId: 'link-2', action: 'REQUESTED', actorType: 'PROFESSIONAL', actorId: 'person-1',
      });
      expect(emailService.sendPatientInvite).not.toHaveBeenCalled();
      expect(redis.setJson).not.toHaveBeenCalled();
    });
  });

  describe('resend', () => {
    it('rejeita quando o vínculo não existe ou é de outra organização', async () => {
      links.findById.mockResolvedValue(null);

      await expect(service.resend('person-1', 'org-1', 'link-1')).rejects.toThrow(NotFoundException);
    });

    it('rejeita quando o vínculo não está recusado', async () => {
      links.findById.mockResolvedValue({ id: 'link-1', organizationId: 'org-1', status: 'ACTIVE' });

      await expect(service.resend('person-1', 'org-1', 'link-1')).rejects.toThrow(ConflictException);
    });

    it('volta o vínculo para PENDING_CONSENT e grava audit RESENT', async () => {
      links.findById.mockResolvedValue({ id: 'link-1', organizationId: 'org-1', status: 'DECLINED' });

      await service.resend('person-1', 'org-1', 'link-1');

      expect(links.updateStatus).toHaveBeenCalledWith('link-1', 'PENDING_CONSENT');
      expect(audits.record).toHaveBeenCalledWith({
        patientAccountLinkId: 'link-1', action: 'RESENT', actorType: 'PROFESSIONAL', actorId: 'person-1',
      });
    });
  });
});
