# Evolução — Data Ajustável Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let professionals pick/edit the clinical date of an evolution record instead of always using the record's creation timestamp.

**Architecture:** Add a new `evolutionDate` column to the `evolutions` table (separate from the audit `createdAt`). Backend gains an optional field on create and a new `PATCH /api/v1/evolutions/:id` endpoint. Frontend `EvolutionFormDialog` becomes dual-mode (create/edit) with a date input; both timeline views (`Evolutions.tsx`, `PatientProfile.tsx`) display and sort by `evolutionDate`.

**Tech Stack:** NestJS + Prisma + PostgreSQL (backend), React + react-hook-form + zod + TanStack Query (frontend), Jest (backend tests), Vitest + Testing Library (frontend tests).

## Global Constraints

- `evolutionDate` cannot be a future date — enforced on both `create` and `update`.
- `createdAt` is never modified by this feature — it stays the audit "record inserted" timestamp.
- Any professional active in the organization can edit any evolution of that organization (same access model as the rest of the module — no author-only restriction).
- All queries stay scoped by `organizationId` from the JWT — never trust client-sent IDs.
- Spec: `docs/superpowers/specs/2026-07-26-evolution-date-design.md`

---

### Task 1: Prisma schema — add `evolutionDate` column

**Files:**
- Modify: `backend/prisma/schema.prisma` (Evolution model, ~line 323)
- Create: `backend/prisma/migrations/20260726000000_add_evolution_date/migration.sql`

**Interfaces:**
- Produces: `Evolution.evolutionDate: DateTime` (Prisma Client field), used by Task 3 (service) onward.

- [ ] **Step 1: Edit the Evolution model**

In `backend/prisma/schema.prisma`, find the `Evolution` model and change it to:

```prisma
model Evolution {
  id             String              @id @default(uuid())
  organizationId String              @map("organization_id")
  patientId      String              @map("patient_id")
  professionalId String              @map("professional_id")
  appointmentId  String?             @map("appointment_id")
  description    String
  evolutionDate  DateTime            @default(now()) @map("evolution_date")
  legalBasis     SensitiveLegalBasis @default(HEALTH_PROTECTION) @map("legal_basis")
  consentId      String?             @map("consent_id")
  createdAt      DateTime            @default(now()) @map("created_at")
  updatedAt      DateTime            @updatedAt @map("updated_at")

  organization Organization     @relation(fields: [organizationId], references: [id])
  patient      Patient          @relation(fields: [patientId], references: [id])
  professional OrganizationUser @relation(fields: [professionalId], references: [id])
  appointment  Appointment?     @relation(fields: [appointmentId], references: [id])

  @@index([organizationId, patientId])
  @@index([organizationId, evolutionDate])
  @@map("evolutions")
}
```

(Only two lines change from the current model: the new `evolutionDate` field, and the second `@@index` now points at `evolutionDate` instead of `createdAt`.)

- [ ] **Step 2: Validate the schema**

Run from `backend/`: `bunx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Generate the migration**

From `backend/`, run: `bunx prisma migrate dev --name add_evolution_date`

If `DATABASE_URL` is configured and reachable, Prisma generates the migration folder and applies it — skip to Step 5.

If there is no working `DATABASE_URL` (no `backend/.env.dev` in this checkout), create the migration manually instead:

Create `backend/prisma/migrations/20260726000000_add_evolution_date/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "evolutions" ADD COLUMN     "evolution_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: prior to this migration, created_at was the only date shown for
-- an evolution, so it's the best available value for pre-existing rows.
UPDATE "evolutions" SET "evolution_date" = "created_at";

-- DropIndex
DROP INDEX "evolutions_organization_id_created_at_idx";

-- CreateIndex
CREATE INDEX "evolutions_organization_id_evolution_date_idx" ON "evolutions"("organization_id", "evolution_date");
```

- [ ] **Step 4: Regenerate the Prisma Client**

From `backend/`, run: `bunx prisma generate`
Expected: `✔ Generated Prisma Client` with no errors. This step works without a DB connection and is required either way so `EvolutionService` (Task 3+) type-checks against the new `evolutionDate` field.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(evolution): add evolutionDate column"
```

---

