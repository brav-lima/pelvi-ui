import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { PrismaService } from '../prisma/prisma.service';
import { TreatmentPackageService } from '../treatment-package/treatment-package.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('AppointmentService', () => {
  let service: AppointmentService;
  let prisma: { appointment: any; procedure: any };

  const orgId = 'org-1';

  const treatmentPackageService = {
    incrementUsedSessions: jest.fn(),
    decrementUsedSessions: jest.fn(),
  };

  const notificationsService = {
    sendWhatsApp: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    prisma = {
      appointment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      procedure: {
        findFirst: jest.fn(),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          settings: { whatsappNotificationsEnabled: true },
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: TreatmentPackageService, useValue: treatmentPackageService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
  });

  describe('create', () => {
    const mockProcedure = {
      id: 'proc-1',
      organizationId: orgId,
      durationMinutes: 60,
    };

    it('deve calcular endAt com base na duração do procedimento', async () => {
      prisma.procedure.findFirst.mockResolvedValue(mockProcedure);
      prisma.appointment.findFirst.mockResolvedValue(null); // sem conflito
      prisma.appointment.create.mockResolvedValue({
        id: 'apt-1',
        startAt: new Date('2025-06-15T09:00:00Z'),
        endAt: new Date('2025-06-15T10:00:00Z'),
      });

      await service.create(orgId, {
        patientId: 'patient-1',
        professionalId: 'prof-1',
        procedureId: 'proc-1',
        startAt: '2025-06-15T09:00:00Z',
      });

      expect(prisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startAt: new Date('2025-06-15T09:00:00Z'),
            endAt: new Date('2025-06-15T10:00:00Z'),
          }),
        }),
      );
    });

    it('deve rejeitar quando há conflito de horário', async () => {
      prisma.procedure.findFirst.mockResolvedValue(mockProcedure);
      prisma.appointment.findFirst.mockResolvedValue({
        id: 'existing-apt',
        startAt: new Date('2025-06-15T09:30:00Z'),
        endAt: new Date('2025-06-15T10:30:00Z'),
      });

      await expect(
        service.create(orgId, {
          patientId: 'patient-1',
          professionalId: 'prof-1',
          procedureId: 'proc-1',
          startAt: '2025-06-15T09:00:00Z',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('deve permitir agendamento sem conflito', async () => {
      prisma.procedure.findFirst.mockResolvedValue(mockProcedure);
      prisma.appointment.findFirst.mockResolvedValue(null);
      prisma.appointment.create.mockResolvedValue({ id: 'apt-1' });

      await expect(
        service.create(orgId, {
          patientId: 'patient-1',
          professionalId: 'prof-1',
          procedureId: 'proc-1',
          startAt: '2025-06-15T11:00:00Z',
        }),
      ).resolves.toBeDefined();
    });

    it('deve rejeitar quando procedimento não pertence à organização', async () => {
      prisma.procedure.findFirst.mockResolvedValue(null);

      await expect(
        service.create(orgId, {
          patientId: 'patient-1',
          professionalId: 'prof-1',
          procedureId: 'proc-outro',
          startAt: '2025-06-15T09:00:00Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('deve alterar o status do agendamento', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        id: 'apt-1',
        organizationId: orgId,
        status: 'SCHEDULED',
        professionalId: 'prof-1',
        procedureId: 'proc-1',
      });
      prisma.appointment.update.mockResolvedValue({
        id: 'apt-1',
        status: 'CONFIRMED',
      });

      const result = await service.updateStatus(
        orgId,
        'apt-1',
        'CONFIRMED' as any,
        'user-1',
      );

      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'apt-1' },
          data: { status: 'CONFIRMED' },
        }),
      );
    });

    it('deve rejeitar quando agendamento não existe', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus(orgId, 'inexistente', 'DONE' as any, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll (agenda)', () => {
    it('deve filtrar por intervalo de datas e organizationId', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      await service.findAll(orgId, {
        startDate: '2025-06-15',
        endDate: '2025-06-21',
      });

      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            startAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
          orderBy: { startAt: 'asc' },
        }),
      );
    });

    it('deve filtrar por profissional quando informado', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      await service.findAll(orgId, {
        startDate: '2025-06-15',
        endDate: '2025-06-21',
        professionalId: 'prof-1',
      });

      const callArgs = prisma.appointment.findMany.mock.calls[0][0];
      expect(callArgs.where.professionalId).toBe('prof-1');
    });
  });
});
