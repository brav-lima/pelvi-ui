import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProfessionalService } from './professional.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProfessionalService', () => {
  let service: ProfessionalService;
  let prisma: { organizationUser: any };

  const orgId = 'org-1';

  const mockOrgUser = {
    id: 'ou-1',
    organizationId: orgId,
    role: 'PROFESSIONAL',
    active: true,
    person: {
      id: 'person-1',
      name: 'Dr. João',
      cpf: '12345678901',
      email: 'joao@clinica.com',
      phone: '11999990000',
    },
  };

  const expectedShape = {
    id: mockOrgUser.id,
    role: mockOrgUser.role,
    active: mockOrgUser.active,
    person: mockOrgUser.person,
  };

  beforeEach(async () => {
    prisma = {
      organizationUser: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessionalService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProfessionalService>(ProfessionalService);
  });

  describe('findAll', () => {
    it('deve listar profissionais da organização com shape correto', async () => {
      prisma.organizationUser.findMany.mockResolvedValue([mockOrgUser]);

      const result = await service.findAll(orgId);

      expect(prisma.organizationUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId },
          orderBy: { person: { name: 'asc' } },
        }),
      );
      expect(result).toEqual([expectedShape]);
    });

    it('deve retornar apenas { id, role, active, person } sem expor campos internos do OrganizationUser', async () => {
      const rawWithExtra = { ...mockOrgUser, personId: 'person-1', createdAt: new Date() };
      prisma.organizationUser.findMany.mockResolvedValue([rawWithExtra]);

      const result = await service.findAll(orgId);

      expect(result[0]).not.toHaveProperty('personId');
      expect(result[0]).not.toHaveProperty('organizationId');
      expect(result[0]).not.toHaveProperty('createdAt');
    });
  });

  describe('findById', () => {
    it('deve retornar profissional com shape correto quando encontrado', async () => {
      prisma.organizationUser.findFirst.mockResolvedValue(mockOrgUser);

      const result = await service.findById(orgId, 'ou-1');

      expect(prisma.organizationUser.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ou-1', organizationId: orgId },
        }),
      );
      expect(result).toEqual(expectedShape);
    });

    it('deve lançar NotFoundException quando não encontrado ou de outra organização', async () => {
      prisma.organizationUser.findFirst.mockResolvedValue(null);

      await expect(service.findById(orgId, 'ou-outro')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('deve atualizar e retornar shape correto', async () => {
      const updated = { ...mockOrgUser, active: false };
      prisma.organizationUser.findFirst.mockResolvedValue(mockOrgUser);
      prisma.organizationUser.update.mockResolvedValue(updated);

      const result = await service.update(orgId, 'ou-1', { active: false });

      expect(prisma.organizationUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ou-1' },
          data: { active: false },
        }),
      );
      expect(result).toEqual({ ...expectedShape, active: false });
    });

    it('deve lançar NotFoundException antes de atualizar quando profissional não existe na org', async () => {
      prisma.organizationUser.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, 'ou-inexistente', { active: false }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.organizationUser.update).not.toHaveBeenCalled();
    });
  });
});