### Task 2: Backend DTOs — `evolutionDate` on create + new update DTO

**Files:**
- Modify: `backend/src/evolution/dto/create-evolution.dto.ts`
- Create: `backend/src/evolution/dto/update-evolution.dto.ts`

**Interfaces:**
- Consumes: nothing beyond `class-validator`/`SensitiveLegalBasis` already used in the module.
- Produces: `CreateEvolutionDto.evolutionDate?: string`, `UpdateEvolutionDto { description?: string; evolutionDate?: string }` — consumed by Task 3/4 (service) and Task 5 (controller).

- [ ] **Step 1: Add `evolutionDate` to `CreateEvolutionDto`**

Edit `backend/src/evolution/dto/create-evolution.dto.ts`:

```ts
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { SensitiveLegalBasis } from '@prisma/client';

export class CreateEvolutionDto {
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId: string;

  @IsString({ message: 'Descrição é obrigatória' })
  @MinLength(1, { message: 'Descrição não pode ser vazia' })
  description: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data da evolução inválida' })
  evolutionDate?: string;

  @IsOptional()
  @IsUUID('4', { message: 'ID do agendamento inválido' })
  appointmentId?: string;

  @IsOptional()
  @IsEnum(SensitiveLegalBasis, { message: 'Base legal inválida' })
  legalBasis?: SensitiveLegalBasis;

  @IsOptional()
  @IsUUID('4', { message: 'ID do consentimento inválido' })
  consentId?: string;
}
```

- [ ] **Step 2: Create `UpdateEvolutionDto`**

Create `backend/src/evolution/dto/update-evolution.dto.ts`:

```ts
import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateEvolutionDto {
  @IsOptional()
  @IsString({ message: 'Descrição inválida' })
  @MinLength(1, { message: 'Descrição não pode ser vazia' })
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data da evolução inválida' })
  evolutionDate?: string;
}
```

- [ ] **Step 3: Compile check**

From `backend/`, run: `bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `create-evolution.dto.ts` or `update-evolution.dto.ts`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/evolution/dto/
git commit -m "feat(evolution): add evolutionDate DTO field and UpdateEvolutionDto"
```

---

### Task 3: `EvolutionService.create` — use `evolutionDate`, reject future dates

**Files:**
- Modify: `backend/src/evolution/evolution.service.ts`
- Test: `backend/src/evolution/evolution.service.spec.ts`

**Interfaces:**
- Consumes: `CreateEvolutionDto.evolutionDate?: string` (Task 2).
- Produces: `EvolutionService.assertNotFutureDate(date: string): void` (private helper) — reused by Task 4's `update()`.

- [ ] **Step 1: Write the failing tests**

Add to `backend/src/evolution/evolution.service.spec.ts`, inside `describe('create', ...)`:

```ts
    it('deve usar evolutionDate informado ao invés da data atual', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
      prisma.evolution.create.mockResolvedValue({ id: 'evo-1' });

      await service.create(orgId, personId, {
        patientId: 'patient-1',
        description: 'Texto',
        evolutionDate: '2026-01-10T00:00:00.000Z',
      });

      expect(prisma.evolution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            evolutionDate: new Date('2026-01-10T00:00:00.000Z'),
          }),
        }),
      );
    });

    it('deve usar a data atual quando evolutionDate não é informado', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
      prisma.evolution.create.mockResolvedValue({ id: 'evo-1' });

      const before = Date.now();
      await service.create(orgId, personId, {
        patientId: 'patient-1',
        description: 'Texto',
      });
      const after = Date.now();

      const callData = prisma.evolution.create.mock.calls[0][0].data;
      expect(callData.evolutionDate).toBeInstanceOf(Date);
      expect(callData.evolutionDate.getTime()).toBeGreaterThanOrEqual(before);
      expect(callData.evolutionDate.getTime()).toBeLessThanOrEqual(after);
    });

    it('deve lançar BadRequestException quando evolutionDate é no futuro', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await expect(
        service.create(orgId, personId, {
          patientId: 'patient-1',
          description: 'Texto',
          evolutionDate: futureDate,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.evolution.create).not.toHaveBeenCalled();
    });
```

