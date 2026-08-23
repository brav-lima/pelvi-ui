import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EvolutionService } from './evolution.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EvolutionService', () => {
  let service: EvolutionService;
  let prisma: { evolution: any; organizationUser: any; appointment: any };

  const orgId = 'org-1';
  const personId = 'person-1';

  const mockOrgUser = { id: 'ou-1', active: true };

  beforeEach(async () => {
    prisma = {
      evolution: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      organizationUser: {
        findUnique: jest.fn(),
      },
      appointment: {
        findFirst: jest.fn(),
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
      prisma.appointment.findFirst.mockResolvedValue({ id: 'apt-1' });
      prisma.evolution.create.mockResolvedValue({ id: 'evo-1' });

      await service.create(orgId, personId, {
        patientId: 'patient-1',
        description: 'Sessão concluída.',
        appointmentId: 'apt-1',
      });

      expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
        where: { id: 'apt-1', organizationId: orgId, patientId: 'patient-1', deletedAt: null },
        select: { id: true },
      });
      expect(prisma.evolution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ appointmentId: 'apt-1' }),
        }),
      );
    });

    it('deve lançar BadRequestException quando appointmentId não pertence ao paciente', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
      prisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.create(orgId, personId, {
          patientId: 'patient-1',
          description: 'Sessão concluída.',
          appointmentId: 'apt-de-outro-paciente',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.evolution.create).not.toHaveBeenCalled();
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
    it('deve filtrar por organizationId e patientId, ordenado por evolutionDate decrescente', async () => {
      prisma.evolution.findMany.mockResolvedValue([]);

      await service.findByPatient(orgId, 'patient-1');

      expect(prisma.evolution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId, patientId: 'patient-1' },
          orderBy: [{ evolutionDate: 'desc' }, { createdAt: 'desc' }],
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

  describe('update', () => {
    it('deve atualizar apenas os campos informados', async () => {
      const existing = { id: 'evo-1', organizationId: orgId };
      prisma.evolution.findFirst.mockResolvedValue(existing);
      prisma.evolution.update.mockResolvedValue({ ...existing, description: 'Novo texto' });

      await service.update(orgId, 'evo-1', { description: 'Novo texto' });

      expect(prisma.evolution.findFirst).toHaveBeenCalledWith({
        where: { id: 'evo-1', organizationId: orgId },
      });
      expect(prisma.evolution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evo-1' },
          data: { description: 'Novo texto' },
        }),
      );
    });

    it('deve atualizar evolutionDate quando informado', async () => {
      prisma.evolution.findFirst.mockResolvedValue({ id: 'evo-1', organizationId: orgId });
      prisma.evolution.update.mockResolvedValue({ id: 'evo-1' });

      await service.update(orgId, 'evo-1', { evolutionDate: '2026-02-01T00:00:00.000Z' });

      expect(prisma.evolution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { evolutionDate: new Date('2026-02-01T00:00:00.000Z') },
        }),
      );
    });

    it('deve lançar NotFoundException quando a evolução não existe na organização', async () => {
      prisma.evolution.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, 'evo-outra', { description: 'x' }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.evolution.update).not.toHaveBeenCalled();
    });

    it('deve lançar BadRequestException quando evolutionDate é no futuro', async () => {
      prisma.evolution.findFirst.mockResolvedValue({ id: 'evo-1', organizationId: orgId });

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await expect(
        service.update(orgId, 'evo-1', { evolutionDate: futureDate }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.evolution.update).not.toHaveBeenCalled();
    });

    it('deve vincular a um agendamento do mesmo paciente quando appointmentId informado', async () => {
      const existing = { id: 'evo-1', organizationId: orgId, patientId: 'patient-1' };
      prisma.evolution.findFirst.mockResolvedValue(existing);
      prisma.appointment.findFirst.mockResolvedValue({ id: 'apt-1' });
      prisma.evolution.update.mockResolvedValue({ ...existing, appointmentId: 'apt-1' });

      await service.update(orgId, 'evo-1', { appointmentId: 'apt-1' });

      expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
        where: { id: 'apt-1', organizationId: orgId, patientId: 'patient-1', deletedAt: null },
        select: { id: true },
      });
      expect(prisma.evolution.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { appointmentId: 'apt-1' } }),
      );
    });

    it('deve lançar BadRequestException quando appointmentId não pertence ao paciente da evolução', async () => {
      prisma.evolution.findFirst.mockResolvedValue({ id: 'evo-1', organizationId: orgId, patientId: 'patient-1' });
      prisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, 'evo-1', { appointmentId: 'apt-de-outro-paciente' }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.evolution.update).not.toHaveBeenCalled();
    });

    it('deve desvincular o agendamento quando appointmentId é null', async () => {
      const existing = { id: 'evo-1', organizationId: orgId, patientId: 'patient-1' };
      prisma.evolution.findFirst.mockResolvedValue(existing);
      prisma.evolution.update.mockResolvedValue({ ...existing, appointmentId: null });

      await service.update(orgId, 'evo-1', { appointmentId: null });

      expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
      expect(prisma.evolution.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { appointmentId: null } }),
      );
    });
  });
});
