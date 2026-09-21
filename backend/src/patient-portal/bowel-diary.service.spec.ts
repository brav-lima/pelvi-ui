import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BowelDiaryService } from './bowel-diary.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BowelDiaryService', () => {
  let service: BowelDiaryService;
  let prisma: {
    bowelDiaryEntry: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      bowelDiaryEntry: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BowelDiaryService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<BowelDiaryService>(BowelDiaryService);
  });

  describe('create', () => {
    it('cria o registro escopado por organização e paciente', async () => {
      const recordedAt = new Date('2026-09-20T10:00:00.000Z');
      prisma.bowelDiaryEntry.create.mockResolvedValue({ id: 'entry-1' });

      const result = await service.create('org-1', 'patient-1', {
        recordedAt,
        hadBowelMovement: true,
        bristolType: '4',
        effort: 'NONE',
        sensation: 'COMPLETE',
        bowelMovementDurationSeconds: 60,
        hadLeakage: false,
        leakageType: null,
      });

      expect(prisma.bowelDiaryEntry.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          patientId: 'patient-1',
          recordedAt,
          hadBowelMovement: true,
          bristolType: '4',
          effort: 'NONE',
          sensation: 'COMPLETE',
          bowelMovementDurationSeconds: 60,
          hadLeakage: false,
          leakageType: null,
        },
      });
      expect(result).toEqual({ id: 'entry-1' });
    });

    it('força os campos de evacuação para null quando hadBowelMovement é false, mesmo que informados', async () => {
      const recordedAt = new Date('2026-09-20T10:00:00.000Z');
      prisma.bowelDiaryEntry.create.mockResolvedValue({ id: 'entry-1' });

      await service.create('org-1', 'patient-1', {
        recordedAt,
        hadBowelMovement: false,
        bristolType: '4',
        effort: 'INTENSE',
        sensation: 'INCOMPLETE',
        bowelMovementDurationSeconds: 60,
        hadLeakage: false,
        leakageType: null,
      });

      expect(prisma.bowelDiaryEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          hadBowelMovement: false,
          bristolType: null,
          effort: null,
          sensation: null,
          bowelMovementDurationSeconds: null,
        }),
      });
    });

    it('força leakageType para null quando hadLeakage é false, mesmo que informado', async () => {
      const recordedAt = new Date('2026-09-20T10:00:00.000Z');
      prisma.bowelDiaryEntry.create.mockResolvedValue({ id: 'entry-1' });

      await service.create('org-1', 'patient-1', {
        recordedAt,
        hadBowelMovement: false,
        bristolType: null,
        effort: null,
        sensation: null,
        bowelMovementDurationSeconds: null,
        hadLeakage: false,
        leakageType: 'STOOL',
      });

      expect(prisma.bowelDiaryEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          hadLeakage: false,
          leakageType: null,
        }),
      });
    });
  });

  describe('findAllForPatient', () => {
    it('lista os registros não excluídos, ordenados por horário', async () => {
      prisma.bowelDiaryEntry.findMany.mockResolvedValue([{ id: 'entry-1' }]);

      const result = await service.findAllForPatient('org-1', 'patient-1');

      expect(prisma.bowelDiaryEntry.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', patientId: 'patient-1', deletedAt: null },
        orderBy: { recordedAt: 'asc' },
      });
      expect(result).toEqual([{ id: 'entry-1' }]);
    });

    it('aplica o intervalo de datas quando informado', async () => {
      prisma.bowelDiaryEntry.findMany.mockResolvedValue([]);
      const from = new Date('2026-09-01T00:00:00.000Z');
      const to = new Date('2026-09-30T23:59:59.999Z');

      await service.findAllForPatient('org-1', 'patient-1', from, to);

      expect(prisma.bowelDiaryEntry.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          patientId: 'patient-1',
          deletedAt: null,
          recordedAt: { gte: from, lte: to },
        },
        orderBy: { recordedAt: 'asc' },
      });
    });

    it('aplica somente o limite inferior quando apenas "from" é informado', async () => {
      prisma.bowelDiaryEntry.findMany.mockResolvedValue([]);
      const from = new Date('2026-09-01T00:00:00.000Z');

      await service.findAllForPatient('org-1', 'patient-1', from, undefined);

      expect(prisma.bowelDiaryEntry.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          patientId: 'patient-1',
          deletedAt: null,
          recordedAt: { gte: from },
        },
        orderBy: { recordedAt: 'asc' },
      });
    });

    it('aplica somente o limite superior quando apenas "to" é informado', async () => {
      prisma.bowelDiaryEntry.findMany.mockResolvedValue([]);
      const to = new Date('2026-09-30T23:59:59.999Z');

      await service.findAllForPatient('org-1', 'patient-1', undefined, to);

      expect(prisma.bowelDiaryEntry.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          patientId: 'patient-1',
          deletedAt: null,
          recordedAt: { lte: to },
        },
        orderBy: { recordedAt: 'asc' },
      });
    });
  });

  describe('softDelete', () => {
    it('marca deletedAt quando o registro pertence ao paciente e organização', async () => {
      prisma.bowelDiaryEntry.findFirst.mockResolvedValue({ id: 'entry-1' });
      prisma.bowelDiaryEntry.update.mockResolvedValue({ id: 'entry-1' });

      await service.softDelete('org-1', 'patient-1', 'entry-1');

      expect(prisma.bowelDiaryEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'entry-1', organizationId: 'org-1', patientId: 'patient-1', deletedAt: null },
      });
      expect(prisma.bowelDiaryEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('rejeita quando o registro não existe ou não pertence ao paciente', async () => {
      prisma.bowelDiaryEntry.findFirst.mockResolvedValue(null);

      await expect(service.softDelete('org-1', 'patient-1', 'entry-x')).rejects.toThrow(NotFoundException);
      expect(prisma.bowelDiaryEntry.update).not.toHaveBeenCalled();
    });
  });
});