Add `BadRequestException` to the existing import at the top of the file:

```ts
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
```

- [ ] **Step 2: Run tests to verify they fail**

From `backend/`, run: `bun run test -- evolution.service.spec.ts`
Expected: the 3 new tests FAIL (`evolutionDate` not handled yet / `BadRequestException` not thrown).

- [ ] **Step 3: Implement `assertNotFutureDate` and use it in `create`**

Edit `backend/src/evolution/evolution.service.ts`:

```ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEvolutionDto } from './dto/create-evolution.dto';

@Injectable()
export class EvolutionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    personId: string,
    dto: CreateEvolutionDto,
  ) {
    const orgUser = await this.resolveOrgUser(organizationId, personId);

    if (dto.evolutionDate) {
      this.assertNotFutureDate(dto.evolutionDate);
    }

    return this.prisma.evolution.create({
      data: {
        organizationId,
        patientId: dto.patientId,
        professionalId: orgUser.id,
        appointmentId: dto.appointmentId,
        description: dto.description,
        evolutionDate: dto.evolutionDate ? new Date(dto.evolutionDate) : new Date(),
        ...(dto.legalBasis && { legalBasis: dto.legalBasis }),
        ...(dto.consentId && { consentId: dto.consentId }),
      },
      include: {
        professional: {
          include: { person: { select: { id: true, name: true } } },
        },
        appointment: {
          select: { id: true, startAt: true, status: true },
        },
      },
    });
  }

  async findByPatient(organizationId: string, patientId: string) {
    return this.prisma.evolution.findMany({
      where: { organizationId, patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        professional: {
          include: { person: { select: { id: true, name: true } } },
        },
        appointment: {
          select: { id: true, startAt: true, status: true },
        },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    const evolution = await this.prisma.evolution.findFirst({
      where: { id, organizationId },
      include: {
        patient: { select: { id: true, name: true } },
        professional: {
          include: { person: { select: { id: true, name: true } } },
        },
        appointment: {
          select: { id: true, startAt: true, status: true },
        },
      },
    });

    if (!evolution) {
      throw new NotFoundException('Evolução não encontrada');
    }

    return evolution;
  }

  private assertNotFutureDate(date: string) {
    if (new Date(date).getTime() > Date.now()) {
      throw new BadRequestException(
        'Data da evolução não pode ser no futuro',
      );
    }
  }

  private async resolveOrgUser(organizationId: string, personId: string) {
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_personId: { organizationId, personId },
      },
    });

    if (!orgUser || !orgUser.active) {
      throw new ForbiddenException('Vínculo com a clínica não encontrado');
    }

    return orgUser;
  }
}
```

(`findByPatient`'s `orderBy` and the new `update()` method are added in Task 4 — leave them as shown here for now, this task only touches `create` and the shared helper.)

- [ ] **Step 4: Run tests to verify they pass**

From `backend/`, run: `bun run test -- evolution.service.spec.ts`
Expected: all tests in the file PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/evolution/evolution.service.ts backend/src/evolution/evolution.service.spec.ts
git commit -m "feat(evolution): honor evolutionDate on create, reject future dates"
```

---

### Task 4: `EvolutionService` — sort by `evolutionDate`, add `update()`

**Files:**
- Modify: `backend/src/evolution/evolution.service.ts`
- Test: `backend/src/evolution/evolution.service.spec.ts`

**Interfaces:**
- Consumes: `UpdateEvolutionDto` (Task 2), `assertNotFutureDate` (Task 3).
- Produces: `EvolutionService.update(organizationId: string, id: string, dto: UpdateEvolutionDto): Promise<Evolution>` — consumed by Task 5 (controller).

- [ ] **Step 1: Write the failing tests**

In `backend/src/evolution/evolution.service.spec.ts`, replace the existing `findByPatient` test's `orderBy` expectation and add an `update` suite:

```ts
  describe('findByPatient', () => {
    it('deve filtrar por organizationId e patientId, ordenado por evolutionDate decrescente', async () => {
      prisma.evolution.findMany.mockResolvedValue([]);

      await service.findByPatient(orgId, 'patient-1');

      expect(prisma.evolution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId, patientId: 'patient-1' },
          orderBy: { evolutionDate: 'desc' },
        }),
      );
    });
  });
