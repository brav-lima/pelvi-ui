import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PersonService } from './person.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PersonService', () => {
  let service: PersonService;
  let prisma: { person: any; organizationUser: any };

  const mockPerson = {
    id: 'person-1',
    cpf: '11111111111',
    name: 'Maria',
    email: 'maria@email.com',
    phone: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      person: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      organizationUser: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PersonService>(PersonService);
  });

  describe('create', () => {
    const dto = {
      cpf: '11111111111',
      name: 'Maria',
      email: 'maria@email.com',
      password: 'senha123',
    };

    it('deve lançar ConflictException quando CPF já cadastrado', async () => {
      prisma.person.findFirst.mockResolvedValue({ ...mockPerson });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(prisma.person.create).not.toHaveBeenCalled();
    });

    it('deve lançar ConflictException quando Email já cadastrado', async () => {
      // CPF diferente, mesmo email
      prisma.person.findFirst.mockResolvedValue({ ...mockPerson, cpf: '99999999999' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('deve criar pessoa com senha hasheada', async () => {
      prisma.person.findFirst.mockResolvedValue(null);
      prisma.person.create.mockResolvedValue(mockPerson);

      await service.create(dto);

      const callData = prisma.person.create.mock.calls[0][0].data;
      expect(callData.passwordHash).toBeDefined();
      expect(callData.passwordHash).not.toBe('senha123');
      // Verifica que é um hash bcrypt válido
      const isValidHash = await bcrypt.compare('senha123', callData.passwordHash);
      expect(isValidHash).toBe(true);
    });

    it('não deve expor passwordHash no retorno', async () => {
      prisma.person.findFirst.mockResolvedValue(null);
      prisma.person.create.mockResolvedValue(mockPerson);

      const result = await service.create(dto);

      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('findById', () => {
    it('deve retornar pessoa existente', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);

      const result = await service.findById('person-1');

      expect(prisma.person.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'person-1' } }),
      );
      expect(result).toEqual(mockPerson);
    });

    it('deve lançar NotFoundException quando pessoa não existe', async () => {
      prisma.person.findUnique.mockResolvedValue(null);

      await expect(service.findById('person-inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCpf', () => {
    it('deve retornar pessoa pelo CPF', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);

      const result = await service.findByCpf('11111111111');

      expect(prisma.person.findUnique).toHaveBeenCalledWith({ where: { cpf: '11111111111' } });
      expect(result).toEqual(mockPerson);
    });

    it('deve lançar NotFoundException quando CPF não existe', async () => {
      prisma.person.findUnique.mockResolvedValue(null);

      await expect(service.findByCpf('00000000000')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('deve lançar NotFoundException quando pessoa não existe', async () => {
      prisma.person.findUnique.mockResolvedValue(null);

      await expect(service.update('person-1', { name: 'Novo' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.person.update).not.toHaveBeenCalled();
    });

    it('deve lançar ConflictException quando email já pertence a outra pessoa', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson); // findById OK
      prisma.person.findFirst.mockResolvedValue({ id: 'person-2', email: 'outro@email.com' });

      await expect(
        service.update('person-1', { email: 'outro@email.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('deve hashear nova senha quando password informado', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);
      prisma.person.findFirst.mockResolvedValue(null);
      prisma.person.update.mockResolvedValue(mockPerson);

      await service.update('person-1', { password: 'nova123' });

      const callData = prisma.person.update.mock.calls[0][0].data;
      expect(callData.passwordHash).toBeDefined();
      const isValid = await bcrypt.compare('nova123', callData.passwordHash);
      expect(isValid).toBe(true);
    });

    it('não deve incluir passwordHash quando password não informado', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);
      prisma.person.update.mockResolvedValue(mockPerson);

      await service.update('person-1', { name: 'Novo nome' });

      const callData = prisma.person.update.mock.calls[0][0].data;
      expect(callData).not.toHaveProperty('passwordHash');
    });
  });

  describe('remove', () => {
    it('deve desativar pessoa (soft delete) em vez de deletar', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);
      prisma.person.update.mockResolvedValue({ ...mockPerson, active: false });

      await service.remove('person-1');

      expect(prisma.person.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { active: false } }),
      );
    });

    it('deve lançar NotFoundException antes de desativar quando pessoa não existe', async () => {
      prisma.person.findUnique.mockResolvedValue(null);

      await expect(service.remove('person-inexistente')).rejects.toThrow(NotFoundException);
      expect(prisma.person.update).not.toHaveBeenCalled();
    });
  });

  describe('findOrganizations', () => {
    it('deve lançar NotFoundException quando pessoa não existe', async () => {
      prisma.person.findUnique.mockResolvedValue(null);

      await expect(service.findOrganizations('person-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve retornar vínculos ativos mapeados corretamente', async () => {
      const org = { id: 'org-1', name: 'Clínica A' };
      prisma.person.findUnique.mockResolvedValue(mockPerson);
      prisma.organizationUser.findMany.mockResolvedValue([
        { id: 'ou-1', role: 'ADMIN', organization: org },
      ]);

      const result = await service.findOrganizations('person-1');

      expect(prisma.organizationUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { personId: 'person-1', active: true } }),
      );
      expect(result).toEqual([{ id: 'ou-1', role: 'ADMIN', organization: org }]);
    });
  });
});
