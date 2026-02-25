import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PatientService } from './patient.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PatientService', () => {
  let service: PatientService;
  let prisma: { patient: any; organization: any };

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
    };

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
      prisma.patient.create.mockResolvedValue({
        id: 'new-patient',
        organizationId: orgA,
        name: 'Maria',
      });

      await service.create(orgA, { name: 'Maria' });

      expect(prisma.patient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ organizationId: orgA }),
      });
    });

    it('update deve verificar organizationId antes de atualizar', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgB, 'patient-1', { name: 'Outro' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('remove deve verificar organizationId antes de deletar', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(orgB, 'patient-1'),
      ).rejects.toThrow(NotFoundException);
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