```

(This replaces the old `orderBy: { createdAt: 'desc' }` expectation — delete the old assertion, don't duplicate the `describe` block.)

Add a new `describe('update', ...)` block after `describe('findById', ...)`:

```ts
  describe('update', () => {
    it('deve atualizar apenas os campos informados', async () => {
      const existing = { id: 'evo-1', organizationId: orgId };
      prisma.evolution.findFirst.mockResolvedValue(existing);
      prisma.evolution.update.mockResolvedValue({ ...existing, description: 'Novo texto' });

      await service.update(orgId, 'evo-1', { description: 'Novo texto' });

      expect(prisma.evolution.findFirst).toHaveBeenCalledWith({
        where: { id: 'evo-1', organizationId: orgId },
      });
      expect(prisma.evolution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evo-1' },
          data: { description: 'Novo texto' },
        }),
      );
    });

    it('deve atualizar evolutionDate quando informado', async () => {
      prisma.evolution.findFirst.mockResolvedValue({ id: 'evo-1', organizationId: orgId });
      prisma.evolution.update.mockResolvedValue({ id: 'evo-1' });

      await service.update(orgId, 'evo-1', { evolutionDate: '2026-02-01T00:00:00.000Z' });

      expect(prisma.evolution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { evolutionDate: new Date('2026-02-01T00:00:00.000Z') },
        }),
      );
    });

    it('deve lançar NotFoundException quando a evolução não existe na organização', async () => {
      prisma.evolution.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, 'evo-outra', { description: 'x' }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.evolution.update).not.toHaveBeenCalled();
    });

    it('deve lançar BadRequestException quando evolutionDate é no futuro', async () => {
      prisma.evolution.findFirst.mockResolvedValue({ id: 'evo-1', organizationId: orgId });

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await expect(
        service.update(orgId, 'evo-1', { evolutionDate: futureDate }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.evolution.update).not.toHaveBeenCalled();
    });
  });
```

Add `update: jest.fn()` to the `prisma.evolution` mock object in `beforeEach`:

```ts
    prisma = {
      evolution: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      organizationUser: {
        findUnique: jest.fn(),
      },
    };
```

- [ ] **Step 2: Run tests to verify they fail**

From `backend/`, run: `bun run test -- evolution.service.spec.ts`
Expected: `findByPatient` test fails (still ordering by `createdAt`), all `update` tests fail (`service.update` does not exist).

- [ ] **Step 3: Implement `findByPatient` ordering and `update()`**

In `backend/src/evolution/evolution.service.ts`, add the `UpdateEvolutionDto` import alongside the existing `CreateEvolutionDto` one:

```ts
import { CreateEvolutionDto } from './dto/create-evolution.dto';
import { UpdateEvolutionDto } from './dto/update-evolution.dto';
```

Then change `findByPatient`'s `orderBy` and add `update`:

```ts
  async findByPatient(organizationId: string, patientId: string) {
    return this.prisma.evolution.findMany({
      where: { organizationId, patientId },
      orderBy: { evolutionDate: 'desc' },
      include: {
        professional: {
          include: { person: { select: { id: true, name: true } } },
        },
        appointment: {
          select: { id: true, startAt: true, status: true },
        },
      },
    });
  }
```

Add `update` right after `findById`:

```ts
  async update(organizationId: string, id: string, dto: UpdateEvolutionDto) {
    const existing = await this.prisma.evolution.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException('Evolução não encontrada');
    }

    if (dto.evolutionDate) {
      this.assertNotFutureDate(dto.evolutionDate);
    }

    return this.prisma.evolution.update({
      where: { id },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.evolutionDate && { evolutionDate: new Date(dto.evolutionDate) }),
      },
      include: {
        professional: {
          include: { person: { select: { id: true, name: true } } },
        },
        appointment: {
          select: { id: true, startAt: true, status: true },
        },
      },
    });
  }
