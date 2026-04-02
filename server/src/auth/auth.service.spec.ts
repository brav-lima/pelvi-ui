import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { PersonService } from '../person/person.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { person: any; organizationUser: any };
  let personService: { findOrganizations: jest.Mock };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      person: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      organizationUser: { findUnique: jest.fn() },
    };
    personService = { findOrganizations: jest.fn() };
    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PersonService, useValue: personService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    const hashedPassword = bcrypt.hashSync('senha123', 10);
    const mockPerson = {
      id: 'person-1',
      cpf: '12345678901',
      name: 'João',
      email: 'joao@email.com',
      passwordHash: hashedPassword,
      active: true,
    };

    it('deve retornar token quando há apenas uma clínica', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);
      personService.findOrganizations.mockResolvedValue([
        {
          id: 'org-user-1',
          role: 'ADMIN',
          organization: { id: 'org-1', name: 'Clínica A' },
        },
      ]);

      const result = await service.login({
        cpf: '12345678901',
        password: 'senha123',
      });

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.person.id).toBe('person-1');
      expect(result.organization).toBeDefined();
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'person-1', organizationId: 'org-1', role: 'ADMIN' },
        { expiresIn: '15m' },
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'person-1', organizationId: 'org-1', role: 'ADMIN', type: 'refresh' },
        { expiresIn: '7d' },
      );
    });

    it('deve retornar lista de organizações quando há múltiplas', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);
      personService.findOrganizations.mockResolvedValue([
        {
          id: 'org-user-1',
          role: 'ADMIN',
          organization: { id: 'org-1', name: 'Clínica A' },
        },
        {
          id: 'org-user-2',
          role: 'PROFESSIONAL',
          organization: { id: 'org-2', name: 'Clínica B' },
        },
      ]);

      const result = await service.login({
        cpf: '12345678901',
        password: 'senha123',
      });

      expect(result.accessToken).toBeNull();
      expect(result.refreshToken).toBeNull();
      expect(result.organizations).toHaveLength(2);
    });

    it('deve rejeitar CPF inexistente', async () => {
      prisma.person.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ cpf: '00000000000', password: 'senha123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve rejeitar senha incorreta', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);

      await expect(
        service.login({ cpf: '12345678901', password: 'errada' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve rejeitar usuário inativo', async () => {
      prisma.person.findUnique.mockResolvedValue({
        ...mockPerson,
        active: false,
      });

      await expect(
        service.login({ cpf: '12345678901', password: 'senha123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve rejeitar quando não há clínicas vinculadas', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);
      personService.findOrganizations.mockResolvedValue([]);

      await expect(
        service.login({ cpf: '12345678901', password: 'senha123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('selectOrganization', () => {
    it('deve gerar token para vínculo válido', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue({
        active: true,
        role: 'ADMIN',
        person: { id: 'person-1', cpf: '12345678901', name: 'João', email: 'j@e.com' },
        organization: { id: 'org-1', name: 'Clínica A' },
      });

      const result = await service.selectOrganization({
        personId: 'person-1',
        organizationId: 'org-1',
      });

      expect(result.accessToken).toBe('mock-token');
    });

    it('deve rejeitar vínculo inativo', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue({
        active: false,
        role: 'ADMIN',
        person: { id: 'person-1', cpf: '12345678901', name: 'João', email: 'j@e.com' },
        organization: { id: 'org-1', name: 'Clínica A' },
      });

      await expect(
        service.selectOrganization({
          personId: 'person-1',
          organizationId: 'org-1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    const payload = { sub: 'person-1', organizationId: 'org-1', role: 'ADMIN' as any };

    it('deve retornar dados da pessoa e da organização', async () => {
      const person = { id: 'person-1', cpf: '12345678901', name: 'João', email: 'j@e.com', phone: null };
      const org = { id: 'org-1', name: 'Clínica A' };
      prisma.person.findUnique.mockResolvedValue(person);
      prisma.organizationUser.findUnique.mockResolvedValue({ organization: org });

      const result = await service.getProfile(payload);

      expect(result.person).toEqual(person);
      expect(result.organization).toEqual(org);
      expect(result.role).toBe('ADMIN');
    });

    it('deve retornar organization null quando vínculo não encontrado', async () => {
      prisma.person.findUnique.mockResolvedValue({ id: 'person-1' });
      prisma.organizationUser.findUnique.mockResolvedValue(null);

      const result = await service.getProfile(payload);

      expect(result.organization).toBeNull();
    });
  });

  describe('updateProfile', () => {
    const payload = { sub: 'person-1', organizationId: 'org-1', role: 'ADMIN' as any };

    it('deve lançar ConflictException quando email já pertence a outro usuário', async () => {
      prisma.person.findFirst.mockResolvedValue({ id: 'person-2', email: 'outro@email.com' });

      await expect(
        service.updateProfile(payload, { email: 'outro@email.com' }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.person.update).not.toHaveBeenCalled();
    });

    it('deve atualizar perfil quando dados são válidos', async () => {
      prisma.person.findFirst.mockResolvedValue(null);
      prisma.person.update.mockResolvedValue({ id: 'person-1', name: 'Novo Nome' });

      await service.updateProfile(payload, { name: 'Novo Nome' });

      expect(prisma.person.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'person-1' } }),
      );
    });
  });

  describe('changePassword', () => {
    const payload = { sub: 'person-1', organizationId: 'org-1', role: 'ADMIN' as any };
    const hashedPassword = bcrypt.hashSync('senha-atual', 10);

    it('deve lançar UnauthorizedException quando usuário não encontrado', async () => {
      prisma.person.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword(payload, { currentPassword: 'x', newPassword: 'y' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException quando senha atual incorreta', async () => {
      prisma.person.findUnique.mockResolvedValue({ id: 'person-1', passwordHash: hashedPassword });

      await expect(
        service.changePassword(payload, { currentPassword: 'errada', newPassword: 'nova' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve atualizar senha com hash quando dados são válidos', async () => {
      prisma.person.findUnique.mockResolvedValue({ id: 'person-1', passwordHash: hashedPassword });
      prisma.person.update.mockResolvedValue({});

      const result = await service.changePassword(payload, {
        currentPassword: 'senha-atual',
        newPassword: 'nova-senha',
      });

      const callData = prisma.person.update.mock.calls[0][0].data;
      expect(callData.passwordHash).toBeDefined();
      const isValid = await bcrypt.compare('nova-senha', callData.passwordHash);
      expect(isValid).toBe(true);
      expect(result.message).toBeDefined();
    });
  });

  describe('refreshAccessToken', () => {
    it('deve retornar novos tokens quando refresh token é válido', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'person-1',
        organizationId: 'org-1',
        role: 'ADMIN',
        type: 'refresh',
      });

      const result = await service.refreshAccessToken({ refreshToken: 'valid-refresh' });

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
    });

    it('deve lançar UnauthorizedException quando token não é do tipo refresh', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'person-1',
        type: 'access', // tipo errado
      });

      await expect(
        service.refreshAccessToken({ refreshToken: 'wrong-type-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException quando refresh token é inválido ou expirado', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('jwt expired'); });

      await expect(
        service.refreshAccessToken({ refreshToken: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
