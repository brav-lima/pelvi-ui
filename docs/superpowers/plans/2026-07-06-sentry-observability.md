# Sentry Observability Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the backend more Sentry visibility into user actions and errors, and deepen tracing, without exposing PII or adding log noise.

**Architecture:** Three additions, all backend-only, none changing existing behavior: (1) a central Sentry breadcrumb+log hook inside `AuditService.log()` so every already-audited action (create/update/delete) surfaces in Sentry automatically; (2) pointed breadcrumb/log/capture calls at existing error branches for events that never go through `AuditService` today (login failure, refresh token rejection, 403 role/plan denial, queue reminder failure); (3) `SentryModule.forRoot()` + Prisma tracing integration for deeper spans, with the health-check route excluded from tracing.

**Tech Stack:** NestJS, `@sentry/nestjs` 10.53.1 (re-exports `@sentry/node`, so `Sentry.prismaIntegration()` and `Sentry.addBreadcrumb` are available from the existing `@sentry/nestjs` import), Jest for tests.

## Global Constraints

- Never log `AuditLogEntry.details` or any field in `SENSITIVE_KEYS` (`backend/src/common/logger/sanitize.ts`) — only structural metadata (IDs, action, entity names) goes to Sentry.
- Every new Sentry call added in this plan must use one of exactly these levels: `info` (normal business action), `warning` (expected-but-notable, e.g. login failure), `error` (real failure impacting the user/system). Never `debug`/`verbose` to Sentry.
- No new call fires on the happy path of auth (successful login, successful refresh) — only on the failure/denial branch.
- Every task must preserve existing thrown exception types and rethrow behavior exactly — these are pure observability additions, not behavior changes.
- Run `bun run test` from `backend/` after every task; all existing tests plus new ones must pass before committing.

---

## File Structure

| File | Change |
|---|---|
| `backend/src/audit/audit.service.ts` | Modify — add breadcrumb + `Sentry.logger.info` after DB write |
| `backend/src/audit/audit.service.spec.ts` | Modify — assert new Sentry calls |
| `backend/src/auth/auth.service.ts` | Modify — add breadcrumb + `Sentry.logger.warn` on login failure and refresh rejection branches |
| `backend/src/auth/auth.service.spec.ts` | Modify — assert new Sentry calls on existing failure test cases |
| `backend/src/auth/guards/roles.guard.ts` | Modify — add breadcrumb before throwing 403 |
| `backend/src/auth/guards/roles.guard.spec.ts` | Create — new spec, didn't exist before |
| `backend/src/subscription/plan.guard.ts` | Modify — add breadcrumb before throwing 403 |
| `backend/src/subscription/plan.guard.spec.ts` | Create — new spec, didn't exist before |
| `backend/src/queue/processors/reminder.processor.ts` | Modify — wrap `process()` body in try/catch, capture + rethrow |
| `backend/src/queue/processors/reminder.processor.spec.ts` | Create — new spec, didn't exist before |
| `backend/src/appointment/appointment.service.ts` | Modify — wrap `scheduleReminder` body in try/catch, capture + rethrow |
| `backend/src/appointment/appointment.service.spec.ts` | Modify — add reminder-failure test case |
| `backend/src/app.module.ts` | Modify — add `SentryModule.forRoot()` as first import |
| `backend/src/instrument.ts` | Modify — add `Sentry.prismaIntegration()`, add `ignoreTransactions` for health check |

---

### Task 1: AuditService Sentry hook

**Files:**
- Modify: `backend/src/audit/audit.service.ts`
- Test: `backend/src/audit/audit.service.spec.ts`

**Interfaces:**
- Consumes: nothing new (existing `AuditLogEntry` interface, `PrismaService`)
- Produces: nothing new consumed by later tasks — this is a leaf change

- [ ] **Step 1: Write the failing test**

Add to `backend/src/audit/audit.service.spec.ts`, right after the existing imports:

```ts
jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
```

Add `import * as Sentry from '@sentry/nestjs';` to the imports at the top of the file.

Add these two tests inside the existing `describe('log', ...)` block, after the two existing tests:

