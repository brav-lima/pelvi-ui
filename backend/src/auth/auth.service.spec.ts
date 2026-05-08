import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { PersonService } from '../person/person.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { person: any; organizationUser: any; refreshToken: any };
  let personService: { findOrganizations: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let config: { getOrThrow: jest.Mock };

  beforeEach(async () => {
    prisma = {
      person: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      organizationUser: { findUnique: jest.fn() },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    personService = { findOrganizations: jest.fn() };
    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
    };
    config = { getOrThrow: jest.fn().mockReturnValue('refresh-secret') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PersonService, useValue: personService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
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

    it('deve emitir tokens e persistir hash do refresh quando há apenas uma clínica', async () => {
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
        expect.objectContaining({
          sub: 'person-1',
          organizationId: 'org-1',
          role: 'ADMIN',
          type: 'refresh',
          jti: expect.any(String),
        }),
        expect.objectContaining({ secret: 'refresh-secret', expiresIn: '7d' }),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          personId: 'person-1',
          tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
          expiresAt: expect.any(Date),
        }),
      });
      const persistedHash = prisma.refreshToken.create.mock.calls[0][0].data.tokenHash;
      const signedJti = jwtService.sign.mock.calls[1][0].jti;
      expect(persistedHash).not.toBe(signedJti);
    });

    it('deve retornar lista de organizações quando há múltiplas e não persistir refresh', async () => {
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
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
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
    it('deve gerar e persistir refresh para vínculo válido', async () => {
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
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ personId: 'person-1' }),
      });
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

  describe('rotateRefreshToken', () => {
    const validJti = 'jti-abc';
    const personId = 'person-1';
    const organizationId = 'org-1';
    const futureExpiry = new Date(Date.now() + 60 * 60 * 1000);
    const pastExpiry = new Date(Date.now() - 60 * 1000);

    function activeStored(over: Partial<any> = {}) {
      return {
        id: 'rt-1',
        personId,
        tokenHash: 'h',
        expiresAt: futureExpiry,
        revokedAt: null,
        createdAt: new Date(),
        ...over,
      };
    }

    it('deve revogar a linha corrente e emitir novo par no caminho feliz', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(activeStored());
      prisma.organizationUser.findUnique.mockResolvedValue({
        active: true,
        role: 'ADMIN',
        person: { active: true },
      });

      const result = await service.rotateRefreshToken(personId, organizationId, validJti);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
    });

    it('deve revogar toda a família ao detectar reuso de refresh já revogado', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        activeStored({ revokedAt: new Date() }),
      );

      await expect(
        service.rotateRefreshToken(personId, organizationId, validJti),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { personId, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('deve rejeitar quando hash não existe no banco', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.rotateRefreshToken(personId, organizationId, validJti),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('deve rejeitar quando o token pertence a outro personId', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        activeStored({ personId: 'outro-person' }),
      );

      await expect(
        service.rotateRefreshToken(personId, organizationId, validJti),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('deve rejeitar quando o refresh está expirado', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        activeStored({ expiresAt: pastExpiry }),
      );

      await expect(
        service.rotateRefreshToken(personId, organizationId, validJti),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve revogar a família quando o vínculo foi inativado mesmo com token válido', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(activeStored());
      prisma.organizationUser.findUnique.mockResolvedValue({
        active: false,
        role: 'ADMIN',
        person: { active: true },
      });

      await expect(
        service.rotateRefreshToken(personId, organizationId, validJti),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { personId, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('revokeRefreshToken', () => {
    it('deve marcar revokedAt na linha correspondente ao jti (somente se ainda ativa)', async () => {
      await service.revokeRefreshToken('jti-xyz');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
