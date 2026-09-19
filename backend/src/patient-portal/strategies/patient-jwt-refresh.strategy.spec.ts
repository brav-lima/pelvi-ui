import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { PatientJwtRefreshStrategy } from './patient-jwt-refresh.strategy';

describe('PatientJwtRefreshStrategy', () => {
  let strategy: PatientJwtRefreshStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientJwtRefreshStrategy,
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('refresh-secret') } },
      ],
    }).compile();

    strategy = module.get<PatientJwtRefreshStrategy>(PatientJwtRefreshStrategy);
  });

  it('aceita um payload de refresh de paciente válido', () => {
    const payload = {
      sub: 'account-1',
      scope: 'patient' as const,
      linkId: 'link-1',
      patientId: 'patient-1',
      organizationId: 'org-1',
      jti: 'jti-1',
      type: 'patient-refresh' as const,
    };

    expect(strategy.validate(payload)).toEqual({ accountId: 'account-1', linkId: 'link-1', jti: 'jti-1' });
  });

  it('rejeita um payload com scope/type incorretos (ex.: token profissional ou pré-auth)', () => {
    const wrongScope = {
      sub: 'account-1',
      scope: 'patient-preauth',
      linkId: 'link-1',
      patientId: 'patient-1',
      organizationId: 'org-1',
      jti: 'jti-1',
      type: 'patient-refresh',
    } as any;
    const wrongType = {
      sub: 'account-1',
      scope: 'patient',
      linkId: 'link-1',
      patientId: 'patient-1',
      organizationId: 'org-1',
      jti: 'jti-1',
      type: 'patient-pre-auth',
    } as any;

    expect(() => strategy.validate(wrongScope)).toThrow(UnauthorizedException);
    expect(() => strategy.validate(wrongType)).toThrow(UnauthorizedException);
  });
});
