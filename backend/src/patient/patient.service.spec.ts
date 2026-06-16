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

      expect(prisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'patient-1', organizationId: orgB }),
        }),
      );
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

    it('remove deve aplicar soft delete quando organizationId for correto', async () => {
      prisma.patient.findFirst.mockResolvedValue({
        id: 'patient-1',
        organizationId: orgB,
        name: 'Maria',
      } as any);
      prisma.patient.update.mockResolvedValue({ id: 'patient-1' } as any);

      await service.remove(orgB, 'patient-1');

      expect(prisma.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'patient-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
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

  describe('filtros e ordenação', () => {
    beforeEach(() => {
      prisma.patient.findMany.mockResolvedValue([]);
      prisma.patient.count.mockResolvedValue(0);
    });

    it('orderBy name_desc deve passar { name: desc } ao findMany', async () => {
      await service.findAll(orgA, { page: 1, limit: 20, orderBy: 'name_desc' });

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'desc' } }),
      );
    });

    it('orderBy name_asc (default) deve passar { name: asc } ao findMany', async () => {
      await service.findAll(orgA, { page: 1, limit: 20 });

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });

    it('hasActivePackage deve adicionar filtro de pacote ativo ao where', async () => {
      await service.findAll(orgA, { page: 1, limit: 20, hasActivePackage: true });

      const callArgs = prisma.patient.findMany.mock.calls[0][0];
      expect(callArgs.where.treatmentPackages).toEqual({ some: { status: 'ACTIVE' } });
    });

    it('hasActivePackage false não deve adicionar filtro de pacote ao where', async () => {
      await service.findAll(orgA, { page: 1, limit: 20, hasActivePackage: false });

      const callArgs = prisma.patient.findMany.mock.calls[0][0];
      expect(callArgs.where.treatmentPackages).toBeUndefined();
    });

    it('hasNoUpcomingAppointment deve adicionar filtro none de agendamentos futuros ao where', async () => {
      await service.findAll(orgA, { page: 1, limit: 20, hasNoUpcomingAppointment: true });

      const callArgs = prisma.patient.findMany.mock.calls[0][0];
      expect(callArgs.where.appointments).toEqual({
        none: {
          startAt: { gte: expect.any(Date) },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
      });
    });

    it('hasNoUpcomingAppointment false não deve adicionar filtro de agendamento ao where', async () => {
      await service.findAll(orgA, { page: 1, limit: 20, hasNoUpcomingAppointment: false });

      const callArgs = prisma.patient.findMany.mock.calls[0][0];
      expect(callArgs.where.appointments).toBeUndefined();
    });

    it('filtros combinados com search devem compor o where corretamente', async () => {
      await service.findAll(orgA, {
        page: 1,
        limit: 20,
        search: 'ana',
        hasActivePackage: true,
        hasNoUpcomingAppointment: true,
      });

      const callArgs = prisma.patient.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toBeDefined();
      expect(callArgs.where.treatmentPackages).toEqual({ some: { status: 'ACTIVE' } });
      expect(callArgs.where.appointments).toBeDefined();
    });
  });
});