```

- [ ] **Step 4: Run tests to verify they pass**

From `backend/`, run: `bun run test -- evolution.service.spec.ts`
Expected: all tests PASS.

- [ ] **Step 5: Run full backend test suite + coverage**

From `backend/`, run: `bun run test:cov`
Expected: PASS, coverage thresholds (80% statements/functions/lines, 75% branches) still met for `evolution.service.ts`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/evolution/evolution.service.ts backend/src/evolution/evolution.service.spec.ts
git commit -m "feat(evolution): sort timeline by evolutionDate, add update()"
```

---

### Task 5: `EvolutionController` — `PATCH /api/v1/evolutions/:id`

**Files:**
- Modify: `backend/src/evolution/evolution.controller.ts`

**Interfaces:**
- Consumes: `EvolutionService.update` (Task 4), `UpdateEvolutionDto` (Task 2).
- Produces: `PATCH /api/v1/evolutions/:id` route — consumed by Task 7 (frontend `evolutionsApi.update`).

- [ ] **Step 1: Add the `Patch` import and endpoint**

Edit `backend/src/evolution/evolution.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EvolutionService } from './evolution.service';
import { CreateEvolutionDto } from './dto/create-evolution.dto';
import { UpdateEvolutionDto } from './dto/update-evolution.dto';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequireFeature } from '../subscription/decorators/require-feature.decorator';

@RequireFeature('EVOLUTIONS')
@ApiBearerAuth()
@ApiTags('Evolutions')
@Throttle({ default: { ttl: 60000, limit: 30 } })
@Controller('evolutions')
export class EvolutionController {
  constructor(private readonly evolutionService: EvolutionService) {}

  @Post()
  create(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateEvolutionDto,
  ) {
    return this.evolutionService.create(orgId, user.sub, dto);
  }

  @Get()
  findByPatient(
    @OrgId() orgId: string,
    @Query('patientId') patientId: string,
  ) {
    return this.evolutionService.findByPatient(orgId, patientId);
  }

  @Get(':id')
  findById(@OrgId() orgId: string, @Param('id') id: string) {
    return this.evolutionService.findById(orgId, id);
  }

  @Patch(':id')
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEvolutionDto,
  ) {
    return this.evolutionService.update(orgId, id, dto);
  }
}
```

- [ ] **Step 2: Compile + run backend test suite**

From `backend/`, run: `bun run test`
Expected: all suites PASS (no controller unit test file exists for this module — this is a compile/wiring check, covered functionally by `evolution.service.spec.ts`).

- [ ] **Step 3: Commit**

```bash
git add backend/src/evolution/evolution.controller.ts
git commit -m "feat(evolution): add PATCH /evolutions/:id endpoint"
```

---

### Task 6: Frontend — `Evolution` type + `evolutionsApi.update`

**Files:**
- Modify: `frontend/src/types/clinic.ts` (Evolution interface, ~line 171)
- Modify: `frontend/src/lib/api.ts` (evolutionsApi block, ~line 258)

**Interfaces:**
- Produces: `Evolution.evolutionDate: string`, `evolutionsApi.update(id: string, data: { description?: string; evolutionDate?: string }): Promise<Evolution>` — consumed by Task 7 (`EvolutionFormDialog`).

- [ ] **Step 1: Add `evolutionDate` to the `Evolution` type**

In `frontend/src/types/clinic.ts`, change:

```ts
export interface Evolution {
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  appointmentId?: string;
  description: string;
  evolutionDate: string;
  createdAt: string;
  updatedAt: string;
  patient?: { id: string; name: string };
  professional?: { id: string; person: { name: string } };
}
```

- [ ] **Step 2: Add `evolutionDate` to create + add `update` to `evolutionsApi`**

In `frontend/src/lib/api.ts`, change the `evolutionsApi` block to:

```ts
export const evolutionsApi = {
  list: (patientId: string) => api.get<Evolution[]>(`/evolutions?patientId=${patientId}`),
  getById: (id: string) => api.get<Evolution>(`/evolutions/${id}`),
  create: (data: { patientId: string; description: string; evolutionDate?: string; appointmentId?: string }) =>
    api.post<Evolution>('/evolutions', data),
  update: (id: string, data: { description?: string; evolutionDate?: string }) =>
    api.patch<Evolution>(`/evolutions/${id}`, data),
};
```

- [ ] **Step 3: Type-check the frontend**

