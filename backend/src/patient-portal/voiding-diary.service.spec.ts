import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VoidingDiaryService } from './voiding-diary.service';
import { PrismaService } from '../prisma/prisma.service';

describe('VoidingDiaryService', () => {
  let service: VoidingDiaryService;
  let prisma: {
    voidingDiaryEntry: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      voidingDiaryEntry: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [VoidingDiaryService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<VoidingDiaryService>(VoidingDiaryService);
  });

  describe('create', () => {
    it('cria o registro escopado por organização e paciente', async () => {
      const recordedAt = new Date('2026-09-20T10:00:00.000Z');
      prisma.voidingDiaryEntry.create.mockResolvedValue({ id: 'entry-1' });

      const result = await service.create('org-1', 'patient-1', {
        recordedAt,
        urineVolumeMl: 250,
        voidingDurationSeconds: 30,
        fluidIntakeMl: null,
        hadLeakage: false,
        leakageAmount: null,
        changedPad: false,
      });

      expect(prisma.voidingDiaryEntry.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          patientId: 'patient-1',
          recordedAt,
          urineVolumeMl: 250,
          voidingDurationSeconds: 30,
          fluidIntakeMl: null,
          hadLeakage: false,
          leakageAmount: null,
          changedPad: false,
        },
      });
      expect(result).toEqual({ id: 'entry-1' });
    });
  });

  describe('findAllForPatient', () => {
    it('lista os registros não excluídos, ordenados por horário', async () => {
      prisma.voidingDiaryEntry.findMany.mockResolvedValue([{ id: 'entry-1' }]);

      const result = await service.findAllForPatient('org-1', 'patient-1');

      expect(prisma.voidingDiaryEntry.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', patientId: 'patient-1', deletedAt: null },
        orderBy: { recordedAt: 'asc' },
      });
      expect(result).toEqual([{ id: 'entry-1' }]);
    });

    it('aplica o intervalo de datas quando informado', async () => {
      prisma.voidingDiaryEntry.findMany.mockResolvedValue([]);
      const from = new Date('2026-09-01T00:00:00.000Z');
      const to = new Date('2026-09-30T23:59:59.999Z');

      await service.findAllForPatient('org-1', 'patient-1', from, to);

      expect(prisma.voidingDiaryEntry.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          patientId: 'patient-1',
          deletedAt: null,
          recordedAt: { gte: from, lte: to },
        },
        orderBy: { recordedAt: 'asc' },
      });
    });
  });

  describe('softDelete', () => {
    it('marca deletedAt quando o registro pertence ao paciente e organização', async () => {
      prisma.voidingDiaryEntry.findFirst.mockResolvedValue({ id: 'entry-1' });
      prisma.voidingDiaryEntry.update.mockResolvedValue({ id: 'entry-1' });

      await service.softDelete('org-1', 'patient-1', 'entry-1');

      expect(prisma.voidingDiaryEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'entry-1', organizationId: 'org-1', patientId: 'patient-1', deletedAt: null },
      });
      expect(prisma.voidingDiaryEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('rejeita quando o registro não existe ou não pertence ao paciente', async () => {
      prisma.voidingDiaryEntry.findFirst.mockResolvedValue(null);

      await expect(service.softDelete('org-1', 'patient-1', 'entry-x')).rejects.toThrow(NotFoundException);
      expect(prisma.voidingDiaryEntry.update).not.toHaveBeenCalled();
    });
  });
});
