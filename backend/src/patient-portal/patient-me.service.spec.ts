import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PatientMeService } from './patient-me.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientLookupService } from '../patient/patient-lookup.service';
import { AppointmentLookupService } from '../appointment/appointment-lookup.service';

describe('PatientMeService', () => {
  let service: PatientMeService;
  let links: { findAllByAccountId: jest.Mock };
  let patientLookup: { findById: jest.Mock };
  let appointmentLookup: { findUpcomingByPatientId: jest.Mock };

  beforeEach(async () => {
    links = { findAllByAccountId: jest.fn() };
    patientLookup = { findById: jest.fn() };
    appointmentLookup = { findUpcomingByPatientId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientMeService,
        { provide: PatientAccountLinkService, useValue: links },
        { provide: PatientLookupService, useValue: patientLookup },
        { provide: AppointmentLookupService, useValue: appointmentLookup },
      ],
    }).compile();

    service = module.get<PatientMeService>(PatientMeService);
  });

  describe('getFicha', () => {
    it('rejeita quando o patientId não corresponde a nenhum vínculo ativo da conta', async () => {
      links.findAllByAccountId.mockResolvedValue([
        { id: 'link-1', patientId: 'patient-1', organizationId: 'org-1', status: 'ACTIVE' },
      ]);
      patientLookup.findById.mockResolvedValue({
        id: 'patient-1', name: 'Maria', cpf: '12345678901', phone: null, birthDate: null, organizationName: 'Clínica A',
      });

      await expect(service.getFicha('acc-1', 'patient-outro')).rejects.toThrow(NotFoundException);
    });

    it('retorna nome, CPF mascarado e as clínicas com vínculo ativo', async () => {
      links.findAllByAccountId.mockResolvedValue([
        { id: 'link-1', patientId: 'patient-1', organizationId: 'org-1', status: 'ACTIVE' },
        { id: 'link-2', patientId: 'patient-2', organizationId: 'org-2', status: 'PENDING_CONSENT' },
      ]);
      patientLookup.findById.mockImplementation((patientId: string) =>
        Promise.resolve(
          patientId === 'patient-1'
            ? { id: 'patient-1', name: 'Maria Silva', cpf: '12345678901', phone: '11999998888', birthDate: new Date('1990-01-01'), organizationName: 'Clínica A' }
            : null,
        ),
      );

      const result = await service.getFicha('acc-1', 'patient-1');

      expect(result).toEqual({
        name: 'Maria Silva',
        cpfMasked: '123.***.***-01',
        phone: '11999998888',
        birthDate: new Date('1990-01-01'),
        clinics: [{ organizationId: 'org-1', organizationName: 'Clínica A' }],
      });
    });
  });

  describe('getAppointments', () => {
    it('delega para o AppointmentLookupService', async () => {
      appointmentLookup.findUpcomingByPatientId.mockResolvedValue([{ id: 'appt-1' }]);

      const result = await service.getAppointments('org-1', 'patient-1');

      expect(result).toEqual([{ id: 'appt-1' }]);
      expect(appointmentLookup.findUpcomingByPatientId).toHaveBeenCalledWith('org-1', 'patient-1');
    });
  });
});