From `frontend/`, run: `bunx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/clinic.ts frontend/src/lib/api.ts
git commit -m "feat(evolution): add evolutionDate to type and API client"
```

---

### Task 7: `EvolutionFormDialog` — dual-mode (create/edit) with date field

**Files:**
- Modify: `frontend/src/components/evolutions/EvolutionFormDialog.tsx`
- Create: `frontend/src/components/evolutions/EvolutionFormDialog.test.tsx`

**Interfaces:**
- Consumes: `evolutionsApi.create` / `evolutionsApi.update` (Task 6), `Evolution` type (Task 6).
- Produces: `EvolutionFormDialogProps.evolution?: Evolution` — consumed by Task 8 (`Evolutions.tsx`).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/evolutions/EvolutionFormDialog.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    evolutionsApi: { create: vi.fn(), update: vi.fn() },
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  AnalyticsEvent: { EvolutionCreated: 'evolution_created' },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string; size?: string }>(
    ({ children, loading: _l, variant: _v, size: _s, ...props }, ref) => (
      <button ref={ref} {...props}>{children}</button>
    ),
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }>(
    ({ error: _e, ...props }, ref) => <input ref={ref} {...props} />,
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }>(
    ({ error: _e, ...props }, ref) => <textarea ref={ref} {...props} />,
  ),
}));

import { evolutionsApi } from '@/lib/api';
import { EvolutionFormDialog } from './EvolutionFormDialog';
import type { Evolution } from '@/types/clinic';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const existingEvolution: Evolution = {
  id: 'evo-1',
  organizationId: 'org-1',
  patientId: 'patient-1',
  professionalId: 'prof-1',
  description: 'Texto original',
  evolutionDate: '2026-01-10T00:00:00.000Z',
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
};

