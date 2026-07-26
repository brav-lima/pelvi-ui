import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EvolutionService } from './evolution.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EvolutionService', () => {
  let service: EvolutionService;
  let prisma: { evolution: any; organizationUser: any };

  const orgId = 'org-1';
  const personId = 'person-1';

  const mockOrgUser = { id: 'ou-1', active: true };

  beforeEach(async () => {
    prisma = {
      evolution: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      organizationUser: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvolutionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EvolutionService>(EvolutionService);
  });

  describe('create', () => {
    it('deve criar evolução com professionalId resolvido via orgUser', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
      prisma.evolution.create.mockResolvedValue({ id: 'evo-1' });

      await service.create(orgId, personId, {
        patientId: 'patient-1',
        description: 'Paciente apresentou melhora significativa.',
      });

      expect(prisma.organizationUser.findUnique).toHaveBeenCalledWith({
        where: { organizationId_personId: { organizationId: orgId, personId } },
      });
      expect(prisma.evolution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            patientId: 'patient-1',
            professionalId: mockOrgUser.id,
            description: 'Paciente apresentou melhora significativa.',
          }),
        }),
      );
    });

    it('deve criar evolução vinculada a um agendamento quando appointmentId informado', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
      prisma.evolution.create.mockResolvedValue({ id: 'evo-1' });

      await service.create(orgId, personId, {
        patientId: 'patient-1',
        description: 'Sessão concluída.',
        appointmentId: 'apt-1',
      });

      expect(prisma.evolution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ appointmentId: 'apt-1' }),
        }),
      );
    });

    it('deve lançar ForbiddenException quando orgUser não existe', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(null);

      await expect(
        service.create(orgId, personId, { patientId: 'patient-1', description: 'Texto' }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.evolution.create).not.toHaveBeenCalled();
    });

    it('deve lançar ForbiddenException quando orgUser está inativo', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue({ ...mockOrgUser, active: false });

      await expect(
        service.create(orgId, personId, { patientId: 'patient-1', description: 'Texto' }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.evolution.create).not.toHaveBeenCalled();
    });

    it('deve usar evolutionDate informado ao invés da data atual', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
      prisma.evolution.create.mockResolvedValue({ id: 'evo-1' });

      await service.create(orgId, personId, {
        patientId: 'patient-1',
        description: 'Texto',
        evolutionDate: '2026-01-10T00:00:00.000Z',
      });

      expect(prisma.evolution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            evolutionDate: new Date('2026-01-10T00:00:00.000Z'),
          }),
        }),
      );
    });

    it('deve usar a data atual quando evolutionDate não é informado', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
      prisma.evolution.create.mockResolvedValue({ id: 'evo-1' });

      const before = Date.now();
      await service.create(orgId, personId, {
        patientId: 'patient-1',
        description: 'Texto',
      });
      const after = Date.now();

      const callData = prisma.evolution.create.mock.calls[0][0].data;
      expect(callData.evolutionDate).toBeInstanceOf(Date);
      expect(callData.evolutionDate.getTime()).toBeGreaterThanOrEqual(before);
      expect(callData.evolutionDate.getTime()).toBeLessThanOrEqual(after);
    });

    it('deve lançar BadRequestException quando evolutionDate é no futuro', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await expect(
        service.create(orgId, personId, {
          patientId: 'patient-1',
          description: 'Texto',
          evolutionDate: futureDate,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.evolution.create).not.toHaveBeenCalled();
    });
  });

  describe('findByPatient', () => {
    it('deve filtrar por organizationId e patientId, ordenado por data decrescente', async () => {
      prisma.evolution.findMany.mockResolvedValue([]);

      await service.findByPatient(orgId, 'patient-1');

      expect(prisma.evolution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId, patientId: 'patient-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findById', () => {
    it('deve retornar evolução quando pertence à organização', async () => {
      const evo = { id: 'evo-1', organizationId: orgId };
      prisma.evolution.findFirst.mockResolvedValue(evo);

      const result = await service.findById(orgId, 'evo-1');

      expect(prisma.evolution.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'evo-1', organizationId: orgId } }),
      );
      expect(result).toEqual(evo);
    });

    it('deve lançar NotFoundException quando não encontrada ou de outra organização', async () => {
      prisma.evolution.findFirst.mockResolvedValue(null);

      await expect(service.findById(orgId, 'evo-outra')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
