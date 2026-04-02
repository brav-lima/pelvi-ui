import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
