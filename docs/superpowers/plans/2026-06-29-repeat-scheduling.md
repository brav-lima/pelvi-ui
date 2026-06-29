# Repeat Scheduling + Package Deduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recurrent appointment creation (daily/weekly/monthly), edit-forward propagation, package session deduction on DONE/CANCELED status change, and fix the TreatmentPackageFormDialog silent save bug.

**Architecture:** Backend gets two new endpoints (`POST /appointments/bulk`, `PATCH /appointments/:id/recurrence-forward`) and an updated status endpoint accepting `deductFromPackage`; the Appointment DB model gains `recurrenceGroupId`/`recurrenceIndex`. Frontend adds repeat UI to `AppointmentFormDialog`, two new dialog components (`RecurrenceConflictDialog`, `RecurrenceScopeDialog`), and a cancellation deduction modal in `Agenda.tsx`. Business-hours conflict detection runs entirely on the frontend using the existing `isSlotBlocked()` utility.

**Tech Stack:** NestJS + Prisma 7 + PostgreSQL (backend), React 18 + react-hook-form + zod + date-fns + shadcn/ui (frontend), Jest/ts-jest (backend tests), Vitest + @testing-library/react (frontend tests), Bun package manager.

## Global Constraints

- All IDs are UUID v4 — use `@IsUUID('4')` on backend DTOs
- Multi-tenant: always scope by `organizationId` from `@OrgId()` decorator, never from client body
- Business-hours conflict check runs on **frontend** using `isSlotBlocked()` from `frontend/src/lib/business-hours.ts`
- All new backend DB writes use `Serializable` transaction isolation (matches existing pattern)
- No package session decrement on appointment **creation** — only on status change to `DONE`
- UI text in Brazilian Portuguese
- Tests live next to the code they test: `*.spec.ts` for backend, `*.test.tsx` for frontend

---

## File Map

| Action | File |
|---|---|
| Modify | `backend/prisma/schema.prisma` |
| Create | `backend/prisma/migrations/<ts>_add_recurrence_to_appointment/` (auto) |
| Create | `backend/src/appointment/dto/create-bulk-appointment.dto.ts` |
| Modify | `backend/src/appointment/dto/update-status.dto.ts` |
| Modify | `backend/src/appointment/appointment.service.ts` |
| Modify | `backend/src/appointment/appointment.controller.ts` |
| Modify | `backend/src/appointment/appointment.service.spec.ts` |
| Modify | `frontend/src/types/clinic.ts` |
| Modify | `frontend/src/lib/api.ts` |
| Create | `frontend/src/components/appointments/RecurrenceConflictDialog.tsx` |
| Create | `frontend/src/components/appointments/RecurrenceConflictDialog.test.tsx` |
| Create | `frontend/src/components/appointments/RecurrenceScopeDialog.tsx` |
| Modify | `frontend/src/components/appointments/AppointmentFormDialog.tsx` |
| Modify | `frontend/src/pages/Agenda.tsx` |
| Modify | `frontend/src/components/treatment-packages/TreatmentPackageFormDialog.tsx` |

---

### Task 1: DB Migration — add recurrenceGroupId + recurrenceIndex to Appointment

**Files:**
- Modify: `backend/prisma/schema.prisma` (Appointment model ~line 237)
- Auto-create: migration file via `bunx prisma migrate dev`

**Interfaces:**
- Produces: Prisma `Appointment` model includes `recurrenceGroupId: String?` and `recurrenceIndex: Int?` — all subsequent queries return these fields automatically

- [ ] **Step 1: Add fields to Appointment model in schema.prisma**

In `backend/prisma/schema.prisma`, inside `model Appointment { ... }`, add two lines after `notes String?`:

```prisma
recurrenceGroupId  String?  @db.Uuid @map("recurrence_group_id")
recurrenceIndex    Int?     @map("recurrence_index")
```

The complete model after edit (lines 237-264):
```prisma
model Appointment {
  id                 String            @id @default(uuid())
  organizationId     String            @map("organization_id")
  patientId          String            @map("patient_id")
  professionalId     String            @map("professional_id")
  procedureId        String            @map("procedure_id")
  treatmentPackageId String?           @map("treatment_package_id")
  startAt            DateTime          @map("start_at")
  endAt              DateTime          @map("end_at")
  status             AppointmentStatus @default(SCHEDULED)
  notes              String?
  recurrenceGroupId  String?           @db.Uuid @map("recurrence_group_id")
  recurrenceIndex    Int?              @map("recurrence_index")
  deletedAt          DateTime?         @map("deleted_at")
  createdAt          DateTime          @default(now()) @map("created_at")
  updatedAt          DateTime          @updatedAt @map("updated_at")

  organization     Organization       @relation(fields: [organizationId], references: [id])
  patient          Patient            @relation(fields: [patientId], references: [id])
  professional     OrganizationUser   @relation(fields: [professionalId], references: [id])
  procedure        Procedure          @relation(fields: [procedureId], references: [id])
  treatmentPackage TreatmentPackage?  @relation(fields: [treatmentPackageId], references: [id])
  evolutions       Evolution[]
  financialRecords FinancialRecord[]

  @@index([organizationId, startAt, endAt, deletedAt])
  @@index([organizationId, professionalId, startAt, deletedAt])
  @@index([organizationId, patientId, deletedAt])
  @@map("appointments")
}
```

- [ ] **Step 2: Validate schema**

From `backend/`:
```bash
bunx prisma validate
```
Expected: no output (success).

- [ ] **Step 3: Create and apply migration**

