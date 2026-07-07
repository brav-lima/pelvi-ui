import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { RolesGuard } from './roles.guard';

jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
  logger: { warn: jest.fn() },
}));

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const makeContext = (user: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('permite quando não há roles exigidas', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(makeContext({ role: 'RECEPTIONIST' }))).toBe(true);
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
  });

  it('permite quando role do usuário está na lista exigida', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN', 'PROFESSIONAL']);

    expect(guard.canActivate(makeContext({ role: 'ADMIN' }))).toBe(true);
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
  });

  it('emite breadcrumb e lança ForbiddenException quando role não autorizada', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(() => guard.canActivate(makeContext({ role: 'RECEPTIONIST' }))).toThrow(
      ForbiddenException,
    );
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'authz',
      message: 'role denied',
      level: 'warning',
      data: { requiredRoles: ['ADMIN'], role: 'RECEPTIONIST' },
    });
    expect(Sentry.logger.warn).toHaveBeenCalledWith('role denied', {
      requiredRoles: ['ADMIN'],
      role: 'RECEPTIONIST',
    });
  });
});
