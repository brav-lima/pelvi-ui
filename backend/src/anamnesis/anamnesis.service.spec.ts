import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnamnesisService } from './anamnesis.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AnamnesisService', () => {
  let service: AnamnesisService;
  let prisma: { anamnesis: any; organizationUser: any };

  const orgId = 'org-1';
  const personId = 'person-1';

  const mockOrgUser = { id: 'ou-1', active: true };

  beforeEach(async () => {
    prisma = {
      anamnesis: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      organizationUser: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnamnesisService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AnamnesisService>(AnamnesisService);
  });

  describe('create', () => {
    it('deve criar anamnese com professionalId resolvido via orgUser', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
      prisma.anamnesis.create.mockResolvedValue({ id: 'ana-1' });

      await service.create(orgId, personId, {
        patientId: 'patient-1',
        data: { queixa: 'Dor lombar' },
      });

      expect(prisma.organizationUser.findUnique).toHaveBeenCalledWith({
        where: { organizationId_personId: { organizationId: orgId, personId } },
      });
      expect(prisma.anamnesis.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            patientId: 'patient-1',
            professionalId: mockOrgUser.id,
          }),
        }),
      );
    });

    it('deve lançar ForbiddenException quando orgUser não existe', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(null);

      await expect(
        service.create(orgId, personId, { patientId: 'patient-1', data: {} }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.anamnesis.create).not.toHaveBeenCalled();
    });

    it('deve lançar ForbiddenException quando orgUser está inativo', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue({ ...mockOrgUser, active: false });

      await expect(
        service.create(orgId, personId, { patientId: 'patient-1', data: {} }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.anamnesis.create).not.toHaveBeenCalled();
    });
  });

  describe('findByPatient', () => {
    it('deve filtrar por organizationId e patientId', async () => {
      prisma.anamnesis.findMany.mockResolvedValue([]);

      await service.findByPatient(orgId, 'patient-1');

      expect(prisma.anamnesis.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId, patientId: 'patient-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findById', () => {
    it('deve retornar anamnese quando pertence à organização', async () => {
      const ana = { id: 'ana-1', organizationId: orgId };
      prisma.anamnesis.findFirst.mockResolvedValue(ana);

      const result = await service.findById(orgId, 'ana-1');

      expect(prisma.anamnesis.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ana-1', organizationId: orgId } }),
      );
      expect(result).toEqual(ana);
    });

    it('deve lançar NotFoundException quando não encontrada ou de outra organização', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(null);

      await expect(service.findById(orgId, 'ana-outra')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('deve fazer merge dos dados JSON preservando campos existentes', async () => {
      const existing = { id: 'ana-1', organizationId: orgId, data: { queixa: 'Dor lombar', historico: 'Fratura 2020' } };
      prisma.anamnesis.findFirst.mockResolvedValue(existing);
      prisma.anamnesis.update.mockResolvedValue({ ...existing, data: { queixa: 'Dor cervical', historico: 'Fratura 2020' } });

      await service.update(orgId, 'ana-1', { data: { queixa: 'Dor cervical' } });

      expect(prisma.anamnesis.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ana-1' },
          data: {
            data: { queixa: 'Dor cervical', historico: 'Fratura 2020' },
          },
        }),
      );
    });

    it('deve sobrescrever completamente quando dado existente não é um objeto', async () => {
      const existing = { id: 'ana-1', organizationId: orgId, data: null };
      prisma.anamnesis.findFirst.mockResolvedValue(existing);
      prisma.anamnesis.update.mockResolvedValue({ ...existing, data: { queixa: 'Novo' } });

      await service.update(orgId, 'ana-1', { data: { queixa: 'Novo' } });

      expect(prisma.anamnesis.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { data: { queixa: 'Novo' } },
        }),
      );
    });

    it('deve lançar NotFoundException quando anamnese não existe na org', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, 'ana-inexistente', { data: {} }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.anamnesis.update).not.toHaveBeenCalled();
    });
  });
});