```ts
    it('deve emitir breadcrumb e log estruturado no Sentry sem incluir details', async () => {
      await service.log({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'CREATE',
        entity: 'Patient',
        entityId: 'patient-1',
        details: { name: 'Maria', cpf: '12345678901' },
      });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'audit',
        message: 'CREATE Patient',
        level: 'info',
        data: { entityId: 'patient-1', organizationId: 'org-1' },
      });
      expect(Sentry.logger.info).toHaveBeenCalledWith('CREATE Patient', {
        userId: 'user-1',
        organizationId: 'org-1',
        entityId: 'patient-1',
      });

      const breadcrumbData = (Sentry.addBreadcrumb as jest.Mock).mock.calls[0][0].data;
      const logMeta = (Sentry.logger.info as jest.Mock).mock.calls[0][1];
      expect(JSON.stringify(breadcrumbData)).not.toContain('Maria');
      expect(JSON.stringify(logMeta)).not.toContain('Maria');
    });

    it('deve emitir breadcrumb mesmo sem entityId', async () => {
      await service.log({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'DELETE',
        entity: 'Appointment',
      });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'audit',
        message: 'DELETE Appointment',
        level: 'info',
        data: { entityId: undefined, organizationId: 'org-1' },
      });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bunx jest src/audit/audit.service.spec.ts -t "Sentry"`
