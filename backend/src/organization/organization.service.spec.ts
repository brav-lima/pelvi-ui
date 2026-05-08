import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prisma: {
    organization: any;
    organizationUser: any;
    patient: any;
  };

  const mockOrg = { id: 'org-1', name: 'Clínica A', cnpj: '12345678000199' };
  const mockLink = {
    id: 'ou-1',
    organizationId: 'org-1',
    personId: 'person-1',
    role: 'PROFESSIONAL',
    active: true,
    person: { id: 'person-1', cpf: '11111111111', name: 'Dr. Ana', email: 'ana@c.com', phone: null },
  };

  beforeEach(async () => {
    prisma = {
      organization: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      organizationUser: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      patient: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  // ─── Organization CRUD ────────────────────────────────────────

  describe('create', () => {
    it('deve criar organização sem CNPJ', async () => {
      prisma.organization.create.mockResolvedValue({ id: 'org-1', name: 'Clínica B' });

      await service.create({ name: 'Clínica B' });

      expect(prisma.organization.findUnique).not.toHaveBeenCalled();
      expect(prisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Clínica B' }) }),
      );
    });

    it('deve lançar ConflictException quando CNPJ já cadastrado', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockOrg);

      await expect(
        service.create({ name: 'Outra', cnpj: '12345678000199' }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.organization.create).not.toHaveBeenCalled();
    });

    it('deve criar organização quando CNPJ é novo', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      prisma.organization.create.mockResolvedValue(mockOrg);

      await service.create({ name: 'Clínica A', cnpj: '12345678000199' });

      expect(prisma.organization.create).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('deve retornar organização existente', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockOrg);

      const result = await service.findById('org-1');

      expect(result).toEqual(mockOrg);
    });

    it('deve lançar NotFoundException quando organização não existe', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.findById('org-inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('deve lançar NotFoundException quando organização não existe', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.update('org-1', { name: 'Novo' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('deve lançar ConflictException quando CNPJ já pertence a outra organização', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockOrg);
      prisma.organization.findFirst.mockResolvedValue({ id: 'org-2', cnpj: '99999999000199' });

      await expect(
        service.update('org-1', { cnpj: '99999999000199' }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('deve atualizar quando dados são válidos', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockOrg);
      prisma.organization.findFirst.mockResolvedValue(null);
      prisma.organization.update.mockResolvedValue({ ...mockOrg, name: 'Novo nome' });

      await service.update('org-1', { name: 'Novo nome', cnpj: '99999999000199' });

      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'org-1' } }),
      );
    });
  });

  describe('remove', () => {
    it('deve lançar NotFoundException antes de deletar quando org não existe', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.remove('org-inexistente')).rejects.toThrow(NotFoundException);
      expect(prisma.organization.delete).not.toHaveBeenCalled();
    });

    it('deve deletar quando organização existe', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockOrg);
      prisma.organization.delete.mockResolvedValue(mockOrg);

      await service.remove('org-1');

      expect(prisma.organization.delete).toHaveBeenCalledWith({ where: { id: 'org-1' } });
    });
  });

  // ─── OrganizationUser ─────────────────────────────────────────

  describe('addUser', () => {
    beforeEach(() => {
      // Org existe por padrão
      prisma.organization.findUnique
        .mockResolvedValueOnce(mockOrg)              // findById dentro de addUser
        .mockResolvedValueOnce({ planMaxUsers: null }); // planMaxUsers check
    });

    it('deve lançar NotFoundException quando pessoa não existe', async () => {
      prisma.person = { findUnique: jest.fn().mockResolvedValue(null) };
      (prisma as any).person = { findUnique: jest.fn().mockResolvedValue(null) };

      // Reconstruir o mock do prisma com person
      prisma['person'] = { findUnique: jest.fn().mockResolvedValue(null) };

      await expect(
        service.addUser('org-1', { personId: 'person-X', role: 'PROFESSIONAL' as any }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar ConflictException quando pessoa já está vinculada', async () => {
      prisma['person'] = { findUnique: jest.fn().mockResolvedValue({ id: 'person-1' }) };
      prisma.organizationUser.findUnique.mockResolvedValue(mockLink);

      await expect(
        service.addUser('org-1', { personId: 'person-1', role: 'PROFESSIONAL' as any }),
      ).rejects.toThrow(ConflictException);
    });

    it('deve lançar BadRequestException quando limite de usuários foi atingido', async () => {
      // Reconfigurar findUnique para retornar planMaxUsers limitado
      prisma.organization.findUnique
        .mockReset()
        .mockResolvedValueOnce(mockOrg)             // findById
        .mockResolvedValueOnce(null)                 // person
        .mockResolvedValueOnce({ planMaxUsers: 2 }); // plan check

      prisma['person'] = { findUnique: jest.fn().mockResolvedValue({ id: 'person-1' }) };
      prisma.organizationUser.findUnique.mockResolvedValue(null);
      prisma.organizationUser.count.mockResolvedValue(2); // já no limite

      // Precisamos remock do findById separado
      prisma.organization.findUnique.mockReset();
      prisma.organization.findUnique
        .mockResolvedValueOnce(mockOrg)              // findById (org existe)
        .mockResolvedValueOnce({ planMaxUsers: 2 }); // plan check
      prisma['person'] = { findUnique: jest.fn().mockResolvedValue({ id: 'person-1' }) };
      prisma.organizationUser.findUnique.mockResolvedValue(null);
      prisma.organizationUser.count.mockResolvedValue(2);

      await expect(
        service.addUser('org-1', { personId: 'person-1', role: 'PROFESSIONAL' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve criar vínculo quando todas as validações passam', async () => {
      prisma.organization.findUnique
        .mockReset()
        .mockResolvedValueOnce(mockOrg)               // findById
        .mockResolvedValueOnce({ planMaxUsers: null }); // sem limite
      prisma['person'] = { findUnique: jest.fn().mockResolvedValue({ id: 'person-1' }) };
      prisma.organizationUser.findUnique.mockResolvedValue(null);
      prisma.organizationUser.create.mockResolvedValue(mockLink);

      const result = await service.addUser('org-1', {
        personId: 'person-1',
        role: 'PROFESSIONAL' as any,
      });

      expect(prisma.organizationUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', personId: 'person-1' }),
        }),
      );
      expect(result).toEqual(mockLink);
    });
  });

  describe('findUsers', () => {
    it('deve lançar NotFoundException quando organização não existe', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.findUsers('org-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('deve listar vínculos da organização', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockOrg);
      prisma.organizationUser.findMany.mockResolvedValue([mockLink]);

      const result = await service.findUsers('org-1');

      expect(prisma.organizationUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1' } }),
      );
      expect(result).toEqual([mockLink]);
    });
  });

  describe('findUserById', () => {
    it('deve lançar NotFoundException quando vínculo não existe', async () => {
      prisma.organizationUser.findFirst.mockResolvedValue(null);

      await expect(service.findUserById('org-1', 'ou-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve retornar vínculo quando encontrado', async () => {
      prisma.organizationUser.findFirst.mockResolvedValue(mockLink);

      const result = await service.findUserById('org-1', 'ou-1');

      expect(result).toEqual(mockLink);
    });
  });

  describe('updateUser', () => {
    it('deve atualizar vínculo quando existe', async () => {
      prisma.organizationUser.findFirst.mockResolvedValue(mockLink);
      prisma.organizationUser.update.mockResolvedValue({ ...mockLink, active: false });

      await service.updateUser('org-1', 'ou-1', { active: false });

      expect(prisma.organizationUser.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ou-1' } }),
      );
    });
  });

  describe('removeUser', () => {
    it('deve desativar vínculo (soft delete) em vez de deletar', async () => {
      prisma.organizationUser.findFirst.mockResolvedValue(mockLink);
      prisma.organizationUser.update.mockResolvedValue({ ...mockLink, active: false });

      await service.removeUser('org-1', 'ou-1');

      expect(prisma.organizationUser.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { active: false } }),
      );
    });
  });

  describe('getPlanUsage', () => {
    it('deve retornar contagens corretas de pacientes e usuários', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        planMaxPatients: 50,
        planMaxUsers: 10,
        accessStatus: 'ACTIVE',
      });
      prisma.patient.count.mockResolvedValue(20);
      prisma.organizationUser.count.mockResolvedValue(5);

      const result = await service.getPlanUsage('org-1');

      expect(result).toEqual({
        accessStatus: 'ACTIVE',
        planMaxPatients: 50,
        planMaxUsers: 10,
        currentPatients: 20,
        currentUsers: 5,
      });
    });

    it('deve retornar valores padrão quando organização não tem plano configurado', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      prisma.patient.count.mockResolvedValue(0);
      prisma.organizationUser.count.mockResolvedValue(0);

      const result = await service.getPlanUsage('org-1');

      expect(result.accessStatus).toBe('ACTIVE');
      expect(result.planMaxPatients).toBeNull();
      expect(result.planMaxUsers).toBeNull();
    });
  });
});
