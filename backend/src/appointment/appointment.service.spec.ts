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
  let prisma: {
    appointment: any;
    procedure: any;
    treatmentPackage: any;
    patient: any;
    organizationUser: any;
    $transaction: jest.Mock;
  };

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
        findMany: jest.fn(),
      },
      treatmentPackage: {
        findFirst: jest.fn(),
      },
      patient: {
        findFirst: jest.fn().mockResolvedValue({ id: 'patient-1' }),
      },
      organizationUser: {
        findFirst: jest.fn().mockResolvedValue({ id: 'prof-1' }),
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

  describe('updateRecurrenceForward', () => {
    it('updates target and all following siblings', async () => {
      const target = {
        id: 'apt-2',
        organizationId: 'org-1',
        recurrenceGroupId: 'grp-1',
        recurrenceIndex: 2,
        procedureId: 'proc-1',
        startAt: new Date('2026-07-03T10:00:00Z'),
        patientId: 'pat-1',
        deletedAt: null,
      };
      const sibling = {
        id: 'apt-3',
        organizationId: 'org-1',
        recurrenceGroupId: 'grp-1',
        recurrenceIndex: 3,
        procedureId: 'proc-1',
        startAt: new Date('2026-07-04T10:00:00Z'),
        patientId: 'pat-1',
        deletedAt: null,
      };
      const procedure = { id: 'proc-1', durationMinutes: 30 };

      prisma.appointment.findFirst = jest.fn().mockResolvedValue(target);
      prisma.procedure.findFirst = jest.fn().mockResolvedValue(procedure);
      prisma.appointment.findMany = jest.fn().mockResolvedValue([target, sibling]);

      const updated = [
        { ...target, notes: 'novo' },
        { ...sibling, notes: 'novo' },
      ];
      const txMock = {
        appointment: {
          findFirst: jest.fn().mockResolvedValue(null), // no conflict
          update: jest.fn()
            .mockResolvedValueOnce(updated[0])
            .mockResolvedValueOnce(updated[1]),
        },
      };
      prisma.$transaction = jest.fn().mockImplementation(async (fn) => fn(txMock));

      const result = await service.updateRecurrenceForward('org-1', 'apt-2', { notes: 'novo' });

      expect(result).toHaveLength(2);
      expect(txMock.appointment.update).toHaveBeenCalledTimes(2);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          recurrenceGroupId: 'grp-1',
          recurrenceIndex: { gte: 2 },
        }),
      }));
    });

    it('throws BadRequestException if appointment has no recurrenceGroupId', async () => {
      prisma.appointment.findFirst = jest.fn().mockResolvedValue({
        id: 'apt-1',
        organizationId: 'org-1',
        recurrenceGroupId: null,
        procedureId: 'proc-1',
        startAt: new Date(),
        deletedAt: null,
      });

      await expect(
        service.updateRecurrenceForward('org-1', 'apt-1', { notes: 'test' })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus — CANCELED with package', () => {
    const existing = {
      id: 'apt-1',
      organizationId: 'org-1',
      treatmentPackageId: 'pkg-1',
      status: 'SCHEDULED',
      patientId: 'pat-1',
      startAt: new Date(),
    };

    beforeEach(() => {
      prisma.appointment.findFirst = jest.fn().mockResolvedValue(existing);
    });

    it('does NOT decrement sessions on CANCELED when deductFromPackage is false', async () => {
      const txMock = {
        appointment: { update: jest.fn().mockResolvedValue({ ...existing, status: 'CANCELED' }) },
      };
      prisma.$transaction = jest.fn().mockImplementation(async (fn) => fn(txMock));
      const incrementSpy = jest.spyOn(treatmentPackageService, 'incrementUsedSessions').mockResolvedValue(undefined as any);

      await service.updateStatus('org-1', 'apt-1', 'CANCELED' as any, 'user-1', false);

      expect(incrementSpy).not.toHaveBeenCalled();
    });

    it('decrements sessions on CANCELED when deductFromPackage is true', async () => {
      const txMock = {
        appointment: { update: jest.fn().mockResolvedValue({ ...existing, status: 'CANCELED' }) },
      };
      prisma.$transaction = jest.fn().mockImplementation(async (fn) => fn(txMock));
      const incrementSpy = jest.spyOn(treatmentPackageService, 'incrementUsedSessions').mockResolvedValue(undefined as any);

      await service.updateStatus('org-1', 'apt-1', 'CANCELED' as any, 'user-1', true);

      expect(incrementSpy).toHaveBeenCalledWith('org-1', 'pkg-1', txMock);
    });
  });

  describe('createBulk', () => {
    it('creates multiple appointments atomically', async () => {
      const procedure = { id: 'proc-1', durationMinutes: 30 };
      prisma.procedure.findMany = jest.fn().mockResolvedValue([procedure]);
      prisma.treatmentPackage.findFirst = jest.fn().mockResolvedValue(null);

      const createdApts = [
        { id: 'apt-0', recurrenceGroupId: 'grp-1', recurrenceIndex: 0 },
        { id: 'apt-1', recurrenceGroupId: 'grp-1', recurrenceIndex: 1 },
      ];
      const txMock = {
        appointment: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn()
            .mockResolvedValueOnce(createdApts[0])
            .mockResolvedValueOnce(createdApts[1]),
        },
      };
      prisma.$transaction = jest.fn().mockImplementation(async (fn) => fn(txMock));

      const result = await service.createBulk('org-1', {
        recurrenceGroupId: 'grp-1',
        appointments: [
          { patientId: 'pat-1', professionalId: 'prof-1', procedureId: 'proc-1', startAt: '2026-07-01T10:00:00Z', recurrenceIndex: 0 },
          { patientId: 'pat-1', professionalId: 'prof-1', procedureId: 'proc-1', startAt: '2026-07-02T10:00:00Z', recurrenceIndex: 1 },
        ],
      });

      expect(result).toHaveLength(2);
      expect(txMock.appointment.create).toHaveBeenCalledTimes(2);
      expect(txMock.appointment.create).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ data: expect.objectContaining({ recurrenceGroupId: 'grp-1', recurrenceIndex: 0 }) })
      );
    });

    it('throws ConflictException when any slot has a conflict', async () => {
      const procedure = { id: 'proc-1', durationMinutes: 30 };
      prisma.procedure.findMany = jest.fn().mockResolvedValue([procedure]);
      prisma.treatmentPackage.findFirst = jest.fn().mockResolvedValue(null);

      const txMock = {
        appointment: {
          findFirst: jest.fn().mockResolvedValue({ id: 'conflict-id' }),
          create: jest.fn(),
        },
      };
      prisma.$transaction = jest.fn().mockImplementation(async (fn) => fn(txMock));

      await expect(
        service.createBulk('org-1', {
          recurrenceGroupId: 'grp-1',
          appointments: [
            { patientId: 'pat-1', professionalId: 'prof-1', procedureId: 'proc-1', startAt: '2026-07-01T10:00:00Z', recurrenceIndex: 0 },
          ],
        })
      ).rejects.toThrow(ConflictException);
      expect(txMock.appointment.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when procedure not found', async () => {
      prisma.procedure.findMany = jest.fn().mockResolvedValue([]);

      await expect(
        service.createBulk('org-1', {
          recurrenceGroupId: 'grp-1',
          appointments: [
            { patientId: 'pat-1', professionalId: 'prof-1', procedureId: 'proc-1', startAt: '2026-07-01T10:00:00Z', recurrenceIndex: 0 },
          ],
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll com Redis indisponível', () => {
    const query = { startDate: '2025-06-15', endDate: '2025-06-15' };
    const dbResult = [{ id: 'apt-1' }];

    afterEach(() => {
      redisService.getJson.mockResolvedValue(null);
      redisService.setJson.mockResolvedValue(undefined);
    });

    it('cai para o banco quando getJson falha (fail-open do cache)', async () => {
      redisService.getJson.mockRejectedValue(new Error('redis down'));
      redisService.setJson.mockRejectedValue(new Error('redis down'));
      prisma.appointment.findMany.mockResolvedValue(dbResult);

      await expect(service.findAll(orgId, query)).resolves.toEqual(dbResult);
    });

    it('não propaga falha do setJson após consultar o banco', async () => {
      redisService.getJson.mockResolvedValue(null);
      redisService.setJson.mockRejectedValue(new Error('redis down'));
      prisma.appointment.findMany.mockResolvedValue(dbResult);

      await expect(service.findAll(orgId, query)).resolves.toEqual(dbResult);
    });
  });

  describe('isolamento multi-tenant (patientId / professionalId)', () => {
    const mockProcedure = { id: 'proc-1', organizationId: orgId, durationMinutes: 60 };
    const baseDto = {
      patientId: 'patient-1',
      professionalId: 'prof-1',
      procedureId: 'proc-1',
      startAt: '2025-06-15T09:00:00Z',
    };

    it('create rejeita patientId que não pertence à org', async () => {
      prisma.procedure.findFirst.mockResolvedValue(mockProcedure);
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(service.create(orgId, baseDto)).rejects.toThrow(NotFoundException);
      expect(prisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'patient-1', organizationId: orgId }),
        }),
      );
      expect(prisma.appointment.create).not.toHaveBeenCalled();
    });

    it('create rejeita professionalId que não pertence à org', async () => {
      prisma.procedure.findFirst.mockResolvedValue(mockProcedure);
      prisma.organizationUser.findFirst.mockResolvedValue(null);

      await expect(service.create(orgId, baseDto)).rejects.toThrow(NotFoundException);
      expect(prisma.organizationUser.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'prof-1', organizationId: orgId }),
        }),
      );
      expect(prisma.appointment.create).not.toHaveBeenCalled();
    });

    it('update rejeita professionalId que não pertence à org', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        id: 'apt-1',
        organizationId: orgId,
        patientId: 'patient-1',
        professionalId: 'prof-1',
        procedureId: 'proc-1',
        startAt: new Date('2025-06-15T09:00:00Z'),
      });
      prisma.organizationUser.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, 'apt-1', { professionalId: 'prof-outra-org' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    it('update rejeita patientId que não pertence à org', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        id: 'apt-1',
        organizationId: orgId,
        patientId: 'patient-1',
        professionalId: 'prof-1',
        procedureId: 'proc-1',
        startAt: new Date('2025-06-15T09:00:00Z'),
      });
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, 'apt-1', { patientId: 'patient-outra-org' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    it('createBulk rejeita patientId que não pertence à org', async () => {
      prisma.procedure.findMany.mockResolvedValue([mockProcedure]);
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.createBulk(orgId, {
          recurrenceGroupId: 'grp-1',
          appointments: [
            {
              patientId: 'patient-outra-org',
              professionalId: 'prof-1',
              procedureId: 'proc-1',
              startAt: '2026-07-01T10:00:00Z',
              recurrenceIndex: 0,
            },
          ],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