describe('EvolutionFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza título "Nova Evolução" e data de hoje por padrão em modo criação', () => {
    render(
      <EvolutionFormDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} patientId="patient-1" />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByRole('heading', { name: 'Nova Evolução' })).toBeInTheDocument();
    const today = new Date().toISOString().slice(0, 10);
    expect(screen.getByLabelText(/data da evolução/i)).toHaveValue(today);
  });

  it('chama evolutionsApi.create com description e evolutionDate ao submeter em modo criação', async () => {
    vi.mocked(evolutionsApi.create).mockResolvedValue({} as Evolution);
    render(
      <EvolutionFormDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} patientId="patient-1" />,
      { wrapper: makeWrapper() },
    );

    fireEvent.change(screen.getByLabelText(/data da evolução/i), { target: { value: '2026-02-05' } });
    fireEvent.change(screen.getByLabelText(/descrição/i), {
      target: { value: 'Paciente evoluiu bem durante a sessão de hoje.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }));

    await waitFor(() => {
      expect(evolutionsApi.create).toHaveBeenCalledWith({
        patientId: 'patient-1',
        description: 'Paciente evoluiu bem durante a sessão de hoje.',
        evolutionDate: '2026-02-05',
      });
    });
  });

  it('renderiza título "Editar Evolução" e pré-popula campos em modo edição', () => {
    render(
      <EvolutionFormDialog
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        patientId="patient-1"
        evolution={existingEvolution}
      />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByRole('heading', { name: 'Editar Evolução' })).toBeInTheDocument();
    expect(screen.getByLabelText(/data da evolução/i)).toHaveValue('2026-01-10');
    expect(screen.getByLabelText(/descrição/i)).toHaveValue('Texto original');
  });

  it('chama evolutionsApi.update ao submeter em modo edição', async () => {
    vi.mocked(evolutionsApi.update).mockResolvedValue({} as Evolution);
    render(
      <EvolutionFormDialog
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        patientId="patient-1"
        evolution={existingEvolution}
      />,
      { wrapper: makeWrapper() },
    );

    fireEvent.change(screen.getByLabelText(/data da evolução/i), { target: { value: '2026-01-12' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(evolutionsApi.update).toHaveBeenCalledWith('evo-1', {
        description: 'Texto original',
        evolutionDate: '2026-01-12',
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

From `frontend/`, run: `bunx vitest run src/components/evolutions/EvolutionFormDialog.test.tsx`
Expected: FAIL — no `evolutionDate` field/label exists yet, `evolution` prop unused, `evolutionsApi.update` not called anywhere.

- [ ] **Step 3: Implement dual-mode dialog with date field**

Replace `frontend/src/components/evolutions/EvolutionFormDialog.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { track, AnalyticsEvent } from '@/lib/analytics';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { evolutionsApi } from '@/lib/api';
import type { Evolution } from '@/types/clinic';

const evolutionSchema = z.object({
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  evolutionDate: z.string().min(1, 'Data é obrigatória'),
});

type EvolutionFormData = z.infer<typeof evolutionSchema>;

interface EvolutionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  patientId: string;
  evolution?: Evolution;
}

export function EvolutionFormDialog({ open, onOpenChange, onSuccess, patientId, evolution }: EvolutionFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditMode = !!evolution;

  const form = useForm<EvolutionFormData>({
    resolver: zodResolver(evolutionSchema),
    defaultValues: {
      description: '',
      evolutionDate: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  useEffect(() => {
    if (open) {
      if (isEditMode && evolution) {
        form.reset({
          description: evolution.description,
          evolutionDate: evolution.evolutionDate.slice(0, 10),
        });
      } else {
        form.reset({
          description: '',
          evolutionDate: format(new Date(), 'yyyy-MM-dd'),
        });
      }
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = async (data: EvolutionFormData) => {
    setLoading(true);
    setError('');

    try {
      if (isEditMode && evolution) {
        await evolutionsApi.update(evolution.id, {
          description: data.description,
          evolutionDate: data.evolutionDate,
        });
        toast.success('Evolução atualizada com sucesso');
      } else {
        await evolutionsApi.create({
          patientId,
          description: data.description,
          evolutionDate: data.evolutionDate,
        });
        toast.success('Evolução registrada com sucesso');
        track(AnalyticsEvent.EvolutionCreated);
      }
      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error(isEditMode ? 'Erro ao atualizar evolução' : 'Erro ao salvar evolução');
      setError(isEditMode ? 'Erro ao atualizar evolução. Tente novamente.' : 'Erro ao salvar evolução. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Editar Evolução' : 'Nova Evolução'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Altere a data ou o texto da evolução clínica.' : 'Registre a evolução clínica do paciente.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="evolutionDate">Data da evolução *</Label>
            <Input
              id="evolutionDate"
              type="date"
              max={format(new Date(), 'yyyy-MM-dd')}
              error={!!form.formState.errors.evolutionDate}
              {...form.register('evolutionDate')}
            />
            {form.formState.errors.evolutionDate && (
              <p className="text-sm text-destructive">{form.formState.errors.evolutionDate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea
              id="description"
              rows={8}
              placeholder="Descreva a evolução clínica do paciente..."
              error={!!form.formState.errors.description}
              aria-describedby={form.formState.errors.description ? 'evo-desc-error' : undefined}
              {...form.register('description')}
            />
            {form.formState.errors.description && (
              <p id="evo-desc-error" className="text-sm text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          {error && <p role="alert" className="text-sm text-destructive text-center">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              {isEditMode ? 'Salvar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

From `frontend/`, run: `bunx vitest run src/components/evolutions/EvolutionFormDialog.test.tsx`
Expected: all tests PASS.

- [ ] **Step 5: Run full frontend test suite**

From `frontend/`, run: `bun run test`
Expected: all suites PASS (check that `PatientProfile.tsx`'s usage of `<EvolutionFormDialog>` still compiles — it doesn't pass `evolution`, which is fine since the prop is optional).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/evolutions/EvolutionFormDialog.tsx frontend/src/components/evolutions/EvolutionFormDialog.test.tsx
git commit -m "feat(evolution): dual-mode form dialog with editable evolution date"
```

---

### Task 8: `Evolutions.tsx` — timeline uses `evolutionDate`, adds edit action

**Files:**
- Modify: `frontend/src/pages/Evolutions.tsx`

**Interfaces:**
- Consumes: `EvolutionFormDialog` with `evolution?` prop (Task 7).

- [ ] **Step 1: Add edit state and wire the dialog for both create and edit**

In `frontend/src/pages/Evolutions.tsx`, add `Pencil` to the lucide-react import:

```tsx
import {
  Search,
  Users,
  Plus,
  Pencil,
  TrendingUp,
  Loader2,
} from 'lucide-react';
```

Add state below `dialogOpen`:

```tsx
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvolution, setEditingEvolution] = useState<Evolution | null>(null);
```

Import the `Evolution` type at the top:

```tsx
import type { Evolution } from '@/types/clinic';
```

Add a handler near `getInitials`:

```tsx
  const openCreateDialog = () => {
    setEditingEvolution(null);
    setDialogOpen(true);
  };

  const openEditDialog = (evolution: Evolution) => {
    setEditingEvolution(evolution);
    setDialogOpen(true);
  };
```

Replace both `onClick={() => setDialogOpen(true)}` call sites with `onClick={openCreateDialog}`:

```tsx
            {patient && (
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Evolução
              </Button>
            )}
```

and:

```tsx
              <EmptyState
                icon={TrendingUp}
                title="Nenhuma evolução registrada"
                description="Adicione a primeira evolução clínica deste paciente"
                action={{
                  label: 'Nova Evolução',
                  onClick: openCreateDialog,
                }}
              />
```

- [ ] **Step 2: Display `evolutionDate` and add the edit button in the timeline**

Replace the timeline item block:

```tsx
                  {evolutions.map((evolution) => (
                    <div key={evolution.id} className="relative pl-10">
                      <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                      <div className="p-4 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {format(new Date(evolution.evolutionDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {evolution.professional?.person?.name ?? ''}
                            </span>
                            <button
                              type="button"
                              aria-label="Editar evolução"
                              onClick={() => openEditDialog(evolution)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {evolution.description}
                        </p>
                      </div>
                    </div>
                  ))}
```

- [ ] **Step 3: Pass `evolution` to the dialog and reset on close**

Replace the `EvolutionFormDialog` usage at the bottom of the component:

```tsx
      {selectedPatient && (
        <EvolutionFormDialog
          open={dialogOpen}
          onOpenChange={(next) => {
            setDialogOpen(next);
            if (!next) setEditingEvolution(null);
          }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['evolutions', selectedPatient] })}
          patientId={selectedPatient}
          evolution={editingEvolution ?? undefined}
        />
      )}
```

- [ ] **Step 4: Manual check**

From repo root, run: `bun run frontend:dev`, log in (see seed credentials in `CLAUDE.md`), open "Evoluções", select a patient with existing evolutions, click the pencil icon on an entry, confirm the dialog opens in edit mode pre-filled, change the date, save, and confirm the timeline re-sorts/updates. Then create a new evolution with a past date and confirm it appears correctly ordered.

- [ ] **Step 5: Run frontend test suite**

From `frontend/`, run: `bun run test`
Expected: all suites PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Evolutions.tsx
git commit -m "feat(evolution): show evolutionDate and allow editing from timeline"
```

---

### Task 9: `PatientProfile.tsx` — timeline uses `evolutionDate`

**Files:**
- Modify: `frontend/src/pages/PatientProfile.tsx`

**Interfaces:**
- None new — pure display fix so this timeline matches the data model change from Task 1.

- [ ] **Step 1: Switch the timeline date source**

In `frontend/src/pages/PatientProfile.tsx`, inside the evolutions tab's timeline `map`, change:

```tsx
                        {evolutions.map((evo, i) => {
                          const d = new Date(evo.createdAt);
```

to:

```tsx
                        {evolutions.map((evo, i) => {
                          const d = new Date(evo.evolutionDate);
```

(No other change needed — this timeline is read-only here; full edit happens via the Evoluções page from Task 8.)

- [ ] **Step 2: Manual check**

With the dev server running, open a patient profile, go to the "Consultas"/timeline area showing evolutions, and confirm the displayed date matches what was set via the Evoluções page edit dialog (Task 8) rather than the original creation date.

- [ ] **Step 3: Run frontend test suite**

From `frontend/`, run: `bun run test`
Expected: all suites PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PatientProfile.tsx
git commit -m "fix(evolution): show evolutionDate in patient profile timeline"
```
