# Patient Portal Backend — Fundação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `patient-portal` backend module in `pelvi-ui/backend` — patient login (CPF + senha), the multi-clinic consent flow, treatment-plan feature flags, and the two read-only endpoints (`ficha`, `appointments`) the `pelvi-app` mobile client needs.

**Architecture:** A new, self-contained NestJS module (`src/patient-portal/`) that never imports internal services of `patient`/`appointment`/`organization` — only their new `*LookupService` exports. All `patient-portal` tables use soft references (plain `String` columns, no Prisma `@relation`) to `Patient`/`Organization`. Patient sessions use their own JWT strategy (`patient-jwt` / `patient-jwt-refresh`), signed with the same secrets as the professional flow but distinguished by a `scope` claim the professional `JwtStrategy` is updated to reject.

**Tech Stack:** NestJS 11, Prisma 7 (`@prisma/adapter-pg`), `bcryptjs`, `@nestjs/jwt` + `passport-jwt`, `ioredis` (via the existing `RedisService`), Resend (via the existing `EmailService`), Jest.

**Spec:** `pelvi-app/docs/superpowers/specs/2026-09-18-app-paciente-fundacao-design.md`

## Global Constraints

- `patient-portal` tables never use Prisma `@relation` to `Patient`/`Organization`/`OrganizationUser` — `patientId`/`organizationId`/`actorId` are plain `String` columns, validated in application code.
- `patient-portal` never imports `PatientService`, `AppointmentService`, or any other domain module's internal service — only `PatientLookupService` and `AppointmentLookupService`.
- Every patient-portal controller method is `@Public()` (bypasses the global professional `JwtAuthGuard`) and applies its own guard locally (`PatientJwtAuthGuard`, `PatientJwtRefreshGuard`) where a session is required.
- Patient JWTs and professional JWTs share `JWT_SECRET`/`JWT_REFRESH_SECRET`, but are mutually exclusive by the presence/absence of a `scope` claim — enforced inside both `JwtStrategy.validate()` (existing, professional) and `PatientJwtStrategy.validate()` (new).
- All new Portuguese-language strings (error messages, Swagger summaries) follow the existing style in `src/auth/*`.
- Run `npm test -- --forceExit` after each task (the Jest process doesn't exit cleanly on its own — this is pre-existing, unrelated to this work).

---

## Task 1: Prisma schema — patient-portal tables

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma models `PatientAccount`, `PatientAccountLink`, `PatientConsentAudit`, `PatientTreatmentPlan`, and enums `PatientAccountStatus`, `PatientAccountLinkStatus`, `PatientConsentAction`, `PatientConsentActorType` — consumed by every later task via `@prisma/client`.

- [ ] **Step 1: Add the new enums and models to `prisma/schema.prisma`**

Append at the end of the file:

```prisma
// ──────────────────────────────────────────────
// Patient Portal — login e vínculo da paciente
// Tabelas isoladas: sem @relation para Patient/Organization (referência solta,
// ver docs/superpowers/specs/2026-09-18-app-paciente-fundacao-design.md)
// ──────────────────────────────────────────────

enum PatientAccountStatus {
  ACTIVE
  BLOCKED
}

model PatientAccount {
  id           String               @id @default(uuid())
  cpf          String               @unique
  passwordHash String?              @map("password_hash")
  status       PatientAccountStatus @default(ACTIVE)
  createdAt    DateTime             @default(now()) @map("created_at")
  activatedAt  DateTime?            @map("activated_at")

  @@map("patient_accounts")
}

enum PatientAccountLinkStatus {
  PENDING_CONSENT
  ACTIVE
  DECLINED
}

model PatientAccountLink {
  id               String                   @id @default(uuid())
  patientAccountId String                   @map("patient_account_id")
  patientId        String                   @map("patient_id")
  organizationId   String                   @map("organization_id")
  status           PatientAccountLinkStatus @default(PENDING_CONSENT)
  invitedAt        DateTime                 @default(now()) @map("invited_at")
  confirmedAt      DateTime?                @map("confirmed_at")

  @@unique([patientId])
  @@index([patientAccountId, status])
  @@map("patient_account_links")
}

enum PatientConsentAction {
  REQUESTED
  ACCEPTED
  DECLINED
  RESENT
}

enum PatientConsentActorType {
  PATIENT
  PROFESSIONAL
}

model PatientConsentAudit {
  id                   String                  @id @default(uuid())
  patientAccountLinkId String                  @map("patient_account_link_id")
  action               PatientConsentAction
  actorType            PatientConsentActorType @map("actor_type")
  actorId              String                  @map("actor_id")
  createdAt            DateTime                @default(now()) @map("created_at")

  @@index([patientAccountLinkId])
  @@map("patient_consent_audits")
}

model PatientTreatmentPlan {
  id                 String   @id @default(uuid())
  patientId          String   @unique @map("patient_id")
  organizationId     String   @map("organization_id")
  features           Json     @default("{}")
  updatedByPersonId  String?  @map("updated_by_person_id")
  updatedAt          DateTime @updatedAt @map("updated_at")

  @@map("patient_treatment_plans")
}
```

- [ ] **Step 2: Format and validate the schema**

Run: `npx prisma format && npx prisma validate`
Expected: both commands exit 0, no output other than the formatted file diff (if any).

- [ ] **Step 3: Create and apply the migration**

Run: `npx prisma migrate dev --name add_patient_portal`
Expected: a new folder under `prisma/migrations/` (timestamp prefix + `_add_patient_portal`), migration applied to the local dev database, Prisma Client regenerated with `prisma.patientAccount`, `prisma.patientAccountLink`, `prisma.patientConsentAudit`, `prisma.patientTreatmentPlan` delegates available.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(patient-portal): add PatientAccount, PatientAccountLink, PatientConsentAudit and PatientTreatmentPlan tables"
```

---

## Task 2: `PatientLookupService`

**Files:**
- Create: `src/patient/patient-lookup.service.ts`
- Create: `src/patient/patient-lookup.service.spec.ts`
- Modify: `src/patient/patient.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (existing).
- Produces: `PatientLookupService.findById(patientId: string): Promise<PatientLookupResult | null>`, exported from `PatientModule`. `PatientLookupResult` shape consumed by every patient-portal task that needs patient/organization display data.

- [ ] **Step 1: Write the failing test**

```typescript
// src/patient/patient-lookup.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PatientLookupService } from './patient-lookup.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PatientLookupService', () => {
  let service: PatientLookupService;
  let prisma: { patient: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = { patient: { findFirst: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientLookupService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PatientLookupService>(PatientLookupService);
  });

  it('retorna os dados enxutos da paciente e da clínica quando encontrada', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'patient-1',
      name: 'Maria Silva',
      cpf: '12345678901',
      phone: '11999998888',
      birthDate: new Date('1990-01-01'),
      email: 'maria@email.com',
      organizationId: 'org-1',
      organization: { name: 'Clínica A' },
    });

    const result = await service.findById('patient-1');

    expect(result).toEqual({
      id: 'patient-1',
      name: 'Maria Silva',
      cpf: '12345678901',
      phone: '11999998888',
      birthDate: new Date('1990-01-01'),
      email: 'maria@email.com',
      organizationId: 'org-1',
      organizationName: 'Clínica A',
    });
    expect(prisma.patient.findFirst).toHaveBeenCalledWith({
      where: { id: 'patient-1', deletedAt: null },
      select: {
        id: true,
        name: true,
        cpf: true,
        phone: true,
        birthDate: true,
        email: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });
  });

  it('retorna null quando a paciente não existe', async () => {
    prisma.patient.findFirst.mockResolvedValue(null);

    const result = await service.findById('nope');

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/patient/patient-lookup.service.spec.ts`
Expected: FAIL — cannot find module `./patient-lookup.service`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/patient/patient-lookup.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PatientLookupResult {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  birthDate: Date | null;
  email: string | null;
  organizationId: string;
  organizationName: string;
}

@Injectable()
export class PatientLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(patientId: string): Promise<PatientLookupResult | null> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, deletedAt: null },
      select: {
        id: true,
        name: true,
        cpf: true,
        phone: true,
        birthDate: true,
        email: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });

    if (!patient) return null;

    return {
      id: patient.id,
      name: patient.name,
      cpf: patient.cpf,
      phone: patient.phone,
      birthDate: patient.birthDate,
      email: patient.email,
      organizationId: patient.organizationId,
      organizationName: patient.organization.name,
    };
  }
}
```

- [ ] **Step 4: Export it from `PatientModule`**

```typescript
// src/patient/patient.module.ts
import { Module } from '@nestjs/common';
import { PatientController } from './patient.controller';
import { PatientService } from './patient.service';
import { PatientLookupService } from './patient-lookup.service';

