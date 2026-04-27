import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PerinealAssessmentService } from './perineal-assessment.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PerinealAssessmentService', () => {
  let service: PerinealAssessmentService;
  let prisma: { perinealAssessment: any; organizationUser: any };

  const orgId = 'org-1';
  const personId = 'person-1';

  const mockOrgUser = { id: 'ou-1', active: true };

  beforeEach(async () => {
    prisma = {
      perinealAssessment: {
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
        PerinealAssessmentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PerinealAssessmentService>(PerinealAssessmentService);
  });

  describe('create', () => {
    it('deve criar ficha perineal com professionalId resolvido via orgUser', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
      prisma.perinealAssessment.create.mockResolvedValue({ id: 'pa-1' });

      await service.create(orgId, personId, {
        patientId: 'patient-1',
        data: { inspecaoEstatica: { tonusBulbocav: '>0.5' } },
      });

      expect(prisma.organizationUser.findUnique).toHaveBeenCalledWith({
        where: { organizationId_personId: { organizationId: orgId, personId } },
      });
      expect(prisma.perinealAssessment.create).toHaveBeenCalledWith(
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

      expect(prisma.perinealAssessment.create).not.toHaveBeenCalled();
    });

    it('deve lançar ForbiddenException quando orgUser está inativo', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue({ ...mockOrgUser, active: false });

      await expect(
        service.create(orgId, personId, { patientId: 'patient-1', data: {} }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.perinealAssessment.create).not.toHaveBeenCalled();
    });
  });

  describe('findByPatient', () => {
    it('deve filtrar por organizationId e patientId, ordenado desc', async () => {
      prisma.perinealAssessment.findMany.mockResolvedValue([]);

      await service.findByPatient(orgId, 'patient-1');

      expect(prisma.perinealAssessment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId, patientId: 'patient-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findById', () => {
    it('deve retornar ficha quando pertence à organização', async () => {
      const assessment = { id: 'pa-1', organizationId: orgId };
      prisma.perinealAssessment.findFirst.mockResolvedValue(assessment);

      const result = await service.findById(orgId, 'pa-1');

      expect(prisma.perinealAssessment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pa-1', organizationId: orgId } }),
      );
      expect(result).toEqual(assessment);
    });

    it('deve lançar NotFoundException quando não encontrada ou de outra organização', async () => {
      prisma.perinealAssessment.findFirst.mockResolvedValue(null);

      await expect(service.findById(orgId, 'pa-outra')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('deve fazer merge dos dados JSON preservando campos existentes', async () => {
      const existing = {
        id: 'pa-1',
        organizationId: orgId,
        data: {
          inspecaoEstatica: { tonusBulbocav: '>0.5' },
          diagnostico: { observacoes: 'Inicial' },
        },
      };
      prisma.perinealAssessment.findFirst.mockResolvedValue(existing);
      prisma.perinealAssessment.update.mockResolvedValue(existing);

      await service.update(orgId, 'pa-1', {
        data: { diagnostico: { observacoes: 'Atualizada' } },
      });

      expect(prisma.perinealAssessment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pa-1' },
          data: {
            data: {
              inspecaoEstatica: { tonusBulbocav: '>0.5' },
              diagnostico: { observacoes: 'Atualizada' },
            },
          },
        }),
      );
    });

    it('deve sobrescrever completamente quando dado existente não é um objeto', async () => {
      const existing = { id: 'pa-1', organizationId: orgId, data: null };
      prisma.perinealAssessment.findFirst.mockResolvedValue(existing);
      prisma.perinealAssessment.update.mockResolvedValue(existing);

      await service.update(orgId, 'pa-1', { data: { diagnostico: { observacoes: 'Nova' } } });

      expect(prisma.perinealAssessment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { data: { diagnostico: { observacoes: 'Nova' } } },
        }),
      );
    });

    it('deve lançar NotFoundException quando ficha não existe na org', async () => {
      prisma.perinealAssessment.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, 'pa-inexistente', { data: {} }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.perinealAssessment.update).not.toHaveBeenCalled();
    });
  });
});
