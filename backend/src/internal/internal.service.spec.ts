import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { InternalService } from './internal.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('InternalService', () => {
  let service: InternalService;
  let prisma: { organization: any; person: any; organizationUser: any };
  let redis: { del: jest.Mock };

  const mockClinic = {
    id: 'org-1',
    name: 'Clínica A',
    document: '12345678000199',
    documentType: 'CNPJ',
    email: 'a@clinica.com',
    phone: '11999990000',
    accessStatus: 'ACTIVE',
    planMaxUsers: null,
    planMaxPatients: null,
  };

  const mockPerson = {
    id: 'person-1',
    cpf: '11122233344',
    name: 'Maria Responsável',
    email: 'maria@clinica.com',
    phone: '11999990001',
    passwordHash: 'hash',
    active: true,
  };

  beforeEach(async () => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      person: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organizationUser: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    redis = { del: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<InternalService>(InternalService);
  });

  describe('createClinic', () => {
    const dto = {
      name: 'Clínica A',
      document: '12345678000199',
      email: 'a@clinica.com',
      phone: '11999990000',
    };

    it('deve lançar ConflictException quando organização já existe', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockClinic);

      await expect(service.createClinic(dto)).rejects.toThrow(ConflictException);
      expect(prisma.organization.create).not.toHaveBeenCalled();
    });

    it('deve criar clínica e retornar clinicId', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      prisma.organization.create.mockResolvedValue(mockClinic);

      const result = await service.createClinic(dto);

      expect(prisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: dto.name, document: dto.document }),
        }),
      );
      expect(result).toEqual({ clinicId: mockClinic.id });
    });
  });

  describe('listClinics', () => {
    it('deve listar clínicas no formato de resposta da API interna', async () => {
      prisma.organization.findMany.mockResolvedValue([mockClinic]);

      const result = await service.listClinics();

      expect(result).toEqual([
        {
          clinicId: 'org-1',
          name: 'Clínica A',
          document: '12345678000199',
          documentType: 'CNPJ',
          email: 'a@clinica.com',
          phone: '11999990000',
          accessStatus: 'ACTIVE',
        },
      ]);
    });
  });

  describe('updateClinicAccess', () => {
    it('deve lançar NotFoundException quando clínica não existe', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.updateClinicAccess('org-inexistente', 'BLOCKED'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('deve atualizar status de acesso sem limites opcionais', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockClinic);
      prisma.organization.update.mockResolvedValue({ ...mockClinic, accessStatus: 'BLOCKED' });

      const result = await service.updateClinicAccess('org-1', 'BLOCKED');

      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          data: expect.objectContaining({ accessStatus: 'BLOCKED' }),
        }),
      );
      expect(result.accessStatus).toBe('BLOCKED');
    });

    it('deve incluir planMaxUsers e planMaxPatients quando informados', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockClinic);
      prisma.organization.update.mockResolvedValue({
        ...mockClinic,
        accessStatus: 'ACTIVE',
        planMaxUsers: 10,
        planMaxPatients: 50,
      });

      await service.updateClinicAccess('org-1', 'ACTIVE', 10, 50);

      const callData = prisma.organization.update.mock.calls[0][0].data;
      expect(callData.planMaxUsers).toBe(10);
      expect(callData.planMaxPatients).toBe(50);
    });

    it('deve invalidar o cache de accessStatus após atualizar', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockClinic);
      prisma.organization.update.mockResolvedValue({ ...mockClinic, accessStatus: 'BLOCKED' });

      await service.updateClinicAccess('org-1', 'BLOCKED');

      expect(redis.del).toHaveBeenCalledWith('cache:org-access:org-1');
    });
  });

  describe('upsertPerson', () => {
    const dto = {
      cpf: '11122233344',
      name: 'Maria Responsável',
      email: 'maria@clinica.com',
      phone: '11999990001',
      password: 'senha-provisoria',
    };

    it('deve reaproveitar pessoa existente com mesmo CPF', async () => {
      prisma.person.findUnique.mockResolvedValueOnce(mockPerson);

      const result = await service.upsertPerson(dto);

      expect(result.reused).toBe(true);
      expect(result.person.personId).toBe(mockPerson.id);
      expect(prisma.person.create).not.toHaveBeenCalled();
    });

    it('deve criar pessoa quando CPF não existe', async () => {
      prisma.person.findUnique
        .mockResolvedValueOnce(null) // busca por cpf
        .mockResolvedValueOnce(null); // busca por email
      prisma.person.create.mockResolvedValue(mockPerson);

      const result = await service.upsertPerson(dto);

      expect(prisma.person.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cpf: dto.cpf, name: dto.name, email: dto.email }),
        }),
      );
      expect(result.reused).toBe(false);
      expect(result.person.personId).toBe(mockPerson.id);
    });

    it('deve lançar ConflictException quando email pertence a outro CPF', async () => {
      prisma.person.findUnique
        .mockResolvedValueOnce(null) // cpf não existe
        .mockResolvedValueOnce({ ...mockPerson, cpf: '99988877766' }); // email existe em outro

      await expect(service.upsertPerson(dto)).rejects.toThrow(ConflictException);
      expect(prisma.person.create).not.toHaveBeenCalled();
    });
  });

  describe('linkClinicUser', () => {
    const dto = { personId: 'person-1', role: Role.ADMIN };

    it('deve lançar NotFoundException quando clínica não existe', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.linkClinicUser('org-x', dto)).rejects.toThrow(NotFoundException);
    });

    it('deve lançar NotFoundException quando pessoa não existe', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockClinic);
      prisma.person.findUnique.mockResolvedValue(null);

      await expect(service.linkClinicUser('org-1', dto)).rejects.toThrow(NotFoundException);
    });

    it('deve reaproveitar vínculo ativo com mesma role', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockClinic);
      prisma.person.findUnique.mockResolvedValue(mockPerson);
      prisma.organizationUser.findUnique.mockResolvedValue({
        id: 'ou-1',
        organizationId: 'org-1',
        personId: 'person-1',
        role: Role.ADMIN,
        active: true,
      });

      const result = await service.linkClinicUser('org-1', dto);

      expect(result).toEqual({ organizationUserId: 'ou-1', reused: true });
      expect(prisma.organizationUser.create).not.toHaveBeenCalled();
      expect(prisma.organizationUser.update).not.toHaveBeenCalled();
    });

    it('deve reativar e ajustar role em vínculo inativo', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockClinic);
      prisma.person.findUnique.mockResolvedValue(mockPerson);
      prisma.organizationUser.findUnique.mockResolvedValue({
        id: 'ou-1',
        organizationId: 'org-1',
        personId: 'person-1',
        role: Role.PROFESSIONAL,
        active: false,
      });
      prisma.organizationUser.update.mockResolvedValue({ id: 'ou-1' });

      const result = await service.linkClinicUser('org-1', dto);

      expect(prisma.organizationUser.update).toHaveBeenCalledWith({
        where: { id: 'ou-1' },
        data: { active: true, role: Role.ADMIN },
      });
      expect(result.reused).toBe(true);
    });

    it('deve criar vínculo quando não existe', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockClinic);
      prisma.person.findUnique.mockResolvedValue(mockPerson);
      prisma.organizationUser.findUnique.mockResolvedValue(null);
      prisma.organizationUser.create.mockResolvedValue({ id: 'ou-new' });

      const result = await service.linkClinicUser('org-1', dto);

      expect(prisma.organizationUser.create).toHaveBeenCalledWith({
        data: { organizationId: 'org-1', personId: 'person-1', role: Role.ADMIN },
      });
      expect(result).toEqual({ organizationUserId: 'ou-new', reused: false });
    });

    it('deve usar role padrão ADMIN quando não informada', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockClinic);
      prisma.person.findUnique.mockResolvedValue(mockPerson);
      prisma.organizationUser.findUnique.mockResolvedValue(null);
      prisma.organizationUser.create.mockResolvedValue({ id: 'ou-new' });

      await service.linkClinicUser('org-1', { personId: 'person-1' });

      expect(prisma.organizationUser.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: Role.ADMIN }) }),
      );
    });
  });

  describe('listClinicUsers', () => {
    it('deve lançar NotFoundException quando clínica não existe', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.listClinicUsers('x')).rejects.toThrow(NotFoundException);
    });

    it('deve mapear OrganizationUser + Person para shape público', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockClinic);
      prisma.organizationUser.findMany.mockResolvedValue([
        {
          id: 'ou-1',
          role: Role.ADMIN,
          active: true,
          createdAt: new Date('2026-01-01'),
          person: { ...mockPerson, active: true },
        },
      ]);

      const result = await service.listClinicUsers('org-1');

      expect(result).toEqual([
        expect.objectContaining({
          organizationUserId: 'ou-1',
          personId: mockPerson.id,
          cpf: mockPerson.cpf,
          role: Role.ADMIN,
          linkActive: true,
          personActive: true,
        }),
      ]);
    });
  });

  describe('updateClinicUser', () => {
    it('deve lançar NotFoundException quando vínculo não existe ou é de outra clínica', async () => {
      prisma.organizationUser.findUnique.mockResolvedValueOnce(null);
      await expect(service.updateClinicUser('org-1', 'ou-x', { active: false })).rejects.toThrow(
        NotFoundException,
      );

      prisma.organizationUser.findUnique.mockResolvedValueOnce({
        id: 'ou-1',
        organizationId: 'org-outra',
        personId: 'p-1',
        role: Role.ADMIN,
        active: true,
      });
      await expect(service.updateClinicUser('org-1', 'ou-1', { active: false })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve atualizar somente campos fornecidos', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue({
        id: 'ou-1',
        organizationId: 'org-1',
        personId: 'p-1',
        role: Role.ADMIN,
        active: true,
      });
      prisma.organizationUser.update.mockResolvedValue({
        id: 'ou-1',
        active: false,
        role: Role.ADMIN,
      });

      const result = await service.updateClinicUser('org-1', 'ou-1', { active: false });

      expect(prisma.organizationUser.update).toHaveBeenCalledWith({
        where: { id: 'ou-1' },
        data: { active: false },
      });
      expect(result).toEqual({ organizationUserId: 'ou-1', active: false, role: Role.ADMIN });
    });
  });

  describe('resetClinicUserPassword', () => {
    it('deve lançar NotFoundException quando vínculo não pertence à clínica', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue({
        id: 'ou-1',
        organizationId: 'org-outra',
        personId: 'p-1',
      });

      await expect(
        service.resetClinicUserPassword('org-1', 'ou-1', { password: 'nova-senha' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve atualizar hash da senha da pessoa vinculada', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue({
        id: 'ou-1',
        organizationId: 'org-1',
        personId: 'p-1',
      });
      prisma.person.update = jest.fn().mockResolvedValue({ id: 'p-1' });

      const result = await service.resetClinicUserPassword('org-1', 'ou-1', {
        password: 'nova-senha',
      });

      expect(prisma.person.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p-1' },
          data: expect.objectContaining({ passwordHash: expect.any(String) }),
        }),
      );
      expect(result).toEqual({ personId: 'p-1' });
    });
  });
});