@Module({
  controllers: [PatientController],
  providers: [PatientService, PatientLookupService],
  exports: [PatientLookupService],
})
export class PatientModule {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/patient/patient-lookup.service.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/patient/patient-lookup.service.ts src/patient/patient-lookup.service.spec.ts src/patient/patient.module.ts
git commit -m "feat(patient): add PatientLookupService for cross-module patient reads"
```

---

## Task 3: `AppointmentLookupService`

**Files:**
- Create: `src/appointment/appointment-lookup.service.ts`
- Create: `src/appointment/appointment-lookup.service.spec.ts`
- Modify: `src/appointment/appointment.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (existing).
- Produces: `AppointmentLookupService.findUpcomingByPatientId(organizationId: string, patientId: string): Promise<AppointmentLookupResult[]>`, exported from `AppointmentModule`. Consumed by Task 15 (`PatientMeService`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/appointment/appointment-lookup.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentLookupService } from './appointment-lookup.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AppointmentLookupService', () => {
  let service: AppointmentLookupService;
  let prisma: { appointment: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { appointment: { findMany: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentLookupService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AppointmentLookupService>(AppointmentLookupService);
  });

  it('retorna as consultas da paciente com o nome do procedimento', async () => {
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: 'appt-1',
        startAt: new Date('2026-10-01T10:00:00Z'),
        endAt: new Date('2026-10-01T10:50:00Z'),
        status: 'SCHEDULED',
        procedure: { name: 'Fisioterapia pélvica' },
      },
    ]);

    const result = await service.findUpcomingByPatientId('org-1', 'patient-1');

    expect(result).toEqual([
      {
        id: 'appt-1',
        startAt: new Date('2026-10-01T10:00:00Z'),
        endAt: new Date('2026-10-01T10:50:00Z'),
        status: 'SCHEDULED',
        procedureName: 'Fisioterapia pélvica',
      },
    ]);
    expect(prisma.appointment.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', patientId: 'patient-1', deletedAt: null },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        procedure: { select: { name: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/appointment/appointment-lookup.service.spec.ts`
Expected: FAIL — cannot find module `./appointment-lookup.service`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/appointment/appointment-lookup.service.ts
import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AppointmentLookupResult {
  id: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  procedureName: string;
}

@Injectable()
export class AppointmentLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async findUpcomingByPatientId(
    organizationId: string,
    patientId: string,
  ): Promise<AppointmentLookupResult[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: { organizationId, patientId, deletedAt: null },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        procedure: { select: { name: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    return appointments.map((appointment) => ({
      id: appointment.id,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      status: appointment.status,
      procedureName: appointment.procedure.name,
    }));
  }
}
```

- [ ] **Step 4: Export it from `AppointmentModule`**

```typescript
// src/appointment/appointment.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { AppointmentLookupService } from './appointment-lookup.service';
import { TreatmentPackageModule } from '../treatment-package/treatment-package.module';
import { REMINDER_QUEUE } from '../queue/jobs/reminder.job';

@Module({
  imports: [
    TreatmentPackageModule,
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService, AppointmentLookupService],
  exports: [AppointmentLookupService],
})
export class AppointmentModule {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/appointment/appointment-lookup.service.spec.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/appointment/appointment-lookup.service.ts src/appointment/appointment-lookup.service.spec.ts src/appointment/appointment.module.ts
git commit -m "feat(appointment): add AppointmentLookupService for cross-module patient reads"
```

---

## Task 4: `EmailService.sendPatientInvite`

**Files:**
- Modify: `src/email/email.service.ts`
- Create: `src/email/email.service.spec.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `Resend` SDK (existing dependency), `ConfigService`.
- Produces: `EmailService.sendPatientInvite(to: string, patientName: string, organizationName: string, activateUrl: string): Promise<void>` — consumed by Task 9 (`PatientInviteService`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/email/email.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const sendMock = jest.fn().mockResolvedValue({ error: null });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;
  let config: { getOrThrow: jest.Mock };

  beforeEach(async () => {
    sendMock.mockClear();
    config = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          RESEND_API_KEY: 'resend-key',
          RESEND_FROM: 'contato@soupelvi.com',
          RESEND_TEMPLATE_PASSWORD_RESET_ID: 'tpl-reset',
          RESEND_TEMPLATE_PATIENT_INVITE_ID: 'tpl-invite',
        };
        return values[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: ConfigService, useValue: config }],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('envia o convite com o template e as variáveis corretas', async () => {
    await service.sendPatientInvite(
      'paciente@email.com',
      'Maria Silva',
      'Clínica A',
      'https://app.soupelvi.com/paciente/ativar-conta?token=abc',
    );

    expect(sendMock).toHaveBeenCalledWith({
      from: 'contato@soupelvi.com',
      to: 'paciente@email.com',
      template: {
        id: 'tpl-invite',
        variables: {
          first_name: 'Maria',
          company_name: 'Sou Pelvi',
          organization_name: 'Clínica A',
          activate_url: 'https://app.soupelvi.com/paciente/ativar-conta?token=abc',
        },
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/email/email.service.spec.ts`
Expected: FAIL — `service.sendPatientInvite is not a function`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly passwordResetTemplateId: string;
  private readonly patientInviteTemplateId: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(config.getOrThrow<string>('RESEND_API_KEY'));
    this.from = config.getOrThrow<string>('RESEND_FROM');
    this.passwordResetTemplateId = config.getOrThrow<string>('RESEND_TEMPLATE_PASSWORD_RESET_ID');
    this.patientInviteTemplateId = config.getOrThrow<string>('RESEND_TEMPLATE_PATIENT_INVITE_ID');
  }

  async sendPasswordReset(to: string, name: string, resetUrl: string): Promise<void> {
    const firstName = name.split(' ')[0];
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      template: {
        id: this.passwordResetTemplateId,
        variables: {
          first_name: firstName,
          company_name: 'Sou Pelvi',
          reset_password_url: resetUrl,
        },
      },
    });

    if (error) {
      this.logger.error('Falha ao enviar e-mail de reset de senha', error);
    }
  }

  async sendPatientInvite(
    to: string,
    patientName: string,
    organizationName: string,
    activateUrl: string,
  ): Promise<void> {
    const firstName = patientName.split(' ')[0];
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      template: {
        id: this.patientInviteTemplateId,
        variables: {
          first_name: firstName,
          company_name: 'Sou Pelvi',
          organization_name: organizationName,
          activate_url: activateUrl,
        },
      },
    });

    if (error) {
      this.logger.error('Falha ao enviar e-mail de convite da paciente', error);
    }
  }
}
```

- [ ] **Step 4: Add the new template env var**

```bash
# .env.example — add after RESEND_TEMPLATE_PASSWORD_RESET_ID (or alongside it,
# if that line is not present in this file yet)
RESEND_TEMPLATE_PATIENT_INVITE_ID=
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/email/email.service.spec.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/email/email.service.ts src/email/email.service.spec.ts .env.example
git commit -m "feat(email): add sendPatientInvite for the patient-portal first-invite flow"
```

---

## Task 5: `PatientPortalModule` skeleton + `PatientAccountService`

**Files:**
- Create: `src/patient-portal/patient-portal.module.ts`
- Create: `src/patient-portal/patient-account.service.ts`
- Create: `src/patient-portal/patient-account.service.spec.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`.
- Produces: `PatientAccountService.findByCpf`, `.findById`, `.createPending`, `.activate` and `PatientAccountSummary` — consumed by Tasks 9–15.

- [ ] **Step 1: Write the failing test**

```typescript
// src/patient-portal/patient-account.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PatientAccountService } from './patient-account.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PatientAccountService', () => {
  let service: PatientAccountService;
  let prisma: {
    patientAccount: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      patientAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PatientAccountService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PatientAccountService>(PatientAccountService);
  });

  it('busca conta por CPF', async () => {
    prisma.patientAccount.findUnique.mockResolvedValue({ id: 'acc-1', cpf: '12345678901' });

    const result = await service.findByCpf('12345678901');

    expect(result).toEqual({ id: 'acc-1', cpf: '12345678901' });
    expect(prisma.patientAccount.findUnique).toHaveBeenCalledWith({ where: { cpf: '12345678901' } });
  });

  it('retorna null quando o CPF não tem conta', async () => {
    prisma.patientAccount.findUnique.mockResolvedValue(null);

    expect(await service.findByCpf('00000000000')).toBeNull();
  });

  it('cria uma conta pendente sem senha', async () => {
    prisma.patientAccount.create.mockResolvedValue({ id: 'acc-1', cpf: '12345678901', passwordHash: null });

    const result = await service.createPending('12345678901');

    expect(prisma.patientAccount.create).toHaveBeenCalledWith({
      data: { cpf: '12345678901' },
    });
    expect(result.passwordHash).toBeNull();
  });

  it('ativa a conta gravando o hash de senha e activatedAt', async () => {
    prisma.patientAccount.update.mockResolvedValue({ id: 'acc-1', activatedAt: new Date() });

    await service.activate('acc-1', 'hashed-password');

    expect(prisma.patientAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { passwordHash: 'hashed-password', activatedAt: expect.any(Date) },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/patient-portal/patient-account.service.spec.ts`
Expected: FAIL — cannot find module `./patient-account.service`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/patient-portal/patient-account.service.ts
import { Injectable } from '@nestjs/common';
import { PatientAccountStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PatientAccountSummary {
  id: string;
  cpf: string;
  passwordHash: string | null;
  status: PatientAccountStatus;
  createdAt: Date;
  activatedAt: Date | null;
}

@Injectable()
export class PatientAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async findByCpf(cpf: string): Promise<PatientAccountSummary | null> {
    return this.prisma.patientAccount.findUnique({ where: { cpf } });
  }

  async findById(id: string): Promise<PatientAccountSummary | null> {
    return this.prisma.patientAccount.findUnique({ where: { id } });
  }

  async createPending(cpf: string): Promise<PatientAccountSummary> {
    return this.prisma.patientAccount.create({ data: { cpf } });
  }

  async activate(id: string, passwordHash: string): Promise<PatientAccountSummary> {
    return this.prisma.patientAccount.update({
      where: { id },
      data: { passwordHash, activatedAt: new Date() },
    });
  }
}
```

- [ ] **Step 4: Create the module skeleton and register it**

```typescript
// src/patient-portal/patient-portal.module.ts
import { Module } from '@nestjs/common';
import { PatientAccountService } from './patient-account.service';

@Module({
  providers: [PatientAccountService],
})
export class PatientPortalModule {}
```

```typescript
// src/app.module.ts — add the import and register it in the imports array,
// right after PatientModule
import { PatientPortalModule } from './patient-portal/patient-portal.module';
// ...
    PatientModule,
    PatientPortalModule,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/patient-portal/patient-account.service.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/patient-portal/patient-portal.module.ts src/patient-portal/patient-account.service.ts src/patient-portal/patient-account.service.spec.ts src/app.module.ts
git commit -m "feat(patient-portal): scaffold module and add PatientAccountService"
```

---

## Task 6: `PatientAccountLinkService`

**Files:**
- Create: `src/patient-portal/patient-account-link.service.ts`
- Create: `src/patient-portal/patient-account-link.service.spec.ts`
- Modify: `src/patient-portal/patient-portal.module.ts`

**Interfaces:**
- Consumes: `PrismaService`.
- Produces: `PatientAccountLinkService.findByPatientId`, `.findById`, `.findAllByAccountId`, `.create`, `.updateStatus` and `PatientAccountLinkSummary` — consumed by Tasks 9, 11, 12, 13, 14, 15.

- [ ] **Step 1: Write the failing test**

```typescript
// src/patient-portal/patient-account-link.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PatientAccountLinkService', () => {
  let service: PatientAccountLinkService;
  let prisma: {
    patientAccountLink: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      patientAccountLink: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PatientAccountLinkService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PatientAccountLinkService>(PatientAccountLinkService);
  });

  it('busca vínculo por patientId', async () => {
    prisma.patientAccountLink.findFirst.mockResolvedValue({ id: 'link-1' });

    const result = await service.findByPatientId('patient-1');

    expect(result).toEqual({ id: 'link-1' });
    expect(prisma.patientAccountLink.findFirst).toHaveBeenCalledWith({ where: { patientId: 'patient-1' } });
  });

  it('busca vínculo por id', async () => {
    prisma.patientAccountLink.findUnique.mockResolvedValue({ id: 'link-1' });

    const result = await service.findById('link-1');

    expect(result).toEqual({ id: 'link-1' });
    expect(prisma.patientAccountLink.findUnique).toHaveBeenCalledWith({ where: { id: 'link-1' } });
  });

  it('lista todos os vínculos de uma conta', async () => {
    prisma.patientAccountLink.findMany.mockResolvedValue([{ id: 'link-1' }, { id: 'link-2' }]);

    const result = await service.findAllByAccountId('acc-1');

    expect(result).toHaveLength(2);
    expect(prisma.patientAccountLink.findMany).toHaveBeenCalledWith({
      where: { patientAccountId: 'acc-1' },
    });
  });

  it('cria um vínculo pendente de consentimento', async () => {
    prisma.patientAccountLink.create.mockResolvedValue({ id: 'link-1', status: 'PENDING_CONSENT' });

    const result = await service.create({
      patientAccountId: 'acc-1',
      patientId: 'patient-1',
      organizationId: 'org-1',
    });

    expect(prisma.patientAccountLink.create).toHaveBeenCalledWith({
      data: { patientAccountId: 'acc-1', patientId: 'patient-1', organizationId: 'org-1' },
    });
    expect(result.status).toBe('PENDING_CONSENT');
  });

  it('atualiza o status do vínculo, com confirmedAt opcional', async () => {
    prisma.patientAccountLink.update.mockResolvedValue({ id: 'link-1', status: 'ACTIVE' });

    await service.updateStatus('link-1', 'ACTIVE', new Date('2026-09-18'));

    expect(prisma.patientAccountLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { status: 'ACTIVE', confirmedAt: new Date('2026-09-18') },
    });
  });

  it('atualiza o status sem tocar em confirmedAt quando não informado', async () => {
    prisma.patientAccountLink.update.mockResolvedValue({ id: 'link-1', status: 'DECLINED' });

    await service.updateStatus('link-1', 'DECLINED');

    expect(prisma.patientAccountLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { status: 'DECLINED', confirmedAt: undefined },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/patient-portal/patient-account-link.service.spec.ts`
Expected: FAIL — cannot find module `./patient-account-link.service`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/patient-portal/patient-account-link.service.ts
import { Injectable } from '@nestjs/common';
import { PatientAccountLinkStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PatientAccountLinkSummary {
  id: string;
  patientAccountId: string;
  patientId: string;
  organizationId: string;
  status: PatientAccountLinkStatus;
  invitedAt: Date;
  confirmedAt: Date | null;
}

@Injectable()
export class PatientAccountLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPatientId(patientId: string): Promise<PatientAccountLinkSummary | null> {
    return this.prisma.patientAccountLink.findFirst({ where: { patientId } });
  }

  async findById(id: string): Promise<PatientAccountLinkSummary | null> {
    return this.prisma.patientAccountLink.findUnique({ where: { id } });
  }

  async findAllByAccountId(patientAccountId: string): Promise<PatientAccountLinkSummary[]> {
    return this.prisma.patientAccountLink.findMany({ where: { patientAccountId } });
  }

  async create(params: {
    patientAccountId: string;
    patientId: string;
    organizationId: string;
  }): Promise<PatientAccountLinkSummary> {
    return this.prisma.patientAccountLink.create({ data: params });
  }

  async updateStatus(
    id: string,
    status: PatientAccountLinkStatus,
    confirmedAt?: Date,
  ): Promise<PatientAccountLinkSummary> {
    return this.prisma.patientAccountLink.update({
      where: { id },
      data: { status, confirmedAt },
    });
  }
}
```

- [ ] **Step 4: Register it in the module**

```typescript
// src/patient-portal/patient-portal.module.ts
import { Module } from '@nestjs/common';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';

@Module({
  providers: [PatientAccountService, PatientAccountLinkService],
})
export class PatientPortalModule {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/patient-portal/patient-account-link.service.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/patient-portal/patient-account-link.service.ts src/patient-portal/patient-account-link.service.spec.ts src/patient-portal/patient-portal.module.ts
git commit -m "feat(patient-portal): add PatientAccountLinkService"
```

---

## Task 7: `PatientConsentAuditService`

**Files:**
- Create: `src/patient-portal/patient-consent-audit.service.ts`
- Create: `src/patient-portal/patient-consent-audit.service.spec.ts`
- Modify: `src/patient-portal/patient-portal.module.ts`

**Interfaces:**
- Consumes: `PrismaService`.
- Produces: `PatientConsentAuditService.record(params): Promise<void>` — consumed by Tasks 9, 10, 13.

- [ ] **Step 1: Write the failing test**

```typescript
// src/patient-portal/patient-consent-audit.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PatientConsentAuditService } from './patient-consent-audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PatientConsentAuditService', () => {
  let service: PatientConsentAuditService;
  let prisma: { patientConsentAudit: { create: jest.Mock } };

  beforeEach(async () => {
    prisma = { patientConsentAudit: { create: jest.fn().mockResolvedValue({}) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PatientConsentAuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PatientConsentAuditService>(PatientConsentAuditService);
  });

  it('grava uma linha de auditoria', async () => {
    await service.record({
      patientAccountLinkId: 'link-1',
      action: 'REQUESTED',
      actorType: 'PROFESSIONAL',
      actorId: 'person-1',
    });

    expect(prisma.patientConsentAudit.create).toHaveBeenCalledWith({
      data: {
        patientAccountLinkId: 'link-1',
        action: 'REQUESTED',
        actorType: 'PROFESSIONAL',
        actorId: 'person-1',
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/patient-portal/patient-consent-audit.service.spec.ts`
Expected: FAIL — cannot find module `./patient-consent-audit.service`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/patient-portal/patient-consent-audit.service.ts
import { Injectable } from '@nestjs/common';
import { PatientConsentAction, PatientConsentActorType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordConsentAuditParams {
  patientAccountLinkId: string;
  action: PatientConsentAction;
  actorType: PatientConsentActorType;
  actorId: string;
}

@Injectable()
export class PatientConsentAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordConsentAuditParams): Promise<void> {
    await this.prisma.patientConsentAudit.create({ data: params });
  }
}
```

- [ ] **Step 4: Register it in the module**

```typescript
// src/patient-portal/patient-portal.module.ts
import { Module } from '@nestjs/common';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';

@Module({
  providers: [PatientAccountService, PatientAccountLinkService, PatientConsentAuditService],
})
export class PatientPortalModule {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/patient-portal/patient-consent-audit.service.spec.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/patient-portal/patient-consent-audit.service.ts src/patient-portal/patient-consent-audit.service.spec.ts src/patient-portal/patient-portal.module.ts
git commit -m "feat(patient-portal): add PatientConsentAuditService"
```

---

## Task 8: Patient JWT strategy, guards and decorators — plus the professional/patient token split

This is the security-critical task: it makes the professional and patient JWT strategies
mutually exclusive, even though they share the same signing secret.

**Files:**
- Modify: `src/auth/strategies/jwt.strategy.ts`
- Create: `src/auth/strategies/jwt.strategy.spec.ts`
- Create: `src/patient-portal/strategies/patient-jwt.strategy.ts`
- Create: `src/patient-portal/strategies/patient-jwt.strategy.spec.ts`
- Create: `src/patient-portal/guards/patient-jwt-auth.guard.ts`
- Create: `src/patient-portal/guards/patient-scope.guard.ts`
- Create: `src/patient-portal/guards/patient-scope.guard.spec.ts`
- Create: `src/patient-portal/decorators/current-patient.decorator.ts`
- Create: `src/patient-portal/decorators/require-full-patient-session.decorator.ts`
- Modify: `src/patient-portal/patient-portal.module.ts`

**Interfaces:**
- Produces: `PatientJwtPayload` (`{ sub, scope, linkId?, patientId?, organizationId?, jti }`), `PatientJwtAuthGuard`, `PatientScopeGuard`, `@CurrentPatient()`, `@RequireFullPatientSession()` — consumed by Tasks 11, 13, 15.

- [ ] **Step 1: Write the failing test for the existing `JwtStrategy` rejecting patient tokens**

```typescript
// src/auth/strategies/jwt.strategy.spec.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/auth/strategies/jwt.strategy.spec.ts`
Expected: FAIL on the third test — `JwtStrategy.validate` currently accepts any payload shape.

- [ ] **Step 3: Update `JwtStrategy.validate` to reject scoped (patient) payloads**

```typescript
// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service';

export interface JwtPayload {
  sub: string;
  organizationId: string;
  role: string;
  jti: string;
}

export const ACCESS_COOKIE_NAME = 'pelvi_access_token';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies?.[ACCESS_COOKIE_NAME] as string | undefined) ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Tokens da paciente carregam `scope` — nunca são válidos para rotas
    // profissionais, mesmo assinados com o mesmo segredo.
    if ('scope' in payload) {
      throw new UnauthorizedException('Token inválido para este contexto');
    }

    try {
      if (payload.jti && await this.redis.exists(`blacklist:${payload.jti}`)) {
        throw new UnauthorizedException('Token revogado');
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
    }
    return {
      sub: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role,
      jti: payload.jti,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/auth/strategies/jwt.strategy.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing test for the new `PatientJwtStrategy`**

```typescript
// src/patient-portal/strategies/patient-jwt.strategy.spec.ts
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
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest src/patient-portal/strategies/patient-jwt.strategy.spec.ts`
Expected: FAIL — cannot find module `./patient-jwt.strategy`.

- [ ] **Step 7: Write the implementation**

```typescript
// src/patient-portal/strategies/patient-jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type PatientJwtScope = 'patient' | 'patient-consent';

export interface PatientJwtPayload {
  sub: string;
  scope: PatientJwtScope;
  linkId?: string;
  patientId?: string;
  organizationId?: string;
  jti: string;
}

import { RedisService } from '../../redis/redis.service';

@Injectable()
export class PatientJwtStrategy extends PassportStrategy(Strategy, 'patient-jwt') {
  constructor(
    configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: PatientJwtPayload): Promise<PatientJwtPayload> {
    // Tokens profissionais não carregam `scope` — nunca são válidos aqui,
    // mesmo assinados com o mesmo segredo.
    if (!payload.scope) {
      throw new UnauthorizedException('Token inválido para este contexto');
    }

    if (payload.jti && (await this.redis.exists(`patient-blacklist:${payload.jti}`))) {
      throw new UnauthorizedException('Token revogado');
    }

    return payload;
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest src/patient-portal/strategies/patient-jwt.strategy.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Write the guard, scope guard (with its test) and decorators**

```typescript
// src/patient-portal/guards/patient-jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PatientJwtAuthGuard extends AuthGuard('patient-jwt') {}
```

```typescript
// src/patient-portal/decorators/require-full-patient-session.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FULL_PATIENT_SESSION = 'requireFullPatientSession';
export const RequireFullPatientSession = () => SetMetadata(REQUIRE_FULL_PATIENT_SESSION, true);
```

```typescript
// src/patient-portal/guards/patient-scope.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_FULL_PATIENT_SESSION } from '../decorators/require-full-patient-session.decorator';
import { PatientJwtPayload } from '../strategies/patient-jwt.strategy';

@Injectable()
export class PatientScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresFullSession = this.reflector.getAllAndOverride<boolean>(REQUIRE_FULL_PATIENT_SESSION, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiresFullSession) return true;

    const { user } = context.switchToHttp().getRequest();
    const payload = user as PatientJwtPayload;

    if (payload.scope !== 'patient') {
      throw new ForbiddenException('Sessão de consentimento não pode acessar este recurso');
    }

    return true;
  }
}
```

```typescript
// src/patient-portal/guards/patient-scope.guard.spec.ts
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
```

```typescript
// src/patient-portal/decorators/current-patient.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PatientJwtPayload } from '../strategies/patient-jwt.strategy';

export const CurrentPatient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PatientJwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as PatientJwtPayload;
  },
);
```

- [ ] **Step 10: Register the strategy in the module**

```typescript
// src/patient-portal/patient-portal.module.ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';
import { PatientJwtStrategy } from './strategies/patient-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_SECRET') }),
    }),
  ],
  providers: [
    PatientAccountService,
    PatientAccountLinkService,
    PatientConsentAuditService,
    PatientJwtStrategy,
  ],
})
export class PatientPortalModule {}
```

- [ ] **Step 11: Run all patient-portal and auth tests to verify everything passes**

Run: `npx jest src/patient-portal src/auth/strategies`
Expected: PASS, all suites green.

- [ ] **Step 12: Commit**

```bash
git add src/auth/strategies/jwt.strategy.ts src/auth/strategies/jwt.strategy.spec.ts \
  src/patient-portal/strategies src/patient-portal/guards src/patient-portal/decorators \
  src/patient-portal/patient-portal.module.ts
git commit -m "feat(patient-portal): add patient JWT strategy and make it mutually exclusive with the professional one"
```

---

## Task 9: `PatientInviteService` (invite + resend)

**Files:**
- Create: `src/patient-portal/patient-invite.service.ts`
- Create: `src/patient-portal/patient-invite.service.spec.ts`
- Create: `src/patient-portal/patient-invite.controller.ts`
- Modify: `src/patient-portal/patient-portal.module.ts`

**Interfaces:**
- Consumes: `PatientLookupService` (Task 2), `PatientAccountService` (Task 5), `PatientAccountLinkService` (Task 6), `PatientConsentAuditService` (Task 7), `EmailService.sendPatientInvite` (Task 4), `RedisService`, `ConfigService`.
- Produces: `PatientInviteService.invite(actorPersonId, organizationId, patientId): Promise<void>`, `.resend(actorPersonId, organizationId, linkId): Promise<void>`. Redis key `patient-invite:<token>` (JSON `{ patientAccountId, linkId }`) consumed by Task 10 (`PatientActivationService`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/patient-portal/patient-invite.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PatientInviteService } from './patient-invite.service';
import { PatientLookupService } from '../patient/patient-lookup.service';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';
import { EmailService } from '../email/email.service';
import { RedisService } from '../redis/redis.service';

describe('PatientInviteService', () => {
  let service: PatientInviteService;
  let patientLookup: { findById: jest.Mock };
  let accounts: { findByCpf: jest.Mock; createPending: jest.Mock };
  let links: { findByPatientId: jest.Mock; findById: jest.Mock; create: jest.Mock; updateStatus: jest.Mock };
  let audits: { record: jest.Mock };
  let emailService: { sendPatientInvite: jest.Mock };
  let redis: { setJson: jest.Mock };
  let config: { getOrThrow: jest.Mock };

  beforeEach(async () => {
    patientLookup = { findById: jest.fn() };
    accounts = { findByCpf: jest.fn(), createPending: jest.fn() };
    links = {
      findByPatientId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
    };
    audits = { record: jest.fn() };
    emailService = { sendPatientInvite: jest.fn() };
    redis = { setJson: jest.fn() };
    config = { getOrThrow: jest.fn().mockReturnValue('https://app.soupelvi.com') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientInviteService,
        { provide: PatientLookupService, useValue: patientLookup },
        { provide: PatientAccountService, useValue: accounts },
        { provide: PatientAccountLinkService, useValue: links },
        { provide: PatientConsentAuditService, useValue: audits },
        { provide: EmailService, useValue: emailService },
        { provide: RedisService, useValue: redis },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<PatientInviteService>(PatientInviteService);
  });

  describe('invite', () => {
    const patient = {
      id: 'patient-1', name: 'Maria Silva', cpf: '12345678901', email: 'maria@email.com',
      phone: null, birthDate: null, organizationId: 'org-1', organizationName: 'Clínica A',
    };

    it('rejeita quando a paciente não existe ou não é da organização', async () => {
      patientLookup.findById.mockResolvedValue(null);

      await expect(service.invite('person-1', 'org-1', 'patient-1')).rejects.toThrow(NotFoundException);
    });

    it('rejeita quando a paciente não tem CPF', async () => {
      patientLookup.findById.mockResolvedValue({ ...patient, cpf: null });

      await expect(service.invite('person-1', 'org-1', 'patient-1')).rejects.toThrow(BadRequestException);
    });

    it('rejeita quando a paciente não tem e-mail e a conta ainda não existe', async () => {
      patientLookup.findById.mockResolvedValue({ ...patient, email: null });
      links.findByPatientId.mockResolvedValue(null);
      accounts.findByCpf.mockResolvedValue(null);

      await expect(service.invite('person-1', 'org-1', 'patient-1')).rejects.toThrow(BadRequestException);
    });

    it('rejeita quando já existe vínculo para esse registro de paciente', async () => {
      patientLookup.findById.mockResolvedValue(patient);
      links.findByPatientId.mockResolvedValue({ id: 'link-1' });

      await expect(service.invite('person-1', 'org-1', 'patient-1')).rejects.toThrow(ConflictException);
    });

    it('cria conta nova, vínculo e envia e-mail quando o CPF ainda não tem conta', async () => {
      patientLookup.findById.mockResolvedValue(patient);
      links.findByPatientId.mockResolvedValue(null);
      accounts.findByCpf.mockResolvedValue(null);
      accounts.createPending.mockResolvedValue({ id: 'acc-1', cpf: '12345678901' });
      links.create.mockResolvedValue({ id: 'link-1' });

      await service.invite('person-1', 'org-1', 'patient-1');

      expect(accounts.createPending).toHaveBeenCalledWith('12345678901');
      expect(links.create).toHaveBeenCalledWith({
        patientAccountId: 'acc-1', patientId: 'patient-1', organizationId: 'org-1',
      });
      expect(audits.record).toHaveBeenCalledWith({
        patientAccountLinkId: 'link-1', action: 'REQUESTED', actorType: 'PROFESSIONAL', actorId: 'person-1',
      });
      expect(redis.setJson).toHaveBeenCalledWith(
        expect.stringMatching(/^patient-invite:/),
        { patientAccountId: 'acc-1', linkId: 'link-1' },
        60 * 60 * 24 * 7,
      );
      expect(emailService.sendPatientInvite).toHaveBeenCalledWith(
        'maria@email.com', 'Maria Silva', 'Clínica A',
        expect.stringContaining('/paciente/ativar-conta?token='),
      );
    });

    it('cria só um novo vínculo, sem e-mail, quando o CPF já tem conta', async () => {
      patientLookup.findById.mockResolvedValue(patient);
      links.findByPatientId.mockResolvedValue(null);
      accounts.findByCpf.mockResolvedValue({ id: 'acc-existing', cpf: '12345678901' });
      links.create.mockResolvedValue({ id: 'link-2' });

      await service.invite('person-1', 'org-1', 'patient-1');

      expect(accounts.createPending).not.toHaveBeenCalled();
      expect(links.create).toHaveBeenCalledWith({
        patientAccountId: 'acc-existing', patientId: 'patient-1', organizationId: 'org-1',
      });
      expect(audits.record).toHaveBeenCalledWith({
        patientAccountLinkId: 'link-2', action: 'REQUESTED', actorType: 'PROFESSIONAL', actorId: 'person-1',
      });
      expect(emailService.sendPatientInvite).not.toHaveBeenCalled();
      expect(redis.setJson).not.toHaveBeenCalled();
    });
  });

  describe('resend', () => {
    it('rejeita quando o vínculo não existe ou é de outra organização', async () => {
      links.findById.mockResolvedValue(null);

      await expect(service.resend('person-1', 'org-1', 'link-1')).rejects.toThrow(NotFoundException);
    });

    it('rejeita quando o vínculo não está recusado', async () => {
      links.findById.mockResolvedValue({ id: 'link-1', organizationId: 'org-1', status: 'ACTIVE' });

      await expect(service.resend('person-1', 'org-1', 'link-1')).rejects.toThrow(ConflictException);
    });

    it('volta o vínculo para PENDING_CONSENT e grava audit RESENT', async () => {
      links.findById.mockResolvedValue({ id: 'link-1', organizationId: 'org-1', status: 'DECLINED' });

      await service.resend('person-1', 'org-1', 'link-1');

      expect(links.updateStatus).toHaveBeenCalledWith('link-1', 'PENDING_CONSENT');
      expect(audits.record).toHaveBeenCalledWith({
        patientAccountLinkId: 'link-1', action: 'RESENT', actorType: 'PROFESSIONAL', actorId: 'person-1',
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/patient-portal/patient-invite.service.spec.ts`
Expected: FAIL — cannot find module `./patient-invite.service`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/patient-portal/patient-invite.service.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PatientLookupService } from '../patient/patient-lookup.service';
import { EmailService } from '../email/email.service';
import { RedisService } from '../redis/redis.service';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';

const INVITE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

@Injectable()
export class PatientInviteService {
  constructor(
    private readonly patientLookup: PatientLookupService,
    private readonly accounts: PatientAccountService,
    private readonly links: PatientAccountLinkService,
    private readonly audits: PatientConsentAuditService,
    private readonly emailService: EmailService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async invite(actorPersonId: string, organizationId: string, patientId: string): Promise<void> {
    const patient = await this.patientLookup.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      throw new NotFoundException('Paciente não encontrada');
    }
    if (!patient.cpf) {
      throw new BadRequestException('Paciente não tem CPF cadastrado');
    }

    const existingLink = await this.links.findByPatientId(patientId);
    if (existingLink) {
      throw new ConflictException('Paciente já convidada');
    }

    const existingAccount = await this.accounts.findByCpf(patient.cpf);
    const isNewAccount = !existingAccount;
    if (isNewAccount && !patient.email) {
      throw new BadRequestException('Paciente não tem e-mail cadastrado');
    }

    const account = existingAccount ?? (await this.accounts.createPending(patient.cpf));
    const link = await this.links.create({
      patientAccountId: account.id,
      patientId,
      organizationId,
    });

    await this.audits.record({
      patientAccountLinkId: link.id,
      action: 'REQUESTED',
      actorType: 'PROFESSIONAL',
      actorId: actorPersonId,
    });

    if (isNewAccount) {
      const token = crypto.randomBytes(32).toString('hex');
      await this.redis.setJson(
        `patient-invite:${token}`,
        { patientAccountId: account.id, linkId: link.id },
        INVITE_TOKEN_TTL_SECONDS,
      );
      const appUrl = this.config.getOrThrow<string>('APP_URL');
      const activateUrl = `${appUrl}/paciente/ativar-conta?token=${token}`;
      await this.emailService.sendPatientInvite(
        patient.email as string,
        patient.name,
        patient.organizationName,
        activateUrl,
      );
    }
  }

  async resend(actorPersonId: string, organizationId: string, linkId: string): Promise<void> {
    const link = await this.links.findById(linkId);
    if (!link || link.organizationId !== organizationId) {
      throw new NotFoundException('Vínculo não encontrado');
    }
    if (link.status !== 'DECLINED') {
      throw new ConflictException('Só é possível reenviar um vínculo recusado');
    }

    await this.links.updateStatus(linkId, 'PENDING_CONSENT');
    await this.audits.record({
      patientAccountLinkId: linkId,
      action: 'RESENT',
      actorType: 'PROFESSIONAL',
      actorId: actorPersonId,
    });
  }
}
```

- [ ] **Step 4: Write the controller**

```typescript
// src/patient-portal/patient-invite.controller.ts
import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PatientInviteService } from './patient-invite.service';

@ApiBearerAuth()
@ApiTags('Patient Portal - Convites')
@Controller('patient-portal')
export class PatientInviteController {
  constructor(private readonly inviteService: PatientInviteService) {}

  @Post('patients/:patientId/invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Convidar paciente para o app (cria conta ou novo vínculo)' })
  async invite(
    @CurrentUser() user: JwtPayload,
    @OrgId() orgId: string,
    @Param('patientId') patientId: string,
  ) {
    await this.inviteService.invite(user.sub, orgId, patientId);
    return { message: 'Convite enviado' };
  }

  @Post('links/:linkId/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar uma solicitação de vínculo recusada' })
  async resend(
    @CurrentUser() user: JwtPayload,
    @OrgId() orgId: string,
    @Param('linkId') linkId: string,
  ) {
    await this.inviteService.resend(user.sub, orgId, linkId);
    return { message: 'Solicitação reenviada' };
  }
}
```

- [ ] **Step 5: Register in the module**

```typescript
// src/patient-portal/patient-portal.module.ts — add imports/providers/controllers
import { EmailModule } from '../email/email.module';
import { PatientModule } from '../patient/patient.module';
import { PatientInviteService } from './patient-invite.service';
import { PatientInviteController } from './patient-invite.controller';
// ...
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({ /* ...unchanged... */ }),
    PatientModule,
    EmailModule,
  ],
  controllers: [PatientInviteController],
  providers: [
    PatientAccountService,
    PatientAccountLinkService,
    PatientConsentAuditService,
    PatientJwtStrategy,
    PatientInviteService,
  ],
})
export class PatientPortalModule {}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/patient-portal/patient-invite.service.spec.ts`
Expected: PASS (9 tests).

- [ ] **Step 7: Commit**

```bash
git add src/patient-portal/patient-invite.service.ts src/patient-portal/patient-invite.service.spec.ts \
  src/patient-portal/patient-invite.controller.ts src/patient-portal/patient-portal.module.ts
git commit -m "feat(patient-portal): add invite and resend flow"
```

---

## Task 10: `PatientActivationService`

**Files:**
- Create: `src/patient-portal/patient-activation.service.ts`
- Create: `src/patient-portal/patient-activation.service.spec.ts`
- Create: `src/patient-portal/dto/patient-activate.dto.ts`
- Create: `src/patient-portal/patient-auth.controller.ts`
- Modify: `src/patient-portal/patient-portal.module.ts`

**Interfaces:**
- Consumes: `RedisService` (reads `patient-invite:<token>` written by Task 9), `PatientAccountService.activate`, `PatientAccountLinkService.updateStatus`, `PatientConsentAuditService.record`.
- Produces: `PatientActivationService.activate(token, password): Promise<void>`, `POST /patient-portal/auth/activate`. Starts `patient-auth.controller.ts`, extended by Tasks 11 and 12.

- [ ] **Step 1: Write the failing test**

```typescript
// src/patient-portal/patient-activation.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PatientActivationService } from './patient-activation.service';
import { RedisService } from '../redis/redis.service';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';

describe('PatientActivationService', () => {
  let service: PatientActivationService;
  let redis: { getJson: jest.Mock; del: jest.Mock };
  let accounts: { activate: jest.Mock };
  let links: { updateStatus: jest.Mock };
  let audits: { record: jest.Mock };

  beforeEach(async () => {
    redis = { getJson: jest.fn(), del: jest.fn() };
    accounts = { activate: jest.fn().mockResolvedValue({}) };
    links = { updateStatus: jest.fn().mockResolvedValue({}) };
    audits = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientActivationService,
        { provide: RedisService, useValue: redis },
        { provide: PatientAccountService, useValue: accounts },
        { provide: PatientAccountLinkService, useValue: links },
        { provide: PatientConsentAuditService, useValue: audits },
      ],
    }).compile();

    service = module.get<PatientActivationService>(PatientActivationService);
  });

  it('rejeita token inválido ou expirado', async () => {
    redis.getJson.mockResolvedValue(null);

    await expect(service.activate('bad-token', 'novaSenha123')).rejects.toThrow(BadRequestException);
    expect(accounts.activate).not.toHaveBeenCalled();
  });

  it('ativa a conta, o vínculo, grava audit e apaga o token', async () => {
    redis.getJson.mockResolvedValue({ patientAccountId: 'acc-1', linkId: 'link-1' });

    await service.activate('good-token', 'novaSenha123');

    expect(accounts.activate).toHaveBeenCalledWith('acc-1', expect.any(String));
    expect(links.updateStatus).toHaveBeenCalledWith('link-1', 'ACTIVE', expect.any(Date));
    expect(audits.record).toHaveBeenCalledWith({
      patientAccountLinkId: 'link-1', action: 'ACCEPTED', actorType: 'PATIENT', actorId: 'acc-1',
    });
    expect(redis.del).toHaveBeenCalledWith('patient-invite:good-token');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/patient-portal/patient-activation.service.spec.ts`
Expected: FAIL — cannot find module `./patient-activation.service`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/patient-portal/patient-activation.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { RedisService } from '../redis/redis.service';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';

interface StoredInvite {
  patientAccountId: string;
  linkId: string;
}

@Injectable()
export class PatientActivationService {
  constructor(
    private readonly redis: RedisService,
    private readonly accounts: PatientAccountService,
    private readonly links: PatientAccountLinkService,
    private readonly audits: PatientConsentAuditService,
  ) {}

  async activate(token: string, password: string): Promise<void> {
    const stored = await this.redis.getJson<StoredInvite>(`patient-invite:${token}`);
    if (!stored) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.accounts.activate(stored.patientAccountId, passwordHash);
    await this.links.updateStatus(stored.linkId, 'ACTIVE', new Date());
    await this.audits.record({
      patientAccountLinkId: stored.linkId,
      action: 'ACCEPTED',
      actorType: 'PATIENT',
      actorId: stored.patientAccountId,
    });
    await this.redis.del(`patient-invite:${token}`);
  }
}
```

- [ ] **Step 4: Write the DTO and controller**

```typescript
// src/patient-portal/dto/patient-activate.dto.ts
import { IsString, MinLength } from 'class-validator';

export class PatientActivateDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password!: string;
}
```

```typescript
// src/patient-portal/patient-auth.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PatientActivationService } from './patient-activation.service';
import { PatientActivateDto } from './dto/patient-activate.dto';

@ApiTags('Patient Portal - Auth')
@Controller('patient-portal/auth')
export class PatientAuthController {
  constructor(private readonly activationService: PatientActivationService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('activate')
  @ApiOperation({ summary: 'Definir a senha e ativar a conta a partir do link de convite' })
  async activate(@Body() dto: PatientActivateDto) {
    await this.activationService.activate(dto.token, dto.password);
    return { message: 'Conta ativada com sucesso' };
  }
}
```

- [ ] **Step 5: Register in the module**

```typescript
// src/patient-portal/patient-portal.module.ts — add to the existing arrays
import { PatientActivationService } from './patient-activation.service';
import { PatientAuthController } from './patient-auth.controller';
// ...
  controllers: [PatientInviteController, PatientAuthController],
  providers: [
    PatientAccountService,
    PatientAccountLinkService,
    PatientConsentAuditService,
    PatientJwtStrategy,
    PatientInviteService,
    PatientActivationService,
  ],
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/patient-portal/patient-activation.service.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/patient-portal/patient-activation.service.ts src/patient-portal/patient-activation.service.spec.ts \
  src/patient-portal/dto/patient-activate.dto.ts src/patient-portal/patient-auth.controller.ts \
  src/patient-portal/patient-portal.module.ts
git commit -m "feat(patient-portal): add account activation from the first-invite email link"
```

---

## Task 11: `PatientAuthService` — login + select-link

**Files:**
- Create: `src/patient-portal/patient-auth.service.ts`
- Create: `src/patient-portal/patient-auth.service.spec.ts`
- Create: `src/patient-portal/dto/patient-login.dto.ts`
- Create: `src/patient-portal/dto/patient-select-link.dto.ts`
- Modify: `src/patient-portal/patient-auth.controller.ts`
- Modify: `src/patient-portal/patient-portal.module.ts`

**Interfaces:**
- Consumes: `PatientAccountService`, `PatientAccountLinkService`, `PatientLookupService`, `JwtService`, `ConfigService`, `RedisService`.
- Produces: `PatientAuthService.login`, `.selectLink`, `PatientLoginResult` — the `refresh`/`logout` methods are added onto this same service and file in Task 12, and `PatientJwtRefreshPayload` type is also defined in Task 12.

- [ ] **Step 1: Write the failing test**

```typescript
// src/patient-portal/patient-auth.service.spec.ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/patient-portal/patient-auth.service.spec.ts`
Expected: FAIL — cannot find module `./patient-auth.service`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/patient-portal/patient-auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PatientLookupService } from '../patient/patient-lookup.service';
import { RedisService } from '../redis/redis.service';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService, PatientAccountLinkSummary } from './patient-account-link.service';
import { PatientJwtPayload } from './strategies/patient-jwt.strategy';

const REFRESH_TTL_DAYS = 7;
const REFRESH_TTL_SECONDS = REFRESH_TTL_DAYS * 24 * 60 * 60;
const ACCESS_TTL_SECONDS = 15 * 60;

export const patientRedisKey = {
  refresh: (hash: string) => `patient-refresh:${hash}`,
  blacklist: (jti: string) => `patient-blacklist:${jti}`,
};

export interface PatientOrganizationSummary {
  linkId: string;
  organizationId: string;
  organizationName: string;
}

export interface PatientPendingConsentSummary {
  linkId: string;
  organizationId: string;
  organizationName: string;
  requestedAt: Date;
}

export interface PatientLoginResult {
  accessToken: string | null;
  refreshToken: string | null;
  preAuthToken: string | null;
  scope: 'patient' | 'patient-consent' | null;
  patientId: string | null;
  organizationId: string | null;
  organizations: PatientOrganizationSummary[];
  pendingConsents: PatientPendingConsentSummary[];
}

@Injectable()
export class PatientAuthService {
  constructor(
    protected readonly accounts: PatientAccountService,
    protected readonly links: PatientAccountLinkService,
    protected readonly patientLookup: PatientLookupService,
    protected readonly jwtService: JwtService,
    protected readonly config: ConfigService,
    protected readonly redis: RedisService,
  ) {}

  async login(cpf: string, password: string): Promise<PatientLoginResult> {
    const account = await this.accounts.findByCpf(cpf);
    if (!account || account.status === 'BLOCKED' || !account.passwordHash) {
      throw new UnauthorizedException('CPF ou senha inválidos');
    }

    const passwordValid = await bcrypt.compare(password, account.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('CPF ou senha inválidos');
    }

    const allLinks = await this.links.findAllByAccountId(account.id);
    const activeLinks = allLinks.filter((link) => link.status === 'ACTIVE');
    const pendingLinks = allLinks.filter((link) => link.status === 'PENDING_CONSENT');
    const pendingConsents = await this.toPendingConsentSummaries(pendingLinks);

    if (activeLinks.length === 0 && pendingLinks.length === 0) {
      throw new UnauthorizedException('Sem vínculo com nenhuma clínica');
    }

    if (activeLinks.length === 0) {
      return {
        accessToken: this.issueConsentOnlyToken(account.id),
        refreshToken: null,
        preAuthToken: null,
        scope: 'patient-consent',
        patientId: null,
        organizationId: null,
        organizations: [],
        pendingConsents,
      };
    }

    if (activeLinks.length === 1) {
      const tokens = await this.issueSessionTokens(account.id, activeLinks[0]);
      return {
        ...tokens,
        preAuthToken: null,
        scope: 'patient',
        patientId: activeLinks[0].patientId,
        organizationId: activeLinks[0].organizationId,
        organizations: await this.toOrganizationSummaries(activeLinks),
        pendingConsents,
      };
    }

    return {
      accessToken: null,
      refreshToken: null,
      preAuthToken: this.issuePreAuthToken(account.id),
      scope: null,
      patientId: null,
      organizationId: null,
      organizations: await this.toOrganizationSummaries(activeLinks),
      pendingConsents,
    };
  }

  async selectLink(preAuthToken: string, linkId: string): Promise<PatientLoginResult> {
    const accountId = this.verifyPreAuthToken(preAuthToken);
    const link = await this.links.findById(linkId);
    if (!link || link.patientAccountId !== accountId || link.status !== 'ACTIVE') {
      throw new UnauthorizedException('Vínculo inválido ou inativo');
    }

    const tokens = await this.issueSessionTokens(accountId, link);
    const allLinks = await this.links.findAllByAccountId(accountId);
    const activeLinks = allLinks.filter((l) => l.status === 'ACTIVE');
    const pendingLinks = allLinks.filter((l) => l.status === 'PENDING_CONSENT');

    return {
      ...tokens,
      preAuthToken: null,
      scope: 'patient',
      patientId: link.patientId,
      organizationId: link.organizationId,
      organizations: await this.toOrganizationSummaries(activeLinks),
      pendingConsents: await this.toPendingConsentSummaries(pendingLinks),
    };
  }

  protected async toOrganizationSummaries(
    links: PatientAccountLinkSummary[],
  ): Promise<PatientOrganizationSummary[]> {
    const patients = await Promise.all(links.map((link) => this.patientLookup.findById(link.patientId)));
    return links.map((link, index) => ({
      linkId: link.id,
      organizationId: link.organizationId,
      organizationName: patients[index]?.organizationName ?? '',
    }));
  }

  protected async toPendingConsentSummaries(
    links: PatientAccountLinkSummary[],
  ): Promise<PatientPendingConsentSummary[]> {
    const patients = await Promise.all(links.map((link) => this.patientLookup.findById(link.patientId)));
    return links.map((link, index) => ({
      linkId: link.id,
      organizationId: link.organizationId,
      organizationName: patients[index]?.organizationName ?? '',
      requestedAt: link.invitedAt,
    }));
  }

  protected issueConsentOnlyToken(accountId: string): string {
    const payload: PatientJwtPayload = { sub: accountId, scope: 'patient-consent', jti: crypto.randomUUID() };
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  protected issuePreAuthToken(accountId: string): string {
    return this.jwtService.sign({ sub: accountId, type: 'patient-pre-auth' }, { expiresIn: '5m' });
  }

  protected verifyPreAuthToken(token: string): string {
    try {
      const payload = this.jwtService.verify<{ sub?: string; type?: string }>(token);
      if (!payload.sub || payload.type !== 'patient-pre-auth') {
        throw new UnauthorizedException('Token de pré-autenticação inválido');
      }
      return payload.sub;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Token de pré-autenticação inválido ou expirado');
    }
  }

  protected async issueSessionTokens(
    accountId: string,
    link: PatientAccountLinkSummary,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const jti = crypto.randomUUID();
    const accessJti = crypto.randomUUID();

    const accessPayload: PatientJwtPayload = {
      sub: accountId,
      scope: 'patient',
      linkId: link.id,
      patientId: link.patientId,
      organizationId: link.organizationId,
      jti: accessJti,
    };
    const accessToken = this.jwtService.sign(accessPayload, { expiresIn: '15m' });

    const refreshPayload = {
      sub: accountId,
      scope: 'patient' as const,
      linkId: link.id,
      patientId: link.patientId,
      organizationId: link.organizationId,
      jti,
      type: 'patient-refresh' as const,
    };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: `${REFRESH_TTL_DAYS}d`,
    });

    await this.redis.set(patientRedisKey.refresh(this.hashJti(jti)), accountId, REFRESH_TTL_SECONDS);

    return { accessToken, refreshToken };
  }

  protected hashJti(jti: string): string {
    return crypto.createHash('sha256').update(jti).digest('hex');
  }
}
```

Note: `ACCESS_TTL_SECONDS` is unused by name here but is the blacklist TTL used by
`logout` in Task 12 — it stays in this file since that's where the redis key
constants live.

- [ ] **Step 4: Add the DTOs and wire login/select-link into the controller**

```typescript
// src/patient-portal/dto/patient-login.dto.ts
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class PatientLoginDto {
  @IsString()
  @IsNotEmpty()
  @Length(11, 11, { message: 'CPF deve ter exatamente 11 dígitos' })
  @Matches(/^\d{11}$/, { message: 'CPF deve conter apenas números' })
  cpf!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
```

```typescript
// src/patient-portal/dto/patient-select-link.dto.ts
import { IsString } from 'class-validator';

export class PatientSelectLinkDto {
  @IsString()
  preAuthToken!: string;

  @IsString()
  linkId!: string;
}
```

```typescript
// src/patient-portal/patient-auth.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PatientActivationService } from './patient-activation.service';
import { PatientAuthService } from './patient-auth.service';
import { PatientActivateDto } from './dto/patient-activate.dto';
import { PatientLoginDto } from './dto/patient-login.dto';
import { PatientSelectLinkDto } from './dto/patient-select-link.dto';

@ApiTags('Patient Portal - Auth')
@Controller('patient-portal/auth')
export class PatientAuthController {
  constructor(
    private readonly authService: PatientAuthService,
    private readonly activationService: PatientActivationService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Login da paciente via CPF + senha' })
  async login(@Body() dto: PatientLoginDto) {
    return this.authService.login(dto.cpf, dto.password);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('select-link')
  @ApiOperation({ summary: 'Escolher a clínica após login com mais de um vínculo ativo' })
  async selectLink(@Body() dto: PatientSelectLinkDto) {
    return this.authService.selectLink(dto.preAuthToken, dto.linkId);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('activate')
  @ApiOperation({ summary: 'Definir a senha e ativar a conta a partir do link de convite' })
  async activate(@Body() dto: PatientActivateDto) {
    await this.activationService.activate(dto.token, dto.password);
    return { message: 'Conta ativada com sucesso' };
  }
}
```

- [ ] **Step 5: Register in the module**

```typescript
// src/patient-portal/patient-portal.module.ts — add PatientAuthService to providers
import { PatientAuthService } from './patient-auth.service';
// ...
  providers: [
    PatientAccountService,
    PatientAccountLinkService,
    PatientConsentAuditService,
    PatientJwtStrategy,
    PatientInviteService,
    PatientActivationService,
    PatientAuthService,
  ],
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/patient-portal/patient-auth.service.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 7: Commit**

```bash
git add src/patient-portal/patient-auth.service.ts src/patient-portal/patient-auth.service.spec.ts \
  src/patient-portal/dto/patient-login.dto.ts src/patient-portal/dto/patient-select-link.dto.ts \
  src/patient-portal/patient-auth.controller.ts src/patient-portal/patient-portal.module.ts
git commit -m "feat(patient-portal): add login and select-link"
```

---

## Task 12: `PatientAuthService` — refresh + logout

**Files:**
- Modify: `src/patient-portal/patient-auth.service.ts`
- Modify: `src/patient-portal/patient-auth.service.spec.ts`
- Create: `src/patient-portal/strategies/patient-jwt-refresh.strategy.ts`
- Create: `src/patient-portal/guards/patient-jwt-refresh.guard.ts`
- Create: `src/patient-portal/decorators/current-patient-refresh-user.decorator.ts`
- Create: `src/patient-portal/dto/patient-logout.dto.ts`
- Modify: `src/patient-portal/patient-auth.controller.ts`
- Modify: `src/patient-portal/patient-portal.module.ts`

**Interfaces:**
- Consumes: `PatientJwtAuthGuard`, `@CurrentPatient()` (Task 8).
- Produces: `PatientAuthService.rotateRefreshToken(accountId, linkId, jti)`, `.logout(refreshToken, accessJti)`, `POST /patient-portal/auth/refresh`, `POST /patient-portal/auth/logout`.

- [ ] **Step 1: Add the failing tests**

```typescript
// src/patient-portal/patient-auth.service.spec.ts — add these two describe blocks
// at the end of the file, before the final closing `});`

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/patient-portal/patient-auth.service.spec.ts`
Expected: FAIL — `service.rotateRefreshToken is not a function`.

- [ ] **Step 3: Add the methods to `PatientAuthService`**

```typescript
// src/patient-portal/patient-auth.service.ts — add these two public methods
// to the PatientAuthService class, after selectLink()

  async rotateRefreshToken(
    accountId: string,
    linkId: string,
    jti: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = this.hashJti(jti);
    const storedAccountId = await this.redis.get(patientRedisKey.refresh(tokenHash));

    if (!storedAccountId || storedAccountId !== accountId) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const link = await this.links.findById(linkId);
    if (!link || link.status !== 'ACTIVE' || link.patientAccountId !== accountId) {
      await this.redis.del(patientRedisKey.refresh(tokenHash));
      throw new UnauthorizedException('Vínculo inválido ou inativo');
    }

    await this.redis.del(patientRedisKey.refresh(tokenHash));
    return this.issueSessionTokens(accountId, link);
  }

  async logout(refreshToken: string, accessJti: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<{ jti: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      await this.redis.del(patientRedisKey.refresh(this.hashJti(payload.jti)));
    } catch {
      // refresh token já inválido/expirado — segue para revogar o access token
    }

    await this.redis.set(patientRedisKey.blacklist(accessJti), '1', ACCESS_TTL_SECONDS);
  }
```

- [ ] **Step 4: Write the refresh strategy, guard and decorator**

```typescript
// src/patient-portal/strategies/patient-jwt-refresh.strategy.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface PatientJwtRefreshPayload {
  sub: string;
  scope: 'patient';
  linkId: string;
  patientId: string;
  organizationId: string;
  jti: string;
  type: 'patient-refresh';
}

@Injectable()
export class PatientJwtRefreshStrategy extends PassportStrategy(Strategy, 'patient-jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  validate(payload: PatientJwtRefreshPayload) {
    return { accountId: payload.sub, linkId: payload.linkId, jti: payload.jti };
  }
}
```

```typescript
// src/patient-portal/guards/patient-jwt-refresh.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PatientJwtRefreshGuard extends AuthGuard('patient-jwt-refresh') {}
```

```typescript
// src/patient-portal/decorators/current-patient-refresh-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface PatientRefreshUser {
  accountId: string;
  linkId: string;
  jti: string;
}

export const CurrentPatientRefreshUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PatientRefreshUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as PatientRefreshUser;
  },
);
```

```typescript
// src/patient-portal/dto/patient-logout.dto.ts
import { IsString } from 'class-validator';

export class PatientLogoutDto {
  @IsString()
  refreshToken!: string;
}
```

- [ ] **Step 5: Add the refresh and logout routes to the controller**

```typescript
// src/patient-portal/patient-auth.controller.ts — replace the imports and class body
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PatientActivationService } from './patient-activation.service';
import { PatientAuthService } from './patient-auth.service';
import { PatientActivateDto } from './dto/patient-activate.dto';
import { PatientLoginDto } from './dto/patient-login.dto';
import { PatientSelectLinkDto } from './dto/patient-select-link.dto';
import { PatientLogoutDto } from './dto/patient-logout.dto';
import { PatientJwtAuthGuard } from './guards/patient-jwt-auth.guard';
import { PatientJwtRefreshGuard } from './guards/patient-jwt-refresh.guard';
import { CurrentPatient } from './decorators/current-patient.decorator';
import { CurrentPatientRefreshUser, PatientRefreshUser } from './decorators/current-patient-refresh-user.decorator';
import { PatientJwtPayload } from './strategies/patient-jwt.strategy';

@ApiTags('Patient Portal - Auth')
@Controller('patient-portal/auth')
export class PatientAuthController {
  constructor(
    private readonly authService: PatientAuthService,
    private readonly activationService: PatientActivationService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Login da paciente via CPF + senha' })
  async login(@Body() dto: PatientLoginDto) {
    return this.authService.login(dto.cpf, dto.password);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('select-link')
  @ApiOperation({ summary: 'Escolher a clínica após login com mais de um vínculo ativo' })
  async selectLink(@Body() dto: PatientSelectLinkDto) {
    return this.authService.selectLink(dto.preAuthToken, dto.linkId);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('activate')
  @ApiOperation({ summary: 'Definir a senha e ativar a conta a partir do link de convite' })
  async activate(@Body() dto: PatientActivateDto) {
    await this.activationService.activate(dto.token, dto.password);
    return { message: 'Conta ativada com sucesso' };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(PatientJwtRefreshGuard)
  @Post('refresh')
  @ApiOperation({ summary: 'Renovar o access token via refresh token' })
  async refresh(@CurrentPatientRefreshUser() refreshUser: PatientRefreshUser) {
    return this.authService.rotateRefreshToken(refreshUser.accountId, refreshUser.linkId, refreshUser.jti);
  }

  @ApiBearerAuth()
  @Public()
  @UseGuards(PatientJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Encerrar a sessão da paciente' })
  async logout(@CurrentPatient() patient: PatientJwtPayload, @Body() dto: PatientLogoutDto) {
    await this.authService.logout(dto.refreshToken, patient.jti);
    return { message: 'Sessão encerrada' };
  }
}
```

- [ ] **Step 6: Register the refresh strategy in the module**

```typescript
// src/patient-portal/patient-portal.module.ts — add to providers
import { PatientJwtRefreshStrategy } from './strategies/patient-jwt-refresh.strategy';
// ...
  providers: [
    PatientAccountService,
    PatientAccountLinkService,
    PatientConsentAuditService,
    PatientJwtStrategy,
    PatientJwtRefreshStrategy,
    PatientInviteService,
    PatientActivationService,
    PatientAuthService,
  ],
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx jest src/patient-portal/patient-auth.service.spec.ts`
Expected: PASS (14 tests).

- [ ] **Step 8: Commit**

```bash
git add src/patient-portal/patient-auth.service.ts src/patient-portal/patient-auth.service.spec.ts \
  src/patient-portal/strategies/patient-jwt-refresh.strategy.ts \
  src/patient-portal/guards/patient-jwt-refresh.guard.ts \
  src/patient-portal/decorators/current-patient-refresh-user.decorator.ts \
  src/patient-portal/dto/patient-logout.dto.ts src/patient-portal/patient-auth.controller.ts \
  src/patient-portal/patient-portal.module.ts
git commit -m "feat(patient-portal): add refresh token rotation and logout"
```

---

## Task 13: `PatientConsentService` (accept/decline)

**Files:**
- Create: `src/patient-portal/patient-consent.service.ts`
- Create: `src/patient-portal/patient-consent.service.spec.ts`
- Create: `src/patient-portal/patient-consent.controller.ts`
- Modify: `src/patient-portal/patient-portal.module.ts`

**Interfaces:**
- Consumes: `PatientAccountLinkService`, `PatientConsentAuditService`, `PatientJwtAuthGuard`, `@CurrentPatient()`.
- Produces: `PatientConsentService.accept(patientAccountId, linkId)`, `.decline(...)`, `POST /patient-portal/consent/:linkId/accept|decline`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/patient-portal/patient-consent.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PatientConsentService } from './patient-consent.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';

describe('PatientConsentService', () => {
  let service: PatientConsentService;
  let links: { findById: jest.Mock; updateStatus: jest.Mock };
  let audits: { record: jest.Mock };

  beforeEach(async () => {
    links = { findById: jest.fn(), updateStatus: jest.fn().mockResolvedValue({}) };
    audits = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientConsentService,
        { provide: PatientAccountLinkService, useValue: links },
        { provide: PatientConsentAuditService, useValue: audits },
      ],
    }).compile();

    service = module.get<PatientConsentService>(PatientConsentService);
  });

  describe('accept', () => {
    it('rejeita quando o vínculo não existe ou é de outra conta', async () => {
      links.findById.mockResolvedValue({ id: 'link-1', patientAccountId: 'outra-conta', status: 'PENDING_CONSENT' });

      await expect(service.accept('acc-1', 'link-1')).rejects.toThrow(NotFoundException);
    });

    it('rejeita quando o vínculo não está pendente', async () => {
      links.findById.mockResolvedValue({ id: 'link-1', patientAccountId: 'acc-1', status: 'ACTIVE' });

      await expect(service.accept('acc-1', 'link-1')).rejects.toThrow(ConflictException);
    });

    it('ativa o vínculo e grava audit ACCEPTED', async () => {
      links.findById.mockResolvedValue({ id: 'link-1', patientAccountId: 'acc-1', status: 'PENDING_CONSENT' });

      await service.accept('acc-1', 'link-1');

      expect(links.updateStatus).toHaveBeenCalledWith('link-1', 'ACTIVE', expect.any(Date));
      expect(audits.record).toHaveBeenCalledWith({
        patientAccountLinkId: 'link-1', action: 'ACCEPTED', actorType: 'PATIENT', actorId: 'acc-1',
      });
    });
  });

  describe('decline', () => {
    it('recusa o vínculo e grava audit DECLINED', async () => {
      links.findById.mockResolvedValue({ id: 'link-1', patientAccountId: 'acc-1', status: 'PENDING_CONSENT' });

      await service.decline('acc-1', 'link-1');

      expect(links.updateStatus).toHaveBeenCalledWith('link-1', 'DECLINED');
      expect(audits.record).toHaveBeenCalledWith({
        patientAccountLinkId: 'link-1', action: 'DECLINED', actorType: 'PATIENT', actorId: 'acc-1',
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/patient-portal/patient-consent.service.spec.ts`
Expected: FAIL — cannot find module `./patient-consent.service`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/patient-portal/patient-consent.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PatientAccountLinkService, PatientAccountLinkSummary } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';

@Injectable()
export class PatientConsentService {
  constructor(
    private readonly links: PatientAccountLinkService,
    private readonly audits: PatientConsentAuditService,
  ) {}

  async accept(patientAccountId: string, linkId: string): Promise<void> {
    const link = await this.getOwnedPendingLink(patientAccountId, linkId);
    await this.links.updateStatus(link.id, 'ACTIVE', new Date());
    await this.audits.record({
      patientAccountLinkId: link.id,
      action: 'ACCEPTED',
      actorType: 'PATIENT',
      actorId: patientAccountId,
    });
  }

  async decline(patientAccountId: string, linkId: string): Promise<void> {
    const link = await this.getOwnedPendingLink(patientAccountId, linkId);
    await this.links.updateStatus(link.id, 'DECLINED');
    await this.audits.record({
      patientAccountLinkId: link.id,
      action: 'DECLINED',
      actorType: 'PATIENT',
      actorId: patientAccountId,
    });
  }

  private async getOwnedPendingLink(
    patientAccountId: string,
    linkId: string,
  ): Promise<PatientAccountLinkSummary> {
    const link = await this.links.findById(linkId);
    if (!link || link.patientAccountId !== patientAccountId) {
      throw new NotFoundException('Vínculo não encontrado');
    }
    if (link.status !== 'PENDING_CONSENT') {
      throw new ConflictException('Vínculo não está pendente de consentimento');
    }
    return link;
  }
}
```

- [ ] **Step 4: Write the controller**

```typescript
// src/patient-portal/patient-consent.controller.ts
import { Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentPatient } from './decorators/current-patient.decorator';
import { PatientJwtAuthGuard } from './guards/patient-jwt-auth.guard';
import { PatientConsentService } from './patient-consent.service';
import { PatientJwtPayload } from './strategies/patient-jwt.strategy';

@ApiBearerAuth()
@ApiTags('Patient Portal - Consentimento')
@Public()
@UseGuards(PatientJwtAuthGuard)
@Controller('patient-portal/consent')
export class PatientConsentController {
  constructor(private readonly consentService: PatientConsentService) {}

  @Post(':linkId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar o vínculo com uma nova clínica' })
  async accept(@CurrentPatient() patient: PatientJwtPayload, @Param('linkId') linkId: string) {
    await this.consentService.accept(patient.sub, linkId);
    return { message: 'Vínculo confirmado' };
  }

  @Post(':linkId/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recusar o vínculo com uma nova clínica' })
  async decline(@CurrentPatient() patient: PatientJwtPayload, @Param('linkId') linkId: string) {
    await this.consentService.decline(patient.sub, linkId);
    return { message: 'Vínculo recusado' };
  }
}
```

Note: this controller applies `PatientJwtAuthGuard` only — no
`@RequireFullPatientSession()` — because both a full session (`scope: 'patient'`)
and a consent-only session (`scope: 'patient-consent'`) must be able to
accept/decline a pending link, per the spec.

- [ ] **Step 5: Register in the module**

```typescript
// src/patient-portal/patient-portal.module.ts — add
import { PatientConsentService } from './patient-consent.service';
import { PatientConsentController } from './patient-consent.controller';
// ...
  controllers: [PatientInviteController, PatientAuthController, PatientConsentController],
  providers: [
    // ...previous providers...
    PatientConsentService,
  ],
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/patient-portal/patient-consent.service.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/patient-portal/patient-consent.service.ts src/patient-portal/patient-consent.service.spec.ts \
  src/patient-portal/patient-consent.controller.ts src/patient-portal/patient-portal.module.ts
git commit -m "feat(patient-portal): add consent accept/decline"
```

---

## Task 14: `PatientTreatmentPlanService`

**Files:**
- Create: `src/patient-portal/patient-treatment-plan.service.ts`
- Create: `src/patient-portal/patient-treatment-plan.service.spec.ts`
- Create: `src/patient-portal/dto/update-patient-treatment-plan.dto.ts`
- Create: `src/patient-portal/patient-treatment-plan.controller.ts`
- Modify: `src/patient-portal/patient-portal.module.ts`

**Interfaces:**
- Consumes: `PrismaService`, `PatientAccountLinkService`.
- Produces: `PatientTreatmentPlanService.getForPatient`, `.upsertFeatures`, `PatientTreatmentPlanFeatures`, `GET/PUT /patient-portal/patients/:patientId/{portal,plan}`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/patient-portal/patient-treatment-plan.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PatientTreatmentPlanService } from './patient-treatment-plan.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PatientTreatmentPlanService', () => {
  let service: PatientTreatmentPlanService;
  let prisma: { patientTreatmentPlan: { findFirst: jest.Mock; upsert: jest.Mock } };

  beforeEach(async () => {
    prisma = { patientTreatmentPlan: { findFirst: jest.fn(), upsert: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PatientTreatmentPlanService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PatientTreatmentPlanService>(PatientTreatmentPlanService);
  });

  it('retorna os recursos padrão (tudo desligado) quando não há plano', async () => {
    prisma.patientTreatmentPlan.findFirst.mockResolvedValue(null);

    const result = await service.getForPatient('org-1', 'patient-1');

    expect(result).toEqual({ diarioMiccional: false, diarioEvacuatorio: false, cronometros: false });
  });

  it('retorna os recursos salvos quando há plano', async () => {
    prisma.patientTreatmentPlan.findFirst.mockResolvedValue({
      features: { diarioMiccional: true, diarioEvacuatorio: false, cronometros: true },
    });

    const result = await service.getForPatient('org-1', 'patient-1');

    expect(result).toEqual({ diarioMiccional: true, diarioEvacuatorio: false, cronometros: true });
  });

  it('faz upsert dos recursos e retorna o resultado salvo', async () => {
    const features = { diarioMiccional: true, diarioEvacuatorio: true, cronometros: false };
    prisma.patientTreatmentPlan.upsert.mockResolvedValue({ features });

    const result = await service.upsertFeatures('org-1', 'patient-1', features, 'person-1');

    expect(prisma.patientTreatmentPlan.upsert).toHaveBeenCalledWith({
      where: { patientId: 'patient-1' },
      create: { patientId: 'patient-1', organizationId: 'org-1', features, updatedByPersonId: 'person-1' },
      update: { features, updatedByPersonId: 'person-1' },
    });
    expect(result).toEqual(features);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/patient-portal/patient-treatment-plan.service.spec.ts`
Expected: FAIL — cannot find module `./patient-treatment-plan.service`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/patient-portal/patient-treatment-plan.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PatientTreatmentPlanFeatures {
  diarioMiccional: boolean;
  diarioEvacuatorio: boolean;
  cronometros: boolean;
}

const DEFAULT_FEATURES: PatientTreatmentPlanFeatures = {
  diarioMiccional: false,
  diarioEvacuatorio: false,
  cronometros: false,
};

@Injectable()
export class PatientTreatmentPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async getForPatient(organizationId: string, patientId: string): Promise<PatientTreatmentPlanFeatures> {
    const plan = await this.prisma.patientTreatmentPlan.findFirst({
      where: { organizationId, patientId },
    });
    return (plan?.features as PatientTreatmentPlanFeatures) ?? DEFAULT_FEATURES;
  }

  async upsertFeatures(
    organizationId: string,
    patientId: string,
    features: PatientTreatmentPlanFeatures,
    updatedByPersonId: string,
  ): Promise<PatientTreatmentPlanFeatures> {
    const plan = await this.prisma.patientTreatmentPlan.upsert({
      where: { patientId },
      create: { patientId, organizationId, features, updatedByPersonId },
      update: { features, updatedByPersonId },
    });
    return plan.features as PatientTreatmentPlanFeatures;
  }
}
```

- [ ] **Step 4: Write the DTO and controller**

```typescript
// src/patient-portal/dto/update-patient-treatment-plan.dto.ts
import { Type } from 'class-transformer';
import { IsBoolean, ValidateNested } from 'class-validator';

class PatientTreatmentPlanFeaturesDto {
  @IsBoolean()
  diarioMiccional!: boolean;

  @IsBoolean()
  diarioEvacuatorio!: boolean;

  @IsBoolean()
  cronometros!: boolean;
}

export class UpdatePatientTreatmentPlanDto {
  @ValidateNested()
  @Type(() => PatientTreatmentPlanFeaturesDto)
  features!: PatientTreatmentPlanFeaturesDto;
}
```

```typescript
// src/patient-portal/patient-treatment-plan.controller.ts
import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientTreatmentPlanService } from './patient-treatment-plan.service';
import { UpdatePatientTreatmentPlanDto } from './dto/update-patient-treatment-plan.dto';

@ApiBearerAuth()
@ApiTags('Patient Portal - Plano de tratamento')
@Controller('patient-portal/patients')
export class PatientTreatmentPlanController {
  constructor(
    private readonly links: PatientAccountLinkService,
    private readonly plans: PatientTreatmentPlanService,
  ) {}

  @Get(':patientId/portal')
  @ApiOperation({ summary: 'Status do vínculo e plano de tratamento da paciente' })
  async getPortalStatus(@OrgId() orgId: string, @Param('patientId') patientId: string) {
    const link = await this.links.findByPatientId(patientId);
    const features = await this.plans.getForPatient(orgId, patientId);
    return {
      linkStatus: link && link.organizationId === orgId ? link.status : null,
      features,
    };
  }

  @Put(':patientId/plan')
  @ApiOperation({ summary: 'Atualizar os recursos habilitados no plano de tratamento' })
  async updatePlan(
    @CurrentUser() user: JwtPayload,
    @OrgId() orgId: string,
    @Param('patientId') patientId: string,
    @Body() dto: UpdatePatientTreatmentPlanDto,
  ) {
    return this.plans.upsertFeatures(orgId, patientId, dto.features, user.sub);
  }
}
```

- [ ] **Step 5: Register in the module**

```typescript
// src/patient-portal/patient-portal.module.ts — add
import { PatientTreatmentPlanService } from './patient-treatment-plan.service';
import { PatientTreatmentPlanController } from './patient-treatment-plan.controller';
// ...
  controllers: [
    PatientInviteController,
    PatientAuthController,
    PatientConsentController,
    PatientTreatmentPlanController,
  ],
  providers: [
    // ...previous providers...
    PatientTreatmentPlanService,
  ],
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/patient-portal/patient-treatment-plan.service.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/patient-portal/patient-treatment-plan.service.ts src/patient-portal/patient-treatment-plan.service.spec.ts \
  src/patient-portal/dto/update-patient-treatment-plan.dto.ts src/patient-portal/patient-treatment-plan.controller.ts \
  src/patient-portal/patient-portal.module.ts
git commit -m "feat(patient-portal): add treatment plan get/update"
```

---

## Task 15: `PatientMeService` (ficha + appointments) — final module wiring

**Files:**
- Create: `src/patient-portal/patient-me.service.ts`
- Create: `src/patient-portal/patient-me.service.spec.ts`
- Create: `src/patient-portal/patient-me.controller.ts`
- Modify: `src/patient-portal/patient-portal.module.ts`

**Interfaces:**
- Consumes: `PatientAccountLinkService`, `PatientLookupService`, `AppointmentLookupService` (Task 3), `PatientJwtAuthGuard`, `PatientScopeGuard`, `@RequireFullPatientSession()`.
- Produces: `GET /patient-portal/me/ficha`, `GET /patient-portal/me/appointments` — the endpoints `pelvi-app` (Plan 3) calls for Início and Ficha.

- [ ] **Step 1: Write the failing test**

```typescript
// src/patient-portal/patient-me.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PatientMeService } from './patient-me.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientLookupService } from '../patient/patient-lookup.service';
import { AppointmentLookupService } from '../appointment/appointment-lookup.service';

describe('PatientMeService', () => {
  let service: PatientMeService;
  let links: { findAllByAccountId: jest.Mock };
  let patientLookup: { findById: jest.Mock };
  let appointmentLookup: { findUpcomingByPatientId: jest.Mock };

  beforeEach(async () => {
    links = { findAllByAccountId: jest.fn() };
    patientLookup = { findById: jest.fn() };
    appointmentLookup = { findUpcomingByPatientId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientMeService,
        { provide: PatientAccountLinkService, useValue: links },
        { provide: PatientLookupService, useValue: patientLookup },
        { provide: AppointmentLookupService, useValue: appointmentLookup },
      ],
    }).compile();

    service = module.get<PatientMeService>(PatientMeService);
  });

  describe('getFicha', () => {
    it('rejeita quando o patientId não corresponde a nenhum vínculo ativo da conta', async () => {
      links.findAllByAccountId.mockResolvedValue([
        { id: 'link-1', patientId: 'patient-1', organizationId: 'org-1', status: 'ACTIVE' },
      ]);
      patientLookup.findById.mockResolvedValue({
        id: 'patient-1', name: 'Maria', cpf: '12345678901', phone: null, birthDate: null, organizationName: 'Clínica A',
      });

      await expect(service.getFicha('acc-1', 'patient-outro')).rejects.toThrow(NotFoundException);
    });

    it('retorna nome, CPF mascarado e as clínicas com vínculo ativo', async () => {
      links.findAllByAccountId.mockResolvedValue([
        { id: 'link-1', patientId: 'patient-1', organizationId: 'org-1', status: 'ACTIVE' },
        { id: 'link-2', patientId: 'patient-2', organizationId: 'org-2', status: 'PENDING_CONSENT' },
      ]);
      patientLookup.findById.mockImplementation((patientId: string) =>
        Promise.resolve(
          patientId === 'patient-1'
            ? { id: 'patient-1', name: 'Maria Silva', cpf: '12345678901', phone: '11999998888', birthDate: new Date('1990-01-01'), organizationName: 'Clínica A' }
            : null,
        ),
      );

      const result = await service.getFicha('acc-1', 'patient-1');

      expect(result).toEqual({
        name: 'Maria Silva',
        cpfMasked: '123.***.***-01',
        phone: '11999998888',
        birthDate: new Date('1990-01-01'),
        clinics: [{ organizationId: 'org-1', organizationName: 'Clínica A' }],
      });
    });
  });

  describe('getAppointments', () => {
    it('delega para o AppointmentLookupService', async () => {
      appointmentLookup.findUpcomingByPatientId.mockResolvedValue([{ id: 'appt-1' }]);

      const result = await service.getAppointments('org-1', 'patient-1');

      expect(result).toEqual([{ id: 'appt-1' }]);
      expect(appointmentLookup.findUpcomingByPatientId).toHaveBeenCalledWith('org-1', 'patient-1');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/patient-portal/patient-me.service.spec.ts`
Expected: FAIL — cannot find module `./patient-me.service`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/patient-portal/patient-me.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentLookupService, AppointmentLookupResult } from '../appointment/appointment-lookup.service';
import { PatientLookupService } from '../patient/patient-lookup.service';
import { PatientAccountLinkService } from './patient-account-link.service';

export interface PatientClinicSummary {
  organizationId: string;
  organizationName: string;
}

export interface PatientFicha {
  name: string;
  cpfMasked: string;
  phone: string | null;
  birthDate: Date | null;
  clinics: PatientClinicSummary[];
}

@Injectable()
export class PatientMeService {
  constructor(
    private readonly links: PatientAccountLinkService,
    private readonly patientLookup: PatientLookupService,
    private readonly appointmentLookup: AppointmentLookupService,
  ) {}

  async getFicha(patientAccountId: string, patientId: string): Promise<PatientFicha> {
    const activeLinks = (await this.links.findAllByAccountId(patientAccountId)).filter(
      (link) => link.status === 'ACTIVE',
    );
    const patients = await Promise.all(activeLinks.map((link) => this.patientLookup.findById(link.patientId)));
    const current = patients.find((patient) => patient?.id === patientId);

    if (!current) {
      throw new NotFoundException('Paciente não encontrada');
    }

    return {
      name: current.name,
      cpfMasked: maskCpf(current.cpf ?? ''),
      phone: current.phone,
      birthDate: current.birthDate,
      clinics: activeLinks.map((link, index) => ({
        organizationId: link.organizationId,
        organizationName: patients[index]?.organizationName ?? '',
      })),
    };
  }

  async getAppointments(organizationId: string, patientId: string): Promise<AppointmentLookupResult[]> {
    return this.appointmentLookup.findUpcomingByPatientId(organizationId, patientId);
  }
}

function maskCpf(cpf: string): string {
  if (cpf.length !== 11) return cpf;
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}`;
}
```

- [ ] **Step 4: Write the controller**

```typescript
// src/patient-portal/patient-me.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentPatient } from './decorators/current-patient.decorator';
import { RequireFullPatientSession } from './decorators/require-full-patient-session.decorator';
import { PatientJwtAuthGuard } from './guards/patient-jwt-auth.guard';
import { PatientScopeGuard } from './guards/patient-scope.guard';
import { PatientMeService } from './patient-me.service';
import { PatientJwtPayload } from './strategies/patient-jwt.strategy';

@ApiBearerAuth()
@ApiTags('Patient Portal - Minha conta')
@Public()
@UseGuards(PatientJwtAuthGuard, PatientScopeGuard)
@RequireFullPatientSession()
@Controller('patient-portal/me')
export class PatientMeController {
  constructor(private readonly meService: PatientMeService) {}

  @Get('ficha')
  @ApiOperation({ summary: 'Dados pessoais básicos da paciente logada' })
  async ficha(@CurrentPatient() patient: PatientJwtPayload) {
    return this.meService.getFicha(patient.sub, patient.patientId as string);
  }

  @Get('appointments')
  @ApiOperation({ summary: 'Consultas da paciente logada, na clínica ativa da sessão' })
  async appointments(@CurrentPatient() patient: PatientJwtPayload) {
    return this.meService.getAppointments(
      patient.organizationId as string,
      patient.patientId as string,
    );
  }
}
```

- [ ] **Step 5: Final module wiring — assemble every piece from Tasks 5–15**

```typescript
// src/patient-portal/patient-portal.module.ts — final shape
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppointmentModule } from '../appointment/appointment.module';
import { EmailModule } from '../email/email.module';
import { PatientModule } from '../patient/patient.module';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';
import { PatientInviteService } from './patient-invite.service';
import { PatientInviteController } from './patient-invite.controller';
import { PatientActivationService } from './patient-activation.service';
import { PatientAuthService } from './patient-auth.service';
import { PatientAuthController } from './patient-auth.controller';
import { PatientConsentService } from './patient-consent.service';
import { PatientConsentController } from './patient-consent.controller';
import { PatientTreatmentPlanService } from './patient-treatment-plan.service';
import { PatientTreatmentPlanController } from './patient-treatment-plan.controller';
import { PatientMeService } from './patient-me.service';
import { PatientMeController } from './patient-me.controller';
import { PatientJwtStrategy } from './strategies/patient-jwt.strategy';
import { PatientJwtRefreshStrategy } from './strategies/patient-jwt-refresh.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_SECRET') }),
    }),
    PatientModule,
    AppointmentModule,
    EmailModule,
  ],
  controllers: [
    PatientInviteController,
    PatientAuthController,
    PatientConsentController,
    PatientTreatmentPlanController,
    PatientMeController,
  ],
  providers: [
    PatientAccountService,
    PatientAccountLinkService,
    PatientConsentAuditService,
    PatientJwtStrategy,
    PatientJwtRefreshStrategy,
    PatientInviteService,
    PatientActivationService,
    PatientAuthService,
    PatientConsentService,
    PatientTreatmentPlanService,
    PatientMeService,
  ],
})
export class PatientPortalModule {}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/patient-portal/patient-me.service.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Run the full backend test suite**

Run: `npm test -- --forceExit`
Expected: every suite passes, including the pre-existing ones (`auth`, `patient`, `appointment`, etc.) untouched by this plan.

- [ ] **Step 8: Commit**

```bash
git add src/patient-portal/patient-me.service.ts src/patient-portal/patient-me.service.spec.ts \
  src/patient-portal/patient-me.controller.ts src/patient-portal/patient-portal.module.ts
git commit -m "feat(patient-portal): add ficha/appointments endpoints and finish module wiring"
```

---

## Self-Review Notes

- **Spec coverage:** login (Task 11), select-link/multi-clinic (Task 11), refresh/logout (Task 12), first-invite email + activation (Tasks 4, 9, 10), multi-clinic consent + audit + resend (Tasks 7, 9, 13), treatment plan flags (Task 14), mobile-facing ficha/appointments (Task 15), module isolation via `*LookupService` (Tasks 2, 3), soft references (Task 1 — no `@relation` on any patient-portal model), mutual token exclusion (Task 8). The web page (`/paciente/ativar-conta`) and the "Portal da paciente" UI are out of scope for this plan — they belong to the Web plan, which calls the endpoints built here.
- **Placeholder scan:** no TBD/TODO; every step has runnable code.
- **Type consistency:** `PatientJwtPayload`, `PatientAccountLinkSummary`, `PatientAccountSummary`, `PatientTreatmentPlanFeatures`, `PatientLookupResult` and `AppointmentLookupResult` are defined once (Tasks 2, 3, 5, 6, 8, 14) and reused with the same field names in every later task.
