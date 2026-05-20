import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { AppointmentService } from './appointment.service';
import { PrismaService } from '../prisma/prisma.service';
import { TreatmentPackageService } from '../treatment-package/treatment-package.service';
import { RedisService } from '../redis/redis.service';
import { REMINDER_QUEUE } from '../queue/jobs/reminder.job';

describe('AppointmentService', () => {
  let service: AppointmentService;
  let prisma: { appointment: any; procedure: any; treatmentPackage: any; $transaction: jest.Mock };

  const orgId = 'org-1';

  const treatmentPackageService = {
    incrementUsedSessions: jest.fn(),
    decrementUsedSessions: jest.fn(),
  };

  const redisService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false),
    setJson: jest.fn().mockResolvedValue(undefined),
    getJson: jest.fn().mockResolvedValue(null),
    deleteByPattern: jest.fn().mockResolvedValue(undefined),
  };

  const reminderQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    getJob: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const appointmentMock = {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    prisma = {
      appointment: appointmentMock,
      procedure: {
        findFirst: jest.fn(),
      },
      treatmentPackage: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((fn, _opts?) => fn({ appointment: appointmentMock })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: TreatmentPackageService, useValue: treatmentPackageService },
        { provide: RedisService, useValue: redisService },
        { provide: getQueueToken(REMINDER_QUEUE), useValue: reminderQueue },
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

  describe('create (com treatment package)', () => {
    const mockProcedure = { id: 'proc-1', organizationId: orgId, durationMinutes: 60 };

    it('deve lançar NotFoundException quando pacote não pertence à organização', async () => {
      prisma.procedure.findFirst.mockResolvedValue(mockProcedure);
      prisma.treatmentPackage.findFirst.mockResolvedValue(null);

      await expect(
        service.create(orgId, {
          patientId: 'patient-1',
          professionalId: 'prof-1',
          procedureId: 'proc-1',
          startAt: '2025-06-15T09:00:00Z',
          treatmentPackageId: 'pkg-inexistente',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar BadRequestException quando pacote não está ativo', async () => {
      prisma.procedure.findFirst.mockResolvedValue(mockProcedure);
      prisma.treatmentPackage.findFirst.mockResolvedValue({
        id: 'pkg-1',
        status: 'COMPLETED',
        usedSessions: 10,
        totalSessions: 10,
        procedures: [],
      });

      await expect(
        service.create(orgId, {
          patientId: 'patient-1',
          professionalId: 'prof-1',
          procedureId: 'proc-1',
          startAt: '2025-06-15T09:00:00Z',
          treatmentPackageId: 'pkg-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException quando procedimento não faz parte do pacote', async () => {
      prisma.procedure.findFirst.mockResolvedValue(mockProcedure);
      prisma.treatmentPackage.findFirst.mockResolvedValue({
        id: 'pkg-1',
        status: 'ACTIVE',
        usedSessions: 0,
        totalSessions: 10,
        procedures: [{ procedureId: 'proc-outro' }], // não inclui proc-1
      });

      await expect(
        service.create(orgId, {
          patientId: 'patient-1',
          professionalId: 'prof-1',
          procedureId: 'proc-1',
          startAt: '2025-06-15T09:00:00Z',
          treatmentPackageId: 'pkg-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('deve retornar agendamento quando pertence à organização', async () => {
      const apt = { id: 'apt-1', organizationId: orgId };
      prisma.appointment.findFirst.mockResolvedValue(apt);

      const result = await service.findById(orgId, 'apt-1');

      expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'apt-1', organizationId: orgId }),
        }),
      );
      expect(result).toEqual(apt);
    });

    it('deve lançar NotFoundException quando não encontrado', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null);

      await expect(service.findById(orgId, 'apt-outro')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('deve atualizar agendamento sem recalcular horário quando startAt não muda', async () => {
      const existing = {
        id: 'apt-1',
        organizationId: orgId,
        startAt: new Date('2025-06-15T09:00:00Z'),
        endAt: new Date('2025-06-15T10:00:00Z'),
        procedureId: 'proc-1',
        professionalId: 'prof-1',
      };
      prisma.appointment.findFirst.mockResolvedValue(existing);
      prisma.appointment.update.mockResolvedValue({ ...existing, notes: 'Nova observação' });

      await service.update(orgId, 'apt-1', { notes: 'Nova observação' });

      expect(prisma.procedure.findFirst).not.toHaveBeenCalled();
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'apt-1' } }),
      );
    });

    it('deve recalcular endAt quando startAt é alterado', async () => {
      const existing = {
        id: 'apt-1',
        organizationId: orgId,
        startAt: new Date('2025-06-15T09:00:00Z'),
        endAt: new Date('2025-06-15T10:00:00Z'),
        procedureId: 'proc-1',
        professionalId: 'prof-1',
      };
      prisma.appointment.findFirst
        .mockResolvedValueOnce(existing)  // findById
        .mockResolvedValueOnce(null);     // checkConflict — sem conflito
      prisma.procedure.findFirst.mockResolvedValue({ id: 'proc-1', durationMinutes: 45 });
      prisma.appointment.update.mockResolvedValue({ id: 'apt-1' });

      await service.update(orgId, 'apt-1', { startAt: '2025-06-15T11:00:00Z' });

      const updateCall = prisma.appointment.update.mock.calls[0][0];
      expect(updateCall.data.startAt).toEqual(new Date('2025-06-15T11:00:00Z'));
      // endAt = 11:00 + 45min = 11:45
      expect(updateCall.data.endAt).toEqual(new Date('2025-06-15T11:45:00Z'));
    });
  });

  describe('remove', () => {
    it('deve aplicar soft delete quando pertence à organização', async () => {
      const existing = { id: 'apt-1', organizationId: orgId };
      prisma.appointment.findFirst.mockResolvedValue(existing);
      prisma.appointment.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

      await service.remove(orgId, 'apt-1');

      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'apt-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it('deve lançar NotFoundException antes de deletar quando não encontrado', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null);

      await expect(service.remove(orgId, 'apt-inexistente')).rejects.toThrow(NotFoundException);
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus (com treatment package)', () => {
    it('deve usar $transaction e incrementar sessões ao marcar como DONE', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        id: 'apt-1',
        organizationId: orgId,
        status: 'CONFIRMED',
        professionalId: 'prof-1',
        procedureId: 'proc-1',
        treatmentPackageId: 'pkg-1',
      });

      await service.updateStatus(orgId, 'apt-1', 'DONE' as any, 'user-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(treatmentPackageService.incrementUsedSessions).toHaveBeenCalledWith(
        orgId,
        'pkg-1',
        expect.anything(),
      );
    });

    it('deve decrementar sessões ao reverter de DONE para outro status', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        id: 'apt-1',
        organizationId: orgId,
        status: 'DONE',
        professionalId: 'prof-1',
        procedureId: 'proc-1',
        treatmentPackageId: 'pkg-1',
      });

      await service.updateStatus(orgId, 'apt-1', 'CONFIRMED' as any, 'user-1');

      expect(treatmentPackageService.decrementUsedSessions).toHaveBeenCalledWith(
        orgId,
        'pkg-1',
        expect.anything(),
      );
    });
  });
});
