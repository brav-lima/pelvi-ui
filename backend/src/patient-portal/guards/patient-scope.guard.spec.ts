import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PatientScopeGuard } from './patient-scope.guard';

describe('PatientScopeGuard', () => {
  let guard: PatientScopeGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const makeContext = (user: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PatientScopeGuard(reflector as unknown as Reflector);
  });

  it('permite quando a rota não exige sessão completa', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(makeContext({ scope: 'patient-consent' }))).toBe(true);
  });

  it('permite sessão completa quando a rota exige', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(guard.canActivate(makeContext({ scope: 'patient' }))).toBe(true);
  });

  it('rejeita sessão só-de-consentimento quando a rota exige sessão completa', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(() => guard.canActivate(makeContext({ scope: 'patient-consent' }))).toThrow(
      ForbiddenException,
    );
  });
});
