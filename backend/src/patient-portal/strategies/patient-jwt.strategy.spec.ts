import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { PatientJwtStrategy } from './patient-jwt.strategy';
import { RedisService } from '../../redis/redis.service';

describe('PatientJwtStrategy', () => {
  let strategy: PatientJwtStrategy;
  let redis: { exists: jest.Mock };

  beforeEach(async () => {
    redis = { exists: jest.fn().mockResolvedValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientJwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('secret') } },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    strategy = module.get<PatientJwtStrategy>(PatientJwtStrategy);
  });

  it('aceita um payload de sessão completa da paciente', async () => {
    const payload = {
      sub: 'account-1', scope: 'patient' as const, linkId: 'link-1',
      patientId: 'patient-1', organizationId: 'org-1', jti: 'jti-1',
    };

    await expect(strategy.validate(payload)).resolves.toEqual(payload);
  });

  it('aceita um payload só-de-consentimento (sem linkId/patientId/organizationId)', async () => {
    const payload = { sub: 'account-1', scope: 'patient-consent' as const, jti: 'jti-1' };

    await expect(strategy.validate(payload)).resolves.toEqual(payload);
  });

  it('rejeita um token revogado (jti na blacklist)', async () => {
    redis.exists.mockResolvedValue(true);
    const payload = { sub: 'account-1', scope: 'patient' as const, jti: 'jti-1' };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita um payload profissional (sem scope)', async () => {
    const professionalPayload = {
      sub: 'person-1', organizationId: 'org-1', role: 'ADMIN', jti: 'jti-1',
    } as any;

    await expect(strategy.validate(professionalPayload)).rejects.toThrow(UnauthorizedException);
  });
});
