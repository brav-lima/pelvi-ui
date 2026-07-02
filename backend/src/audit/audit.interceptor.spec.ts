import { of, lastValueFrom } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditService: { log: jest.Mock };

  const makeContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as unknown as ExecutionContext;

  const next: CallHandler = { handle: () => of({ ok: true }) };

  const user = { sub: 'user-1', organizationId: 'org-1' };

  beforeEach(() => {
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    interceptor = new AuditInterceptor(auditService as unknown as AuditService);
  });

  it('extrai entity e entityId de rota versionada /api/v1/patients/:id', async () => {
    const ctx = makeContext({
      method: 'PATCH',
      url: '/api/v1/patients/abc-123',
      user,
      ip: '1.2.3.4',
    });

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'Patient',
        entityId: 'abc-123',
        action: 'UPDATE',
      }),
    );
  });

  it('extrai entity sem entityId em POST /api/v1/appointments', async () => {
    const ctx = makeContext({
      method: 'POST',
      url: '/api/v1/appointments',
      user,
      ip: '1.2.3.4',
    });

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'Appointment',
        entityId: undefined,
        action: 'CREATE',
      }),
    );
  });

  it('ignora query string ao extrair entity', async () => {
    const ctx = makeContext({
      method: 'DELETE',
      url: '/api/v1/procedures/proc-9?force=true',
      user,
      ip: '1.2.3.4',
    });

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'Procedure',
        entityId: 'proc-9',
        action: 'DELETE',
      }),
    );
  });

  it('mantém compatibilidade com rota sem versão /api/patients/:id', async () => {
    const ctx = makeContext({
      method: 'PATCH',
      url: '/api/patients/abc-123',
      user,
      ip: '1.2.3.4',
    });

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'Patient', entityId: 'abc-123' }),
    );
  });

  it('não audita GET', async () => {
    const ctx = makeContext({ method: 'GET', url: '/api/v1/patients', user });

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('não audita requisição sem usuário autenticado', async () => {
    const ctx = makeContext({ method: 'POST', url: '/api/v1/auth/login' });

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(auditService.log).not.toHaveBeenCalled();
  });
});
