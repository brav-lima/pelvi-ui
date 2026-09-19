import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { RedisService } from '../../redis/redis.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let redis: { exists: jest.Mock };

  beforeEach(async () => {
    redis = { exists: jest.fn().mockResolvedValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('secret') } },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('aceita um payload profissional válido', async () => {
    const payload = { sub: 'person-1', organizationId: 'org-1', role: 'ADMIN', jti: 'jti-1' };

    await expect(strategy.validate(payload)).resolves.toEqual(payload);
  });

  it('rejeita um token revogado (jti na blacklist)', async () => {
    redis.exists.mockResolvedValue(true);
    const payload = { sub: 'person-1', organizationId: 'org-1', role: 'ADMIN', jti: 'jti-1' };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita um payload de paciente (carrega scope)', async () => {
    const patientPayload = {
      sub: 'account-1',
      scope: 'patient',
      linkId: 'link-1',
      patientId: 'patient-1',
      organizationId: 'org-1',
      jti: 'jti-1',
    } as any;

    await expect(strategy.validate(patientPayload)).rejects.toThrow(UnauthorizedException);
  });
});