Expected: FAIL — `Sentry.addBreadcrumb` not called (property doesn't exist / mock never invoked).

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `backend/src/audit/audit.service.ts` with:

```ts
import { Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  organizationId: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        details: entry.details ? (entry.details as object) : undefined,
        ipAddress: entry.ipAddress,
      },
    });

    Sentry.addBreadcrumb({
      category: 'audit',
      message: `${entry.action} ${entry.entity}`,
      level: 'info',
      data: { entityId: entry.entityId, organizationId: entry.organizationId },
    });
    Sentry.logger.info(`${entry.action} ${entry.entity}`, {
      userId: entry.userId,
      organizationId: entry.organizationId,
      entityId: entry.entityId,
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && bunx jest src/audit/audit.service.spec.ts`
Expected: PASS (4 tests: 2 existing + 2 new)

- [ ] **Step 5: Commit**

```bash
git add backend/src/audit/audit.service.ts backend/src/audit/audit.service.spec.ts
git commit -m "feat(observability): emit Sentry breadcrumb+log from AuditService"
```

---

### Task 2: AuthService critical events (login failure, refresh rejection)

**Files:**
- Modify: `backend/src/auth/auth.service.ts`
- Test: `backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `Sentry.addBreadcrumb`, `Sentry.logger.warn` (same shape as Task 1)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Write the failing test**

Add `jest.mock('@sentry/nestjs', ...)` and the import to `backend/src/auth/auth.service.spec.ts`. At the very top of the file, before the `describe('AuthService', ...)` block:

```ts
import * as Sentry from '@sentry/nestjs';

jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
```

Add `jest.clearAllMocks();` at the start of the existing `beforeEach` (it currently has no `jest.clearAllMocks()` — check first; if absent, add it as the first line inside `beforeEach(async () => {`).

Replace the existing `'deve rejeitar CPF inexistente'` test with (adds an assertion, same rejection behavior):

```ts
    it('deve rejeitar CPF inexistente e emitir warn sem CPF', async () => {
      prisma.person.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ cpf: '00000000000', password: 'senha123' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(Sentry.logger.warn).toHaveBeenCalledWith('login failed');
      const warnCalls = (Sentry.logger.warn as jest.Mock).mock.calls;
      expect(JSON.stringify(warnCalls)).not.toContain('00000000000');
    });
```

Replace the existing `'deve rejeitar senha incorreta'` test with:

```ts
    it('deve rejeitar senha incorreta e emitir warn sem senha', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);

      await expect(
        service.login({ cpf: '12345678901', password: 'errada' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(Sentry.logger.warn).toHaveBeenCalledWith('login failed');
    });
```

Inside `describe('rotateRefreshToken', ...)`, replace `'deve rejeitar quando o hash não existe no Redis'` with:

```ts
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
```

Replace `'deve revogar o token e rejeitar quando o vínculo foi inativado'` with:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bunx jest src/auth/auth.service.spec.ts`
Expected: FAIL on the 4 modified tests — `Sentry.logger.warn` never called.

- [ ] **Step 3: Write minimal implementation**

In `backend/src/auth/auth.service.ts`, add the import after the existing imports (line 20):

```ts
import * as Sentry from '@sentry/nestjs';
```

Add two private methods right before the closing brace of the class (after `issueTokens`, near the other private helpers around line 330+):

```ts
  private logLoginFailure(): void {
    Sentry.addBreadcrumb({ category: 'auth', message: 'login failed', level: 'warning' });
    Sentry.logger.warn('login failed');
  }

  private logRefreshFailure(personId: string, reason: string): void {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: `refresh rejected: ${reason}`,
      level: 'warning',
      data: { personId },
    });
    Sentry.logger.warn(`refresh rejected: ${reason}`, { personId });
  }
```

In `login()`, update the two failure branches (lines 53-55 and 57-60):

```ts
    if (!person || !person.active) {
      this.logLoginFailure();
      throw new UnauthorizedException('CPF ou senha inválidos');
    }

    const passwordValid = await bcrypt.compare(dto.password, person.passwordHash);
    if (!passwordValid) {
      this.logLoginFailure();
      throw new UnauthorizedException('CPF ou senha inválidos');
    }
```

In `rotateRefreshToken()`, update the two failure branches (lines 254-256 and 262-265):

```ts
    if (!storedPersonId || storedPersonId !== personId) {
      this.logRefreshFailure(personId, 'invalid_token');
      throw new UnauthorizedException('Refresh token inválido');
    }

    const link = await this.prisma.organizationUser.findUnique({
      where: { organizationId_personId: { organizationId, personId } },
      select: { active: true, role: true, person: { select: { active: true } } },
    });
    if (!link || !link.active || !link.person.active) {
      await this.redis.del(redisKey.refresh(tokenHash));
      this.logRefreshFailure(personId, 'inactive_link');
      throw new UnauthorizedException('Vínculo inválido ou inativo');
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && bunx jest src/auth/auth.service.spec.ts`
Expected: PASS (all tests, including the 4 modified ones)

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/auth.service.ts backend/src/auth/auth.service.spec.ts
git commit -m "feat(observability): warn to Sentry on login and refresh failures"
```

---

### Task 3: RolesGuard breadcrumb on 403

**Files:**
- Modify: `backend/src/auth/guards/roles.guard.ts`
- Create: `backend/src/auth/guards/roles.guard.spec.ts`

**Interfaces:**
- Consumes: `Sentry.addBreadcrumb` (same shape as Task 1)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Write the failing test**

Create `backend/src/auth/guards/roles.guard.spec.ts`:

```ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { RolesGuard } from './roles.guard';

jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bunx jest src/auth/guards/roles.guard.spec.ts`
Expected: FAIL on the third test — `Sentry.addBreadcrumb` never called.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `backend/src/auth/guards/roles.guard.ts` with:

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../strategies/jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const payload = user as JwtPayload;

    if (!requiredRoles.includes(payload.role as Role)) {
      Sentry.addBreadcrumb({
        category: 'authz',
        message: 'role denied',
        level: 'warning',
        data: { requiredRoles, role: payload.role },
      });
      throw new ForbiddenException('Acesso negado para este perfil');
    }

    return true;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && bunx jest src/auth/guards/roles.guard.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/guards/roles.guard.ts backend/src/auth/guards/roles.guard.spec.ts
git commit -m "feat(observability): breadcrumb on role-based 403"
```

---

### Task 4: PlanGuard breadcrumb on 403

**Files:**
- Modify: `backend/src/subscription/plan.guard.ts`
- Create: `backend/src/subscription/plan.guard.spec.ts`

**Interfaces:**
- Consumes: `Sentry.addBreadcrumb` (same shape as Task 1)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Write the failing test**

Create `backend/src/subscription/plan.guard.spec.ts`:

```ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import * as Sentry from '@sentry/nestjs'
import { PlanGuard } from './plan.guard'
import { SubscriptionService } from './subscription.service'

jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
}))

describe('PlanGuard', () => {
  let guard: PlanGuard
  let reflector: { getAllAndOverride: jest.Mock }
  let subscriptionService: { hasFeature: jest.Mock }

  const makeContext = (organizationId?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user: { organizationId } }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext

  beforeEach(() => {
    jest.clearAllMocks()
    reflector = { getAllAndOverride: jest.fn() }
    subscriptionService = { hasFeature: jest.fn() }
    guard = new PlanGuard(
      reflector as unknown as Reflector,
      subscriptionService as unknown as SubscriptionService,
    )
  })

  it('permite quando não há feature exigida', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined)

    await expect(guard.canActivate(makeContext('org-1'))).resolves.toBe(true)
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled()
  })

  it('permite quando plano inclui a feature', async () => {
    reflector.getAllAndOverride.mockReturnValue('FINANCIAL_BASIC')
    subscriptionService.hasFeature.mockResolvedValue(true)

    await expect(guard.canActivate(makeContext('org-1'))).resolves.toBe(true)
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled()
  })

  it('emite breadcrumb e lança ForbiddenException quando plano não inclui a feature', async () => {
    reflector.getAllAndOverride.mockReturnValue('FINANCIAL_BASIC')
    subscriptionService.hasFeature.mockResolvedValue(false)

    await expect(guard.canActivate(makeContext('org-1'))).rejects.toThrow(ForbiddenException)
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'authz',
      message: 'feature denied',
      level: 'warning',
      data: { requiredFeature: 'FINANCIAL_BASIC', organizationId: 'org-1' },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bunx jest src/subscription/plan.guard.spec.ts`
Expected: FAIL on the third test — `Sentry.addBreadcrumb` never called.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `backend/src/subscription/plan.guard.ts` with:

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import * as Sentry from '@sentry/nestjs'
import { PLAN_FEATURE_KEY } from './decorators/require-feature.decorator'
import { PlanFeature } from './plan-features'
import { SubscriptionService } from './subscription.service'

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<PlanFeature | undefined>(
      PLAN_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (!requiredFeature) return true

    const request = context.switchToHttp().getRequest<{ user?: { organizationId?: string } }>()
    const orgId = request.user?.organizationId

    if (!orgId) return false

    const allowed = await this.subscriptionService.hasFeature(orgId, requiredFeature)

    if (!allowed) {
      Sentry.addBreadcrumb({
        category: 'authz',
        message: 'feature denied',
        level: 'warning',
        data: { requiredFeature, organizationId: orgId },
      })
      throw new ForbiddenException(
        `Seu plano não inclui acesso a esta funcionalidade. Faça upgrade para continuar.`,
      )
    }

    return true
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && bunx jest src/subscription/plan.guard.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/subscription/plan.guard.ts backend/src/subscription/plan.guard.spec.ts
git commit -m "feat(observability): breadcrumb on plan-feature 403"
```

---

### Task 5: ReminderProcessor error capture

**Files:**
- Modify: `backend/src/queue/processors/reminder.processor.ts`
- Create: `backend/src/queue/processors/reminder.processor.spec.ts`

**Interfaces:**
- Consumes: `Sentry.captureException`, `Sentry.addBreadcrumb`
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Write the failing test**

Create `backend/src/queue/processors/reminder.processor.spec.ts`:

```ts
import * as Sentry from '@sentry/nestjs';
import { Job } from 'bullmq';
import { ReminderProcessor } from './reminder.processor';
import { ReminderJobData } from '../jobs/reminder.job';

jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

describe('ReminderProcessor', () => {
  let processor: ReminderProcessor;

  const makeJob = (data: ReminderJobData): Job<ReminderJobData> =>
    ({ data }) as Job<ReminderJobData>;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new ReminderProcessor();
  });

  it('processa o lembrete sem erro no caminho feliz', async () => {
    await processor.process(
      makeJob({
        appointmentId: 'apt-1',
        patientId: 'patient-1',
        organizationId: 'org-1',
        startAt: '2026-08-01T10:00:00Z',
      }),
    );

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('captura exceção no Sentry e relança quando o processamento falha', async () => {
    const job = makeJob({
      appointmentId: 'apt-1',
      patientId: 'patient-1',
      organizationId: 'org-1',
      startAt: '2026-08-01T10:00:00Z',
    });

    const originalLog = (processor as any).logger.log;
    (processor as any).logger.log = jest.fn(() => {
      throw new Error('boom');
    });

    await expect(processor.process(job)).rejects.toThrow('boom');

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'queue',
      message: 'reminder processing failed',
      level: 'error',
      data: { appointmentId: 'apt-1' },
    });

    (processor as any).logger.log = originalLog;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bunx jest src/queue/processors/reminder.processor.spec.ts`
Expected: FAIL on the second test — error propagates uncaught but no capture/breadcrumb call happens (or test fails compiling if `process` doesn't yet catch — either way, `Sentry.captureException` assertion fails).

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `backend/src/queue/processors/reminder.processor.ts` with:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Job } from 'bullmq';
import { REMINDER_QUEUE, ReminderJobData } from '../jobs/reminder.job';

@Processor(REMINDER_QUEUE)
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  async process(job: Job<ReminderJobData>): Promise<void> {
    const { appointmentId, patientId, organizationId, startAt } = job.data;

    try {
      this.logger.log(
        `Reminder: appointment=${appointmentId} patient=${patientId} org=${organizationId} startAt=${startAt}`,
      );

      // TODO: adicionar canais externos quando disponíveis:
      // - WhatsApp
      // - Email
      // - Push notification
    } catch (err) {
      Sentry.addBreadcrumb({
        category: 'queue',
        message: 'reminder processing failed',
        level: 'error',
        data: { appointmentId },
      });
      Sentry.captureException(err);
      throw err;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && bunx jest src/queue/processors/reminder.processor.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/queue/processors/reminder.processor.ts backend/src/queue/processors/reminder.processor.spec.ts
git commit -m "feat(observability): capture reminder job failures in Sentry"
```

---

### Task 6: AppointmentService scheduleReminder error capture

**Files:**
- Modify: `backend/src/appointment/appointment.service.ts:474-488`
- Test: `backend/src/appointment/appointment.service.spec.ts`

**Interfaces:**
- Consumes: `Sentry.captureException`, `Sentry.addBreadcrumb`
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Write the failing test**

Add to the top of `backend/src/appointment/appointment.service.spec.ts`, with the other imports:

```ts
import * as Sentry from '@sentry/nestjs';

jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));
```

Add `jest.clearAllMocks();` is already present in the outer `beforeEach` — no change needed there since it already clears all mocks.

Add this test inside `describe('create', ...)`, after the existing tests:

```ts
    it('deve capturar no Sentry e propagar erro quando enfileirar o lembrete falha', async () => {
      prisma.procedure.findFirst.mockResolvedValue(mockProcedure);
      prisma.appointment.findFirst.mockResolvedValue(null);
      prisma.appointment.create.mockResolvedValue({ id: 'apt-1' });
      reminderQueue.add.mockRejectedValueOnce(new Error('redis down'));

      const futureStart = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

      await expect(
        service.create(orgId, {
          patientId: 'patient-1',
          professionalId: 'prof-1',
          procedureId: 'proc-1',
          startAt: futureStart,
        }),
      ).rejects.toThrow('redis down');

      expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'queue',
        message: 'reminder scheduling failed',
        level: 'error',
        data: { appointmentId: 'apt-1' },
      });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bunx jest src/appointment/appointment.service.spec.ts -t "enfileirar o lembrete falha"`
Expected: FAIL — test still rejects with `'redis down'` correctly (no behavior change there) but `Sentry.captureException` was never called.

- [ ] **Step 3: Write minimal implementation**

In `backend/src/appointment/appointment.service.ts`, add the import after the existing imports (near line 9, alongside `PrismaService`):

```ts
import * as Sentry from '@sentry/nestjs';
```

Replace the `scheduleReminder` method (lines 474-488) with:

```ts
  private async scheduleReminder(
    appointmentId: string,
    patientId: string,
    organizationId: string,
    startAt: Date,
  ): Promise<void> {
    const delay = startAt.getTime() - Date.now() - 60 * 60 * 1000; // 1h antes
    if (delay <= 0) return;

    try {
      await this.reminderQueue.add(
        'reminder',
        { appointmentId, patientId, organizationId, startAt: startAt.toISOString() },
        { jobId: `reminder-${appointmentId}`, delay },
      );
    } catch (err) {
      Sentry.addBreadcrumb({
        category: 'queue',
        message: 'reminder scheduling failed',
        level: 'error',
        data: { appointmentId },
      });
      Sentry.captureException(err);
      throw err;
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && bunx jest src/appointment/appointment.service.spec.ts`
Expected: PASS (all tests in the file, including the new one)

- [ ] **Step 5: Commit**

```bash
git add backend/src/appointment/appointment.service.ts backend/src/appointment/appointment.service.spec.ts
git commit -m "feat(observability): capture reminder scheduling failures in Sentry"
```

---

### Task 7: Deeper tracing — SentryModule + Prisma spans + health exclusion

**Files:**
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/instrument.ts`

**Interfaces:**
- Consumes: `Sentry.prismaIntegration` (exported from `@sentry/nestjs`, re-exported from `@sentry/node`), `SentryModule` (from `@sentry/nestjs`)
- Produces: nothing consumed by later tasks — this is the last task

There is no meaningful unit test for Nest module wiring or trace sampling — this task is verified manually (Step 3) instead of via Jest.

- [ ] **Step 1: Add `SentryModule.forRoot()` to `app.module.ts`**

In `backend/src/app.module.ts`, add the import at the very top, before all other imports:

```ts
import { SentryModule } from '@sentry/nestjs/setup';
```

Add `SentryModule.forRoot(),` as the very first entry in the `imports` array (before `ConfigModule.forRoot(...)`):

```ts
@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'dev'}`,
    }),
    // ... rest unchanged
```

- [ ] **Step 2: Add Prisma tracing + health-check exclusion to `instrument.ts`**

Replace the full contents of `backend/src/instrument.ts` with:

```ts
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.APP_VERSION,
  dist: process.env.GIT_SHA,
  environment: process.env.NODE_ENV,
  integrations: [
    nodeProfilingIntegration(),
    Sentry.prismaIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  profilesSampleRate: 1.0,
  enableLogs: true,
  ignoreTransactions: [/\/health$/],
});
```

- [ ] **Step 3: Verify manually**

Run: `cd backend && bun run start:dev`

With `SENTRY_DSN` set in `backend/.env.dev` (use a real or throwaway Sentry project DSN), exercise these paths and confirm in the Sentry dashboard (Performance + Logs tabs):

1. `GET /api/v1/health` a few times — confirm **no** transaction is created for it.
2. Any authenticated `GET` request (e.g. `GET /api/v1/patients`) — confirm the trace now shows a child span for the controller/handler, and (if `prismaIntegration` picked up the query) a span for the Prisma query.
3. If `SENTRY_DSN` is not set locally, skip this step and note in the PR description that trace depth needs to be checked in a deployed environment where `SENTRY_DSN` is configured (per `CLAUDE.md`, it's a Coolify-injected env var).

If Prisma spans do not appear (Prisma 7.x may need a different config than `prismaIntegration()` defaults, which target Prisma v6), that is acceptable to ship without — note it in the PR description as a follow-up, since `SentryModule.forRoot()` + `ignoreTransactions` already deliver the two agreed-upon wins (per-handler spans, no health noise).

- [ ] **Step 4: Run full test suite to confirm no regression**

Run: `cd backend && bun run test`
Expected: All existing tests pass (module wiring changes don't affect unit tests, which mock providers directly).

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.module.ts backend/src/instrument.ts
git commit -m "feat(observability): add SentryModule, Prisma tracing, exclude health from traces"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && bun run test`
Expected: All tests pass, including all new specs from Tasks 1-6.

- [ ] **Step 2: Run backend lint**

Run: `cd backend && bunx eslint . --quiet` (or the repo's configured lint command if different — check `backend/package.json` `scripts.lint`)
Expected: No errors.

- [ ] **Step 3: Run backend build**

Run: `cd backend && bun run build`
Expected: Compiles with no TypeScript errors.

- [ ] **Step 4: Run coverage check**

Run: `cd backend && bun run test:cov`
Expected: Coverage stays at or above the enforced thresholds (80% statements/functions/lines, 75% branches per `CLAUDE.md`) — all modified/new files (`audit.service.ts`, `auth.service.ts`, `roles.guard.ts`, `plan.guard.ts`, `reminder.processor.ts`, `appointment.service.ts`) are covered by the new tests written in Tasks 1-6.

- [ ] **Step 5: Manual smoke test (if not already done in Task 7 Step 3)**

With the backend running locally and `SENTRY_DSN` configured, trigger: a failed login, a 403 from a non-admin hitting an admin-only route, and a patient create/update. Confirm all three show up in Sentry with the expected level (`warning`, `warning`, `info` respectively) and none leak CPF/name/email in the event payload.
