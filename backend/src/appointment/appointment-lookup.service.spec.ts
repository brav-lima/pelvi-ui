import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentLookupService } from './appointment-lookup.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AppointmentLookupService', () => {
  let service: AppointmentLookupService;
  let prisma: { appointment: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { appointment: { findMany: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentLookupService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AppointmentLookupService>(AppointmentLookupService);
  });

  it('retorna as consultas da paciente com o nome do procedimento', async () => {
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: 'appt-1',
        startAt: new Date('2026-10-01T10:00:00Z'),
        endAt: new Date('2026-10-01T10:50:00Z'),
        status: 'SCHEDULED',
        procedure: { name: 'Fisioterapia pélvica' },
      },
    ]);

    const result = await service.findUpcomingByPatientId('org-1', 'patient-1');

    expect(result).toEqual([
      {
        id: 'appt-1',
        startAt: new Date('2026-10-01T10:00:00Z'),
        endAt: new Date('2026-10-01T10:50:00Z'),
        status: 'SCHEDULED',
        procedureName: 'Fisioterapia pélvica',
      },
    ]);
    expect(prisma.appointment.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', patientId: 'patient-1', deletedAt: null },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        procedure: { select: { name: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  });
});
