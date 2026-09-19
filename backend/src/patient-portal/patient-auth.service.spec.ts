import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PatientAuthService } from './patient-auth.service';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientLookupService } from '../patient/patient-lookup.service';
import { RedisService } from '../redis/redis.service';

describe('PatientAuthService', () => {
  let service: PatientAuthService;
  let accounts: { findByCpf: jest.Mock; findById: jest.Mock };
  let links: { findAllByAccountId: jest.Mock; findById: jest.Mock };
  let patientLookup: { findById: jest.Mock };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let config: { getOrThrow: jest.Mock };
  let redis: { set: jest.Mock; get: jest.Mock; del: jest.Mock };

  const passwordHash = bcrypt.hashSync('senha123', 10);
  const account = { id: 'acc-1', cpf: '12345678901', passwordHash, status: 'ACTIVE', activatedAt: new Date() };

  beforeEach(async () => {
    accounts = { findByCpf: jest.fn(), findById: jest.fn() };
    links = { findAllByAccountId: jest.fn(), findById: jest.fn() };
    patientLookup = { findById: jest.fn().mockResolvedValue({ organizationName: 'Clínica A' }) };
    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn().mockReturnValue({ sub: 'acc-1', type: 'patient-pre-auth' }),
    };
    config = { getOrThrow: jest.fn().mockReturnValue('refresh-secret') };
    redis = { set: jest.fn(), get: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientAuthService,
        { provide: PatientAccountService, useValue: accounts },
        { provide: PatientAccountLinkService, useValue: links },
        { provide: PatientLookupService, useValue: patientLookup },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<PatientAuthService>(PatientAuthService);
  });

  describe('login', () => {
    it('rejeita CPF inexistente', async () => {
      accounts.findByCpf.mockResolvedValue(null);

      await expect(service.login('00000000000', 'senha123')).rejects.toThrow(UnauthorizedException);
    });

    it('rejeita senha incorreta', async () => {
      accounts.findByCpf.mockResolvedValue(account);

      await expect(service.login('12345678901', 'errada')).rejects.toThrow(UnauthorizedException);
    });

    it('rejeita conta sem vínculo ativo nem pendente', async () => {
      accounts.findByCpf.mockResolvedValue(account);
      links.findAllByAccountId.mockResolvedValue([]);

      await expect(service.login('12345678901', 'senha123')).rejects.toThrow(UnauthorizedException);
    });

    it('emite token só-de-consentimento quando não há vínculo ativo mas há pendente', async () => {
      accounts.findByCpf.mockResolvedValue(account);
      links.findAllByAccountId.mockResolvedValue([
        { id: 'link-1', patientId: 'patient-1', organizationId: 'org-1', status: 'PENDING_CONSENT', invitedAt: new Date() },
      ]);

      const result = await service.login('12345678901', 'senha123');

      expect(result.scope).toBe('patient-consent');
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBeNull();
      expect(result.pendingConsents).toHaveLength(1);
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('emite sessão completa quando há exatamente um vínculo ativo', async () => {
      accounts.findByCpf.mockResolvedValue(account);
      links.findAllByAccountId.mockResolvedValue([
        { id: 'link-1', patientId: 'patient-1', organizationId: 'org-1', status: 'ACTIVE', invitedAt: new Date() },
      ]);

      const result = await service.login('12345678901', 'senha123');

      expect(result.scope).toBe('patient');
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.patientId).toBe('patient-1');
      expect(result.organizationId).toBe('org-1');
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^patient-refresh:/),
        'acc-1',
        expect.any(Number),
      );
    });

    it('emite preAuthToken quando há mais de um vínculo ativo', async () => {
      accounts.findByCpf.mockResolvedValue(account);
      links.findAllByAccountId.mockResolvedValue([
        { id: 'link-1', patientId: 'patient-1', organizationId: 'org-1', status: 'ACTIVE', invitedAt: new Date() },
        { id: 'link-2', patientId: 'patient-2', organizationId: 'org-2', status: 'ACTIVE', invitedAt: new Date() },
      ]);

      const result = await service.login('12345678901', 'senha123');

      expect(result.accessToken).toBeNull();
      expect(result.preAuthToken).toBe('mock-token');
      expect(result.organizations).toHaveLength(2);
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('selectLink', () => {
    it('rejeita vínculo inválido ou de outra conta', async () => {
      links.findById.mockResolvedValue({ id: 'link-1', patientAccountId: 'acc-2', status: 'ACTIVE' });

      await expect(service.selectLink('pre-auth-token', 'link-1')).rejects.toThrow(UnauthorizedException);
    });

    it('emite sessão completa para o vínculo escolhido', async () => {
      links.findById.mockResolvedValue({
        id: 'link-1', patientAccountId: 'acc-1', patientId: 'patient-1',
        organizationId: 'org-1', status: 'ACTIVE', invitedAt: new Date(),
      });
      links.findAllByAccountId.mockResolvedValue([
        { id: 'link-1', patientId: 'patient-1', organizationId: 'org-1', status: 'ACTIVE', invitedAt: new Date() },
      ]);

      const result = await service.selectLink('pre-auth-token', 'link-1');

      expect(result.accessToken).toBe('mock-token');
      expect(result.patientId).toBe('patient-1');
    });
  });

  describe('rotateRefreshToken', () => {
    it('rejeita quando o hash não existe no Redis', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.rotateRefreshToken('acc-1', 'link-1', 'jti-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejeita quando o token pertence a outra conta', async () => {
      redis.get.mockResolvedValue('outra-conta');

      await expect(service.rotateRefreshToken('acc-1', 'link-1', 'jti-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejeita e apaga o token quando o vínculo não está mais ativo', async () => {
      redis.get.mockResolvedValue('acc-1');
      links.findById.mockResolvedValue({ id: 'link-1', patientAccountId: 'acc-1', status: 'DECLINED' });

      await expect(service.rotateRefreshToken('acc-1', 'link-1', 'jti-1')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(redis.del).toHaveBeenCalledWith(expect.stringMatching(/^patient-refresh:/));
    });

    it('revoga o token consumido e emite novo par no caminho feliz', async () => {
      redis.get.mockResolvedValue('acc-1');
      links.findById.mockResolvedValue({
        id: 'link-1', patientAccountId: 'acc-1', patientId: 'patient-1',
        organizationId: 'org-1', status: 'ACTIVE',
      });

      const result = await service.rotateRefreshToken('acc-1', 'link-1', 'jti-1');

      expect(redis.del).toHaveBeenCalledWith(expect.stringMatching(/^patient-refresh:/));
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
    });
  });

  describe('logout', () => {
    it('revoga o refresh token e coloca o access jti na blacklist', async () => {
      jwtService.verify.mockReturnValue({ jti: 'refresh-jti-1' });

      await service.logout('some-refresh-token', 'access-jti-1');

      expect(redis.del).toHaveBeenCalledWith(expect.stringMatching(/^patient-refresh:/));
      expect(redis.set).toHaveBeenCalledWith('patient-blacklist:access-jti-1', '1', expect.any(Number));
    });

    it('ainda coloca o access jti na blacklist quando o refresh token é inválido', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('expired');
      });

      await service.logout('invalid-refresh-token', 'access-jti-1');

      expect(redis.set).toHaveBeenCalledWith('patient-blacklist:access-jti-1', '1', expect.any(Number));
    });
  });
});
