import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PatientService } from './patient.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PatientService', () => {
  let service: PatientService;
  let prisma: jest.Mocked<PrismaService>;

  const orgA = 'org-a';
  const orgB = 'org-b';

  beforeEach(async () => {
    prisma = {
      patient: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ planMaxPatients: null }),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PatientService>(PatientService);
  });

  describe('isolamento por organizationId', () => {
    it('findAll deve filtrar por organizationId', async () => {
      prisma.patient.findMany.mockResolvedValue([]);
      prisma.patient.count.mockResolvedValue(0);

      await service.findAll(orgA, { page: 1, limit: 20 });

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: orgA }),
        }),
      );
    });

    it('findById deve exigir organizationId correto', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.findById(orgB, 'patient-1'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.patient.findFirst).toHaveBeenCalledWith({
        where: { id: 'patient-1', organizationId: orgB },
      });
    });

    it('create deve vincular ao organizationId', async () => {
      const createdPatient = {
        id: 'new-patient',
        organizationId: orgA,
        name: 'Maria',
      };
      prisma.patient.create.mockResolvedValue(createdPatient);

      const result = await service.create(orgA, { name: 'Maria' });

      expect(prisma.patient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ organizationId: orgA }),
      });
      expect(result).toEqual(createdPatient);
    });

    it('update deve verificar organizationId antes de atualizar', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgB, 'patient-1', { name: 'Outro' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('update deve atualizar quando o paciente pertence à organização', async () => {
      prisma.patient.findFirst.mockResolvedValue({
        id: 'patient-1',
        organizationId: orgB,
        name: 'Antigo',
      } as any);
      prisma.patient.update.mockResolvedValue({
        id: 'patient-1',
        organizationId: orgB,
        name: 'Novo',
      } as any);

      const result = await service.update(orgB, 'patient-1', { name: 'Novo' });

      expect(prisma.patient.update).toHaveBeenCalledWith({
        where: { id: 'patient-1' },
        data: expect.objectContaining({ name: 'Novo' }),
      });
      expect(result).toEqual({ id: 'patient-1', organizationId: orgB, name: 'Novo' });
    });

    it('remove deve verificar organizationId antes de deletar', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(orgB, 'patient-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('remove deve deletar paciente quando organizationId for correto', async () => {
      prisma.patient.findFirst.mockResolvedValue({
        id: 'patient-1',
        organizationId: orgB,
        name: 'Maria',
      } as any);
      prisma.patient.delete.mockResolvedValue({ id: 'patient-1' } as any);

      await service.remove(orgB, 'patient-1');

      expect(prisma.patient.delete).toHaveBeenCalledWith({
        where: { id: 'patient-1' },
      });
    });
  });

  describe('busca', () => {
    it('deve buscar por nome (insensitive)', async () => {
      prisma.patient.findMany.mockResolvedValue([]);
      prisma.patient.count.mockResolvedValue(0);

      await service.findAll(orgA, { search: 'maria', page: 1, limit: 20 });

      const callArgs = prisma.patient.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: { contains: 'maria', mode: 'insensitive' },
          }),
        ]),
      );
    });

    it('deve paginar resultados', async () => {
      prisma.patient.findMany.mockResolvedValue([]);
      prisma.patient.count.mockResolvedValue(50);

      const result = await service.findAll(orgA, { page: 2, limit: 10 });

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.meta.totalPages).toBe(5);
    });
  });
});
