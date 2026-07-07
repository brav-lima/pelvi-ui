import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as Sentry from '@sentry/nestjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { PersonService } from '../person/person.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';

jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { person: any; organizationUser: any };
  let personService: { findOrganizations: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let config: { getOrThrow: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock; exists: jest.Mock };
  let emailService: { sendPasswordReset: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
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
      verify: jest.fn().mockReturnValue({ sub: 'person-1', type: 'pre-auth' }),
    };
    config = { getOrThrow: jest.fn().mockReturnValue('refresh-secret') };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
    };
    emailService = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PersonService, useValue: personService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
        { provide: RedisService, useValue: redis },
        { provide: EmailService, useValue: emailService },
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
        expect.objectContaining({ sub: 'person-1', organizationId: 'org-1', role: 'ADMIN', jti: expect.any(String) }),
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
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh:/),
        'person-1',
        expect.any(Number),
      );
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
      expect((result as any).preAuthToken).toBe('mock-token');
      expect(result.organizations).toHaveLength(2);
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('deve rejeitar CPF inexistente e emitir warn sem CPF', async () => {
      prisma.person.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ cpf: '00000000000', password: 'senha123' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(Sentry.logger.warn).toHaveBeenCalledWith('login failed');
      const warnCalls = (Sentry.logger.warn as jest.Mock).mock.calls;
      expect(JSON.stringify(warnCalls)).not.toContain('00000000000');
    });

    it('deve rejeitar senha incorreta e emitir warn sem senha', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);

      await expect(
        service.login({ cpf: '12345678901', password: 'errada' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(Sentry.logger.warn).toHaveBeenCalledWith('login failed');
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
    const validPreAuthToken = 'valid-pre-auth-token';

    it('deve gerar e persistir refresh para vínculo válido', async () => {
      jwtService.verify.mockReturnValue({ sub: 'person-1', type: 'pre-auth' });
      prisma.organizationUser.findUnique.mockResolvedValue({
        active: true,
        role: 'ADMIN',
        person: { id: 'person-1', cpf: '12345678901', name: 'João', email: 'j@e.com' },
        organization: { id: 'org-1', name: 'Clínica A' },
      });

      const result = await service.selectOrganization({
        preAuthToken: validPreAuthToken,
        organizationId: 'org-1',
      });

      expect(result.accessToken).toBe('mock-token');
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh:/),
        'person-1',
        expect.any(Number),
      );
    });

    it('deve rejeitar vínculo inativo', async () => {
      jwtService.verify.mockReturnValue({ sub: 'person-1', type: 'pre-auth' });
      prisma.organizationUser.findUnique.mockResolvedValue({
        active: false,
        role: 'ADMIN',
        person: { id: 'person-1', cpf: '12345678901', name: 'João', email: 'j@e.com' },
        organization: { id: 'org-1', name: 'Clínica A' },
      });

      await expect(
        service.selectOrganization({
          preAuthToken: validPreAuthToken,
          organizationId: 'org-1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve rejeitar token de pré-autenticação inválido', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('invalid token'); });

      await expect(
        service.selectOrganization({
          preAuthToken: 'invalid-token',
          organizationId: 'org-1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve rejeitar token com type incorreto', async () => {
      jwtService.verify.mockReturnValue({ sub: 'person-1', type: 'access' });

      await expect(
        service.selectOrganization({
          preAuthToken: 'wrong-type-token',
          organizationId: 'org-1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('switchOrganization', () => {
    const currentUser = { sub: 'person-1', organizationId: 'org-1', role: 'ADMIN', jti: 'access-jti-1' };

    it('deve trocar de organização, revogar refresh anterior e retornar a lista de clínicas', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue({
        active: true,
        role: 'PROFESSIONAL',
        person: { id: 'person-1', cpf: '12345678901', name: 'João', email: 'j@e.com' },
        organization: { id: 'org-2', name: 'Clínica B' },
      });
      personService.findOrganizations.mockResolvedValue([
        { id: 'org-user-1', role: 'ADMIN', organization: { id: 'org-1', name: 'Clínica A' } },
        { id: 'org-user-2', role: 'PROFESSIONAL', organization: { id: 'org-2', name: 'Clínica B' } },
      ]);

      const result = await service.switchOrganization(currentUser, 'org-2', 'refresh-jti-1', 'access-jti-1');

      expect(redis.del).toHaveBeenCalledWith(expect.stringMatching(/^refresh:/));
      expect(result.accessToken).toBe('mock-token');
      expect(result.organization.id).toBe('org-2');
      expect(result.role).toBe('PROFESSIONAL');
      expect(result.organizations).toHaveLength(2);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'person-1', organizationId: 'org-2', role: 'PROFESSIONAL', jti: expect.any(String) }),
        { expiresIn: '15m' },
      );
    });

    it('deve rejeitar quando não há vínculo com a organização alvo', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(null);

      await expect(
        service.switchOrganization(currentUser, 'org-2', 'refresh-jti-1', 'access-jti-1'),
      ).rejects.toThrow(UnauthorizedException);
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('deve rejeitar quando o vínculo com a organização alvo está inativo', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue({
        active: false,
        role: 'PROFESSIONAL',
        person: { id: 'person-1', cpf: '12345678901', name: 'João', email: 'j@e.com' },
        organization: { id: 'org-2', name: 'Clínica B' },
      });

      await expect(
        service.switchOrganization(currentUser, 'org-2', 'refresh-jti-1', 'access-jti-1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('não tenta revogar refresh quando refreshJti não é fornecido', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue({
        active: true,
        role: 'PROFESSIONAL',
        person: { id: 'person-1', cpf: '12345678901', name: 'João', email: 'j@e.com' },
        organization: { id: 'org-2', name: 'Clínica B' },
      });
      personService.findOrganizations.mockResolvedValue([]);

      await service.switchOrganization(currentUser, 'org-2', undefined, 'access-jti-1');

      expect(redis.del).not.toHaveBeenCalled();
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

    it('deve revogar o token consumido e emitir novo par no caminho feliz', async () => {
      redis.get.mockResolvedValue(personId);
      prisma.organizationUser.findUnique.mockResolvedValue({
        active: true,
        role: 'ADMIN',
        person: { active: true },
      });

      const result = await service.rotateRefreshToken(personId, organizationId, validJti);

      expect(redis.del).toHaveBeenCalledWith(expect.stringMatching(/^refresh:/));
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh:/),
        personId,
        expect.any(Number),
      );
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
    });

    it('deve rejeitar quando o hash não existe no Redis e emitir warn com personId', async () => {
      redis.get.mockResolvedValue(null);

      await expect(
        service.rotateRefreshToken(personId, organizationId, validJti),
      ).rejects.toThrow(UnauthorizedException);
      expect(redis.del).not.toHaveBeenCalled();

      expect(Sentry.logger.warn).toHaveBeenCalledWith(
        'refresh rejected: invalid_token',
        { personId },
      );
    });

    it('deve rejeitar quando o token pertence a outro personId', async () => {
      redis.get.mockResolvedValue('outro-person');

      await expect(
        service.rotateRefreshToken(personId, organizationId, validJti),
      ).rejects.toThrow(UnauthorizedException);
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('deve revogar o token, rejeitar quando o vínculo foi inativado e emitir warn', async () => {
      redis.get.mockResolvedValue(personId);
      prisma.organizationUser.findUnique.mockResolvedValue({
        active: false,
        role: 'ADMIN',
        person: { active: true },
      });

      await expect(
        service.rotateRefreshToken(personId, organizationId, validJti),
      ).rejects.toThrow(UnauthorizedException);

      expect(redis.del).toHaveBeenCalledWith(expect.stringMatching(/^refresh:/));
      expect(Sentry.logger.warn).toHaveBeenCalledWith(
        'refresh rejected: inactive_link',
        { personId },
      );
    });
  });

  describe('revokeRefreshToken', () => {
    it('deve remover o token do Redis', async () => {
      await service.revokeRefreshToken('jti-xyz');
      expect(redis.del).toHaveBeenCalledWith(expect.stringMatching(/^refresh:/));
    });

    it('deve adicionar access jti à blacklist quando fornecido', async () => {
      await service.revokeRefreshToken('jti-xyz', 'access-jti-abc');
      expect(redis.set).toHaveBeenCalledWith(
        'blacklist:access-jti-abc',
        '1',
        expect.any(Number),
      );
    });
  });

  describe('requestPasswordReset', () => {
    it('deve armazenar token no Redis e enviar e-mail quando e-mail existe', async () => {
      prisma.person.findUnique.mockResolvedValue({
        id: 'person-1',
        name: 'João',
        email: 'joao@email.com',
        active: true,
      });

      await service.requestPasswordReset('joao@email.com');

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^pwd-reset:/),
        'person-1',
        1800,
      );
      expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
        'joao@email.com',
        'João',
        expect.stringContaining('/redefinir-senha?token='),
      );
    });

    it('deve retornar sem erro quando e-mail não existe (não vaza informação)', async () => {
      prisma.person.findUnique.mockResolvedValue(null);

      await expect(service.requestPasswordReset('naoexiste@email.com')).resolves.not.toThrow();
      expect(redis.set).not.toHaveBeenCalled();
      expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('deve atualizar passwordHash e apagar token do Redis quando token válido', async () => {
      redis.get.mockResolvedValue('person-1');
      prisma.person.update.mockResolvedValue({});

      await service.resetPassword('valid-token-64chars', 'novaSenha123');

      expect(prisma.person.update).toHaveBeenCalledWith({
        where: { id: 'person-1' },
        data: { passwordHash: expect.any(String) },
      });
      expect(redis.del).toHaveBeenCalledWith('pwd-reset:valid-token-64chars');
    });

    it('deve lançar BadRequestException quando token inválido ou expirado', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.resetPassword('token-invalido', 'novaSenha123'))
        .rejects.toThrow('Token inválido ou expirado');
    });
  });
});