From `backend/`:
```bash
bunx prisma migrate dev --name add-recurrence-to-appointment
```
Expected: migration file created in `backend/prisma/migrations/`, Prisma Client regenerated.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(db): add recurrenceGroupId and recurrenceIndex to Appointment"
```

---

### Task 2: Backend — Bulk appointment creation endpoint

**Files:**
- Create: `backend/src/appointment/dto/create-bulk-appointment.dto.ts`
- Modify: `backend/src/appointment/appointment.service.ts` (add `createBulk` method + import)
- Modify: `backend/src/appointment/appointment.controller.ts` (add `POST /bulk` route + import)
- Modify: `backend/src/appointment/appointment.service.spec.ts` (add `createBulk` tests)

**Interfaces:**
- Produces: `AppointmentService.createBulk(orgId: string, dto: CreateBulkAppointmentDto): Promise<Appointment[]>`
- Produces: `POST /api/appointments/bulk` → 201 with `Appointment[]`

- [ ] **Step 1: Write failing tests**

Add to `backend/src/appointment/appointment.service.spec.ts` inside the existing `describe('AppointmentService')` block (after the last `describe` block):

```ts
describe('createBulk', () => {
  it('creates multiple appointments atomically', async () => {
    const procedure = { id: 'proc-1', durationMinutes: 30 };
    prisma.procedure.findMany = jest.fn().mockResolvedValue([procedure]);
    prisma.treatmentPackage.findFirst = jest.fn().mockResolvedValue(null);

    const createdApts = [
      { id: 'apt-0', recurrenceGroupId: 'grp-1', recurrenceIndex: 0 },
      { id: 'apt-1', recurrenceGroupId: 'grp-1', recurrenceIndex: 1 },
    ];
    const txMock = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn()
          .mockResolvedValueOnce(createdApts[0])
          .mockResolvedValueOnce(createdApts[1]),
      },
    };
    prisma.$transaction = jest.fn().mockImplementation(async (fn) => fn(txMock));

    const result = await service.createBulk('org-1', {
      recurrenceGroupId: 'grp-1',
      appointments: [
        { patientId: 'pat-1', professionalId: 'prof-1', procedureId: 'proc-1', startAt: '2026-07-01T10:00:00Z', recurrenceIndex: 0 },
        { patientId: 'pat-1', professionalId: 'prof-1', procedureId: 'proc-1', startAt: '2026-07-02T10:00:00Z', recurrenceIndex: 1 },
      ],
    });

    expect(result).toHaveLength(2);
    expect(txMock.appointment.create).toHaveBeenCalledTimes(2);
    expect(txMock.appointment.create).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ data: expect.objectContaining({ recurrenceGroupId: 'grp-1', recurrenceIndex: 0 }) })
    );
  });

  it('throws ConflictException when any slot has a conflict', async () => {
    const procedure = { id: 'proc-1', durationMinutes: 30 };
    prisma.procedure.findMany = jest.fn().mockResolvedValue([procedure]);
    prisma.treatmentPackage.findFirst = jest.fn().mockResolvedValue(null);

    const txMock = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'conflict-id' }),
        create: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn().mockImplementation(async (fn) => fn(txMock));

    await expect(
      service.createBulk('org-1', {
        recurrenceGroupId: 'grp-1',
        appointments: [
          { patientId: 'pat-1', professionalId: 'prof-1', procedureId: 'proc-1', startAt: '2026-07-01T10:00:00Z', recurrenceIndex: 0 },
        ],
      })
    ).rejects.toThrow(ConflictException);
    expect(txMock.appointment.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when procedure not found', async () => {
    prisma.procedure.findMany = jest.fn().mockResolvedValue([]);

    await expect(
      service.createBulk('org-1', {
        recurrenceGroupId: 'grp-1',
        appointments: [
          { patientId: 'pat-1', professionalId: 'prof-1', procedureId: 'proc-1', startAt: '2026-07-01T10:00:00Z', recurrenceIndex: 0 },
        ],
      })
    ).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

From `backend/`:
```bash
bun run test -- --testNamePattern="createBulk"
```
Expected: FAIL — `service.createBulk is not a function`

- [ ] **Step 3: Create the DTO**

Create `backend/src/appointment/dto/create-bulk-appointment.dto.ts`:

```ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkAppointmentItemDto {
  @IsUUID('4') patientId: string;
  @IsUUID('4') professionalId: string;
  @IsUUID('4') procedureId: string;
  @IsDateString() startAt: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsUUID('4') treatmentPackageId?: string;
  @IsInt() @Min(0) recurrenceIndex: number;
}

export class CreateBulkAppointmentDto {
  @IsUUID('4') recurrenceGroupId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkAppointmentItemDto)
  appointments: BulkAppointmentItemDto[];
}
```

- [ ] **Step 4: Implement createBulk in the service**

In `backend/src/appointment/appointment.service.ts`:

Add this import at the top (after the existing DTO imports):
```ts
import { CreateBulkAppointmentDto } from './dto/create-bulk-appointment.dto';
```

Add the `createBulk` method to `AppointmentService` before the `remove` method:

```ts
async createBulk(organizationId: string, dto: CreateBulkAppointmentDto) {
  const procedureIds = [...new Set(dto.appointments.map((a) => a.procedureId))];
  const procedures = await this.prisma.procedure.findMany({
    where: { id: { in: procedureIds }, organizationId },
  });
  const procedureMap = new Map(procedures.map((p) => [p.id, p]));

  if (procedureMap.size !== procedureIds.length) {
    throw new NotFoundException('Um ou mais procedimentos não encontrados');
  }

  const packageId = dto.appointments.find((a) => a.treatmentPackageId)?.treatmentPackageId;
  if (packageId) {
    const pkg = await this.prisma.treatmentPackage.findFirst({
      where: { id: packageId, organizationId },
      include: { procedures: { select: { procedureId: true } } },
    });
    if (!pkg) throw new NotFoundException('Pacote não encontrado');
    if (pkg.status !== TreatmentPackageStatus.ACTIVE) {
      throw new BadRequestException('Pacote não está ativo');
    }
    const withPackage = dto.appointments.filter((a) => a.treatmentPackageId).length;
    if (withPackage > pkg.totalSessions - pkg.usedSessions) {
      throw new BadRequestException(
        `Pacote possui apenas ${pkg.totalSessions - pkg.usedSessions} sessões disponíveis`,
      );
    }
    const pkgProcedureIds = pkg.procedures.map((p) => p.procedureId);
    for (const item of dto.appointments) {
      if (item.treatmentPackageId && !pkgProcedureIds.includes(item.procedureId)) {
        throw new BadRequestException('Procedimento não faz parte do pacote');
      }
    }
  }

  const created = await this.prisma.$transaction(
    async (tx) => {
      const results: Awaited<ReturnType<typeof tx.appointment.create>>[] = [];
      for (const item of dto.appointments) {
        const procedure = procedureMap.get(item.procedureId)!;
        const startAt = new Date(item.startAt);
        const endAt = new Date(startAt.getTime() + procedure.durationMinutes * 60_000);

        await this.checkConflict(organizationId, item.professionalId, startAt, endAt, undefined, tx);

        const apt = await tx.appointment.create({
          data: {
            organizationId,
            patientId: item.patientId,
            professionalId: item.professionalId,
            procedureId: item.procedureId,
            treatmentPackageId: item.treatmentPackageId,
            startAt,
            endAt,
            notes: item.notes,
            recurrenceGroupId: dto.recurrenceGroupId,
            recurrenceIndex: item.recurrenceIndex,
          },
          include: appointmentIncludes,
        });
        results.push(apt);
      }
      return results;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await this.invalidateAgendaCache(organizationId);
  for (const apt of created) {
    await this.scheduleReminder(apt.id, apt.patientId, organizationId, apt.startAt);
  }
  return created;
}
```

- [ ] **Step 5: Add route to controller**

In `backend/src/appointment/appointment.controller.ts`:

Add import:
```ts
import { CreateBulkAppointmentDto } from './dto/create-bulk-appointment.dto';
```

Add route after the `create` method (line ~41):
```ts
@Post('bulk')
@ApiOperation({ summary: 'Criar múltiplos agendamentos recorrentes (bulk)' })
@ApiResponse({ status: 201, description: 'Agendamentos criados' })
@ApiResponse({ status: 409, description: 'Conflito de horário em um dos slots' })
createBulk(@OrgId() orgId: string, @Body() dto: CreateBulkAppointmentDto) {
  return this.appointmentService.createBulk(orgId, dto);
}
```

- [ ] **Step 6: Run tests**

From `backend/`:
```bash
bun run test -- --testNamePattern="createBulk"
```
Expected: all 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/appointment/dto/create-bulk-appointment.dto.ts \
        backend/src/appointment/appointment.service.ts \
        backend/src/appointment/appointment.controller.ts \
        backend/src/appointment/appointment.service.spec.ts
git commit -m "feat(appointment): add POST /appointments/bulk for recurrent scheduling"
```

---

### Task 3: Backend — updateRecurrenceForward endpoint

**Files:**
- Modify: `backend/src/appointment/appointment.service.ts` (add `updateRecurrenceForward`)
- Modify: `backend/src/appointment/appointment.controller.ts` (add `PATCH /:id/recurrence-forward`)
- Modify: `backend/src/appointment/appointment.service.spec.ts` (add tests)

**Interfaces:**
- Consumes: `UpdateAppointmentDto` (all fields optional — already defined)
- Produces: `AppointmentService.updateRecurrenceForward(orgId, id, dto): Promise<Appointment[]>`
- Produces: `PATCH /api/appointments/:id/recurrence-forward` → 200 with `Appointment[]`

- [ ] **Step 1: Write failing tests**

Add to `backend/src/appointment/appointment.service.spec.ts`:

```ts
describe('updateRecurrenceForward', () => {
  it('updates target and all following siblings', async () => {
    const target = {
      id: 'apt-2',
      organizationId: 'org-1',
      recurrenceGroupId: 'grp-1',
      recurrenceIndex: 2,
      procedureId: 'proc-1',
      startAt: new Date('2026-07-03T10:00:00Z'),
      patientId: 'pat-1',
      deletedAt: null,
    };
    const sibling = {
      id: 'apt-3',
      organizationId: 'org-1',
      recurrenceGroupId: 'grp-1',
      recurrenceIndex: 3,
      procedureId: 'proc-1',
      startAt: new Date('2026-07-04T10:00:00Z'),
      patientId: 'pat-1',
      deletedAt: null,
    };
    const procedure = { id: 'proc-1', durationMinutes: 30 };

    prisma.appointment.findFirst = jest.fn().mockResolvedValue(target);
    prisma.procedure.findFirst = jest.fn().mockResolvedValue(procedure);
    prisma.appointment.findMany = jest.fn().mockResolvedValue([target, sibling]);

    const updated = [
      { ...target, notes: 'novo' },
      { ...sibling, notes: 'novo' },
    ];
    const txMock = {
      appointment: {
        update: jest.fn()
          .mockResolvedValueOnce(updated[0])
          .mockResolvedValueOnce(updated[1]),
      },
    };
    prisma.$transaction = jest.fn().mockImplementation(async (fn) => fn(txMock));

    const result = await service.updateRecurrenceForward('org-1', 'apt-2', { notes: 'novo' });

    expect(result).toHaveLength(2);
    expect(txMock.appointment.update).toHaveBeenCalledTimes(2);
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        recurrenceGroupId: 'grp-1',
        recurrenceIndex: { gte: 2 },
      }),
    }));
  });

  it('throws BadRequestException if appointment has no recurrenceGroupId', async () => {
    prisma.appointment.findFirst = jest.fn().mockResolvedValue({
      id: 'apt-1',
      organizationId: 'org-1',
      recurrenceGroupId: null,
      procedureId: 'proc-1',
      startAt: new Date(),
      deletedAt: null,
    });

    await expect(
      service.updateRecurrenceForward('org-1', 'apt-1', { notes: 'test' })
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

From `backend/`:
```bash
bun run test -- --testNamePattern="updateRecurrenceForward"
```
Expected: FAIL — `service.updateRecurrenceForward is not a function`

- [ ] **Step 3: Implement updateRecurrenceForward in service**

In `backend/src/appointment/appointment.service.ts`, add before `remove`:

```ts
async updateRecurrenceForward(
  organizationId: string,
  id: string,
  dto: UpdateAppointmentDto,
) {
  const target = await this.findById(organizationId, id);
  if (!target.recurrenceGroupId) {
    throw new BadRequestException('Agendamento não faz parte de uma recorrência');
  }

  const procedureId = dto.procedureId ?? target.procedureId;
  const procedure = await this.prisma.procedure.findFirst({
    where: { id: procedureId, organizationId },
  });
  if (!procedure) throw new NotFoundException('Procedimento não encontrado');

  const siblings = await this.prisma.appointment.findMany({
    where: {
      organizationId,
      recurrenceGroupId: target.recurrenceGroupId,
      recurrenceIndex: { gte: target.recurrenceIndex ?? 0 },
      deletedAt: null,
    },
    orderBy: { recurrenceIndex: 'asc' },
  });

  const newTime = dto.startAt ? new Date(dto.startAt) : null;

  const updated = await this.prisma.$transaction(
    async (tx) => {
      const results: Awaited<ReturnType<typeof tx.appointment.update>>[] = [];
      for (const sibling of siblings) {
        let startAt = sibling.startAt;
        if (newTime) {
          startAt = new Date(sibling.startAt);
          startAt.setHours(newTime.getHours(), newTime.getMinutes(), 0, 0);
        }
        const endAt = new Date(startAt.getTime() + procedure.durationMinutes * 60_000);

        const result = await tx.appointment.update({
          where: { id: sibling.id },
          data: {
            ...(dto.patientId !== undefined && { patientId: dto.patientId }),
            ...(dto.professionalId !== undefined && { professionalId: dto.professionalId }),
            procedureId,
            startAt,
            endAt,
            ...(dto.notes !== undefined && { notes: dto.notes }),
          },
          include: appointmentIncludes,
        });
        results.push(result);
      }
      return results;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await this.invalidateAgendaCache(organizationId);
  return updated;
}
```

- [ ] **Step 4: Add route to controller**

In `backend/src/appointment/appointment.controller.ts`, add after the existing `update` route:

```ts
@Patch(':id/recurrence-forward')
@ApiOperation({ summary: 'Editar este agendamento e todos os seguintes da recorrência' })
updateRecurrenceForward(
  @OrgId() orgId: string,
  @Param('id') id: string,
  @Body() dto: UpdateAppointmentDto,
) {
  return this.appointmentService.updateRecurrenceForward(orgId, id, dto);
}
```

- [ ] **Step 5: Run tests**

From `backend/`:
```bash
bun run test -- --testNamePattern="updateRecurrenceForward"
```
Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/appointment/appointment.service.ts \
        backend/src/appointment/appointment.controller.ts \
        backend/src/appointment/appointment.service.spec.ts
git commit -m "feat(appointment): add PATCH /appointments/:id/recurrence-forward"
```

---

### Task 4: Backend — CANCELED status with deductFromPackage flag

**Files:**
- Modify: `backend/src/appointment/dto/update-status.dto.ts` (add optional field)
- Modify: `backend/src/appointment/appointment.service.ts` (`updateStatus` signature + logic)
- Modify: `backend/src/appointment/appointment.controller.ts` (pass new field)
- Modify: `backend/src/appointment/appointment.service.spec.ts` (add tests)

**Interfaces:**
- Produces: `updateStatus(orgId, id, status, userId, deductFromPackage?: boolean)`
- `PATCH /api/appointments/:id/status` body: `{ status: AppointmentStatus, deductFromPackage?: boolean }`

- [ ] **Step 1: Write failing tests**

Add to `backend/src/appointment/appointment.service.spec.ts`:

```ts
describe('updateStatus — CANCELED with package', () => {
  const existing = {
    id: 'apt-1',
    organizationId: 'org-1',
    treatmentPackageId: 'pkg-1',
    status: 'SCHEDULED',
    patientId: 'pat-1',
    startAt: new Date(),
  };

  beforeEach(() => {
    prisma.appointment.findFirst = jest.fn().mockResolvedValue(existing);
  });

  it('does NOT decrement sessions on CANCELED when deductFromPackage is false', async () => {
    const txMock = {
      appointment: { update: jest.fn().mockResolvedValue({ ...existing, status: 'CANCELED' }) },
    };
    prisma.$transaction = jest.fn().mockImplementation(async (fn) => fn(txMock));
    const incrementSpy = jest.spyOn(treatmentPackageService, 'incrementUsedSessions').mockResolvedValue(undefined as any);

    await service.updateStatus('org-1', 'apt-1', 'CANCELED' as any, 'user-1', false);

    expect(incrementSpy).not.toHaveBeenCalled();
  });

  it('decrements sessions on CANCELED when deductFromPackage is true', async () => {
    const txMock = {
      appointment: { update: jest.fn().mockResolvedValue({ ...existing, status: 'CANCELED' }) },
    };
    prisma.$transaction = jest.fn().mockImplementation(async (fn) => fn(txMock));
    const incrementSpy = jest.spyOn(treatmentPackageService, 'incrementUsedSessions').mockResolvedValue(undefined as any);

    await service.updateStatus('org-1', 'apt-1', 'CANCELED' as any, 'user-1', true);

    expect(incrementSpy).toHaveBeenCalledWith('org-1', 'pkg-1', txMock);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

From `backend/`:
```bash
bun run test -- --testNamePattern="CANCELED with package"
```
Expected: FAIL — method signature mismatch

- [ ] **Step 3: Update UpdateStatusDto**

Replace the contents of `backend/src/appointment/dto/update-status.dto.ts`:

```ts
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(AppointmentStatus, { message: 'Status inválido' })
  status: AppointmentStatus;

  @IsOptional()
  @IsBoolean()
  deductFromPackage?: boolean;
}
```

- [ ] **Step 4: Update updateStatus in service**

In `backend/src/appointment/appointment.service.ts`, change the `updateStatus` signature and CANCELED handling:

```ts
async updateStatus(
  organizationId: string,
  id: string,
  status: AppointmentStatus,
  userId: string,
  deductFromPackage?: boolean,
) {
  const existing = await this.findById(organizationId, id);

  if (existing.treatmentPackageId) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.appointment.update({
        where: { id },
        data: { status },
        include: appointmentIncludes,
      });

      if (status === AppointmentStatus.DONE && existing.status !== AppointmentStatus.DONE) {
        await this.treatmentPackageService.incrementUsedSessions(
          organizationId,
          existing.treatmentPackageId!,
          tx,
        );
      }

      if (status === AppointmentStatus.CANCELED && deductFromPackage === true) {
        await this.treatmentPackageService.incrementUsedSessions(
          organizationId,
          existing.treatmentPackageId!,
          tx,
        );
      }

      if (existing.status === AppointmentStatus.DONE && status !== AppointmentStatus.DONE) {
        await this.treatmentPackageService.decrementUsedSessions(
          organizationId,
          existing.treatmentPackageId!,
          tx,
        );
      }

      return result;
    });

    await this.invalidateAgendaCache(organizationId);
    if (status === AppointmentStatus.CANCELED) await this.cancelReminder(id);
    return updated;
  }

  const updated = await this.prisma.appointment.update({
    where: { id },
    data: { status },
    include: appointmentIncludes,
  });

  await this.invalidateAgendaCache(organizationId);
  if (status === AppointmentStatus.CANCELED) await this.cancelReminder(id);
  return updated;
}
```

- [ ] **Step 5: Update controller to pass deductFromPackage**

In `backend/src/appointment/appointment.controller.ts`, update the `updateStatus` handler:

```ts
@Patch(':id/status')
@ApiOperation({
  summary: 'Alterar status do agendamento',
  description: 'Status possíveis: SCHEDULED, CONFIRMED, CANCELED, DONE. Em CANCELED com pacote: deductFromPackage=true desconta sessão.',
})
updateStatus(
  @OrgId() orgId: string,
  @Param('id') id: string,
  @Body() dto: UpdateStatusDto,
  @CurrentUser() user: JwtPayload,
) {
  return this.appointmentService.updateStatus(
    orgId,
    id,
    dto.status,
    user.sub,
    dto.deductFromPackage,
  );
}
```

- [ ] **Step 6: Run tests**

From `backend/`:
```bash
bun run test -- --testNamePattern="CANCELED with package"
```
Expected: both tests PASS.

- [ ] **Step 7: Run full backend test suite**

From `backend/`:
```bash
bun run test
```
Expected: all tests pass (no regressions).

- [ ] **Step 8: Commit**

```bash
git add backend/src/appointment/dto/update-status.dto.ts \
        backend/src/appointment/appointment.service.ts \
        backend/src/appointment/appointment.controller.ts \
        backend/src/appointment/appointment.service.spec.ts
git commit -m "feat(appointment): support deductFromPackage on CANCELED status"
```

---

### Task 5: Frontend — Update Appointment type and API client

**Files:**
- Modify: `frontend/src/types/clinic.ts` (Appointment interface)
- Modify: `frontend/src/lib/api.ts` (appointmentsApi)

**Interfaces:**
- Produces: `Appointment.recurrenceGroupId?: string`, `Appointment.recurrenceIndex?: number`
- Produces: `appointmentsApi.createBulk(...)`, `appointmentsApi.updateRecurrenceForward(...)`, updated `appointmentsApi.updateStatus(...)`

- [ ] **Step 1: Update Appointment interface in clinic.ts**

In `frontend/src/types/clinic.ts`, find the `Appointment` interface (~line 122) and add two fields after `notes?`:

```ts
export interface Appointment {
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  procedureId: string;
  treatmentPackageId?: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  notes?: string;
  recurrenceGroupId?: string;
  recurrenceIndex?: number;
  createdAt: string;
  updatedAt: string;
  patient?: { id: string; name: string };
  professional?: { id: string; person: { name: string } };
  procedure?: { id: string; name: string; durationMinutes: number; price: number };
  treatmentPackage?: { id: string; name: string };
}
```

- [ ] **Step 2: Update appointmentsApi in api.ts**

In `frontend/src/lib/api.ts`, replace the `appointmentsApi` object:

```ts
export const appointmentsApi = {
  list: (params: { startDate: string; endDate: string; professionalId?: string }) =>
    api.get<Appointment[]>(`/appointments?${queryString(params)}`),
  getById: (id: string) => api.get<Appointment>(`/appointments/${id}`),
  create: (data: {
    patientId: string;
    professionalId: string;
    procedureId: string;
    startAt: string;
    notes?: string;
    treatmentPackageId?: string;
  }) => api.post<Appointment>('/appointments', data),
  createBulk: (data: {
    recurrenceGroupId: string;
    appointments: Array<{
      patientId: string;
      professionalId: string;
      procedureId: string;
      startAt: string;
      notes?: string;
      treatmentPackageId?: string;
      recurrenceIndex: number;
    }>;
  }) => api.post<Appointment[]>('/appointments/bulk', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Appointment>(`/appointments/${id}`, data),
  updateRecurrenceForward: (id: string, data: Record<string, unknown>) =>
    api.patch<Appointment[]>(`/appointments/${id}/recurrence-forward`, data),
  updateStatus: (
    id: string,
    status: AppointmentStatus,
    options?: { deductFromPackage?: boolean },
  ) => api.patch<Appointment>(`/appointments/${id}/status`, { status, ...options }),
  remove: (id: string) => api.delete<void>(`/appointments/${id}`),
};
```

- [ ] **Step 3: Verify TypeScript compiles**

From `frontend/`:
```bash
bunx tsc --noEmit
```
Expected: no errors related to changed types.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/clinic.ts frontend/src/lib/api.ts
git commit -m "feat(frontend): add recurrence fields to Appointment type and API client"
```

---

### Task 6: Frontend — RecurrenceConflictDialog component

**Files:**
- Create: `frontend/src/components/appointments/RecurrenceConflictDialog.tsx`
- Create: `frontend/src/components/appointments/RecurrenceConflictDialog.test.tsx`

**Interfaces:**
- Consumes: `getBusinessHourForDate` from `@/lib/business-hours`, `addDays` from `date-fns`, shadcn `Dialog`, `RadioGroup`/`RadioGroupItem`, `Label`, `Button`
- Produces:
  ```ts
  interface ConflictItem {
    date: Date;
    nextAvailable: Date | null;
  }
  interface ConflictResolution {
    originalDate: Date;
    resolvedDate: Date | null; // null = pular
  }
  interface RecurrenceConflictDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    conflicts: ConflictItem[];
    onConfirm: (resolutions: ConflictResolution[]) => void;
  }
  ```

- [ ] **Step 1: Write failing tests**

Create `frontend/src/components/appointments/RecurrenceConflictDialog.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { RecurrenceConflictDialog } from './RecurrenceConflictDialog';

const conflicts = [
  { date: new Date('2026-07-06T10:00:00'), nextAvailable: new Date('2026-07-07T10:00:00') },
  { date: new Date('2026-07-13T10:00:00'), nextAvailable: null },
];

describe('RecurrenceConflictDialog', () => {
  it('renders each conflict date', () => {
    render(
      <RecurrenceConflictDialog
        open={true}
        onOpenChange={jest.fn()}
        conflicts={conflicts}
        onConfirm={jest.fn()}
      />
    );
    expect(screen.getByText(/06\/07\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/13\/07\/2026/)).toBeInTheDocument();
  });

  it('shows next available date when available', () => {
    render(
      <RecurrenceConflictDialog
        open={true}
        onOpenChange={jest.fn()}
        conflicts={conflicts}
        onConfirm={jest.fn()}
      />
    );
    expect(screen.getByText(/07\/07\/2026/)).toBeInTheDocument();
  });

  it('calls onConfirm with resolved dates using defaults', () => {
    const onConfirm = jest.fn();
    render(
      <RecurrenceConflictDialog
        open={true}
        onOpenChange={jest.fn()}
        conflicts={conflicts}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(onConfirm).toHaveBeenCalledWith([
      { originalDate: conflicts[0].date, resolvedDate: conflicts[0].nextAvailable },
      { originalDate: conflicts[1].date, resolvedDate: null },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

From `frontend/`:
```bash
bunx vitest run src/components/appointments/RecurrenceConflictDialog.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Create the component**

Create `frontend/src/components/appointments/RecurrenceConflictDialog.tsx`:

```tsx
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export interface ConflictItem {
  date: Date;
  nextAvailable: Date | null;
}

export interface ConflictResolution {
  originalDate: Date;
  resolvedDate: Date | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: ConflictItem[];
  onConfirm: (resolutions: ConflictResolution[]) => void;
}

function defaultChoice(conflict: ConflictItem): 'next' | 'skip' {
  return conflict.nextAvailable ? 'next' : 'skip';
}

export function RecurrenceConflictDialog({ open, onOpenChange, conflicts, onConfirm }: Props) {
  const [choices, setChoices] = useState<Record<number, 'next' | 'skip'>>(() =>
    Object.fromEntries(conflicts.map((c, i) => [i, defaultChoice(c)])),
  );

  const handleConfirm = () => {
    const resolutions: ConflictResolution[] = conflicts.map((c, i) => ({
      originalDate: c.date,
      resolvedDate: choices[i] === 'next' ? c.nextAvailable : null,
    }));
    onConfirm(resolutions);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Dias com conflito de horário
          </DialogTitle>
          <DialogDescription>
            Alguns dias da série caem em dias que a clínica não atende. Escolha como resolver cada um.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {conflicts.map((conflict, i) => (
            <div key={i} className="rounded-md border border-border p-3 space-y-2">
              <p className="text-sm font-medium">
                {format(conflict.date, "EEEE, dd/MM/yyyy", { locale: ptBR })} — Clínica fechada
              </p>
              <RadioGroup
                value={choices[i]}
                onValueChange={(v) => setChoices((prev) => ({ ...prev, [i]: v as 'next' | 'skip' }))}
                className="space-y-1"
              >
                {conflict.nextAvailable && (
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="next" id={`next-${i}`} />
                    <Label htmlFor={`next-${i}`} className="cursor-pointer text-sm">
                      Agendar em {format(conflict.nextAvailable, 'dd/MM/yyyy')} (próximo dia disponível)
                    </Label>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="skip" id={`skip-${i}`} />
                  <Label htmlFor={`skip-${i}`} className="cursor-pointer text-sm text-muted-foreground">
                    Pular este dia
                  </Label>
                </div>
              </RadioGroup>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Confirmar e Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests**

From `frontend/`:
```bash
bunx vitest run src/components/appointments/RecurrenceConflictDialog.test.tsx
```
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/appointments/RecurrenceConflictDialog.tsx \
        frontend/src/components/appointments/RecurrenceConflictDialog.test.tsx
git commit -m "feat(appointments): add RecurrenceConflictDialog component"
```

---

### Task 7: Frontend — RecurrenceScopeDialog component

**Files:**
- Create: `frontend/src/components/appointments/RecurrenceScopeDialog.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface RecurrenceScopeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (scope: 'single' | 'forward') => void;
  }
  ```

- [ ] **Step 1: Create the component**

Create `frontend/src/components/appointments/RecurrenceScopeDialog.tsx`:

```tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scope: 'single' | 'forward') => void;
}

export function RecurrenceScopeDialog({ open, onOpenChange, onConfirm }: Props) {
  const [scope, setScope] = useState<'single' | 'forward'>('single');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Editar agendamento recorrente</DialogTitle>
          <DialogDescription>
            Este agendamento faz parte de uma série. Qual alteração deseja aplicar?
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={scope}
          onValueChange={(v) => setScope(v as 'single' | 'forward')}
          className="space-y-3 py-2"
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem value="single" id="scope-single" className="mt-0.5" />
            <Label htmlFor="scope-single" className="cursor-pointer space-y-0.5">
              <span className="text-sm font-medium">Somente este agendamento</span>
              <p className="text-xs text-muted-foreground">Apenas este será alterado.</p>
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="forward" id="scope-forward" className="mt-0.5" />
            <Label htmlFor="scope-forward" className="cursor-pointer space-y-0.5">
              <span className="text-sm font-medium">Este e todos os seguintes</span>
              <p className="text-xs text-muted-foreground">Este e os próximos da série serão alterados.</p>
            </Label>
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => onConfirm(scope)}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/appointments/RecurrenceScopeDialog.tsx
git commit -m "feat(appointments): add RecurrenceScopeDialog component"
```

---

### Task 8: Frontend — AppointmentFormDialog with repeat fields

**Files:**
- Modify: `frontend/src/components/appointments/AppointmentFormDialog.tsx`

**Interfaces:**
- Consumes:
  - `RecurrenceConflictDialog`, `ConflictItem`, `ConflictResolution` from `./RecurrenceConflictDialog`
  - `isSlotBlocked`, `getBusinessHourForDate`, `BusinessHour` from `@/lib/business-hours`
  - `addDays`, `addWeeks`, `addMonths` from `date-fns`
  - `appointmentsApi.createBulk`, `appointmentsApi.updateRecurrenceForward` (Task 5)
- New props:
  ```ts
  businessHours?: BusinessHour[]          // from Agenda.tsx
  recurrenceEditScope?: 'single' | 'forward'  // from Agenda.tsx (edit mode)
  ```

- [ ] **Step 1: Add helper functions (before the component)**

At the top of `frontend/src/components/appointments/AppointmentFormDialog.tsx`, add imports:

```ts
import { addDays, addWeeks, addMonths } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { isSlotBlocked, getBusinessHourForDate, type BusinessHour } from '@/lib/business-hours';
import { RecurrenceConflictDialog, type ConflictItem, type ConflictResolution } from './RecurrenceConflictDialog';
```

Add these helper functions before the `timeSlots` constant:

```ts
function generateRecurrenceDates(
  baseDate: string,
  time: string,
  pattern: 'daily' | 'weekly' | 'monthly',
  repeatCount: number,
): Date[] {
  const base = new Date(`${baseDate}T${time}:00`);
  const dates: Date[] = [base];
  for (let i = 1; i <= repeatCount; i++) {
    let next: Date;
    if (pattern === 'daily') next = addDays(base, i);
    else if (pattern === 'weekly') next = addWeeks(base, i);
    else next = addMonths(base, i);
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    dates.push(next);
  }
  return dates;
}

function findNextAvailableDate(date: Date, bh: BusinessHour[]): Date | null {
  for (let i = 1; i <= 14; i++) {
    const candidate = addDays(date, i);
    const rule = getBusinessHourForDate(candidate, bh);
    if (rule?.enabled) return candidate;
  }
  return null;
}
```

- [ ] **Step 2: Update the form schema**

Replace the `appointmentSchema` constant:

```ts
const appointmentSchema = z.object({
  patientId: z.string().min(1, 'Selecione um paciente'),
  professionalId: z.string().min(1, 'Selecione um profissional'),
  procedureId: z.string().min(1, 'Selecione um procedimento'),
  date: z.string().min(1, 'Selecione a data'),
  time: z.string().min(1, 'Selecione o horário'),
  notes: z.string().optional(),
  repeat: z.boolean().default(false),
  repeatPattern: z.enum(['daily', 'weekly', 'monthly']).optional(),
  repeatCount: z.number().min(1).max(52).optional(),
});
```

- [ ] **Step 3: Update props interface and component signature**

Replace the `AppointmentFormDialogProps` interface:

```ts
interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultDate?: string;
  defaultTime?: string;
  appointment?: Appointment;
  businessHours?: BusinessHour[];
  recurrenceEditScope?: 'single' | 'forward';
}
```

Update component signature:
```ts
export function AppointmentFormDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultDate,
  defaultTime,
  appointment,
  businessHours,
  recurrenceEditScope,
}: AppointmentFormDialogProps) {
```

- [ ] **Step 4: Add conflict dialog state**

Inside the component, after the existing `useState` declarations, add:

```ts
const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
const [pendingConflicts, setPendingConflicts] = useState<ConflictItem[]>([]);
const [pendingDates, setPendingDates] = useState<Date[]>([]);
const [pendingFormData, setPendingFormData] = useState<AppointmentFormData | null>(null);
```

Also add `repeat`, `repeatPattern`, `repeatCount` to form defaultValues (in both branches of the `useEffect`):

```ts
form.reset({
  // ...existing fields...
  repeat: false,
  repeatPattern: 'daily',
  repeatCount: 1,
});
```

- [ ] **Step 5: Replace onSubmit with repeat-aware version**

Replace the entire `onSubmit` function:

```ts
const submitSingle = async (data: AppointmentFormData) => {
  const startAt = new Date(`${data.date}T${data.time}:00`).toISOString();
  if (isEditMode && appointment) {
    if (recurrenceEditScope === 'forward') {
      await appointmentsApi.updateRecurrenceForward(appointment.id, {
        patientId: data.patientId,
        professionalId: data.professionalId,
        procedureId: data.procedureId,
        startAt,
        notes: data.notes || undefined,
      });
      toast.success('Série de agendamentos atualizada');
    } else {
      await appointmentsApi.update(appointment.id, {
        patientId: data.patientId,
        professionalId: data.professionalId,
        procedureId: data.procedureId,
        startAt,
        notes: data.notes || undefined,
      });
      toast.success('Agendamento atualizado com sucesso');
    }
  } else {
    await appointmentsApi.create({
      patientId: data.patientId,
      professionalId: data.professionalId,
      procedureId: data.procedureId,
      startAt,
      notes: data.notes || undefined,
      treatmentPackageId: selectedPackageId || undefined,
    });
    toast.success('Agendamento criado com sucesso');
  }
  onSuccess();
  onOpenChange(false);
  form.reset();
  setSelectedPackageId('');
};

const submitBulk = async (data: AppointmentFormData, resolvedDates: Date[]) => {
  const recurrenceGroupId = crypto.randomUUID();
  await appointmentsApi.createBulk({
    recurrenceGroupId,
    appointments: resolvedDates.map((date, i) => ({
      patientId: data.patientId,
      professionalId: data.professionalId,
      procedureId: data.procedureId,
      startAt: date.toISOString(),
      notes: data.notes || undefined,
      treatmentPackageId: selectedPackageId || undefined,
      recurrenceIndex: i,
    })),
  });
  toast.success(`${resolvedDates.length} agendamentos criados com sucesso`);
  onSuccess();
  onOpenChange(false);
  form.reset();
  setSelectedPackageId('');
};

const onSubmit = async (data: AppointmentFormData) => {
  setLoading(true);
  setError('');

  try {
    if (!isEditMode && data.repeat && data.repeatCount && data.repeatPattern) {
      const allDates = generateRecurrenceDates(data.date, data.time, data.repeatPattern, data.repeatCount);
      const conflicts: ConflictItem[] = allDates
        .map((date) => {
          const blocked = businessHours
            ? isSlotBlocked(data.time, date, businessHours)
            : false;
          if (blocked) {
            return {
              date,
              nextAvailable: businessHours ? findNextAvailableDate(date, businessHours) : null,
            };
          }
          return null;
        })
        .filter((c): c is ConflictItem => c !== null);

      if (conflicts.length > 0) {
        setPendingConflicts(conflicts);
        setPendingDates(allDates);
        setPendingFormData(data);
        setConflictDialogOpen(true);
        setLoading(false);
        return;
      }

      await submitBulk(data, allDates);
      return;
    }

    await submitSingle(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      toast.error('Conflito de horário');
      setError('Já existe um agendamento neste período para este profissional.');
    } else if (err instanceof ApiError && err.status === 408) {
      toast.warning(
        isEditMode
          ? 'Tempo limite excedido. Verifique a agenda — o agendamento pode ter sido atualizado.'
          : 'Tempo limite excedido. Verifique a agenda — o agendamento pode ter sido criado.'
      );
      onSuccess();
      onOpenChange(false);
      form.reset();
      setSelectedPackageId('');
    } else {
      toast.error(isEditMode ? 'Erro ao atualizar agendamento' : 'Erro ao criar agendamento');
      setError(isEditMode ? 'Erro ao atualizar agendamento. Tente novamente.' : 'Erro ao criar agendamento. Tente novamente.');
    }
  } finally {
    setLoading(false);
  }
};

const handleConflictConfirm = async (resolutions: ConflictResolution[]) => {
  if (!pendingFormData || !pendingDates.length) return;
  setConflictDialogOpen(false);
  setLoading(true);
  setError('');

  try {
    const conflictOriginalDates = new Set(
      pendingConflicts.map((c) => c.date.toISOString()),
    );
    const resolutionMap = new Map(
      resolutions.map((r) => [r.originalDate.toISOString(), r.resolvedDate]),
    );

    const resolvedDates: Date[] = [];
    for (const date of pendingDates) {
      const iso = date.toISOString();
      if (conflictOriginalDates.has(iso)) {
        const resolved = resolutionMap.get(iso);
        if (resolved) {
          const d = new Date(resolved);
          d.setHours(date.getHours(), date.getMinutes(), 0, 0);
          resolvedDates.push(d);
        }
        // null = skip this date
      } else {
        resolvedDates.push(date);
      }
    }

    await submitBulk(pendingFormData, resolvedDates);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      toast.error('Conflito de horário em um dos dias resolvidos');
      setError('Conflito de horário detectado. Tente outros dias.');
    } else {
      toast.error('Erro ao criar agendamentos');
      setError('Erro ao criar agendamentos. Tente novamente.');
    }
  } finally {
    setLoading(false);
    setPendingFormData(null);
    setPendingDates([]);
    setPendingConflicts([]);
  }
};
```

- [ ] **Step 6: Add repeat UI to the JSX**

After the "Observações" textarea block and before `{error && ...}`, add (only shown in create mode):

```tsx
{!isEditMode && (
  <div className="space-y-3 border-t border-border pt-3">
    <div className="flex items-center gap-2">
      <Checkbox
        id="repeat"
        checked={form.watch('repeat') ?? false}
        onCheckedChange={(checked) => {
          form.setValue('repeat', !!checked);
        }}
      />
      <Label htmlFor="repeat" className="cursor-pointer">Repetir agendamento</Label>
    </div>

    {form.watch('repeat') && (
      <div className="grid grid-cols-2 gap-4 pl-6">
        <div className="space-y-2">
          <Label htmlFor="repeatPattern">Padrão</Label>
          <Select
            value={form.watch('repeatPattern') ?? 'daily'}
            onValueChange={(v) => form.setValue('repeatPattern', v as 'daily' | 'weekly' | 'monthly')}
          >
            <SelectTrigger id="repeatPattern">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Diário</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="monthly">Mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="repeatCount">Repetir (vezes)</Label>
          <Input
            id="repeatCount"
            type="number"
            min={1}
            max={52}
            inputMode="numeric"
            className="tabular-nums"
            {...form.register('repeatCount', { valueAsNumber: true })}
          />
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 7: Add RecurrenceConflictDialog to the JSX return**

After the closing `</Dialog>` and before the `<PatientFormDialog .../>`, add:

```tsx
<RecurrenceConflictDialog
  open={conflictDialogOpen}
  onOpenChange={setConflictDialogOpen}
  conflicts={pendingConflicts}
  onConfirm={handleConflictConfirm}
/>
```

- [ ] **Step 8: Verify TypeScript**

From `frontend/`:
```bash
bunx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/appointments/AppointmentFormDialog.tsx
git commit -m "feat(appointments): add repeat scheduling UI with conflict resolution"
```

---

### Task 9: Frontend — Agenda.tsx: scope dialog + cancel with package

**Files:**
- Modify: `frontend/src/pages/Agenda.tsx`

**Interfaces:**
- Consumes: `RecurrenceScopeDialog` from `@/components/appointments/RecurrenceScopeDialog`
- Consumes: `businessHours` (already fetched in Agenda)
- Consumes: `appointmentsApi.updateStatus` (with `deductFromPackage` option, from Task 5)

- [ ] **Step 1: Add RecurrenceScopeDialog import**

In `frontend/src/pages/Agenda.tsx`, add to the imports section:

```ts
import { RecurrenceScopeDialog } from '@/components/appointments/RecurrenceScopeDialog';
```

- [ ] **Step 2: Add new state variables**

After line 222 (`const [editAppointment, setEditAppointment] = useState...`), add:

```ts
const [pendingEditAppointment, setPendingEditAppointment] = useState<Appointment | null>(null);
const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
const [recurrenceEditScope, setRecurrenceEditScope] = useState<'single' | 'forward'>('single');
const [cancelWithPackageAppointment, setCancelWithPackageAppointment] = useState<Appointment | null>(null);
```

- [ ] **Step 3: Add handleEditClick helper**

After the state declarations, add:

```ts
const handleEditClick = (apt: Appointment) => {
  if (apt.recurrenceGroupId) {
    setPendingEditAppointment(apt);
    setScopeDialogOpen(true);
  } else {
    setEditAppointment(apt);
  }
};

const handleScopeConfirm = (scope: 'single' | 'forward') => {
  setRecurrenceEditScope(scope);
  setScopeDialogOpen(false);
  setEditAppointment(pendingEditAppointment);
  setPendingEditAppointment(null);
};
```

- [ ] **Step 4: Replace direct setEditAppointment call with handleEditClick**

Find line ~719:
```ts
setEditAppointment(selectedAppointment);
```
Replace with:
```ts
handleEditClick(selectedAppointment);
```

- [ ] **Step 5: Update the statusMutation to handle CANCELED + package**

Find the existing `statusMutation` (around line 281) and replace it:

```ts
const statusMutation = useMutation({
  mutationFn: ({
    id,
    status,
    deductFromPackage,
  }: {
    id: string;
    status: AppointmentStatus;
    deductFromPackage?: boolean;
  }) => appointmentsApi.updateStatus(id, status, { deductFromPackage }),
  onSuccess: (updated) => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    setSelectedAppointment(updated);
    setPendingDoneConfirm(false);
    const labels: Record<string, string> = {
      CONFIRMED: 'Agendamento confirmado',
      CANCELED: 'Agendamento cancelado',
      DONE: 'Atendimento concluído',
      SCHEDULED: 'Agendamento reaberto',
    };
    toast.success(labels[updated.status] ?? 'Status atualizado');
  },
  onError: () => toast.error('Erro ao atualizar status'),
});
```

- [ ] **Step 6: Replace cancel button click handler**

Find line ~843:
```ts
onClick={() => statusMutation.mutate({ id: selectedAppointment.id, status: 'CANCELED' })}
```
Replace with:
```ts
onClick={() => {
  if (selectedAppointment.treatmentPackageId) {
    setCancelWithPackageAppointment(selectedAppointment);
  } else {
    statusMutation.mutate({ id: selectedAppointment.id, status: 'CANCELED' });
  }
}}
```

- [ ] **Step 7: Pass businessHours and recurrenceEditScope to AppointmentFormDialog**

Find the "Edit Appointment Dialog" `<AppointmentFormDialog>` (around line 901) and add props:

```tsx
<AppointmentFormDialog
  open={!!editAppointment}
  onOpenChange={(open) => {
    if (!open) setEditAppointment(null);
  }}
  appointment={editAppointment ?? undefined}
  businessHours={businessHours}
  recurrenceEditScope={recurrenceEditScope}
  onSuccess={() => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    setEditAppointment(null);
  }}
/>
```

Also pass `businessHours` to the create dialog:
```tsx
<AppointmentFormDialog
  open={createOpen}
  onOpenChange={(open) => {
    setCreateOpen(open);
    if (!open) setSlotPreset(null);
  }}
  defaultDate={slotPreset?.date}
  defaultTime={slotPreset?.time}
  businessHours={businessHours}
  onSuccess={() => queryClient.invalidateQueries({ queryKey: ['appointments'] })}
/>
```

- [ ] **Step 8: Add RecurrenceScopeDialog and cancel-with-package AlertDialog to JSX**

Before the closing `</div>` of the component, add (after the existing dialogs):

```tsx
<RecurrenceScopeDialog
  open={scopeDialogOpen}
  onOpenChange={(open) => {
    setScopeDialogOpen(open);
    if (!open) setPendingEditAppointment(null);
  }}
  onConfirm={handleScopeConfirm}
/>

{cancelWithPackageAppointment && (
  <AlertDialog
    open={!!cancelWithPackageAppointment}
    onOpenChange={(open) => {
      if (!open) setCancelWithPackageAppointment(null);
    }}
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Cancelar agendamento</AlertDialogTitle>
        <AlertDialogDescription>
          Deseja descontar esta sessão do pacote &ldquo;
          {cancelWithPackageAppointment.treatmentPackage?.name ?? 'Pacote'}&rdquo;?
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => setCancelWithPackageAppointment(null)}>
          Voltar
        </AlertDialogCancel>
        <Button
          variant="outline"
          onClick={() => {
            statusMutation.mutate({
              id: cancelWithPackageAppointment.id,
              status: 'CANCELED',
              deductFromPackage: false,
            });
            setCancelWithPackageAppointment(null);
          }}
        >
          Não descontar
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            statusMutation.mutate({
              id: cancelWithPackageAppointment.id,
              status: 'CANCELED',
              deductFromPackage: true,
            });
            setCancelWithPackageAppointment(null);
          }}
        >
          Sim, descontar sessão
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}
```

Add the `AlertDialog` imports to the top of `Agenda.tsx` if not already present:
```ts
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
```

- [ ] **Step 9: Verify TypeScript**

From `frontend/`:
```bash
bunx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/Agenda.tsx
git commit -m "feat(agenda): add recurrence scope dialog and cancel-with-package flow"
```

---

### Task 10: Bug fix — TreatmentPackageFormDialog silent save failure

**Root cause:** In `fixed` mode, `customInstallments` defaults to `[{ amount: '', ... }]`. The Zod schema validates `amount: z.string().min(1)` on this item even in fixed mode. The error (`customInstallments.0.amount`) is only rendered in the JSX when `mode === 'flexible'`, so the user never sees it — the form silently blocks submission.

**Fix:** Relax `amount` and `dueDate` validation in the schema (remove `.min(1)`). The `onSubmit` function already validates flexible mode correctly via the `flexValid` check.

**Files:**
- Modify: `frontend/src/components/treatment-packages/TreatmentPackageFormDialog.tsx`

- [ ] **Step 1: Verify the bug**

Open the app, navigate to a patient profile, open the treatment package form. Fill in name, select a procedure, set sessions and price, leave everything else as default. Click "Criar Pacote". Nothing happens. Confirm bug is reproducible.

- [ ] **Step 2: Apply the fix**

In `frontend/src/components/treatment-packages/TreatmentPackageFormDialog.tsx`, find the `packageSchema` (line ~40) and change the `customInstallments` item schema from:

```ts
customInstallments: z
  .array(
    z.object({
      amount: z.string().min(1, 'Informe o valor'),
      dueDate: z.string().min(1, 'Informe o vencimento'),
      paymentMethod: z.string().optional(),
    }),
  )
  .optional(),
```

To:

```ts
customInstallments: z
  .array(
    z.object({
      amount: z.string(),
      dueDate: z.string(),
      paymentMethod: z.string().optional(),
    }),
  )
  .optional(),
```

- [ ] **Step 3: Verify the fix**

Open the treatment package form, fill in the required fields (name, procedure, sessions, price), click "Criar Pacote". The spinner should appear and the package should be created.

- [ ] **Step 4: Run frontend tests**

From `frontend/`:
```bash
bun run test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/treatment-packages/TreatmentPackageFormDialog.tsx
git commit -m "fix(treatment-packages): remove silent Zod validation block on package save button"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Repetir agendamento (diário/semanal/mensal) | Task 8 |
| Perguntar quantas vezes repetir | Task 8 |
| Verificar horário de funcionamento | Task 8 (isSlotBlocked) |
| Resumo de conflitos + resolver todos de uma vez | Task 6 + Task 8 |
| Próximo dia disponível como opção | Task 6 (findNextAvailableDate) |
| Edição com escopo (somente este / este e seguintes) | Task 7 + Task 9 |
| Pacote: deduzir sessão no DONE | Existia antes; preservado na Task 4 |
| Pacote: perguntar se desconta no CANCELED | Task 4 + Task 9 |
| Bug fix: botão salvar pacote sem ação | Task 10 |
| Backend bulk endpoint | Task 2 |
| Backend recurrence-forward endpoint | Task 3 |
| DB migration | Task 1 |

**Type consistency check:**
- `recurrenceGroupId: string` / `recurrenceIndex: number` — consistent across schema (Task 1), API types (Task 5), service (Task 2+3)
- `deductFromPackage?: boolean` — consistent across DTO (Task 4), service (Task 4), API client (Task 5), Agenda.tsx (Task 9)
- `ConflictItem`, `ConflictResolution` — exported from `RecurrenceConflictDialog.tsx` and consumed in `AppointmentFormDialog.tsx`
- `RecurrenceScopeDialog.onConfirm(scope: 'single' | 'forward')` — consistent with `recurrenceEditScope` state in Agenda.tsx
