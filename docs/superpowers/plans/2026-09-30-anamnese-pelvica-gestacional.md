# Anamnese Pélvica Geral e Gestacional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-field "anamnese simplificada" with two independent forms (`PELVIC_GENERAL`, `PREGNANCY`) that have optional narrative sections with out-of-record "Investigar:" guidance, draft/completed status, revision snapshots on edits of completed records, and structured obstetric fields with gestational-age calculation — plus `occupation`/`maritalStatus` on the patient registry.

**Architecture:** Form definitions (titles, placeholders, guidance) live in frontend config; clinical content is stored in `Anamnesis.data` as `{ sections: { [sectionId]: value } }`. The backend validates `type` + known `sectionId`s, merges per section, and snapshots the previous `data` into `anamnesis_revisions` when a `COMPLETED` record is edited. Legacy records (`type = null`) are preserved untouched and rendered read-only. Gestational-age math lives in pure frontend functions.

**Tech Stack:** NestJS + Prisma 7 + Jest (backend); React 18 + TanStack Query + React Router 6.30 (`BrowserRouter`) + react-hook-form/zod + Vitest/Testing Library (frontend); Bun.

**Spec:** `docs/superpowers/specs/2026-09-30-anamnese-pelvica-gestacional-design.md`

## Global Constraints

- Branch: `bravilal/sou-66-anamnese` (Linear `gitBranchName`). Commits/PR reference `Part of SOU-66` / `Fixes SOU-66`.
- Commit messages in Portuguese, conventional-commit style; every commit ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Never run `bunx prisma migrate dev`** and **never run `bun run lint` in `backend/`** (it is `eslint --fix` and rewrites ~195 files). `backend/.env.dev` points at the **production** Neon DB. The migration SQL is hand-written and only applied by the deploy's `prisma migrate deploy`. Do not run `migrate deploy` locally without the user's explicit go-ahead.
- Migration must be additive only (nullable columns / defaults / new table) plus the legacy backfill `UPDATE`.
- Enums: `AnamnesisType = PELVIC_GENERAL | PREGNANCY`; `AnamnesisStatus = DRAFT | COMPLETED`.
- `Anamnesis.type === null` ⇒ legacy record: read-only (PATCH → 409), shown as "Formato anterior".
- `DELETE /anamneses/:id` only for `DRAFT`; `COMPLETED` → 409. Drafts never create revisions.
- Revision snapshot = `data` **before** the edit + editor's `OrganizationUser.id`, written in the same `$transaction` as the update. Only when the record is `COMPLETED` **and** `data` or `assessmentDate` is being changed.
- Reopening (`COMPLETED` → `DRAFT`) is not supported (400).
- All queries scoped by `organizationId` from `@OrgId()`; never trust client org ids. `@RequireFeature('ANAMNESIS')` stays on the controller.
- "Investigar:" guidance is display-only: never part of `value`, payload, or stored data. Clinical narrative fields are never required.
- `marital_status` is validated in the DTO with `@IsIn`, not a Prisma enum. Values: `SINGLE | MARRIED | STABLE_UNION | DIVORCED | WIDOWED | OTHER`.
- Obstetric: `obstetricRisk ∈ HABITUAL | ALTO_RISCO | NAO_INFORMADO`; `gaSource ∈ DUM | ULTRASSONOGRAFIA | MANUAL`. DPP = DUM + 280 days; ultrasound DPP = exam date + (280 − GA at exam in days). A manual GA/DPP is never silently overwritten by a recompute.
- Dates are `YYYY-MM-DD` strings on the frontend, handled with UTC arithmetic (no local-timezone `Date` math).
- UI strings in pt-BR. No `useBlocker` (app uses `BrowserRouter`, not a data router).
- No `@testing-library/user-event` in the repo: use `fireEvent`. Avoid Radix `Select`/`DropdownMenu` in new components (hard to drive in jsdom); use native `<select>` and plain buttons.
- Frontend version bump `0.7.2 → 0.8.0` in `frontend/package.json` as the last commit (`chore: bump version to 0.8.0`).

## Review Focus

Inputs the spec implies but does not spell out; each has a test in the owning task.

1. **Prototype-key section ids** (`constructor`, `__proto__`, `toString`) must be rejected as unknown sections, not accepted by a naive `defs[id]` lookup — Task 3.
2. **Impossible calendar dates** (`2026-02-30`) in DUM/DPP must be rejected by the backend and yield "no result" (not a wrong date) in the GA math — Tasks 3, 6.
3. **Clearing a narrative field** (empty string) must overwrite the stored text when saved; and saving a finished record with no changes must not create a revision — Tasks 4, 10.
4. **Legacy records** (backfilled `COMPLETED`, `type = null`) must be neither editable nor deletable through API or UI, and a legacy record that is still `DRAFT` must still render as legacy — Tasks 4, 11.
5. **GA outside a sane range** (reference date before DUM, more than 45 weeks) must show "—", and the UI must not crash on partially typed dates/numbers — Tasks 6, 9.

---

## File Structure

**Backend — create**
- `backend/prisma/migrations/20260930000000_anamnesis_types_revisions_patient_profile/migration.sql`
- `backend/src/patient/marital-status.ts`
- `backend/src/patient/dto/patient-dto.spec.ts`
- `backend/src/anamnesis/anamnesis-sections.ts` — section ids per type + validation/normalization
- `backend/src/anamnesis/anamnesis-sections.spec.ts`

**Backend — modify**
- `backend/prisma/schema.prisma` — enums, `Patient.occupation/maritalStatus`, `Anamnesis` columns, `AnamnesisRevision`
- `backend/src/patient/dto/create-patient.dto.ts`, `update-patient.dto.ts`, `patient.service.ts`, `patient.service.spec.ts`
- `backend/src/anamnesis/dto/create-anamnesis.dto.ts`, `update-anamnesis.dto.ts`
- `backend/src/anamnesis/anamnesis.service.ts`, `anamnesis.controller.ts`, `anamnesis.service.spec.ts`

**Frontend — create**
- `frontend/src/lib/marital-status.ts` (+ `.test.ts`)
- `frontend/src/lib/gestational-age.ts` (+ `.test.ts`)
- `frontend/src/components/anamnesis/anamnesis-forms.ts` (+ `.test.ts`) — types, form definitions, `getSections`
- `frontend/src/components/anamnesis/gestational-data.ts` (+ `.test.ts`) — obstetric types + pure recompute logic
- `frontend/src/components/anamnesis/ClinicalNarrativeField.tsx` (+ test)
- `frontend/src/components/anamnesis/CollapsibleSection.tsx`
- `frontend/src/components/anamnesis/SelectField.tsx`
- `frontend/src/components/anamnesis/GestationalDataFields.tsx`, `UltrasoundFields.tsx`, `ObstetricSummary.tsx` (+ tests in `gestational-components.test.tsx`)
- `frontend/src/components/anamnesis/IdentificationSection.tsx`
- `frontend/src/components/anamnesis/LegacyAnamnesisView.tsx` (+ test)
- `frontend/src/components/anamnesis/AnamnesisPatientSidebar.tsx`
- `frontend/src/components/anamnesis/AnamnesisTab.tsx` (+ test)
- `frontend/src/hooks/use-unsaved-changes-guard.ts`, `use-autosave.ts` (+ tests)
- `frontend/src/components/patients/PatientFormDialog.occupation.test.tsx`

**Frontend — modify**
- `frontend/src/types/clinic.ts`, `frontend/src/lib/api.ts`
- `frontend/src/components/patients/PatientFormDialog.tsx`
- `frontend/src/pages/PatientProfile.tsx` — header line + replace Anamnese tab with `<AnamnesisTab />`
- `frontend/src/pages/AnamnesisEditorPage.tsx` (rewrite) and `AnamnesisEditorPage.test.tsx` (rewrite)
- `frontend/src/components/anamnesis/anamnesis-fields.tsx` (+ `.test.tsx`) — remove editor-only pieces
- `frontend/package.json` — version
- `CLAUDE.md`, `docs/superpowers/specs/2026-09-30-anamnese-pelvica-gestacional-design.md`

---

## Execution notes

- **Bash sandbox/classifier hiccups:** if a command is refused transiently, retry once.
- **Local DB == prod.** Backend unit tests mock Prisma and need no DB. Manual UI verification needs the new columns to exist; ask the user before applying the migration (Task 1 step 7 documents the options).
- The migration is additive, so the *currently deployed* (old) code keeps working if the migration is applied before the new code ships.

---

### Task 1: Prisma schema + hand-written migration

**Files:**
- Modify: `backend/prisma/schema.prisma` (Patient model ~L203–237; Anamnesis model ~L329–348)
- Create: `backend/prisma/migrations/20260930000000_anamnesis_types_revisions_patient_profile/migration.sql`

**Interfaces:**
- Produces (Prisma client, after `generate`): enums `AnamnesisType`, `AnamnesisStatus`; `Patient.occupation: string | null`, `Patient.maritalStatus: string | null`; `Anamnesis.type: AnamnesisType | null`, `.status: AnamnesisStatus`, `.assessmentDate: Date | null`, `.completedAt: Date | null`; model `AnamnesisRevision { id, organizationId, anamnesisId, professionalId, data: Json, createdAt }` accessible as `prisma.anamnesisRevision`.

- [ ] **Step 1: Create the branch and commit the spec + plan**

```bash
git checkout -b bravilal/sou-66-anamnese
git add docs/superpowers/specs/2026-09-30-anamnese-pelvica-gestacional-design.md docs/superpowers/plans/2026-09-30-anamnese-pelvica-gestacional.md
git commit -m "docs(anamnese): spec e plano da SOU-66

Part of SOU-66

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Do **not** stage the unrelated `.mcp.json` / `AGENTS.md`.

- [ ] **Step 2: Edit `Patient` in `schema.prisma`**

After the `gender              String?` line add:

```prisma
  occupation          String?
  maritalStatus       String?       @map("marital_status")
```

- [ ] **Step 3: Replace the `Anamnesis` model in `schema.prisma`**

Replace the whole `model Anamnesis { ... }` block with:

```prisma
enum AnamnesisType {
  PELVIC_GENERAL
  PREGNANCY
}

enum AnamnesisStatus {
  DRAFT
  COMPLETED
}

model Anamnesis {
  id              String              @id @default(uuid())
  organizationId  String              @map("organization_id")
  patientId       String              @map("patient_id")
  professionalId  String              @map("professional_id")
  data            Json
  // null = legacy record (4-field "simplificada" format); read-only
  type            AnamnesisType?
  status          AnamnesisStatus     @default(DRAFT)
  assessmentDate  DateTime?           @map("assessment_date")
  completedAt     DateTime?           @map("completed_at")
  legalBasis      SensitiveLegalBasis @default(HEALTH_PROTECTION) @map("legal_basis")
  consentId       String?             @map("consent_id")
  legalBasisNotes String?             @map("legal_basis_notes")
  createdAt       DateTime            @default(now()) @map("created_at")
  updatedAt       DateTime            @updatedAt @map("updated_at")

  organization Organization        @relation(fields: [organizationId], references: [id])
  patient      Patient             @relation(fields: [patientId], references: [id])
  professional OrganizationUser    @relation(fields: [professionalId], references: [id])
  revisions    AnamnesisRevision[]

  @@index([organizationId, patientId])
  @@index([organizationId, createdAt])
  @@map("anamneses")
}

// Snapshot of Anamnesis.data taken BEFORE each edit of a COMPLETED anamnesis.
model AnamnesisRevision {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  anamnesisId    String   @map("anamnesis_id")
  professionalId String   @map("professional_id") // OrganizationUser.id of the editor
  data           Json
  createdAt      DateTime @default(now()) @map("created_at")

  anamnesis Anamnesis @relation(fields: [anamnesisId], references: [id])

  @@index([organizationId, anamnesisId])
  @@map("anamnesis_revisions")
}
```

- [ ] **Step 4: Write the migration SQL**

Create `backend/prisma/migrations/20260930000000_anamnesis_types_revisions_patient_profile/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "AnamnesisType" AS ENUM ('PELVIC_GENERAL', 'PREGNANCY');

-- CreateEnum
CREATE TYPE "AnamnesisStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- AlterTable: patient profile
ALTER TABLE "patients" ADD COLUMN "occupation" TEXT,
ADD COLUMN "marital_status" TEXT;

-- AlterTable: anamnesis
ALTER TABLE "anamneses" ADD COLUMN "type" "AnamnesisType",
ADD COLUMN "status" "AnamnesisStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "assessment_date" TIMESTAMP(3),
ADD COLUMN "completed_at" TIMESTAMP(3);

-- Backfill: legacy (4-field) records are finished clinical history, not pending drafts.
UPDATE "anamneses" SET "status" = 'COMPLETED', "completed_at" = "updated_at" WHERE "type" IS NULL;

-- CreateTable
CREATE TABLE "anamnesis_revisions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "anamnesis_id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anamnesis_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anamnesis_revisions_organization_id_anamnesis_id_idx" ON "anamnesis_revisions"("organization_id", "anamnesis_id");

-- AddForeignKey
ALTER TABLE "anamnesis_revisions" ADD CONSTRAINT "anamnesis_revisions_anamnesis_id_fkey" FOREIGN KEY ("anamnesis_id") REFERENCES "anamneses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 5: Validate the schema and regenerate the client**

Run (from `backend/`): `bunx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`.

Run: `bunx prisma generate`
Expected: `Generated Prisma Client`.

- [ ] **Step 6: Cross-check the hand-written SQL against Prisma's own diff (read-only)**

First confirm the flag names for this Prisma 7 install: `bunx prisma migrate diff --help`. Then print (does NOT apply anything; it only introspects the configured datasource) the DDL Prisma would generate:

```bash
bunx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

Expected: the `CREATE TYPE`, `ALTER TABLE ... ADD COLUMN`, `CREATE TABLE "anamnesis_revisions"`, index and FK statements match the file from Step 4 (ignoring ordering/comments; the `UPDATE` backfill is not in the diff). Fix `migration.sql` if a column type/nullable/default differs. If the flags differ from the above, use the ones `--help` shows. If the datasource is unreachable, skip and say so in the PR.

- [ ] **Step 7: Confirm existing backend tests still compile and pass**

Run (from `backend/`): `bun run test -- src/anamnesis src/patient`
Expected: PASS (the new columns are nullable/defaulted, so current specs still type-check).

**Do not** apply the migration to the DB now. To exercise the UI manually later, ask the user whether to run `NODE_ENV=prod bunx prisma migrate deploy` (applies to prod) — they decide.

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260930000000_anamnesis_types_revisions_patient_profile
git commit -m "feat(anamnese): schema de tipos, status, revisões e perfil do paciente

Adiciona AnamnesisType/AnamnesisStatus, colunas type/status/assessment_date/completed_at,
tabela anamnesis_revisions e Patient.occupation/marital_status. Migration aditiva com
backfill dos registros legados para COMPLETED.

Part of SOU-66

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Patient `occupation` / `maritalStatus` (backend)

**Files:**
- Create: `backend/src/patient/marital-status.ts`, `backend/src/patient/dto/patient-dto.spec.ts`
- Modify: `backend/src/patient/dto/create-patient.dto.ts`, `backend/src/patient/dto/update-patient.dto.ts`, `backend/src/patient/patient.service.ts` (create mapping), `backend/src/patient/patient.service.spec.ts`

**Interfaces:**
- Produces: `MARITAL_STATUSES` (readonly tuple) and `MaritalStatus` type from `backend/src/patient/marital-status.ts`; `CreatePatientDto.occupation?: string`, `.maritalStatus?: MaritalStatus`; same on `UpdatePatientDto` (update uses `...dto`, so no service change there).

- [ ] **Step 1: Write the failing DTO test**

Create `backend/src/patient/dto/patient-dto.spec.ts`:

```ts
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePatientDto } from './create-patient.dto';
import { UpdatePatientDto } from './update-patient.dto';

describe('Patient DTOs — occupation / maritalStatus', () => {
  it('CreatePatientDto aceita profissão e estado civil válidos', async () => {
    const dto = plainToInstance(CreatePatientDto, {
      name: 'Maria Silva',
      occupation: 'Professora',
      maritalStatus: 'MARRIED',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('CreatePatientDto rejeita estado civil fora da lista', async () => {
    const dto = plainToInstance(CreatePatientDto, { name: 'Maria Silva', maritalStatus: 'CASADA' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('maritalStatus');
  });

  it('CreatePatientDto rejeita profissão com mais de 120 caracteres', async () => {
    const dto = plainToInstance(CreatePatientDto, { name: 'Maria Silva', occupation: 'x'.repeat(121) });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('occupation');
  });

  it('UpdatePatientDto valida os mesmos campos', async () => {
    const ok = plainToInstance(UpdatePatientDto, { occupation: 'Médica', maritalStatus: 'STABLE_UNION' });
    expect(await validate(ok)).toHaveLength(0);

    const bad = plainToInstance(UpdatePatientDto, { maritalStatus: 'XYZ' });
    const errors = await validate(bad);
    expect(errors.map((e) => e.property)).toContain('maritalStatus');
  });
});
```

And append inside the `describe('isolamento por organizationId', ...)` block of `backend/src/patient/patient.service.spec.ts` (after the `create deve vincular ao organizationId` test):

```ts
    it('create deve repassar profissão e estado civil', async () => {
      prisma.patient.create.mockResolvedValue({ id: 'p1' });

      await service.create(orgA, {
        name: 'Maria',
        occupation: 'Professora',
        maritalStatus: 'MARRIED',
      });

      expect(prisma.patient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: orgA,
          occupation: 'Professora',
          maritalStatus: 'MARRIED',
        }),
      });
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `bun run test -- src/patient`
Expected: FAIL (`occupation`/`maritalStatus` unknown to the DTOs / not passed by the service).

- [ ] **Step 3: Implement**

Create `backend/src/patient/marital-status.ts`:

```ts
export const MARITAL_STATUSES = [
  'SINGLE',
  'MARRIED',
  'STABLE_UNION',
  'DIVORCED',
  'WIDOWED',
  'OTHER',
] as const;

export type MaritalStatus = (typeof MARITAL_STATUSES)[number];
```

In `create-patient.dto.ts`: add `IsIn` and `MaxLength` to the `class-validator` import, add `import { MARITAL_STATUSES, MaritalStatus } from '../marital-status';`, and insert after the `gender` field:

```ts
  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupation?: string;

  @IsOptional()
  @IsIn(MARITAL_STATUSES, { message: 'Estado civil inválido' })
  maritalStatus?: MaritalStatus;
```

In `update-patient.dto.ts` (already imports `IsIn`): add `MaxLength` to the import, add the same `marital-status` import, and insert the same two fields after `gender`.

In `patient.service.ts` `create()`, after `gender: dto.gender,` add:

```ts
        occupation: dto.occupation,
        maritalStatus: dto.maritalStatus,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- src/patient`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/patient
git commit -m "feat(paciente): profissão e estado civil no cadastro (backend)

Part of SOU-66

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Anamnesis section definitions + validation (backend)

**Files:**
- Create: `backend/src/anamnesis/anamnesis-sections.ts`, `backend/src/anamnesis/anamnesis-sections.spec.ts`

**Interfaces:**
- Consumes: `AnamnesisType` from `@prisma/client` (Task 1).
- Produces:
  - `ANAMNESIS_SECTIONS: Record<AnamnesisType, Record<string, 'narrative' | 'structured'>>`
  - `normalizeAnamnesisData(type: AnamnesisType, data: unknown): { sections: Record<string, unknown> }` — throws `BadRequestException`; `undefined` ⇒ `{ sections: {} }`
  - `extractSections(data: unknown): Record<string, unknown>` — safe read of `data.sections` from a stored value (`{}` if absent/invalid)

- [ ] **Step 1: Write the failing tests**

Create `backend/src/anamnesis/anamnesis-sections.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { AnamnesisType } from '@prisma/client';
import {
  ANAMNESIS_SECTIONS,
  extractSections,
  normalizeAnamnesisData,
} from './anamnesis-sections';

const GENERAL = AnamnesisType.PELVIC_GENERAL;
const PREGNANCY = AnamnesisType.PREGNANCY;

describe('ANAMNESIS_SECTIONS', () => {
  it('ficha pélvica geral tem exatamente as 11 seções da SOU-66', () => {
    expect(Object.keys(ANAMNESIS_SECTIONS[GENERAL])).toEqual([
      'identification',
      'chiefComplaint',
      'currentHistory',
      'healthHistory',
      'urinarySymptoms',
      'bowelSymptoms',
      'sexualSymptoms',
      'gynecologicalObstetricHistory',
      'behavioralHabits',
      'treatmentExpectations',
      'additionalNotes',
    ]);
  });

  it('ficha gestacional tem exatamente as 14 seções da SOU-66', () => {
    expect(Object.keys(ANAMNESIS_SECTIONS[PREGNANCY])).toEqual([
      'gestationalData',
      'obstetricHistory',
      'currentPregnancyHistory',
      'ultrasound',
      'otherExams',
      'healthHistory',
      'musculoskeletalPelvicSymptoms',
      'urinarySymptoms',
      'bowelSymptoms',
      'sexualSymptoms',
      'behavioralHabits',
      'birthPlanning',
      'physiotherapyGoals',
      'additionalNotes',
    ]);
  });
});

describe('normalizeAnamnesisData', () => {
  it('data ausente vira { sections: {} }', () => {
    expect(normalizeAnamnesisData(GENERAL, undefined)).toEqual({ sections: {} });
  });

  it('aceita seções narrativas vazias (campos clínicos nunca são obrigatórios)', () => {
    expect(
      normalizeAnamnesisData(GENERAL, { sections: { chiefComplaint: '', currentHistory: 'Há 2 meses' } }),
    ).toEqual({ sections: { chiefComplaint: '', currentHistory: 'Há 2 meses' } });
  });

  it('rejeita seção que não pertence ao tipo', () => {
    expect(() => normalizeAnamnesisData(GENERAL, { sections: { ultrasound: {} } })).toThrow(
      BadRequestException,
    );
    expect(() => normalizeAnamnesisData(PREGNANCY, { sections: { chiefComplaint: 'x' } })).toThrow(
      BadRequestException,
    );
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'rejeita id de seção "%s" (chave do protótipo de Object)',
    (id) => {
      const sections = JSON.parse(`{"${id}": "x"}`);
      expect(() => normalizeAnamnesisData(GENERAL, { sections })).toThrow(BadRequestException);
    },
  );

  it('rejeita chaves desconhecidas fora de sections', () => {
    expect(() => normalizeAnamnesisData(GENERAL, { sections: {}, other: 1 })).toThrow(
      BadRequestException,
    );
  });

  it('rejeita narrativa que não é string e string gigante', () => {
    expect(() => normalizeAnamnesisData(GENERAL, { sections: { chiefComplaint: 5 } })).toThrow(
      BadRequestException,
    );
    expect(() =>
      normalizeAnamnesisData(GENERAL, { sections: { chiefComplaint: 'x'.repeat(20001) } }),
    ).toThrow(BadRequestException);
  });

  it('seção estruturada precisa ser objeto simples', () => {
    expect(() => normalizeAnamnesisData(PREGNANCY, { sections: { ultrasound: 'texto' } })).toThrow(
      BadRequestException,
    );
    expect(() => normalizeAnamnesisData(PREGNANCY, { sections: { ultrasound: [] } })).toThrow(
      BadRequestException,
    );
  });

  describe('gestationalData', () => {
    const run = (gd: unknown) =>
      normalizeAnamnesisData(PREGNANCY, { sections: { gestationalData: gd } });

    it('aceita DUM/DPP válidas e risco obstétrico da lista', () => {
      expect(() =>
        run({ dum: '2026-01-01', dpp: '2026-10-08', obstetricRisk: 'ALTO_RISCO' }),
      ).not.toThrow();
    });

    it('aceita campos vazios/ausentes', () => {
      expect(() => run({ dum: '', obstetricRisk: '' })).not.toThrow();
      expect(() => run({})).not.toThrow();
    });

    it('rejeita data impossível (2026-02-30) e formato inválido', () => {
      expect(() => run({ dum: '2026-02-30' })).toThrow(BadRequestException);
      expect(() => run({ dpp: '10/10/2026' })).toThrow(BadRequestException);
    });

    it('rejeita risco obstétrico fora da lista', () => {
      expect(() => run({ obstetricRisk: 'MEDIO' })).toThrow(BadRequestException);
    });
  });
});

describe('extractSections', () => {
  it('lê sections de um data válido', () => {
    expect(extractSections({ sections: { a: 'b' } })).toEqual({ a: 'b' });
  });

  it.each([null, undefined, 'x', [], { sections: 'x' }, { queixaPrincipal: {} }])(
    'devolve {} para %j',
    (value) => {
      expect(extractSections(value)).toEqual({});
    },
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- src/anamnesis/anamnesis-sections`
Expected: FAIL (`Cannot find module './anamnesis-sections'`).

- [ ] **Step 3: Implement**

Create `backend/src/anamnesis/anamnesis-sections.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { AnamnesisType } from '@prisma/client';

type SectionKind = 'narrative' | 'structured';

// Section ids per form type. Titles/placeholders/guidance live in the frontend
// form definitions; the backend only needs ids + kind to validate.
export const ANAMNESIS_SECTIONS: Record<AnamnesisType, Record<string, SectionKind>> = {
  PELVIC_GENERAL: {
    identification: 'structured',
    chiefComplaint: 'narrative',
    currentHistory: 'narrative',
    healthHistory: 'narrative',
    urinarySymptoms: 'narrative',
    bowelSymptoms: 'narrative',
    sexualSymptoms: 'narrative',
    gynecologicalObstetricHistory: 'narrative',
    behavioralHabits: 'narrative',
    treatmentExpectations: 'narrative',
    additionalNotes: 'narrative',
  },
  PREGNANCY: {
    gestationalData: 'structured',
    obstetricHistory: 'narrative',
    currentPregnancyHistory: 'narrative',
    ultrasound: 'structured',
    otherExams: 'narrative',
    healthHistory: 'narrative',
    musculoskeletalPelvicSymptoms: 'narrative',
    urinarySymptoms: 'narrative',
    bowelSymptoms: 'narrative',
    sexualSymptoms: 'narrative',
    behavioralHabits: 'narrative',
    birthPlanning: 'narrative',
    physiotherapyGoals: 'narrative',
    additionalNotes: 'narrative',
  },
};

const MAX_NARRATIVE_LENGTH = 20000;
const MAX_STRUCTURED_LENGTH = 50000;
const OBSTETRIC_RISKS = ['HABITUAL', 'ALTO_RISCO', 'NAO_INFORMADO'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const isBlank = (value: unknown) => value === undefined || value === null || value === '';

function validateGestationalData(value: PlainObject): void {
  for (const key of ['dum', 'dpp'] as const) {
    const field = value[key];
    if (!isBlank(field) && !(typeof field === 'string' && isValidIsoDate(field))) {
      throw new BadRequestException(`gestationalData.${key} deve ser uma data válida (YYYY-MM-DD)`);
    }
  }
  const risk = value.obstetricRisk;
  if (!isBlank(risk) && !(typeof risk === 'string' && OBSTETRIC_RISKS.includes(risk))) {
    throw new BadRequestException('gestationalData.obstetricRisk inválido');
  }
}

export function normalizeAnamnesisData(
  type: AnamnesisType,
  data: unknown,
): { sections: Record<string, unknown> } {
  if (data === undefined) return { sections: {} };
  if (!isPlainObject(data)) {
    throw new BadRequestException('Dados da anamnese inválidos');
  }

  const extraKeys = Object.keys(data).filter((key) => key !== 'sections');
  if (extraKeys.length > 0) {
    throw new BadRequestException(`Campos desconhecidos em data: ${extraKeys.join(', ')}`);
  }

  const sections = data.sections ?? {};
  if (!isPlainObject(sections)) {
    throw new BadRequestException('data.sections deve ser um objeto');
  }

  const definitions = ANAMNESIS_SECTIONS[type];
  for (const [id, value] of Object.entries(sections)) {
    // hasOwnProperty: "constructor"/"__proto__" must not resolve through Object.prototype
    if (!Object.prototype.hasOwnProperty.call(definitions, id)) {
      throw new BadRequestException(`Seção desconhecida para este tipo de anamnese: ${id}`);
    }

    if (definitions[id] === 'narrative') {
      if (typeof value !== 'string') {
        throw new BadRequestException(`Seção ${id} deve ser um texto`);
      }
      if (value.length > MAX_NARRATIVE_LENGTH) {
        throw new BadRequestException(`Seção ${id} excede ${MAX_NARRATIVE_LENGTH} caracteres`);
      }
      continue;
    }

    if (!isPlainObject(value)) {
      throw new BadRequestException(`Seção ${id} deve ser um objeto`);
    }
    if (JSON.stringify(value).length > MAX_STRUCTURED_LENGTH) {
      throw new BadRequestException(`Seção ${id} é grande demais`);
    }
    if (id === 'gestationalData') validateGestationalData(value);
  }

  return { sections };
}

export function extractSections(data: unknown): Record<string, unknown> {
  if (isPlainObject(data) && isPlainObject(data.sections)) return data.sections;
  return {};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- src/anamnesis/anamnesis-sections`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/anamnesis/anamnesis-sections.ts backend/src/anamnesis/anamnesis-sections.spec.ts
git commit -m "feat(anamnese): definição e validação de seções por tipo

Part of SOU-66

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Anamnesis DTOs, service and controller

**Files:**
- Modify: `backend/src/anamnesis/dto/create-anamnesis.dto.ts`, `dto/update-anamnesis.dto.ts`, `anamnesis.service.ts`, `anamnesis.controller.ts`
- Test (rewrite): `backend/src/anamnesis/anamnesis.service.spec.ts`

**Interfaces:**
- Consumes: `normalizeAnamnesisData`, `extractSections` (Task 3); Prisma enums + `anamnesisRevision` (Task 1).
- Produces (HTTP, used by frontend Task 5):
  - `POST /anamneses` body `{ patientId, type, assessmentDate?, data?: { sections }, legalBasis?, consentId?, legalBasisNotes? }`
  - `PATCH /anamneses/:id` body `{ data?: { sections }, assessmentDate?, status? }`
  - `DELETE /anamneses/:id` (only `DRAFT`)
  - Service signatures: `create(orgId, personId, dto)`, `update(orgId, personId, id, dto)`, `remove(orgId, id)`.

- [ ] **Step 1: Rewrite the service spec (failing)**

Replace the whole content of `backend/src/anamnesis/anamnesis.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AnamnesisStatus, AnamnesisType } from '@prisma/client';
import { AnamnesisService } from './anamnesis.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AnamnesisService', () => {
  let service: AnamnesisService;
  let prisma: any;
  let tx: any;

  const orgId = 'org-1';
  const personId = 'person-1';
  const mockOrgUser = { id: 'ou-1', active: true };

  const record = (over: Record<string, unknown> = {}) => ({
    id: 'ana-1',
    organizationId: orgId,
    type: AnamnesisType.PELVIC_GENERAL,
    status: AnamnesisStatus.DRAFT,
    data: { sections: { chiefComplaint: 'Dor', currentHistory: 'Há 2 meses' } },
    ...over,
  });

  beforeEach(async () => {
    tx = {
      anamnesis: { update: jest.fn().mockResolvedValue({ id: 'ana-1' }) },
      anamnesisRevision: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      anamnesis: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      organizationUser: { findUnique: jest.fn() },
      patient: { findFirst: jest.fn() },
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AnamnesisService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AnamnesisService>(AnamnesisService);
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
      prisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
      prisma.anamnesis.create.mockResolvedValue({ id: 'ana-1' });
    });

    it('cria rascunho vazio com type, professionalId do orgUser e sections vazias', async () => {
      await service.create(orgId, personId, {
        patientId: 'patient-1',
        type: AnamnesisType.PELVIC_GENERAL,
      });

      expect(prisma.organizationUser.findUnique).toHaveBeenCalledWith({
        where: { organizationId_personId: { organizationId: orgId, personId } },
      });
      expect(prisma.anamnesis.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            patientId: 'patient-1',
            professionalId: 'ou-1',
            type: AnamnesisType.PELVIC_GENERAL,
            data: { sections: {} },
          }),
        }),
      );
    });

    it('persiste seções iniciais e a data da avaliação', async () => {
      await service.create(orgId, personId, {
        patientId: 'patient-1',
        type: AnamnesisType.PREGNANCY,
        assessmentDate: '2026-06-10',
        data: { sections: { obstetricHistory: 'G2P1' } },
      });

      expect(prisma.anamnesis.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assessmentDate: new Date('2026-06-10'),
            data: { sections: { obstetricHistory: 'G2P1' } },
          }),
        }),
      );
    });

    it('rejeita paciente de outra organização (escopo por organizationId)', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.create(orgId, personId, { patientId: 'patient-x', type: AnamnesisType.PELVIC_GENERAL }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'patient-x', organizationId: orgId, deletedAt: null },
        }),
      );
      expect(prisma.anamnesis.create).not.toHaveBeenCalled();
    });

    it('rejeita seção desconhecida', async () => {
      await expect(
        service.create(orgId, personId, {
          patientId: 'patient-1',
          type: AnamnesisType.PELVIC_GENERAL,
          data: { sections: { ultrasound: {} } },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.anamnesis.create).not.toHaveBeenCalled();
    });

    it('lança ForbiddenException quando orgUser não existe ou está inativo', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(null);
      await expect(
        service.create(orgId, personId, { patientId: 'patient-1', type: AnamnesisType.PELVIC_GENERAL }),
      ).rejects.toThrow(ForbiddenException);

      prisma.organizationUser.findUnique.mockResolvedValue({ ...mockOrgUser, active: false });
      await expect(
        service.create(orgId, personId, { patientId: 'patient-1', type: AnamnesisType.PELVIC_GENERAL }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.anamnesis.create).not.toHaveBeenCalled();
    });
  });

  describe('findByPatient', () => {
    it('filtra por organizationId e patientId', async () => {
      prisma.anamnesis.findMany.mockResolvedValue([]);

      await service.findByPatient(orgId, 'patient-1');

      expect(prisma.anamnesis.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId, patientId: 'patient-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findById', () => {
    it('retorna a anamnese quando pertence à organização', async () => {
      const ana = record();
      prisma.anamnesis.findFirst.mockResolvedValue(ana);

      const result = await service.findById(orgId, 'ana-1');

      expect(prisma.anamnesis.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ana-1', organizationId: orgId } }),
      );
      expect(result).toEqual(ana);
    });

    it('lança NotFoundException quando não encontrada ou de outra organização', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(null);
      await expect(service.findById(orgId, 'ana-outra')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
    });

    it('faz merge por seção preservando seções não enviadas (rascunho não gera revisão)', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(record());

      await service.update(orgId, personId, 'ana-1', {
        data: { sections: { chiefComplaint: 'Dor intensa' } },
      });

      expect(tx.anamnesis.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ana-1' },
          data: { data: { sections: { chiefComplaint: 'Dor intensa', currentHistory: 'Há 2 meses' } } },
        }),
      );
      expect(tx.anamnesisRevision.create).not.toHaveBeenCalled();
    });

    it('string vazia sobrescreve o texto anterior (limpar um campo)', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(record());

      await service.update(orgId, personId, 'ana-1', { data: { sections: { chiefComplaint: '' } } });

      expect(tx.anamnesis.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { data: { sections: { chiefComplaint: '', currentHistory: 'Há 2 meses' } } },
        }),
      );
    });

    it('finalizar define status COMPLETED e completedAt', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(record());

      await service.update(orgId, personId, 'ana-1', { status: AnamnesisStatus.COMPLETED });

      expect(tx.anamnesis.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AnamnesisStatus.COMPLETED,
            completedAt: expect.any(Date),
          }),
        }),
      );
      expect(tx.anamnesisRevision.create).not.toHaveBeenCalled();
    });

    it('editar anamnese finalizada grava revisão com o data anterior e o editor, antes do update', async () => {
      const before = { sections: { chiefComplaint: 'Dor', currentHistory: 'Há 2 meses' } };
      prisma.anamnesis.findFirst.mockResolvedValue(
        record({ status: AnamnesisStatus.COMPLETED, data: before }),
      );

      await service.update(orgId, personId, 'ana-1', {
        data: { sections: { chiefComplaint: 'Dor leve' } },
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.anamnesisRevision.create).toHaveBeenCalledWith({
        data: { organizationId: orgId, anamnesisId: 'ana-1', professionalId: 'ou-1', data: before },
      });
      const updateArg = tx.anamnesis.update.mock.calls[0][0];
      expect(updateArg.data).not.toHaveProperty('status');
      expect(tx.anamnesisRevision.create.mock.invocationCallOrder[0]).toBeLessThan(
        tx.anamnesis.update.mock.invocationCallOrder[0],
      );
    });

    it('alterar só a data da avaliação de uma anamnese finalizada também gera revisão', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(record({ status: AnamnesisStatus.COMPLETED }));

      await service.update(orgId, personId, 'ana-1', { assessmentDate: '2026-07-01' });

      expect(tx.anamnesisRevision.create).toHaveBeenCalledTimes(1);
      expect(tx.anamnesis.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { assessmentDate: new Date('2026-07-01') } }),
      );
    });

    it('PATCH sem mudança real numa anamnese finalizada não cria revisão nem atualiza', async () => {
      const existing = record({ status: AnamnesisStatus.COMPLETED });
      prisma.anamnesis.findFirst.mockResolvedValue(existing);

      const result = await service.update(orgId, personId, 'ana-1', {
        status: AnamnesisStatus.COMPLETED,
      });

      expect(result).toBe(existing);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('não permite reabrir anamnese finalizada como rascunho', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(record({ status: AnamnesisStatus.COMPLETED }));

      await expect(
        service.update(orgId, personId, 'ana-1', { status: AnamnesisStatus.DRAFT }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('registro legado (type null) é somente leitura → 409', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(
        record({ type: null, status: AnamnesisStatus.COMPLETED, data: { queixaPrincipal: {} } }),
      );

      await expect(
        service.update(orgId, personId, 'ana-1', { data: { sections: {} } }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejeita seção desconhecida sem abrir transação', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(record());

      await expect(
        service.update(orgId, personId, 'ana-1', { data: { sections: { foo: 'x' } } }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando a anamnese não existe na org (tenant isolation)', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, personId, 'ana-outra', { data: { sections: {} } }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.anamnesis.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ana-outra', organizationId: orgId } }),
      );
    });

    it('lança ForbiddenException quando o orgUser está inativo', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(record());
      prisma.organizationUser.findUnique.mockResolvedValue({ ...mockOrgUser, active: false });

      await expect(
        service.update(orgId, personId, 'ana-1', { data: { sections: {} } }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('exclui rascunho', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(record());
      prisma.anamnesis.delete.mockResolvedValue({ id: 'ana-1' });

      await service.remove(orgId, 'ana-1');

      expect(prisma.anamnesis.delete).toHaveBeenCalledWith({ where: { id: 'ana-1' } });
    });

    it('não exclui anamnese finalizada (nem legado backfilled) → 409', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(record({ status: AnamnesisStatus.COMPLETED }));

      await expect(service.remove(orgId, 'ana-1')).rejects.toThrow(ConflictException);
      expect(prisma.anamnesis.delete).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando não existe na org', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(null);
      await expect(service.remove(orgId, 'ana-x')).rejects.toThrow(NotFoundException);
      expect(prisma.anamnesis.delete).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- src/anamnesis/anamnesis.service`
Expected: FAIL (type errors / new behavior not implemented).

- [ ] **Step 3: Implement the DTOs**

Replace `backend/src/anamnesis/dto/create-anamnesis.dto.ts`:

```ts
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { AnamnesisType, SensitiveLegalBasis } from '@prisma/client';

export class CreateAnamnesisDto {
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId: string;

  @IsEnum(AnamnesisType, { message: 'Tipo de anamnese inválido' })
  type: AnamnesisType;

  @IsOptional()
  @IsDateString({}, { message: 'Data da avaliação inválida' })
  assessmentDate?: string;

  @IsOptional()
  @IsObject({ message: 'Dados da anamnese devem ser um objeto JSON' })
  data?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(SensitiveLegalBasis, { message: 'Base legal inválida' })
  legalBasis?: SensitiveLegalBasis;

  @IsOptional()
  @IsUUID('4', { message: 'ID do consentimento inválido' })
  consentId?: string;

  @IsOptional()
  @IsString()
  legalBasisNotes?: string;
}
```

Replace `backend/src/anamnesis/dto/update-anamnesis.dto.ts`:

```ts
import { IsDateString, IsEnum, IsObject, IsOptional } from 'class-validator';
import { AnamnesisStatus } from '@prisma/client';

export class UpdateAnamnesisDto {
  @IsOptional()
  @IsObject({ message: 'Dados da anamnese devem ser um objeto JSON' })
  data?: Record<string, unknown>;

  @IsOptional()
  @IsDateString({}, { message: 'Data da avaliação inválida' })
  assessmentDate?: string;

  @IsOptional()
  @IsEnum(AnamnesisStatus, { message: 'Status inválido' })
  status?: AnamnesisStatus;
}
```

- [ ] **Step 4: Implement the service**

Replace `backend/src/anamnesis/anamnesis.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AnamnesisStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnamnesisDto } from './dto/create-anamnesis.dto';
import { UpdateAnamnesisDto } from './dto/update-anamnesis.dto';
import { extractSections, normalizeAnamnesisData } from './anamnesis-sections';

const INCLUDE = {
  patient: { select: { id: true, name: true } },
  professional: { include: { person: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class AnamnesisService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, personId: string, dto: CreateAnamnesisDto) {
    const orgUser = await this.resolveOrgUser(organizationId, personId);

    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado');
    }

    const data = normalizeAnamnesisData(dto.type, dto.data);

    return this.prisma.anamnesis.create({
      data: {
        organizationId,
        patientId: dto.patientId,
        professionalId: orgUser.id,
        type: dto.type,
        assessmentDate: dto.assessmentDate ? new Date(dto.assessmentDate) : undefined,
        data: data as Prisma.InputJsonValue,
        ...(dto.legalBasis && { legalBasis: dto.legalBasis }),
        ...(dto.consentId && { consentId: dto.consentId }),
        ...(dto.legalBasisNotes && { legalBasisNotes: dto.legalBasisNotes }),
      },
      include: INCLUDE,
    });
  }

  async findByPatient(organizationId: string, patientId: string) {
    return this.prisma.anamnesis.findMany({
      where: { organizationId, patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        professional: { include: { person: { select: { id: true, name: true } } } },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    const anamnesis = await this.prisma.anamnesis.findFirst({
      where: { id, organizationId },
      include: INCLUDE,
    });

    if (!anamnesis) {
      throw new NotFoundException('Anamnese não encontrada');
    }

    return anamnesis;
  }

  async update(
    organizationId: string,
    personId: string,
    id: string,
    dto: UpdateAnamnesisDto,
  ) {
    const existing = await this.findById(organizationId, id);

    if (existing.type === null) {
      throw new ConflictException('Anamnese em formato anterior é somente leitura');
    }
    if (
      dto.status === AnamnesisStatus.DRAFT &&
      existing.status === AnamnesisStatus.COMPLETED
    ) {
      throw new BadRequestException('Anamnese finalizada não pode voltar a rascunho');
    }

    const orgUser = await this.resolveOrgUser(organizationId, personId);

    let nextData: Prisma.InputJsonValue | undefined;
    if (dto.data !== undefined) {
      const incoming = normalizeAnamnesisData(existing.type, dto.data);
      nextData = {
        sections: { ...extractSections(existing.data), ...incoming.sections },
      } as Prisma.InputJsonValue;
    }

    const finalizing =
      dto.status === AnamnesisStatus.COMPLETED && existing.status === AnamnesisStatus.DRAFT;
    const editingCompleted =
      existing.status === AnamnesisStatus.COMPLETED &&
      (dto.data !== undefined || dto.assessmentDate !== undefined);

    if (nextData === undefined && dto.assessmentDate === undefined && !finalizing) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      if (editingCompleted) {
        await tx.anamnesisRevision.create({
          data: {
            organizationId,
            anamnesisId: id,
            professionalId: orgUser.id,
            data: (existing.data ?? {}) as Prisma.InputJsonValue,
          },
        });
      }

      return tx.anamnesis.update({
        where: { id },
        data: {
          ...(nextData !== undefined && { data: nextData }),
          ...(dto.assessmentDate !== undefined && {
            assessmentDate: new Date(dto.assessmentDate),
          }),
          ...(finalizing && {
            status: AnamnesisStatus.COMPLETED,
            completedAt: new Date(),
          }),
        },
        include: INCLUDE,
      });
    });
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.findById(organizationId, id);

    if (existing.status === AnamnesisStatus.COMPLETED) {
      throw new ConflictException(
        'Anamnese finalizada não pode ser excluída. Edite o registro.',
      );
    }

    return this.prisma.anamnesis.delete({ where: { id } });
  }

  private async resolveOrgUser(organizationId: string, personId: string) {
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: { organizationId_personId: { organizationId, personId } },
    });

    if (!orgUser || !orgUser.active) {
      throw new ForbiddenException('Vínculo com a clínica não encontrado');
    }

    return orgUser;
  }
}
```

- [ ] **Step 5: Update the controller**

In `backend/src/anamnesis/anamnesis.controller.ts`, replace the `update` handler:

```ts
  @Patch(':id')
  update(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAnamnesisDto,
  ) {
    return this.anamnesisService.update(orgId, user.sub, id, dto);
  }
```

- [ ] **Step 6: Run the tests and the type check**

Run (from `backend/`): `bun run test -- src/anamnesis src/patient`
Expected: PASS.

Run: `bunx tsc --noEmit -p tsconfig.json`
Expected: no errors. (If `tsconfig.json` is not the right project file, use `bun run build`.)

Run coverage check for the touched module: `bun run test:cov -- src/anamnesis`
Expected: `anamnesis.service.ts` ≥ 80% statements/functions/lines, ≥ 75% branches.

- [ ] **Step 7: Commit**

```bash
git add backend/src/anamnesis
git commit -m "feat(anamnese): tipos, rascunho/finalizada e revisões no backend

Merge por seção, snapshot em anamnesis_revisions ao editar anamnese finalizada,
legado somente leitura (409), exclusão só de rascunho e checagem de paciente
por organização na criação.

Part of SOU-66

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend types, API client, marital-status helper, patient form + profile header

**Files:**
- Create: `frontend/src/lib/marital-status.ts`, `frontend/src/lib/marital-status.test.ts`, `frontend/src/components/patients/PatientFormDialog.occupation.test.tsx`
- Modify: `frontend/src/types/clinic.ts`, `frontend/src/lib/api.ts`, `frontend/src/components/patients/PatientFormDialog.tsx`, `frontend/src/pages/PatientProfile.tsx` (header meta only)

**Interfaces:**
- Produces:
  - Types in `types/clinic.ts`: `AnamnesisType`, `AnamnesisStatus`, `AnamnesisContent = { sections: Record<string, unknown> }`; `Anamnesis` gains `type: AnamnesisType | null`, `status: AnamnesisStatus`, `assessmentDate: string | null`, `completedAt: string | null`; `Patient`/`CreatePatientData` gain `occupation?: string`, `maritalStatus?: string`.
  - `anamnesisApi.create({ patientId, type, assessmentDate?, data? })`, `anamnesisApi.update(id, { data?, assessmentDate?, status? })`.
  - `MARITAL_STATUS_OPTIONS: { value: string; label: string }[]`, `maritalStatusLabel(v?: string | null): string | null`, `describeOccupationAndMaritalStatus(p): string`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/marital-status.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  MARITAL_STATUS_OPTIONS,
  describeOccupationAndMaritalStatus,
  maritalStatusLabel,
} from './marital-status';

describe('marital-status', () => {
  it('expõe as 6 opções esperadas', () => {
    expect(MARITAL_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      'SINGLE', 'MARRIED', 'STABLE_UNION', 'DIVORCED', 'WIDOWED', 'OTHER',
    ]);
  });

  it('maritalStatusLabel traduz e devolve null para vazio/desconhecido', () => {
    expect(maritalStatusLabel('STABLE_UNION')).toBe('União estável');
    expect(maritalStatusLabel('???')).toBeNull();
    expect(maritalStatusLabel(undefined)).toBeNull();
  });

  it('describeOccupationAndMaritalStatus junta os campos presentes', () => {
    expect(describeOccupationAndMaritalStatus({ occupation: 'Professora', maritalStatus: 'MARRIED' })).toBe(
      'Professora · Casado(a)',
    );
    expect(describeOccupationAndMaritalStatus({ occupation: 'Professora' })).toBe('Professora');
    expect(describeOccupationAndMaritalStatus({ maritalStatus: 'SINGLE' })).toBe('Solteiro(a)');
    expect(describeOccupationAndMaritalStatus({})).toBe('');
  });
});
```

Create `frontend/src/components/patients/PatientFormDialog.occupation.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, patientsApi: { create: vi.fn(), update: vi.fn() } };
});
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  AnalyticsEvent: { PatientCreated: 'patient_created' },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { patientsApi } from '@/lib/api';
import { PatientFormDialog } from './PatientFormDialog';

describe('PatientFormDialog — profissão', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patientsApi.create).mockResolvedValue({ id: 'p1', name: 'Maria' } as never);
  });

  it('envia a profissão digitada no cadastro completo', async () => {
    render(<PatientFormDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Maria Silva' } });
    fireEvent.change(screen.getByLabelText('Profissão'), { target: { value: 'Professora' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() =>
      expect(patientsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Maria Silva', occupation: 'Professora' }),
      ),
    );
  });

  it('não mostra Profissão no cadastro rápido', () => {
    render(<PatientFormDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} mode="quick" />);
    expect(screen.queryByLabelText('Profissão')).not.toBeInTheDocument();
  });

  it('preenche a profissão ao editar', () => {
    render(
      <PatientFormDialog
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        patient={{ id: 'p1', name: 'Maria', occupation: 'Médica', status: 'ACTIVE' } as never}
      />,
    );
    expect(screen.getByLabelText('Profissão')).toHaveValue('Médica');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `frontend/`): `bunx vitest run src/lib/marital-status.test.ts src/components/patients/PatientFormDialog.occupation.test.tsx`
Expected: FAIL (module not found / label "Profissão" not found).

- [ ] **Step 3: Implement the helper**

Create `frontend/src/lib/marital-status.ts`:

```ts
export const MARITAL_STATUS_OPTIONS = [
  { value: 'SINGLE', label: 'Solteiro(a)' },
  { value: 'MARRIED', label: 'Casado(a)' },
  { value: 'STABLE_UNION', label: 'União estável' },
  { value: 'DIVORCED', label: 'Divorciado(a)' },
  { value: 'WIDOWED', label: 'Viúvo(a)' },
  { value: 'OTHER', label: 'Outro' },
] as const;

export function maritalStatusLabel(value?: string | null): string | null {
  return MARITAL_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? null;
}

export function describeOccupationAndMaritalStatus(p: {
  occupation?: string | null;
  maritalStatus?: string | null;
}): string {
  return [p.occupation?.trim() || null, maritalStatusLabel(p.maritalStatus)]
    .filter(Boolean)
    .join(' · ');
}
```

- [ ] **Step 4: Update types and API client**

In `frontend/src/types/clinic.ts`:

1. In `interface Patient` and `interface CreatePatientData`, after `gender?: string;` add:
```ts
  occupation?: string;
  maritalStatus?: string;
```
2. Replace `interface Anamnesis` with:
```ts
export type AnamnesisType = 'PELVIC_GENERAL' | 'PREGNANCY';
export type AnamnesisStatus = 'DRAFT' | 'COMPLETED';

export interface AnamnesisContent {
  sections: Record<string, unknown>;
}

export interface Anamnesis {
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  /** null = legacy record (4-field format), read-only */
  type: AnamnesisType | null;
  status: AnamnesisStatus;
  assessmentDate: string | null;
  completedAt: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  patient?: { id: string; name: string };
  professional?: { id: string; person: { name: string } };
}
```

In `frontend/src/lib/api.ts`, add `AnamnesisContent, AnamnesisStatus, AnamnesisType` to the type import from `@/types/clinic` (next to `Anamnesis,`) and replace `anamnesisApi`:

```ts
export const anamnesisApi = {
  list: (patientId: string) => api.get<Anamnesis[]>(`/anamneses?patientId=${patientId}`),
  getById: (id: string) => api.get<Anamnesis>(`/anamneses/${id}`),
  create: (data: {
    patientId: string;
    type: AnamnesisType;
    assessmentDate?: string;
    data?: AnamnesisContent;
  }) => api.post<Anamnesis>('/anamneses', data),
  update: (
    id: string,
    data: { data?: AnamnesisContent; assessmentDate?: string; status?: AnamnesisStatus },
  ) => api.patch<Anamnesis>(`/anamneses/${id}`, data),
  remove: (id: string) => api.delete<void>(`/anamneses/${id}`),
};
```

- [ ] **Step 5: Update `PatientFormDialog.tsx`**

1. Add `import { MARITAL_STATUS_OPTIONS } from '@/lib/marital-status';`.
2. In `patientSchema` add after `gender`: `occupation: z.string().optional(), maritalStatus: z.string().optional(),`.
3. In `defaultValues` add `occupation: '', maritalStatus: '',` after `gender: '',`; in `form.reset({...})` add after the `gender` line:
```ts
        occupation: patient?.occupation ?? '',
        maritalStatus: patient?.maritalStatus ?? '',
```
4. Directly after the `{/* Gênero — só em full */}` block (after its closing `)}`), add:

```tsx
          {/* Profissão + Estado civil — só em full */}
          {mode !== 'quick' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="occupation">Profissão</Label>
                <Input id="occupation" maxLength={120} {...form.register('occupation')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maritalStatus">Estado civil</Label>
                <Select
                  value={form.watch('maritalStatus') || ''}
                  onValueChange={(v) => form.setValue('maritalStatus', v)}
                >
                  <SelectTrigger id="maritalStatus">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {MARITAL_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
```

- [ ] **Step 6: Show occupation / marital status in the profile header**

In `frontend/src/pages/PatientProfile.tsx`:
1. Add `Briefcase` to the `lucide-react` import list (e.g. after `Pencil,`).
2. Add `import { describeOccupationAndMaritalStatus } from '@/lib/marital-status';`.
3. Inside the meta row, directly after the `{patient.cpf && (...)}` block (before the closing `</div>` of `flex items-center gap-4 mt-2 flex-wrap`), add:

```tsx
            {describeOccupationAndMaritalStatus(patient) && (
              <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <Briefcase className="w-3.5 h-3.5 shrink-0" />
                <span>{describeOccupationAndMaritalStatus(patient)}</span>
              </div>
            )}
```

- [ ] **Step 7: Run tests to verify they pass**

Run (from `frontend/`): `bunx vitest run src/lib/marital-status.test.ts src/components/patients`
Expected: PASS (including any pre-existing PatientFormDialog tests).

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(paciente): profissão e estado civil no cadastro e tipos da anamnese (frontend)

Part of SOU-66

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Gestational-age pure functions

**Files:**
- Create: `frontend/src/lib/gestational-age.ts`, `frontend/src/lib/gestational-age.test.ts`

**Interfaces:**
- Produces (all dates `YYYY-MM-DD`; every function returns `null` for invalid input instead of throwing):
  - `interface GestationalAge { weeks: number; days: number }`
  - `dppFromDum(dum?: string): string | null` — DUM + 280 d
  - `gaFromDum(dum?: string, reference?: string): GestationalAge | null`
  - `gaFromDpp(dpp?: string, reference?: string): GestationalAge | null`
  - `dppFromUltrasound(examDate?: string, gaAtExam?: GestationalAge): string | null`
  - `currentGestationalAge(input: { dpp?: string; manual?: GestationalAge; assessmentDate?: string; today: string }): GestationalAge | null`
  - `formatGestationalAge(ga): string` → `"23 semanas + 4 dias"`; `formatGestationalAgeShort(ga): string` → `"23s + 4d"`
  - `formatIsoDate(iso?: string): string` → `"18/01/2027"` (`''` if invalid)
  - `todayIso(now?: Date): string` — local calendar date

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/gestational-age.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  currentGestationalAge,
  dppFromDum,
  dppFromUltrasound,
  formatGestationalAge,
  formatGestationalAgeShort,
  formatIsoDate,
  gaFromDpp,
  gaFromDum,
  todayIso,
} from './gestational-age';

describe('dppFromDum', () => {
  it('soma 280 dias (regra de Naegele)', () => {
    expect(dppFromDum('2026-01-01')).toBe('2026-10-08');
  });
  it('atravessa ano bissexto', () => {
    expect(dppFromDum('2027-06-01')).toBe('2028-03-07');
  });
  it.each([undefined, '', '2026-02-30', '01/01/2026', 'abc'])('devolve null para %j', (v) => {
    expect(dppFromDum(v as string | undefined)).toBeNull();
  });
});

describe('gaFromDum', () => {
  it('calcula semanas + dias', () => {
    expect(gaFromDum('2026-01-01', '2026-06-10')).toEqual({ weeks: 22, days: 6 });
  });
  it('mesmo dia = 0s+0d', () => {
    expect(gaFromDum('2026-01-01', '2026-01-01')).toEqual({ weeks: 0, days: 0 });
  });
  it('referência anterior à DUM → null', () => {
    expect(gaFromDum('2026-06-10', '2026-01-01')).toBeNull();
  });
  it('mais de 45 semanas → null', () => {
    expect(gaFromDum('2026-01-01', '2026-12-31')).toBeNull();
  });
  it('data impossível → null', () => {
    expect(gaFromDum('2026-02-30', '2026-06-10')).toBeNull();
  });
});

describe('gaFromDpp', () => {
  it('é consistente com gaFromDum para a mesma gestação', () => {
    expect(gaFromDpp('2026-10-08', '2026-06-10')).toEqual({ weeks: 22, days: 6 });
  });
  it('na própria DPP = 40s+0d', () => {
    expect(gaFromDpp('2026-10-08', '2026-10-08')).toEqual({ weeks: 40, days: 0 });
  });
  it('referência muito anterior (GA negativa) → null', () => {
    expect(gaFromDpp('2026-10-08', '2025-01-01')).toBeNull();
  });
});

describe('dppFromUltrasound', () => {
  it('data do exame + (280 − IG no exame)', () => {
    expect(dppFromUltrasound('2026-06-10', { weeks: 22, days: 6 })).toBe('2026-10-08');
  });
  it.each([
    [{ weeks: 22, days: 7 }],
    [{ weeks: -1, days: 0 }],
    [{ weeks: 22.5, days: 0 }],
    [{ weeks: 60, days: 0 }],
  ])('IG inválida %j → null', (ga) => {
    expect(dppFromUltrasound('2026-06-10', ga)).toBeNull();
  });
  it('data do exame inválida ou ausente → null', () => {
    expect(dppFromUltrasound('2026-13-01', { weeks: 20, days: 0 })).toBeNull();
    expect(dppFromUltrasound(undefined, { weeks: 20, days: 0 })).toBeNull();
    expect(dppFromUltrasound('2026-06-10', undefined)).toBeNull();
  });
});

describe('currentGestationalAge', () => {
  it('a partir da DPP, recalculada para hoje', () => {
    expect(currentGestationalAge({ dpp: '2026-10-08', today: '2026-06-10' })).toEqual({
      weeks: 22,
      days: 6,
    });
  });
  it('IG manual avança pelos dias decorridos desde a avaliação', () => {
    expect(
      currentGestationalAge({
        manual: { weeks: 24, days: 0 },
        assessmentDate: '2026-06-01',
        today: '2026-06-10',
      }),
    ).toEqual({ weeks: 25, days: 2 });
  });
  it('IG manual tem prioridade sobre a DPP', () => {
    expect(
      currentGestationalAge({
        dpp: '2026-10-08',
        manual: { weeks: 30, days: 0 },
        assessmentDate: '2026-06-10',
        today: '2026-06-10',
      }),
    ).toEqual({ weeks: 30, days: 0 });
  });
  it('sem DPP nem IG manual → null', () => {
    expect(currentGestationalAge({ today: '2026-06-10' })).toBeNull();
  });
  it('IG manual inválida → null', () => {
    expect(
      currentGestationalAge({ manual: { weeks: 10, days: 9 }, assessmentDate: '2026-06-01', today: '2026-06-10' }),
    ).toBeNull();
  });
});

describe('formatação', () => {
  it('formatGestationalAge', () => {
    expect(formatGestationalAge({ weeks: 23, days: 4 })).toBe('23 semanas + 4 dias');
    expect(formatGestationalAge({ weeks: 1, days: 1 })).toBe('1 semana + 1 dia');
  });
  it('formatGestationalAgeShort', () => {
    expect(formatGestationalAgeShort({ weeks: 24, days: 3 })).toBe('24s + 3d');
  });
  it('formatIsoDate', () => {
    expect(formatIsoDate('2027-01-18')).toBe('18/01/2027');
    expect(formatIsoDate('xx')).toBe('');
    expect(formatIsoDate(undefined)).toBe('');
  });
  it('todayIso usa a data local, não UTC', () => {
    expect(todayIso(new Date(2026, 5, 10, 23, 30))).toBe('2026-06-10');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/lib/gestational-age.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `frontend/src/lib/gestational-age.ts`:

```ts
export interface GestationalAge {
  weeks: number;
  days: number;
}

const DAY_MS = 86_400_000;
const GESTATION_DAYS = 280;
const MAX_TOTAL_DAYS = 45 * 7;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIso(iso?: string | null): number | null {
  if (!iso || !ISO_DATE.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  return new Date(ms).toISOString().slice(0, 10) === iso ? ms : null;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function isValidGa(ga?: GestationalAge | null): ga is GestationalAge {
  return (
    !!ga &&
    Number.isInteger(ga.weeks) &&
    Number.isInteger(ga.days) &&
    ga.weeks >= 0 &&
    ga.days >= 0 &&
    ga.days <= 6 &&
    ga.weeks * 7 + ga.days <= MAX_TOTAL_DAYS
  );
}

const totalDays = (ga: GestationalAge) => ga.weeks * 7 + ga.days;

function toGa(total: number): GestationalAge | null {
  if (!Number.isInteger(total) || total < 0 || total > MAX_TOTAL_DAYS) return null;
  return { weeks: Math.floor(total / 7), days: total % 7 };
}

export function dppFromDum(dum?: string): string | null {
  const t = parseIso(dum);
  return t === null ? null : toIso(t + GESTATION_DAYS * DAY_MS);
}

export function gaFromDum(dum?: string, reference?: string): GestationalAge | null {
  const d = parseIso(dum);
  const r = parseIso(reference);
  if (d === null || r === null) return null;
  return toGa((r - d) / DAY_MS);
}

export function gaFromDpp(dpp?: string, reference?: string): GestationalAge | null {
  const d = parseIso(dpp);
  const r = parseIso(reference);
  if (d === null || r === null) return null;
  return toGa(GESTATION_DAYS - (d - r) / DAY_MS);
}

export function dppFromUltrasound(examDate?: string, gaAtExam?: GestationalAge): string | null {
  const e = parseIso(examDate);
  if (e === null || !isValidGa(gaAtExam)) return null;
  return toIso(e + (GESTATION_DAYS - totalDays(gaAtExam)) * DAY_MS);
}

export function currentGestationalAge(input: {
  dpp?: string;
  manual?: GestationalAge;
  assessmentDate?: string;
  today: string;
}): GestationalAge | null {
  const { dpp, manual, assessmentDate, today } = input;
  if (manual) {
    if (!isValidGa(manual)) return null;
    const from = parseIso(assessmentDate ?? today);
    const to = parseIso(today);
    if (from === null || to === null) return toGa(totalDays(manual));
    return toGa(totalDays(manual) + (to - from) / DAY_MS);
  }
  return dpp ? gaFromDpp(dpp, today) : null;
}

export function formatGestationalAge(ga: GestationalAge): string {
  const w = `${ga.weeks} ${ga.weeks === 1 ? 'semana' : 'semanas'}`;
  const d = `${ga.days} ${ga.days === 1 ? 'dia' : 'dias'}`;
  return `${w} + ${d}`;
}

export function formatGestationalAgeShort(ga: GestationalAge): string {
  return `${ga.weeks}s + ${ga.days}d`;
}

export function formatIsoDate(iso?: string): string {
  if (parseIso(iso) === null) return '';
  const [y, m, d] = (iso as string).split('-');
  return `${d}/${m}/${y}`;
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/lib/gestational-age.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/gestational-age.ts frontend/src/lib/gestational-age.test.ts
git commit -m "feat(anamnese): funções puras de idade gestacional e DPP

Part of SOU-66

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Form definitions (titles, placeholders, guidance) + obstetric recompute logic

**Files:**
- Create: `frontend/src/components/anamnesis/anamnesis-forms.ts` (+ `.test.ts`), `frontend/src/components/anamnesis/gestational-data.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `AnamnesisType` (Task 5), gestational-age functions (Task 6).
- Produces:
  - `anamnesis-forms.ts`: `SectionDef`, `ANAMNESIS_FORMS: Record<AnamnesisType, SectionDef[]>`, `ANAMNESIS_TYPE_LABELS: Record<AnamnesisType, string>`, `getSections(data: unknown): Record<string, unknown>`, `asRecord(v: unknown): Record<string, unknown>`.
  - `gestational-data.ts`: types `GaSource`, `ObstetricRisk`, `PregnancyType`, `Conception`, `FetalPresentation`, `GestationalData`, `UltrasoundData`; label maps `GA_SOURCE_LABELS`, `OBSTETRIC_RISK_LABELS`, `PREGNANCY_TYPE_LABELS`, `CONCEPTION_LABELS`, `FETAL_PRESENTATION_LABELS`; `asGestationalData(v: unknown): GestationalData`, `asUltrasound(v: unknown): UltrasoundData`; `interface RecomputeContext { assessmentDate: string; ultrasound?: UltrasoundData }`; `calculatedDpp(data, ctx): string | null`; `recomputeGestational(data, ctx): GestationalData`; `changeGaSource(data, source, ctx): GestationalData`; `editDpp(data, dpp, ctx): GestationalData`; `applyCalculatedDpp(data, ctx): GestationalData`; `setManualGa(data, weeks, days): GestationalData`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/anamnesis/anamnesis-forms.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ANAMNESIS_FORMS, ANAMNESIS_TYPE_LABELS, asRecord, getSections } from './anamnesis-forms';

describe('ANAMNESIS_FORMS', () => {
  it('ids da ficha pélvica geral (mesma lista do backend)', () => {
    expect(ANAMNESIS_FORMS.PELVIC_GENERAL.map((s) => s.id)).toEqual([
      'identification', 'chiefComplaint', 'currentHistory', 'healthHistory', 'urinarySymptoms',
      'bowelSymptoms', 'sexualSymptoms', 'gynecologicalObstetricHistory', 'behavioralHabits',
      'treatmentExpectations', 'additionalNotes',
    ]);
  });

  it('ids da ficha gestacional (mesma lista do backend)', () => {
    expect(ANAMNESIS_FORMS.PREGNANCY.map((s) => s.id)).toEqual([
      'gestationalData', 'obstetricHistory', 'currentPregnancyHistory', 'ultrasound', 'otherExams',
      'healthHistory', 'musculoskeletalPelvicSymptoms', 'urinarySymptoms', 'bowelSymptoms',
      'sexualSymptoms', 'behavioralHabits', 'birthPlanning', 'physiotherapyGoals', 'additionalNotes',
    ]);
  });

  it.each(['PELVIC_GENERAL', 'PREGNANCY'] as const)('%s: ids únicos e toda narrativa tem placeholder', (type) => {
    const ids = ANAMNESIS_FORMS[type].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ANAMNESIS_FORMS[type]) {
      if (s.kind === 'narrative') expect(s.placeholder, s.id).toBeTruthy();
      else expect(s.component, s.id).toBeTruthy();
    }
  });

  it('orientação começa com "Investigar:" (exceto outros exames) e observações não têm orientação', () => {
    for (const type of ['PELVIC_GENERAL', 'PREGNANCY'] as const) {
      for (const s of ANAMNESIS_FORMS[type]) {
        if (s.id === 'additionalNotes') expect(s.guidance).toBeUndefined();
        else if (s.id === 'otherExams') expect(s.guidance).toMatch(/^Registrar exames/);
        else if (s.kind === 'narrative') expect(s.guidance, s.id).toMatch(/^Investigar: /);
      }
    }
  });

  it('usa os textos literais da SOU-66', () => {
    const chief = ANAMNESIS_FORMS.PELVIC_GENERAL.find((s) => s.id === 'chiefComplaint')!;
    expect(chief.title).toBe('Queixa principal');
    expect(chief.placeholder).toBe('Descreva a principal queixa relatada pela paciente...');
    const birth = ANAMNESIS_FORMS.PREGNANCY.find((s) => s.id === 'birthPlanning')!;
    expect(birth.title).toBe('Planejamento e expectativas para o parto');
  });

  it('rótulos dos tipos', () => {
    expect(ANAMNESIS_TYPE_LABELS.PELVIC_GENERAL).toBe('Anamnese Pélvica Geral');
    expect(ANAMNESIS_TYPE_LABELS.PREGNANCY).toBe('Anamnese Gestacional');
  });
});

describe('getSections / asRecord', () => {
  it('getSections lê data.sections e tolera formatos inesperados', () => {
    expect(getSections({ sections: { a: 'b' } })).toEqual({ a: 'b' });
    expect(getSections(null)).toEqual({});
    expect(getSections({ queixaPrincipal: {} })).toEqual({});
    expect(getSections({ sections: [] })).toEqual({});
  });
  it('asRecord', () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
    expect(asRecord('x')).toEqual({});
    expect(asRecord([1])).toEqual({});
  });
});
```

Create `frontend/src/components/anamnesis/gestational-data.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  applyCalculatedDpp,
  asGestationalData,
  asUltrasound,
  calculatedDpp,
  changeGaSource,
  editDpp,
  recomputeGestational,
  setManualGa,
} from './gestational-data';

const ctx = { assessmentDate: '2026-06-10' };

describe('recomputeGestational — fonte DUM (padrão)', () => {
  it('DUM informada → DPP = DUM + 280 dias e IG na data da avaliação', () => {
    const out = recomputeGestational({ dum: '2026-01-01' }, ctx);
    expect(out.dpp).toBe('2026-10-08');
    expect(out.dppSource).toBe('DUM');
    expect(out.gestationalAge).toEqual({ weeks: 22, days: 6, manualOverride: false });
  });

  it('DUM apagada remove DPP e IG calculadas', () => {
    const first = recomputeGestational({ dum: '2026-01-01' }, ctx);
    const out = recomputeGestational({ ...first, dum: '' }, ctx);
    expect(out.dpp).toBeUndefined();
    expect(out.dppSource).toBeUndefined();
    expect(out.gestationalAge).toBeUndefined();
  });

  it('DUM impossível não produz DPP nem IG', () => {
    const out = recomputeGestational({ dum: '2026-02-30' }, ctx);
    expect(out.dpp).toBeUndefined();
    expect(out.gestationalAge).toBeUndefined();
  });

  it('DPP digitada à mão não é sobrescrita ao mudar a DUM', () => {
    const edited = editDpp({ dum: '2026-01-01' }, '2026-10-20', ctx);
    expect(edited.dppSource).toBe('MANUAL');
    const out = recomputeGestational({ ...edited, dum: '2026-01-05' }, ctx);
    expect(out.dpp).toBe('2026-10-20');
    expect(out.dppSource).toBe('MANUAL');
  });

  it('applyCalculatedDpp descarta a DPP manual e volta a calcular', () => {
    const edited = editDpp({ dum: '2026-01-01' }, '2026-10-20', ctx);
    const out = applyCalculatedDpp(edited, ctx);
    expect(out.dpp).toBe('2026-10-08');
    expect(out.dppSource).toBe('DUM');
  });

  it('é idempotente', () => {
    const once = recomputeGestational({ dum: '2026-01-01' }, ctx);
    expect(recomputeGestational(once, ctx)).toEqual(once);
  });
});

describe('recomputeGestational — fonte ultrassonografia', () => {
  const us = { date: '2026-06-10', gaAtExam: { weeks: 22, days: 6 } };

  it('DPP vem do exame e a IG é derivada dela', () => {
    const data = changeGaSource({ dum: '2026-01-15' }, 'ULTRASSONOGRAFIA', { ...ctx, ultrasound: us });
    expect(data.gaSource).toBe('ULTRASSONOGRAFIA');
    expect(data.dpp).toBe('2026-10-08');
    expect(data.dppSource).toBe('ULTRASSONOGRAFIA');
    expect(data.gestationalAge).toEqual({ weeks: 22, days: 6, manualOverride: false });
  });

  it('sem dados de ultrassonografia não inventa DPP', () => {
    const data = changeGaSource({ dum: '2026-01-15' }, 'ULTRASSONOGRAFIA', ctx);
    expect(data.dpp).toBeUndefined();
    expect(data.gestationalAge).toBeUndefined();
  });

  it('calculatedDpp reflete a fonte ativa', () => {
    expect(calculatedDpp({ gaSource: 'ULTRASSONOGRAFIA' }, { ...ctx, ultrasound: us })).toBe('2026-10-08');
    expect(calculatedDpp({ dum: '2026-01-01' }, ctx)).toBe('2026-10-08');
    expect(calculatedDpp({ gaSource: 'MANUAL', dum: '2026-01-01' }, ctx)).toBeNull();
  });
});

describe('fonte manual', () => {
  it('setManualGa marca override e recompute não sobrescreve', () => {
    const manual = setManualGa({ dum: '2026-01-01' }, 30, 2);
    expect(manual.gaSource).toBe('MANUAL');
    expect(manual.gestationalAge).toEqual({ weeks: 30, days: 2, manualOverride: true });
    expect(recomputeGestational(manual, ctx)).toEqual(manual);
  });

  it('trocar para MANUAL preserva o último valor calculado como ponto de partida', () => {
    const calc = recomputeGestational({ dum: '2026-01-01' }, ctx);
    const out = changeGaSource(calc, 'MANUAL', ctx);
    expect(out.gaSource).toBe('MANUAL');
    expect(out.gestationalAge).toEqual({ weeks: 22, days: 6, manualOverride: true });
  });

  it('voltar de MANUAL para DUM recalcula (escolha explícita da profissional)', () => {
    const manual = setManualGa({ dum: '2026-01-01' }, 30, 2);
    const out = changeGaSource(manual, 'DUM', ctx);
    expect(out.gestationalAge).toEqual({ weeks: 22, days: 6, manualOverride: false });
  });
});

describe('asGestationalData / asUltrasound', () => {
  it('toleram valores não-objeto', () => {
    expect(asGestationalData(undefined)).toEqual({});
    expect(asGestationalData('x')).toEqual({});
    expect(asUltrasound(null)).toEqual({});
    expect(asUltrasound({ date: '2026-06-10' })).toEqual({ date: '2026-06-10' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/components/anamnesis/anamnesis-forms.test.ts src/components/anamnesis/gestational-data.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `anamnesis-forms.ts`**

Create `frontend/src/components/anamnesis/anamnesis-forms.ts`. Texts are copied literally from SOU-66 §4 and §5:

```ts
import type { AnamnesisType } from '@/types/clinic';

export interface SectionDef {
  id: string;
  title: string;
  kind: 'narrative' | 'structured';
  placeholder?: string;
  /** Full guidance line, e.g. "Investigar: ...". Display-only — never stored. */
  guidance?: string;
  component?: 'identification' | 'gestationalData' | 'ultrasound';
}

export const ANAMNESIS_TYPE_LABELS: Record<AnamnesisType, string> = {
  PELVIC_GENERAL: 'Anamnese Pélvica Geral',
  PREGNANCY: 'Anamnese Gestacional',
};

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function getSections(data: unknown): Record<string, unknown> {
  return asRecord(asRecord(data).sections);
}

const narrative = (
  id: string,
  title: string,
  placeholder: string,
  guidance?: string,
): SectionDef => ({ id, title, kind: 'narrative', placeholder, guidance });

export const ANAMNESIS_FORMS: Record<AnamnesisType, SectionDef[]> = {
  PELVIC_GENERAL: [
    { id: 'identification', title: 'Identificação', kind: 'structured', component: 'identification' },
    narrative(
      'chiefComplaint',
      'Queixa principal',
      'Descreva a principal queixa relatada pela paciente...',
      'Investigar: motivo da consulta, sintomas predominantes, principal desconforto ou limitação e impacto percebido pela paciente.',
    ),
    narrative(
      'currentHistory',
      'História da queixa atual',
      'Descreva a história clínica da paciente...',
      'Investigar: início e evolução dos sintomas, frequência, intensidade, fatores de melhora e piora, tratamentos anteriores e impacto na qualidade de vida.',
    ),
    narrative(
      'healthHistory',
      'Histórico de saúde',
      'Descreva os antecedentes e informações relevantes de saúde...',
      'Investigar: condições de saúde, comorbidades, cirurgias, medicamentos em uso, alergias, tratamentos prévios e exames relevantes.',
    ),
    narrative(
      'urinarySymptoms',
      'Sintomas urinários',
      'Descreva os hábitos e sintomas urinários...',
      'Investigar: frequência urinária diurna e noturna, urgência, perdas urinárias e situações associadas, jato urinário, necessidade de esforço, dor, sensação de esvaziamento incompleto, uso de absorventes/protetores e histórico de infecções urinárias.',
    ),
    narrative(
      'bowelSymptoms',
      'Sintomas intestinais',
      'Descreva os hábitos e sintomas intestinais...',
      'Investigar: frequência evacuatória, consistência das fezes, esforço, dor, sensação de evacuação incompleta, necessidade de manobras, perdas de fezes ou gases, distensão abdominal e uso de laxativos.',
    ),
    narrative(
      'sexualSymptoms',
      'Sintomas sexuais',
      'Descreva os aspectos relacionados à função sexual...',
      'Investigar: atividade sexual, presença de dor, localização e momento da dor, ardência, sensação de bloqueio, lubrificação, sensibilidade, orgasmo e impacto dos sintomas na vida sexual.',
    ),
    narrative(
      'gynecologicalObstetricHistory',
      'Histórico ginecológico e obstétrico',
      'Descreva o histórico ginecológico e obstétrico...',
      'Investigar: menarca, características do ciclo menstrual, DUM, cólicas, menopausa, condições ginecológicas, método contraceptivo, gestações, partos, abortamentos, lacerações, episiotomia e intercorrências obstétricas.',
    ),
    narrative(
      'behavioralHabits',
      'Hábitos comportamentais',
      'Descreva hábitos e aspectos da rotina que possam estar relacionados às queixas...',
      'Investigar: ingestão hídrica, consumo de cafeína, atividade física, rotina ocupacional, hábitos urinários e intestinais, posição para evacuar, sono e fatores emocionais relacionados aos sintomas.',
    ),
    narrative(
      'treatmentExpectations',
      'Expectativas com o tratamento',
      'Descreva os objetivos e expectativas da paciente com o tratamento...',
      'Investigar: objetivos pessoais, atividades que deseja retomar, limitações consideradas mais importantes e expectativas em relação à fisioterapia.',
    ),
    narrative(
      'additionalNotes',
      'Observações complementares',
      'Registre outras informações relevantes para a avaliação...',
    ),
  ],
  PREGNANCY: [
    {
      id: 'gestationalData',
      title: 'Identificação e dados gestacionais',
      kind: 'structured',
      component: 'gestationalData',
    },
    narrative(
      'obstetricHistory',
      'Histórico obstétrico',
      'Descreva o histórico obstétrico da paciente...',
      'Investigar: gestações anteriores, partos vaginais e cesáreas, abortamentos, intercorrências gestacionais, lacerações, episiotomia e experiências relevantes em gestações ou partos anteriores.',
    ),
    narrative(
      'currentPregnancyHistory',
      'História da gestação atual',
      'Descreva a evolução da gestação atual...',
      'Investigar: acompanhamento pré-natal, evolução da gestação, classificação de risco, intercorrências, restrições ou recomendações obstétricas e demais informações relevantes para o atendimento fisioterapêutico.',
    ),
    {
      id: 'ultrasound',
      title: 'Exames complementares: última ultrassonografia obstétrica',
      kind: 'structured',
      component: 'ultrasound',
    },
    narrative(
      'otherExams',
      'Outros exames',
      'Registre outros exames e resultados relevantes...',
      'Registrar exames laboratoriais, exames de imagem e demais achados relevantes para acompanhamento fisioterapêutico durante a gestação.',
    ),
    narrative(
      'healthHistory',
      'Histórico de saúde',
      'Descreva os antecedentes e informações relevantes de saúde...',
      'Investigar: condições prévias ou atuais de saúde, comorbidades, cirurgias, medicamentos, alergias, tratamentos e informações relevantes para a segurança do atendimento durante a gestação.',
    ),
    narrative(
      'musculoskeletalPelvicSymptoms',
      'Sintomas musculoesqueléticos e pélvicos',
      'Descreva as principais queixas musculoesqueléticas e pélvicas...',
      'Investigar: dor lombar, pélvica, sacroilíaca, púbica, perineal ou outras queixas, limitações funcionais, fatores de melhora e piora e impacto nas atividades diárias.',
    ),
    narrative(
      'urinarySymptoms',
      'Sintomas urinários',
      'Descreva os hábitos e sintomas urinários...',
      'Investigar: frequência urinária, noctúria, urgência, perdas urinárias, situações associadas aos escapes, dor, dificuldade miccional e sensação de esvaziamento incompleto.',
    ),
    narrative(
      'bowelSymptoms',
      'Sintomas intestinais',
      'Descreva os hábitos e sintomas intestinais...',
      'Investigar: frequência evacuatória, consistência das fezes, esforço, dor, sensação de evacuação incompleta, necessidade de manobras e perdas de fezes ou gases.',
    ),
    narrative(
      'sexualSymptoms',
      'Sintomas sexuais',
      'Descreva os aspectos relacionados à função sexual durante a gestação...',
      'Investigar: atividade sexual, dor, desconforto, lubrificação, sensibilidade, desejo, orgasmo e possíveis mudanças percebidas durante a gestação.',
    ),
    narrative(
      'behavioralHabits',
      'Hábitos comportamentais e atividade física',
      'Descreva hábitos, rotina e atividade física...',
      'Investigar: ingestão hídrica, atividade física, rotina ocupacional, sono, hábitos urinários e intestinais e outros fatores comportamentais relevantes.',
    ),
    narrative(
      'birthPlanning',
      'Planejamento e expectativas para o parto',
      'Descreva o planejamento e as expectativas da paciente para o parto...',
      'Investigar: via de parto desejada ou planejada, expectativas, receios, experiências anteriores, orientações já recebidas e aspectos que a paciente considera importantes para o parto.',
    ),
    narrative(
      'physiotherapyGoals',
      'Objetivos com a fisioterapia pélvica',
      'Descreva os principais objetivos da paciente com o acompanhamento fisioterapêutico...',
      'Investigar: queixas que deseja tratar, preparação para o parto, prevenção de sintomas, manutenção da função e demais expectativas relacionadas ao acompanhamento fisioterapêutico.',
    ),
    narrative(
      'additionalNotes',
      'Observações complementares',
      'Registre outras informações relevantes para o acompanhamento da gestação...',
    ),
  ],
};
```

- [ ] **Step 4: Implement `gestational-data.ts`**

Create `frontend/src/components/anamnesis/gestational-data.ts`:

```ts
import {
  dppFromDum,
  dppFromUltrasound,
  gaFromDpp,
  gaFromDum,
} from '@/lib/gestational-age';
import { asRecord } from './anamnesis-forms';

export type GaSource = 'DUM' | 'ULTRASSONOGRAFIA' | 'MANUAL';
export type ObstetricRisk = 'HABITUAL' | 'ALTO_RISCO' | 'NAO_INFORMADO';
export type PregnancyType = 'UNICA' | 'MULTIPLA';
export type Conception = 'ESPONTANEA' | 'REPRODUCAO_ASSISTIDA';
export type FetalPresentation =
  | 'CEFALICA' | 'PELVICA' | 'TRANSVERSA' | 'OBLIQUA' | 'NAO_INFORMADO' | 'OUTRO';

export interface GestationalData {
  dum?: string;
  dpp?: string;
  /** Where the current DPP came from. MANUAL = typed by the professional (never auto-overwritten). */
  dppSource?: GaSource;
  /** Selected source for the gestational age. Defaults to DUM when absent. */
  gaSource?: GaSource;
  /** GA on the assessment date. manualOverride=true when typed by the professional. */
  gestationalAge?: { weeks: number; days: number; manualOverride: boolean };
  pregnancyType?: PregnancyType;
  conception?: Conception;
  obstetricRisk?: ObstetricRisk;
}

export interface UltrasoundData {
  date?: string;
  gaAtExam?: { weeks?: number; days?: number };
  estimatedFetalWeight?: string;
  fetalPercentile?: string;
  fetalPresentation?: FetalPresentation;
  fetalPresentationOther?: string;
  placentaLocation?: string;
  cervicalLength?: string;
  amnioticFluid?: string;
}

export interface RecomputeContext {
  /** YYYY-MM-DD — reference date for the GA stored in the record. */
  assessmentDate: string;
  ultrasound?: UltrasoundData;
}

export const GA_SOURCE_LABELS: Record<GaSource, string> = {
  DUM: 'DUM',
  ULTRASSONOGRAFIA: 'Ultrassonografia',
  MANUAL: 'Manual',
};
export const OBSTETRIC_RISK_LABELS: Record<ObstetricRisk, string> = {
  HABITUAL: 'Habitual',
  ALTO_RISCO: 'Alto risco',
  NAO_INFORMADO: 'Não informado',
};
export const PREGNANCY_TYPE_LABELS: Record<PregnancyType, string> = {
  UNICA: 'Única',
  MULTIPLA: 'Múltipla',
};
export const CONCEPTION_LABELS: Record<Conception, string> = {
  ESPONTANEA: 'Espontânea',
  REPRODUCAO_ASSISTIDA: 'Reprodução assistida',
};
export const FETAL_PRESENTATION_LABELS: Record<FetalPresentation, string> = {
  CEFALICA: 'Cefálica',
  PELVICA: 'Pélvica',
  TRANSVERSA: 'Transversa',
  OBLIQUA: 'Oblíqua',
  NAO_INFORMADO: 'Não informado',
  OUTRO: 'Outro',
};

export const asGestationalData = (value: unknown): GestationalData =>
  asRecord(value) as GestationalData;
export const asUltrasound = (value: unknown): UltrasoundData => asRecord(value) as UltrasoundData;

function ultrasoundDpp(us?: UltrasoundData): string | null {
  const ga = us?.gaAtExam;
  if (!us?.date || ga?.weeks === undefined || ga?.days === undefined) return null;
  return dppFromUltrasound(us.date, { weeks: ga.weeks, days: ga.days });
}

/** DPP the active source would produce, ignoring any manual DPP. */
export function calculatedDpp(data: GestationalData, ctx: RecomputeContext): string | null {
  const source = data.gaSource ?? 'DUM';
  if (source === 'DUM') return dppFromDum(data.dum);
  if (source === 'ULTRASSONOGRAFIA') return ultrasoundDpp(ctx.ultrasound);
  return null;
}

/**
 * Recomputes the derived fields (DPP, GA on the assessment date) from the active
 * source. Never overwrites: a MANUAL source (manual GA), or a manually typed DPP.
 */
export function recomputeGestational(data: GestationalData, ctx: RecomputeContext): GestationalData {
  const source = data.gaSource ?? 'DUM';
  if (source === 'MANUAL') return data;

  const next: GestationalData = { ...data };

  if (next.dppSource !== 'MANUAL') {
    const dpp = calculatedDpp(next, ctx);
    if (dpp) {
      next.dpp = dpp;
      next.dppSource = source;
    } else {
      delete next.dpp;
      delete next.dppSource;
    }
  }

  const ga =
    source === 'DUM'
      ? gaFromDum(next.dum, ctx.assessmentDate)
      : gaFromDpp(next.dpp, ctx.assessmentDate);
  if (ga) next.gestationalAge = { ...ga, manualOverride: false };
  else delete next.gestationalAge;

  return next;
}

export function changeGaSource(
  data: GestationalData,
  source: GaSource,
  ctx: RecomputeContext,
): GestationalData {
  if (source === 'MANUAL') {
    return {
      ...data,
      gaSource: 'MANUAL',
      gestationalAge: data.gestationalAge ? { ...data.gestationalAge, manualOverride: true } : undefined,
    };
  }
  return recomputeGestational({ ...data, gaSource: source }, ctx);
}

export function editDpp(data: GestationalData, dpp: string, ctx: RecomputeContext): GestationalData {
  const next: GestationalData = { ...data, dpp: dpp || undefined, dppSource: dpp ? 'MANUAL' : undefined };
  return recomputeGestational(next, ctx);
}

export function applyCalculatedDpp(data: GestationalData, ctx: RecomputeContext): GestationalData {
  return recomputeGestational({ ...data, dppSource: undefined }, ctx);
}

export function setManualGa(data: GestationalData, weeks: number, days: number): GestationalData {
  return { ...data, gaSource: 'MANUAL', gestationalAge: { weeks, days, manualOverride: true } };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run src/components/anamnesis/anamnesis-forms.test.ts src/components/anamnesis/gestational-data.test.ts`
Expected: PASS.

Note for the `idempotente` test: `recomputeGestational` of an already-computed object returns an equal object (keys with `undefined` are treated as equal by `toEqual`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/anamnesis/anamnesis-forms.ts frontend/src/components/anamnesis/anamnesis-forms.test.ts frontend/src/components/anamnesis/gestational-data.ts frontend/src/components/anamnesis/gestational-data.test.ts
git commit -m "feat(anamnese): definições dos formulários e lógica de dados gestacionais

Part of SOU-66

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `ClinicalNarrativeField`, `CollapsibleSection`, unsaved-changes guard, autosave hook

**Files:**
- Create: `frontend/src/components/anamnesis/ClinicalNarrativeField.tsx`, `ClinicalNarrativeField.test.tsx`, `CollapsibleSection.tsx`, `frontend/src/hooks/use-unsaved-changes-guard.ts`, `frontend/src/hooks/use-unsaved-changes-guard.test.tsx`, `frontend/src/hooks/use-autosave.ts`, `frontend/src/hooks/use-autosave.test.ts`

**Interfaces:**
- Produces:
  - `<ClinicalNarrativeField id title placeholder? guidance? value onChange optional? maxLength? hideTitle? />` — textarea labelled by `title` (accessible name = title even when `hideTitle`), guidance rendered in a `<p data-testid="{id}-guidance">` below; guidance is never part of `value`.
  - `<CollapsibleSection id title children defaultOpen? />` — header `<button aria-expanded>` with `<h3>`; body `hidden` when collapsed; root has `id="section-{id}"`.
  - `useUnsavedChangesGuard(dirty: boolean, onBlockedNavigation: (path: string) => void): void` — while `dirty`: sets `beforeunload` prompt, and intercepts clicks on internal `<a href>` (capture phase), calling `onBlockedNavigation(pathname+search+hash)` instead of navigating. (React Router's `useBlocker` needs a data router; the app uses `BrowserRouter`.)
  - `useAutosave({ enabled: boolean; intervalMs?: number; onSave: () => void }): void` — calls `onSave` every `intervalMs` (default 30000) while `enabled`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/anamnesis/ClinicalNarrativeField.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClinicalNarrativeField } from './ClinicalNarrativeField';

const base = {
  id: 'field-chief',
  title: 'Queixa principal',
  placeholder: 'Descreva a principal queixa...',
  guidance: 'Investigar: motivo da consulta, sintomas predominantes.',
  value: '',
  onChange: vi.fn(),
};

describe('ClinicalNarrativeField', () => {
  it('mostra título, placeholder e orientação abaixo do campo', () => {
    render(<ClinicalNarrativeField {...base} />);
    expect(screen.getByLabelText('Queixa principal')).toHaveAttribute(
      'placeholder',
      'Descreva a principal queixa...',
    );
    expect(screen.getByTestId('field-chief-guidance')).toHaveTextContent(
      'Investigar: motivo da consulta, sintomas predominantes.',
    );
  });

  it('a orientação nunca entra no valor do campo', () => {
    const onChange = vi.fn();
    render(<ClinicalNarrativeField {...base} value="Dor há 2 meses" onChange={onChange} />);
    const textarea = screen.getByLabelText('Queixa principal') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Dor há 2 meses');
    expect(textarea.value).not.toContain('Investigar');

    fireEvent.change(textarea, { target: { value: 'Dor há 3 meses' } });
    expect(onChange).toHaveBeenCalledWith('Dor há 3 meses');
  });

  it('associa a orientação ao campo via aria-describedby', () => {
    render(<ClinicalNarrativeField {...base} />);
    expect(screen.getByLabelText('Queixa principal')).toHaveAttribute(
      'aria-describedby',
      'field-chief-guidance',
    );
  });

  it('sem orientação não renderiza o parágrafo nem aria-describedby', () => {
    render(<ClinicalNarrativeField {...base} guidance={undefined} />);
    expect(screen.queryByTestId('field-chief-guidance')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Queixa principal')).not.toHaveAttribute('aria-describedby');
  });

  it('hideTitle mantém o nome acessível, mas esconde o rótulo visualmente', () => {
    render(<ClinicalNarrativeField {...base} hideTitle />);
    expect(screen.getByLabelText('Queixa principal')).toBeInTheDocument();
    expect(screen.getByText('Queixa principal')).toHaveClass('sr-only');
  });

  it('repassa maxLength ao textarea', () => {
    render(<ClinicalNarrativeField {...base} maxLength={50} />);
    expect(screen.getByLabelText('Queixa principal')).toHaveAttribute('maxlength', '50');
  });
});
```

Create `frontend/src/hooks/use-unsaved-changes-guard.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useUnsavedChangesGuard } from './use-unsaved-changes-guard';

function Harness({ dirty, onBlocked }: { dirty: boolean; onBlocked: (p: string) => void }) {
  useUnsavedChangesGuard(dirty, onBlocked);
  return (
    <div>
      <a href="/patients/1?tab=x#top">interno</a>
      <a href="https://example.com/fora">externo</a>
      <a href="/nova" target="_blank">nova aba</a>
    </div>
  );
}

afterEach(cleanup);

describe('useUnsavedChangesGuard', () => {
  it('com alterações pendentes, beforeunload pede confirmação', () => {
    render(<Harness dirty onBlocked={vi.fn()} />);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('sem alterações, beforeunload não interfere', () => {
    render(<Harness dirty={false} onBlocked={vi.fn()} />);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('intercepta clique em link interno e informa o destino', () => {
    const onBlocked = vi.fn();
    render(<Harness dirty onBlocked={onBlocked} />);
    const notPrevented = fireEvent.click(screen.getByText('interno'));
    expect(onBlocked).toHaveBeenCalledWith('/patients/1?tab=x#top');
    expect(notPrevented).toBe(false); // preventDefault foi chamado
  });

  it('não intercepta link externo, nova aba, nem clique com modificador', () => {
    const onBlocked = vi.fn();
    render(<Harness dirty onBlocked={onBlocked} />);
    fireEvent.click(screen.getByText('externo'));
    fireEvent.click(screen.getByText('nova aba'));
    fireEvent.click(screen.getByText('interno'), { ctrlKey: true });
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('sem alterações não intercepta nada', () => {
    const onBlocked = vi.fn();
    render(<Harness dirty={false} onBlocked={onBlocked} />);
    fireEvent.click(screen.getByText('interno'));
    expect(onBlocked).not.toHaveBeenCalled();
  });
});
```

Create `frontend/src/hooks/use-autosave.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutosave } from './use-autosave';

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('chama onSave a cada intervalo enquanto habilitado', () => {
    const onSave = vi.fn();
    renderHook(() => useAutosave({ enabled: true, intervalMs: 30000, onSave }));
    vi.advanceTimersByTime(29999);
    expect(onSave).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30000);
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('não salva quando desabilitado', () => {
    const onSave = vi.fn();
    renderHook(() => useAutosave({ enabled: false, onSave }));
    vi.advanceTimersByTime(120000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('para ao ser desabilitado e ao desmontar', () => {
    const onSave = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useAutosave({ enabled, intervalMs: 1000, onSave }),
      { initialProps: { enabled: true } },
    );
    vi.advanceTimersByTime(1000);
    expect(onSave).toHaveBeenCalledTimes(1);
    rerender({ enabled: false });
    vi.advanceTimersByTime(5000);
    expect(onSave).toHaveBeenCalledTimes(1);
    rerender({ enabled: true });
    unmount();
    vi.advanceTimersByTime(5000);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('usa sempre a versão mais recente de onSave', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => useAutosave({ enabled: true, intervalMs: 1000, onSave: fn }), {
      initialProps: { fn: first },
    });
    rerender({ fn: second });
    vi.advanceTimersByTime(1000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/components/anamnesis/ClinicalNarrativeField.test.tsx src/hooks`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

Create `frontend/src/components/anamnesis/ClinicalNarrativeField.tsx`:

```tsx
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface ClinicalNarrativeFieldProps {
  id: string;
  title: string;
  placeholder?: string;
  /** Display-only orientation (e.g. "Investigar: ..."). Never merged into `value`. */
  guidance?: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  maxLength?: number;
  /** Keeps the accessible name but hides the label (when a section header already shows the title). */
  hideTitle?: boolean;
  disabled?: boolean;
}

export function ClinicalNarrativeField({
  id, title, placeholder, guidance, value, onChange, optional, maxLength, hideTitle, disabled,
}: ClinicalNarrativeFieldProps) {
  const guidanceId = `${id}-guidance`;
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className={cn('block text-[13.5px] font-semibold text-foreground', hideTitle && 'sr-only')}
      >
        {title}
        {optional && <span className="ml-2 text-[11px] font-normal text-muted-foreground">opcional</span>}
      </label>
      <Textarea
        id={id}
        rows={4}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        aria-describedby={guidance ? guidanceId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {guidance && (
        <p id={guidanceId} data-testid={guidanceId} className="text-[12px] leading-relaxed text-muted-foreground/80">
          {guidance}
        </p>
      )}
    </div>
  );
}
```

Create `frontend/src/components/anamnesis/CollapsibleSection.tsx`:

```tsx
import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CollapsibleSection({
  id, title, children, defaultOpen = true,
}: { id: string; title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `section-${id}-body`;
  return (
    <section id={`section-${id}`} className="border border-border rounded-lg">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <h3 className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h3>
        <ChevronDown
          className={cn('w-4 h-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      <div id={bodyId} hidden={!open} className="px-4 pb-4">
        {children}
      </div>
    </section>
  );
}
```

Create `frontend/src/hooks/use-unsaved-changes-guard.ts`:

```ts
import { useEffect, useRef } from 'react';

/**
 * Warns before losing unsaved changes. React Router's `useBlocker` only works with
 * data routers; the app uses <BrowserRouter>, so this guards:
 *  - tab close / reload / external navigation via `beforeunload`;
 *  - in-app navigation by intercepting clicks on internal <a href> (capture phase),
 *    handing the destination to `onBlockedNavigation` so the page can confirm and navigate.
 * The browser back button cannot be intercepted this way.
 */
export function useUnsavedChangesGuard(
  dirty: boolean,
  onBlockedNavigation: (path: string) => void,
): void {
  const blockedRef = useRef(onBlockedNavigation);
  blockedRef.current = onBlockedNavigation;

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      blockedRef.current(anchor.pathname + anchor.search + anchor.hash);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);
}
```

Create `frontend/src/hooks/use-autosave.ts`:

```ts
import { useEffect, useRef } from 'react';

export function useAutosave({
  enabled,
  intervalMs = 30000,
  onSave,
}: {
  enabled: boolean;
  intervalMs?: number;
  onSave: () => void;
}): void {
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => saveRef.current(), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/components/anamnesis/ClinicalNarrativeField.test.tsx src/hooks`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/anamnesis/ClinicalNarrativeField.tsx frontend/src/components/anamnesis/ClinicalNarrativeField.test.tsx frontend/src/components/anamnesis/CollapsibleSection.tsx frontend/src/hooks
git commit -m "feat(anamnese): ClinicalNarrativeField, seções recolhíveis, guarda de saída e autosave

Part of SOU-66

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Gestational components (`SelectField`, `GestationalDataFields`, `UltrasoundFields`, `ObstetricSummary`)

**Files:**
- Create: `frontend/src/components/anamnesis/SelectField.tsx`, `GestationalDataFields.tsx`, `UltrasoundFields.tsx`, `ObstetricSummary.tsx`, `gestational-components.test.tsx`

**Interfaces:**
- Consumes: `gestational-data.ts` (Task 7), `gestational-age.ts` (Task 6).
- Produces:
  - `<SelectField id label value onChange options allowEmpty? placeholder? />` — native `<select>`, options `{ value; label }[]`.
  - `<GestationalDataFields value: GestationalData onChange(v) assessmentDate: string ultrasound: UltrasoundData />`
  - `<UltrasoundFields value: UltrasoundData onChange(v) />`
  - `<ObstetricSummary gestational ultrasound assessmentDate today? />`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/anamnesis/gestational-components.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GestationalDataFields } from './GestationalDataFields';
import { UltrasoundFields } from './UltrasoundFields';
import { ObstetricSummary } from './ObstetricSummary';

describe('GestationalDataFields', () => {
  const baseProps = { assessmentDate: '2026-06-10', ultrasound: {} };

  it('ao informar a DUM, preenche a DPP e a IG automaticamente', () => {
    const onChange = vi.fn();
    render(<GestationalDataFields {...baseProps} value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/DUM/), { target: { value: '2026-01-01' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dum: '2026-01-01',
        dpp: '2026-10-08',
        dppSource: 'DUM',
        gestationalAge: { weeks: 22, days: 6, manualOverride: false },
      }),
    );
  });

  it('mostra a IG calculada em semanas + dias e a fonte', () => {
    render(
      <GestationalDataFields
        {...baseProps}
        value={{ dum: '2026-01-01', dpp: '2026-10-08', gestationalAge: { weeks: 22, days: 6, manualOverride: false } }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gd-ga')).toHaveTextContent('22 semanas + 6 dias');
    expect(screen.getByLabelText('Fonte da idade gestacional')).toHaveValue('DUM');
  });

  it('mostra "—" quando não há IG calculável', () => {
    render(<GestationalDataFields {...baseProps} value={{ dum: '2026-02-30' }} onChange={vi.fn()} />);
    expect(screen.getByTestId('gd-ga')).toHaveTextContent('—');
  });

  it('editar a DPP marca como manual', () => {
    const onChange = vi.fn();
    render(<GestationalDataFields {...baseProps} value={{ dum: '2026-01-01' }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/DPP/), { target: { value: '2026-10-20' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ dpp: '2026-10-20', dppSource: 'MANUAL' }),
    );
  });

  it('DPP manual divergente mostra sugestão e o botão aplica a calculada', () => {
    const onChange = vi.fn();
    render(
      <GestationalDataFields
        {...baseProps}
        value={{ dum: '2026-01-01', dpp: '2026-10-20', dppSource: 'MANUAL' }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/DPP calculada: 08\/10\/2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar DPP calculada' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ dpp: '2026-10-08', dppSource: 'DUM' }),
    );
  });

  it('fonte Manual libera semanas/dias e registra override', () => {
    const onChange = vi.fn();
    render(
      <GestationalDataFields
        {...baseProps}
        value={{ gaSource: 'MANUAL', gestationalAge: { weeks: 20, days: 0, manualOverride: true } }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Semanas'), { target: { value: '21' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        gaSource: 'MANUAL',
        gestationalAge: { weeks: 21, days: 0, manualOverride: true },
      }),
    );
  });

  it('dias digitados acima de 6 são limitados a 6', () => {
    const onChange = vi.fn();
    render(
      <GestationalDataFields
        {...baseProps}
        value={{ gaSource: 'MANUAL', gestationalAge: { weeks: 20, days: 0, manualOverride: true } }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Dias'), { target: { value: '9' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ gestationalAge: { weeks: 20, days: 6, manualOverride: true } }),
    );
  });

  it('seleciona risco obstétrico, tipo de gestação e concepção', () => {
    const onChange = vi.fn();
    render(<GestationalDataFields {...baseProps} value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Risco obstétrico'), { target: { value: 'ALTO_RISCO' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ obstetricRisk: 'ALTO_RISCO' }));

    fireEvent.change(screen.getByLabelText('Tipo de gestação'), { target: { value: 'MULTIPLA' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ pregnancyType: 'MULTIPLA' }));

    fireEvent.change(screen.getByLabelText('Concepção'), { target: { value: 'REPRODUCAO_ASSISTIDA' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ conception: 'REPRODUCAO_ASSISTIDA' }));
  });
});

describe('UltrasoundFields', () => {
  it('campos são informados manualmente e sobem via onChange', () => {
    const onChange = vi.fn();
    render(<UltrasoundFields value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Data do exame'), { target: { value: '2026-06-10' } });
    expect(onChange).toHaveBeenLastCalledWith({ date: '2026-06-10' });

    fireEvent.change(screen.getByLabelText('IG no exame — semanas'), { target: { value: '22' } });
    expect(onChange).toHaveBeenLastCalledWith({ gaAtExam: { weeks: 22 } });

    fireEvent.change(screen.getByLabelText('Peso fetal estimado'), { target: { value: '2.450 g' } });
    expect(onChange).toHaveBeenLastCalledWith({ estimatedFetalWeight: '2.450 g' });
  });

  it('apresentação "Outro" libera entrada manual', () => {
    const onChange = vi.fn();
    const { rerender } = render(<UltrasoundFields value={{}} onChange={onChange} />);
    expect(screen.queryByLabelText('Descreva a apresentação')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Apresentação fetal'), { target: { value: 'OUTRO' } });
    expect(onChange).toHaveBeenLastCalledWith({ fetalPresentation: 'OUTRO' });

    rerender(<UltrasoundFields value={{ fetalPresentation: 'OUTRO' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Descreva a apresentação'), { target: { value: 'Córmica' } });
    expect(onChange).toHaveBeenLastCalledWith({ fetalPresentation: 'OUTRO', fetalPresentationOther: 'Córmica' });
  });

  it('limpar um número remove a chave em vez de gravar NaN', () => {
    const onChange = vi.fn();
    render(<UltrasoundFields value={{ gaAtExam: { weeks: 22, days: 3 } }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('IG no exame — semanas'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ gaAtExam: { days: 3 } });
  });
});

describe('ObstetricSummary', () => {
  it('mostra IG atual recalculada para hoje, DPP, apresentação (com data do exame) e risco', () => {
    render(
      <ObstetricSummary
        gestational={{ dpp: '2026-10-08', obstetricRisk: 'HABITUAL' }}
        ultrasound={{ fetalPresentation: 'CEFALICA', date: '2026-05-20' }}
        assessmentDate="2026-06-01"
        today="2026-06-10"
      />,
    );
    expect(screen.getByText('IG atual').nextSibling).toHaveTextContent('22s + 6d');
    expect(screen.getByText('DPP').nextSibling).toHaveTextContent('08/10/2026');
    expect(screen.getByText('Apresentação').nextSibling).toHaveTextContent('Cefálica');
    expect(screen.getByText(/ultrassonografia de 20\/05\/2026/)).toBeInTheDocument();
    expect(screen.getByText('Risco obstétrico').nextSibling).toHaveTextContent('Habitual');
  });

  it('IG manual avança pelos dias desde a avaliação', () => {
    render(
      <ObstetricSummary
        gestational={{ gaSource: 'MANUAL', gestationalAge: { weeks: 24, days: 0, manualOverride: true } }}
        ultrasound={{}}
        assessmentDate="2026-06-01"
        today="2026-06-10"
      />,
    );
    expect(screen.getByText('IG atual').nextSibling).toHaveTextContent('25s + 2d');
  });

  it('dados ausentes aparecem como "—" sem quebrar', () => {
    render(<ObstetricSummary gestational={{}} ultrasound={{}} assessmentDate="2026-06-10" today="2026-06-10" />);
    expect(screen.getByText('IG atual').nextSibling).toHaveTextContent('—');
    expect(screen.getByText('DPP').nextSibling).toHaveTextContent('—');
    expect(screen.getByText('Apresentação').nextSibling).toHaveTextContent('—');
    expect(screen.getByText('Risco obstétrico').nextSibling).toHaveTextContent('—');
  });

  it('apresentação "Outro" mostra o texto informado', () => {
    render(
      <ObstetricSummary
        gestational={{}}
        ultrasound={{ fetalPresentation: 'OUTRO', fetalPresentationOther: 'Córmica' }}
        assessmentDate="2026-06-10"
        today="2026-06-10"
      />,
    );
    expect(screen.getByText('Apresentação').nextSibling).toHaveTextContent('Córmica');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/components/anamnesis/gestational-components.test.tsx`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `SelectField`**

Create `frontend/src/components/anamnesis/SelectField.tsx`:

```tsx
export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  id, label, value, onChange, options, allowEmpty = true, placeholder = 'Selecione',
}: {
  id: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[12.5px] font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-md border border-input bg-background text-[13.5px] outline-none focus:ring-2 focus:ring-primary/20"
      >
        {allowEmpty && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Implement `GestationalDataFields`**

Create `frontend/src/components/anamnesis/GestationalDataFields.tsx`:

```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatGestationalAge, formatIsoDate } from '@/lib/gestational-age';
import { SelectField } from './SelectField';
import {
  CONCEPTION_LABELS,
  GA_SOURCE_LABELS,
  OBSTETRIC_RISK_LABELS,
  PREGNANCY_TYPE_LABELS,
  applyCalculatedDpp,
  calculatedDpp,
  changeGaSource,
  editDpp,
  recomputeGestational,
  setManualGa,
  type Conception,
  type GaSource,
  type GestationalData,
  type ObstetricRisk,
  type PregnancyType,
  type UltrasoundData,
} from './gestational-data';

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

function clampInt(raw: string, min: number, max: number): number {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function GestationalDataFields({
  value, onChange, assessmentDate, ultrasound,
}: {
  value: GestationalData;
  onChange: (value: GestationalData) => void;
  assessmentDate: string;
  ultrasound: UltrasoundData;
}) {
  const ctx = { assessmentDate, ultrasound };
  const source: GaSource = value.gaSource ?? 'DUM';
  const calculated = calculatedDpp(value, ctx);
  const showSuggestion = value.dppSource === 'MANUAL' && !!calculated && calculated !== value.dpp;
  const ga = value.gestationalAge;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="gd-dum" className="block text-[12.5px] font-medium text-muted-foreground">
            Data da última menstruação (DUM)
          </label>
          <Input
            id="gd-dum"
            type="date"
            value={value.dum ?? ''}
            onChange={(e) => onChange(recomputeGestational({ ...value, dum: e.target.value || undefined }, ctx))}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="gd-dpp" className="block text-[12.5px] font-medium text-muted-foreground">
            Data provável do parto (DPP)
          </label>
          <Input
            id="gd-dpp"
            type="date"
            value={value.dpp ?? ''}
            onChange={(e) => onChange(editDpp(value, e.target.value, ctx))}
          />
          {showSuggestion && (
            <p className="text-[12px] text-muted-foreground">
              DPP calculada: {formatIsoDate(calculated as string)}{' '}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-[12px]"
                onClick={() => onChange(applyCalculatedDpp(value, ctx))}
              >
                Aplicar DPP calculada
              </Button>
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="gd-source"
          label="Fonte da idade gestacional"
          allowEmpty={false}
          value={source}
          onChange={(v) => onChange(changeGaSource(value, v as GaSource, ctx))}
          options={toOptions(GA_SOURCE_LABELS)}
        />
        <div className="space-y-2">
          <span className="block text-[12.5px] font-medium text-muted-foreground">
            Idade gestacional na avaliação
          </span>
          <p data-testid="gd-ga" className="h-10 flex items-center text-[14px] font-medium">
            {ga ? formatGestationalAge(ga) : '—'}
            {ga?.manualOverride && (
              <span className="ml-2 text-[11px] font-normal text-muted-foreground">informada manualmente</span>
            )}
          </p>
        </div>
      </div>

      {source === 'MANUAL' && (
        <div className="grid grid-cols-2 gap-4 sm:max-w-xs">
          <div className="space-y-2">
            <label htmlFor="gd-weeks" className="block text-[12.5px] font-medium text-muted-foreground">
              Semanas
            </label>
            <Input
              id="gd-weeks"
              type="number"
              min={0}
              max={45}
              value={ga?.weeks ?? ''}
              onChange={(e) => onChange(setManualGa(value, clampInt(e.target.value, 0, 45), ga?.days ?? 0))}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="gd-days" className="block text-[12.5px] font-medium text-muted-foreground">
              Dias
            </label>
            <Input
              id="gd-days"
              type="number"
              min={0}
              max={6}
              value={ga?.days ?? ''}
              onChange={(e) => onChange(setManualGa(value, ga?.weeks ?? 0, clampInt(e.target.value, 0, 6)))}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          id="gd-type"
          label="Tipo de gestação"
          value={value.pregnancyType}
          onChange={(v) => onChange({ ...value, pregnancyType: (v || undefined) as PregnancyType | undefined })}
          options={toOptions(PREGNANCY_TYPE_LABELS)}
        />
        <SelectField
          id="gd-conception"
          label="Concepção"
          value={value.conception}
          onChange={(v) => onChange({ ...value, conception: (v || undefined) as Conception | undefined })}
          options={toOptions(CONCEPTION_LABELS)}
        />
        <SelectField
          id="gd-risk"
          label="Risco obstétrico"
          value={value.obstetricRisk}
          onChange={(v) => onChange({ ...value, obstetricRisk: (v || undefined) as ObstetricRisk | undefined })}
          options={toOptions(OBSTETRIC_RISK_LABELS)}
        />
      </div>
    </div>
  );
}
```

Note: `Button` must support `variant="link"`/`size="sm"` (shadcn default). Confirm with `grep -n "link" frontend/src/components/ui/button.tsx`; if the variant does not exist, use `variant="ghost"`.

- [ ] **Step 5: Implement `UltrasoundFields`**

Create `frontend/src/components/anamnesis/UltrasoundFields.tsx`:

```tsx
import { Input } from '@/components/ui/input';
import { SelectField } from './SelectField';
import { FETAL_PRESENTATION_LABELS, type FetalPresentation, type UltrasoundData } from './gestational-data';

const presentationOptions = Object.entries(FETAL_PRESENTATION_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function TextField({
  id, label, value, onChange, placeholder,
}: { id: string; label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[12.5px] font-medium text-muted-foreground">
        {label}
      </label>
      <Input id={id} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function parseOptionalInt(raw: string): number | undefined {
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
}

export function UltrasoundFields({
  value, onChange,
}: { value: UltrasoundData; onChange: (value: UltrasoundData) => void }) {
  const set = (patch: Partial<UltrasoundData>) => {
    const next = { ...value, ...patch };
    for (const key of Object.keys(next) as (keyof UltrasoundData)[]) {
      if (next[key] === undefined || next[key] === '') delete next[key];
    }
    onChange(next);
  };

  const setGa = (key: 'weeks' | 'days', raw: string) => {
    const gaAtExam = { ...value.gaAtExam, [key]: parseOptionalInt(raw) };
    if (gaAtExam.weeks === undefined) delete gaAtExam.weeks;
    if (gaAtExam.days === undefined) delete gaAtExam.days;
    set({ gaAtExam: Object.keys(gaAtExam).length ? gaAtExam : undefined });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="us-date" className="block text-[12.5px] font-medium text-muted-foreground">
            Data do exame
          </label>
          <Input id="us-date" type="date" value={value.date ?? ''} onChange={(e) => set({ date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <label htmlFor="us-weeks" className="block text-[12.5px] font-medium text-muted-foreground">
            IG no exame — semanas
          </label>
          <Input
            id="us-weeks"
            type="number"
            min={0}
            max={45}
            value={value.gaAtExam?.weeks ?? ''}
            onChange={(e) => setGa('weeks', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="us-days" className="block text-[12.5px] font-medium text-muted-foreground">
            IG no exame — dias
          </label>
          <Input
            id="us-days"
            type="number"
            min={0}
            max={6}
            value={value.gaAtExam?.days ?? ''}
            onChange={(e) => setGa('days', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="us-weight"
          label="Peso fetal estimado"
          value={value.estimatedFetalWeight}
          placeholder="ex.: 2.450 g"
          onChange={(v) => set({ estimatedFetalWeight: v })}
        />
        <TextField
          id="us-percentile"
          label="Percentil fetal"
          value={value.fetalPercentile}
          onChange={(v) => set({ fetalPercentile: v })}
        />
        <SelectField
          id="us-presentation"
          label="Apresentação fetal"
          value={value.fetalPresentation}
          onChange={(v) => set({ fetalPresentation: (v || undefined) as FetalPresentation | undefined })}
          options={presentationOptions}
        />
        {value.fetalPresentation === 'OUTRO' && (
          <TextField
            id="us-presentation-other"
            label="Descreva a apresentação"
            value={value.fetalPresentationOther}
            onChange={(v) => set({ fetalPresentationOther: v })}
          />
        )}
        <TextField
          id="us-placenta"
          label="Localização placentária"
          value={value.placentaLocation}
          onChange={(v) => set({ placentaLocation: v })}
        />
        <TextField
          id="us-cervix"
          label="Comprimento do colo uterino"
          value={value.cervicalLength}
          onChange={(v) => set({ cervicalLength: v })}
        />
        <TextField
          id="us-fluid"
          label="Líquido amniótico"
          value={value.amnioticFluid}
          onChange={(v) => set({ amnioticFluid: v })}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Implement `ObstetricSummary`**

Create `frontend/src/components/anamnesis/ObstetricSummary.tsx`:

```tsx
import {
  currentGestationalAge,
  formatGestationalAgeShort,
  formatIsoDate,
  todayIso,
} from '@/lib/gestational-age';
import {
  FETAL_PRESENTATION_LABELS,
  OBSTETRIC_RISK_LABELS,
  type GestationalData,
  type UltrasoundData,
} from './gestational-data';

function Cell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
        {value}
      </dd>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function ObstetricSummary({
  gestational, ultrasound, assessmentDate, today,
}: {
  gestational: GestationalData;
  ultrasound: UltrasoundData;
  assessmentDate: string;
  today?: string;
}) {
  const manual = gestational.gestationalAge?.manualOverride ? gestational.gestationalAge : undefined;
  const ga = currentGestationalAge({
    dpp: gestational.dpp,
    manual: manual && { weeks: manual.weeks, days: manual.days },
    assessmentDate,
    today: today ?? todayIso(),
  });

  const presentation = ultrasound.fetalPresentation
    ? ultrasound.fetalPresentation === 'OUTRO'
      ? ultrasound.fetalPresentationOther?.trim() || FETAL_PRESENTATION_LABELS.OUTRO
      : FETAL_PRESENTATION_LABELS[ultrasound.fetalPresentation]
    : '—';
  const examDate = formatIsoDate(ultrasound.date);

  return (
    <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-secondary/40 p-4 sm:grid-cols-4">
      <Cell label="IG atual" value={ga ? formatGestationalAgeShort(ga) : '—'} />
      <Cell label="DPP" value={formatIsoDate(gestational.dpp) || '—'} />
      <Cell
        label="Apresentação"
        value={presentation}
        hint={ultrasound.fetalPresentation && examDate ? `ultrassonografia de ${examDate}` : undefined}
      />
      <Cell
        label="Risco obstétrico"
        value={gestational.obstetricRisk ? OBSTETRIC_RISK_LABELS[gestational.obstetricRisk] : '—'}
      />
    </dl>
  );
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bunx vitest run src/components/anamnesis/gestational-components.test.tsx`
Expected: PASS. If `screen.getByLabelText(/DUM/)` is ambiguous with another label containing "DUM", tighten to `getByLabelText(/Data da última menstruação/)` in both test and component usage.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/anamnesis
git commit -m "feat(anamnese): campos gestacionais, ultrassonografia e resumo obstétrico

Part of SOU-66

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Editor page rewrite (+ identification, legacy view, patient sidebar)

**Files:**
- Create: `frontend/src/components/anamnesis/IdentificationSection.tsx`, `LegacyAnamnesisView.tsx`, `LegacyAnamnesisView.test.tsx`, `AnamnesisPatientSidebar.tsx`
- Rewrite: `frontend/src/pages/AnamnesisEditorPage.tsx`, `frontend/src/pages/AnamnesisEditorPage.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 5–9; `anamnesisApi` (Task 5).
- Produces:
  - `<IdentificationSection patient referral onReferralChange onEditPatient />`
  - `<LegacyAnamnesisView data />` — renders the legacy shapes exactly as `PatientProfile` did (4-field shape with grouped hypotheses, and the older generic `Record` shape).
  - `<AnamnesisPatientSidebar patient activePackage shortcuts />` where `shortcuts: { icon: JSX.Element; label: string; to: string }[]` plus `onNavigate(path)`.
  - Page route contract (unchanged routes): `/patients/:patientId/anamnesis/new?type=PELVIC_GENERAL|PREGNANCY` (missing/invalid `type` ⇒ redirect to `/patients/:patientId`) and `/patients/:patientId/anamnesis/:anamnesisId`.

- [ ] **Step 1: Write the failing tests for the small components**

Create `frontend/src/components/anamnesis/LegacyAnamnesisView.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LegacyAnamnesisView } from './LegacyAnamnesisView';

describe('LegacyAnamnesisView', () => {
  it('renderiza o formato de 4 campos com hipóteses agrupadas e "Não informado"', () => {
    render(
      <LegacyAnamnesisView
        data={{
          queixaPrincipal: { texto: 'Dor pélvica', hipoteses: ['Hipótese A'] },
          impacto: { texto: '', hipoteses: [] },
          historiaAtual: { texto: '', hipoteses: [] },
          historiaPregressa: { texto: '', hipoteses: [] },
        }}
      />,
    );
    expect(screen.getByText('Queixa Principal')).toBeInTheDocument();
    expect(screen.getByText('Dor pélvica')).toBeInTheDocument();
    expect(screen.getAllByText('Não informado')).toHaveLength(3);
    expect(screen.getByText('Hipótese A')).toBeInTheDocument();
  });

  it('renderiza o formato antigo genérico e ignora _template', () => {
    render(
      <LegacyAnamnesisView
        data={{ _template: 'dor-pelvica', queixa: 'Dor lombar', historico: { fratura: ['2020'] } }}
      />,
    );
    expect(screen.getByText('Dor lombar')).toBeInTheDocument();
    expect(screen.getByText('2020')).toBeInTheDocument();
    expect(screen.queryByText(/dor-pelvica/)).not.toBeInTheDocument();
  });
});
```

Create the rewritten `frontend/src/pages/AnamnesisEditorPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    patientsApi: { getById: vi.fn() },
    anamnesisApi: { getById: vi.fn(), create: vi.fn(), update: vi.fn() },
    treatmentPackagesApi: { list: vi.fn() },
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const features: Record<string, boolean> = {};
vi.mock('@/contexts/SubscriptionContext', () => ({
  useFeature: (f: string) => features[f] ?? true,
}));

import { patientsApi, anamnesisApi, treatmentPackagesApi } from '@/lib/api';
import AnamnesisEditorPage from './AnamnesisEditorPage';
import type { Patient, Anamnesis } from '@/types/clinic';

const patient = {
  id: 'patient-1',
  name: 'Maria Silva',
  cpf: '12345678900',
  phone: '11999998888',
  birthDate: '1990-05-10T00:00:00.000Z',
  occupation: 'Professora',
  maritalStatus: 'MARRIED',
} as Patient;

const existing = (over: Partial<Anamnesis> = {}): Anamnesis => ({
  id: 'anam-1',
  organizationId: 'org-1',
  patientId: 'patient-1',
  professionalId: 'prof-1',
  type: 'PELVIC_GENERAL',
  status: 'DRAFT',
  assessmentDate: '2026-06-10T00:00:00.000Z',
  completedAt: null,
  data: { sections: { chiefComplaint: 'Queixa salva' } },
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
  professional: { id: 'prof-1', person: { name: 'Dra. Ana' } },
  ...over,
});

function renderPage(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/patients/:patientId/anamnesis/:anamnesisId" element={<AnamnesisEditorPage />} />
          <Route path="/patients/:patientId" element={<div>PERFIL DO PACIENTE</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AnamnesisEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(features)) delete features[k];
    vi.mocked(patientsApi.getById).mockResolvedValue(patient);
    vi.mocked(treatmentPackagesApi.list).mockResolvedValue([]);
  });

  describe('nova anamnese pélvica geral', () => {
    const path = '/patients/patient-1/anamnesis/new?type=PELVIC_GENERAL';

    it('renderiza as seções da ficha com placeholder e orientação, sem resumo obstétrico', async () => {
      renderPage(path);
      expect(await screen.findByRole('heading', { name: 'Queixa principal' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Sintomas urinários' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Observações complementares' })).toBeInTheDocument();
      expect(screen.getByLabelText('Queixa principal')).toHaveAttribute(
        'placeholder',
        'Descreva a principal queixa relatada pela paciente...',
      );
      expect(screen.getByTestId('field-chiefComplaint-guidance')).toHaveTextContent(/^Investigar: /);
      expect(screen.queryByText('IG atual')).not.toBeInTheDocument();
    });

    it('identificação reaproveita o cadastro (profissão e estado civil inclusive)', async () => {
      renderPage(path);
      expect(await screen.findByRole('heading', { name: 'Identificação' })).toBeInTheDocument();
      expect(screen.getByText('Professora')).toBeInTheDocument();
      expect(screen.getByText('Casado(a)')).toBeInTheDocument();
      expect(screen.getAllByText('Maria Silva').length).toBeGreaterThan(0);
    });

    it('salva rascunho sem nada preenchido (campos clínicos não são obrigatórios)', async () => {
      vi.mocked(anamnesisApi.create).mockResolvedValue({ id: 'anam-1', status: 'DRAFT' } as Anamnesis);
      renderPage(path);

      fireEvent.click(await screen.findByRole('button', { name: 'Salvar rascunho' }));

      await waitFor(() =>
        expect(anamnesisApi.create).toHaveBeenCalledWith({
          patientId: 'patient-1',
          type: 'PELVIC_GENERAL',
          assessmentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          data: { sections: {} },
        }),
      );
    });

    it('a orientação "Investigar:" nunca vai no payload', async () => {
      vi.mocked(anamnesisApi.create).mockResolvedValue({ id: 'anam-1', status: 'DRAFT' } as Anamnesis);
      renderPage(path);

      fireEvent.change(await screen.findByLabelText('Queixa principal'), {
        target: { value: 'Dor pélvica há 2 meses' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

      await waitFor(() => expect(anamnesisApi.create).toHaveBeenCalled());
      const [[payload]] = vi.mocked(anamnesisApi.create).mock.calls;
      expect(payload.data.sections).toEqual({ chiefComplaint: 'Dor pélvica há 2 meses' });
      expect(JSON.stringify(payload)).not.toContain('Investigar');
    });

    it('"Salvar e finalizar" cria e em seguida marca como finalizada, voltando ao perfil', async () => {
      vi.mocked(anamnesisApi.create).mockResolvedValue({ id: 'anam-1', status: 'DRAFT' } as Anamnesis);
      vi.mocked(anamnesisApi.update).mockResolvedValue({ id: 'anam-1', status: 'COMPLETED' } as Anamnesis);
      renderPage(path);

      fireEvent.click(await screen.findByRole('button', { name: 'Salvar e finalizar' }));

      await waitFor(() =>
        expect(anamnesisApi.update).toHaveBeenCalledWith('anam-1', { status: 'COMPLETED' }),
      );
      expect(await screen.findByText('PERFIL DO PACIENTE')).toBeInTheDocument();
    });

    it('alterações não salvas pedem confirmação ao voltar; "Sair sem salvar" descarta', async () => {
      renderPage(path);
      fireEvent.change(await screen.findByLabelText('Queixa principal'), { target: { value: 'rascunho' } });

      fireEvent.click(screen.getByRole('button', { name: /voltar para perfil/i }));
      expect(await screen.findByText('Descartar alterações?')).toBeInTheDocument();
      expect(screen.queryByText('PERFIL DO PACIENTE')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Sair sem salvar' }));
      expect(await screen.findByText('PERFIL DO PACIENTE')).toBeInTheDocument();
    });

    it('sem alterações, voltar não pergunta nada', async () => {
      renderPage(path);
      fireEvent.click(await screen.findByRole('button', { name: /voltar para perfil/i }));
      expect(await screen.findByText('PERFIL DO PACIENTE')).toBeInTheDocument();
    });
  });

  describe('nova anamnese gestacional', () => {
    it('mostra o resumo obstétrico e os campos estruturados', async () => {
      renderPage('/patients/patient-1/anamnesis/new?type=PREGNANCY');
      expect(await screen.findByText('IG atual')).toBeInTheDocument();
      expect(screen.getByLabelText(/Data da última menstruação/)).toBeInTheDocument();
      expect(screen.getByLabelText('Data do exame')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Planejamento e expectativas para o parto' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Queixa principal' })).not.toBeInTheDocument();
    });

    it('DUM informada calcula a DPP e entra no payload salvo', async () => {
      vi.mocked(anamnesisApi.create).mockResolvedValue({ id: 'anam-2', status: 'DRAFT' } as Anamnesis);
      renderPage('/patients/patient-1/anamnesis/new?type=PREGNANCY');

      fireEvent.change(await screen.findByLabelText(/Data da última menstruação/), {
        target: { value: '2026-01-01' },
      });
      expect(screen.getByLabelText(/Data provável do parto/)).toHaveValue('2026-10-08');

      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
      await waitFor(() => expect(anamnesisApi.create).toHaveBeenCalled());
      const [[payload]] = vi.mocked(anamnesisApi.create).mock.calls;
      expect(payload.type).toBe('PREGNANCY');
      expect(payload.data.sections.gestationalData).toEqual(
        expect.objectContaining({ dum: '2026-01-01', dpp: '2026-10-08', dppSource: 'DUM' }),
      );
    });
  });

  it('type ausente ou inválido em /new redireciona ao perfil', async () => {
    renderPage('/patients/patient-1/anamnesis/new');
    expect(await screen.findByText('PERFIL DO PACIENTE')).toBeInTheDocument();

    renderPage('/patients/patient-1/anamnesis/new?type=OUTRO');
    expect((await screen.findAllByText('PERFIL DO PACIENTE')).length).toBeGreaterThan(0);
  });

  describe('editar anamnese existente', () => {
    it('rascunho: popula os campos a partir do registro e mantém o botão de rascunho', async () => {
      vi.mocked(anamnesisApi.getById).mockResolvedValue(existing());
      renderPage('/patients/patient-1/anamnesis/anam-1');

      expect(await screen.findByLabelText('Queixa principal')).toHaveValue('Queixa salva');
      expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument();
      expect(screen.getByText(/Dra\. Ana/)).toBeInTheDocument();
    });

    it('rascunho existente salva via PATCH (sem recriar) e sem status', async () => {
      vi.mocked(anamnesisApi.getById).mockResolvedValue(existing());
      vi.mocked(anamnesisApi.update).mockResolvedValue(existing());
      renderPage('/patients/patient-1/anamnesis/anam-1');

      fireEvent.change(await screen.findByLabelText('Queixa principal'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

      await waitFor(() =>
        expect(anamnesisApi.update).toHaveBeenCalledWith('anam-1', {
          data: { sections: { chiefComplaint: '' } },
          assessmentDate: '2026-06-10',
        }),
      );
      expect(anamnesisApi.create).not.toHaveBeenCalled();
    });

    it('finalizada: aviso de histórico, sem "Salvar e finalizar", salvar só habilita após editar', async () => {
      vi.mocked(anamnesisApi.getById).mockResolvedValue(existing({ status: 'COMPLETED' }));
      vi.mocked(anamnesisApi.update).mockResolvedValue(existing({ status: 'COMPLETED' }));
      renderPage('/patients/patient-1/anamnesis/anam-1');

      expect(await screen.findByText(/foi finalizada/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Salvar e finalizar' })).not.toBeInTheDocument();
      const save = screen.getByRole('button', { name: 'Salvar alterações' });
      expect(save).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Queixa principal'), { target: { value: 'Editada' } });
      expect(save).toBeEnabled();
      fireEvent.click(save);

      await waitFor(() => expect(anamnesisApi.update).toHaveBeenCalledTimes(1));
      const [, body] = vi.mocked(anamnesisApi.update).mock.calls[0];
      expect(body).not.toHaveProperty('status');
      expect(body.data).toEqual({ sections: { chiefComplaint: 'Editada' } });
    });

    it('legado (type null): somente leitura, sem botões de salvar, etiquetado "Formato anterior"', async () => {
      vi.mocked(anamnesisApi.getById).mockResolvedValue(
        existing({
          type: null,
          status: 'COMPLETED',
          data: {
            queixaPrincipal: { texto: 'Queixa antiga', hipoteses: [] },
            impacto: { texto: '', hipoteses: [] },
            historiaAtual: { texto: '', hipoteses: [] },
            historiaPregressa: { texto: '', hipoteses: [] },
          },
        }),
      );
      renderPage('/patients/patient-1/anamnesis/anam-1');

      expect(await screen.findByText(/formato anterior/i)).toBeInTheDocument();
      expect(screen.getByText('Queixa antiga')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /salvar/i })).not.toBeInTheDocument();
    });
  });

  it('esconde o atalho "Avaliação perineal" quando a feature está inativa', async () => {
    features.PERINEAL_ASSESSMENT = false;
    renderPage('/patients/patient-1/anamnesis/new?type=PELVIC_GENERAL');
    expect(await screen.findByRole('heading', { name: 'Queixa principal' })).toBeInTheDocument();
    expect(screen.queryByText('Avaliação perineal')).not.toBeInTheDocument();
    expect(screen.getByText('Atalhos de avaliação')).toBeInTheDocument();
  });

  it('esconde o quadro de atalhos quando nenhuma feature de atalho está ativa', async () => {
    features.PERINEAL_ASSESSMENT = false;
    features.EVOLUTIONS = false;
    features.TREATMENT_PACKAGES = false;
    renderPage('/patients/patient-1/anamnesis/new?type=PELVIC_GENERAL');
    expect(await screen.findByRole('heading', { name: 'Queixa principal' })).toBeInTheDocument();
    expect(screen.queryByText('Atalhos de avaliação')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/components/anamnesis/LegacyAnamnesisView.test.tsx src/pages/AnamnesisEditorPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `LegacyAnamnesisView`**

Create `frontend/src/components/anamnesis/LegacyAnamnesisView.tsx`. This is the JSX currently inlined in `PatientProfile.tsx` (lines ~597–646), moved verbatim:

```tsx
import {
  ANAMNESIS_FIELDS,
  GroupedHypotheses,
  formatAnamnesisKey,
  isAnamnesisData,
} from './anamnesis-fields';

export function LegacyAnamnesisView({ data }: { data: Record<string, unknown> }) {
  if (isAnamnesisData(data)) {
    return (
      <div className="space-y-4">
        {ANAMNESIS_FIELDS.map((field) => (
          <div key={field.key} className="p-3 rounded-lg bg-secondary/50">
            <p className="text-[12px] text-muted-foreground">{field.label}</p>
            <p className="text-[13px] font-medium mt-1 whitespace-pre-wrap">
              {data[field.key].texto.trim() !== '' ? data[field.key].texto : 'Não informado'}
            </p>
          </div>
        ))}
        <div className="border border-border rounded-lg p-4">
          <GroupedHypotheses data={data} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(data).map(([key, value]) => {
        if (key === '_template') return null;
        const sectionLabel = formatAnamnesisKey(key);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const section = value as Record<string, unknown>;
          return (
            <div key={key} className="border border-border rounded-lg p-4">
              <h4 className="text-[13.5px] font-semibold text-foreground mb-3 pb-2 border-b border-border">
                {sectionLabel}
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(section).map(([fk, fv]) => (
                  <div key={fk} className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-[12px] text-muted-foreground">{formatAnamnesisKey(fk)}</p>
                    <p className="text-[13px] font-medium mt-1">
                      {Array.isArray(fv)
                        ? fv.join(', ')
                        : fv != null && String(fv).trim() !== ''
                          ? String(fv)
                          : 'Não informado'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div key={key} className="p-3 rounded-lg bg-secondary/50">
            <p className="text-[12px] text-muted-foreground">{sectionLabel}</p>
            <p className="text-[13px] font-medium mt-1">
              {Array.isArray(value)
                ? value.join(', ')
                : value != null && String(value).trim() !== ''
                  ? String(value)
                  : 'Não informado'}
            </p>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Implement `IdentificationSection`**

Create `frontend/src/components/anamnesis/IdentificationSection.tsx`:

```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatIsoDate } from '@/lib/gestational-age';
import { formatPhone } from '@/lib/formatters';
import { maritalStatusLabel } from '@/lib/marital-status';
import type { Patient } from '@/types/clinic';

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
      <span className="text-[13.5px] font-medium">{value?.trim() ? value : 'Não informado'}</span>
    </div>
  );
}

/**
 * Patient data is read from the registry (never copied into the anamnesis).
 * Only the referral is stored with the assessment.
 */
export function IdentificationSection({
  patient, referral, onReferralChange, onEditPatient,
}: {
  patient?: Patient;
  referral: string;
  onReferralChange: (value: string) => void;
  onEditPatient: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Info label="Nome da paciente" value={patient?.name} />
        <Info label="Data de nascimento" value={formatIsoDate(patient?.birthDate?.slice(0, 10))} />
        <Info label="Telefone" value={patient?.phone ? formatPhone(patient.phone) : null} />
        <Info label="Profissão" value={patient?.occupation} />
        <Info label="Estado civil" value={maritalStatusLabel(patient?.maritalStatus)} />
      </div>
      <Button type="button" variant="link" size="sm" className="h-auto p-0 text-[12px]" onClick={onEditPatient}>
        Editar cadastro da paciente
      </Button>
      <div className="space-y-2">
        <label htmlFor="identification-referral" className="block text-[12.5px] font-medium text-muted-foreground">
          Encaminhamento / profissional solicitante
        </label>
        <Input
          id="identification-referral"
          value={referral}
          onChange={(e) => onReferralChange(e.target.value)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement `AnamnesisPatientSidebar`**

Create `frontend/src/components/anamnesis/AnamnesisPatientSidebar.tsx` (the right column of the current page, moved as-is):

```tsx
import type { JSX } from 'react';
import { Card } from '@/components/ui/card';
import { formatCPFMasked } from '@/lib/formatters';
import type { Patient, TreatmentPackage } from '@/types/clinic';

export interface AnamnesisShortcut {
  icon: JSX.Element;
  label: string;
  to: string;
}

export function AnamnesisPatientSidebar({
  patient, activePackage, shortcuts, onNavigate,
}: {
  patient?: Patient;
  activePackage?: TreatmentPackage;
  shortcuts: AnamnesisShortcut[];
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-4">
      <Card>
        <div className="px-4 py-3 border-b border-border">
          <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Paciente</div>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {patient && (
            <>
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-[15px] font-semibold shrink-0"
                  style={{
                    background: 'hsl(296 30% 94%)',
                    color: 'hsl(296 28% 26%)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {patient.name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase()}
                </div>
                <div>
                  <div className="text-[13.5px] font-medium">{patient.name}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {patient.birthDate
                      ? `${Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 86400000))} anos`
                      : '—'}
                    {patient.cpf && ` · ${formatCPFMasked(patient.cpf)}`}
                  </div>
                </div>
              </div>
              {activePackage && (
                <div className="border-t border-border pt-3 flex flex-col gap-0.5">
                  <div className="text-[11.5px] text-muted-foreground">Pacote</div>
                  <div className="text-[13px] font-medium">
                    {activePackage.name} · {activePackage.usedSessions}/{activePackage.totalSessions}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {shortcuts.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b border-border">
            <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Atalhos de avaliação
            </div>
          </div>
          <div className="p-3 flex flex-col gap-1">
            {shortcuts.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate(item.to)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full text-left"
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Rewrite `AnamnesisEditorPage.tsx`**

Replace the whole file:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity, AlertTriangle, ArrowLeft, Check, ClipboardList, Download, Loader2, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { anamnesisApi, patientsApi, treatmentPackagesApi } from '@/lib/api';
import { useFeature } from '@/contexts/SubscriptionContext';
import { useAutosave } from '@/hooks/use-autosave';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { todayIso } from '@/lib/gestational-age';
import type { Anamnesis, AnamnesisStatus, AnamnesisType } from '@/types/clinic';
import {
  ANAMNESIS_FORMS, ANAMNESIS_TYPE_LABELS, asRecord, getSections, type SectionDef,
} from '@/components/anamnesis/anamnesis-forms';
import { AnamnesisPatientSidebar } from '@/components/anamnesis/AnamnesisPatientSidebar';
import { ClinicalNarrativeField } from '@/components/anamnesis/ClinicalNarrativeField';
import { CollapsibleSection } from '@/components/anamnesis/CollapsibleSection';
import { GestationalDataFields } from '@/components/anamnesis/GestationalDataFields';
import { IdentificationSection } from '@/components/anamnesis/IdentificationSection';
import { LegacyAnamnesisView } from '@/components/anamnesis/LegacyAnamnesisView';
import { ObstetricSummary } from '@/components/anamnesis/ObstetricSummary';
import { UltrasoundFields } from '@/components/anamnesis/UltrasoundFields';
import {
  asGestationalData, asUltrasound, recomputeGestational, type UltrasoundData,
} from '@/components/anamnesis/gestational-data';

const VALID_TYPES: AnamnesisType[] = ['PELVIC_GENERAL', 'PREGNANCY'];
const parseType = (raw: string | null): AnamnesisType | null =>
  VALID_TYPES.includes(raw as AnamnesisType) ? (raw as AnamnesisType) : null;

export default function AnamnesisEditorPage() {
  const { patientId, anamnesisId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !anamnesisId || anamnesisId === 'new';

  const [newType] = useState<AnamnesisType | null>(() => parseType(searchParams.get('type')));
  const [sections, setSections] = useState<Record<string, unknown>>({});
  const [assessmentDate, setAssessmentDate] = useState<string>(todayIso());
  const [dirty, setDirty] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<AnamnesisStatus | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const hydratedId = useRef<string | null>(null);

  const hasPerineal = useFeature('PERINEAL_ASSESSMENT');
  const hasEvolutions = useFeature('EVOLUTIONS');
  const hasPackages = useFeature('TREATMENT_PACKAGES');

  const { data: patient, isLoading: loadingPatient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.getById(patientId!),
    enabled: !!patientId,
  });

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['anamnesis', anamnesisId],
    queryFn: () => anamnesisApi.getById(anamnesisId!),
    enabled: !isNew,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['treatment-packages', patientId],
    queryFn: () => treatmentPackagesApi.list({ patientId }),
    enabled: !!patientId,
  });

  const type: AnamnesisType | null = existing ? existing.type : newType;
  const isLegacy = !isNew && !!existing && existing.type === null;
  const status: AnamnesisStatus = savedStatus ?? existing?.status ?? 'DRAFT';
  const effectiveId = savedId ?? (isNew ? null : anamnesisId ?? null);

  useEffect(() => {
    if (!existing || hydratedId.current === existing.id) return;
    hydratedId.current = existing.id;
    setSections(getSections(existing.data));
    setAssessmentDate(existing.assessmentDate ? existing.assessmentDate.slice(0, 10) : todayIso());
  }, [existing]);

  const persist = async (finalize: boolean): Promise<Anamnesis> => {
    const content = { sections };
    if (!effectiveId) {
      const created = await anamnesisApi.create({
        patientId: patientId!,
        type: type!,
        assessmentDate,
        data: content,
      });
      hydratedId.current = created.id;
      setSavedId(created.id);
      navigate(`/patients/${patientId}/anamnesis/${created.id}`, { replace: true });
      return finalize ? anamnesisApi.update(created.id, { status: 'COMPLETED' }) : created;
    }
    return anamnesisApi.update(effectiveId, {
      data: content,
      assessmentDate,
      ...(finalize && status === 'DRAFT' ? { status: 'COMPLETED' as const } : {}),
    });
  };

  const saveMutation = useMutation({
    mutationFn: (finalize: boolean) => persist(finalize),
    onSuccess: (result) => {
      if (result.status) setSavedStatus(result.status);
      setDirty(false);
      setLastSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ['patient-anamneses', patientId] });
      queryClient.invalidateQueries({ queryKey: ['anamnesis', result.id] });
    },
    onError: () => toast.error('Erro ao salvar anamnese', { id: 'anamnesis-save-error' }),
  });

  const handleSave = () =>
    saveMutation.mutate(false, {
      onSuccess: () => toast.success(status === 'COMPLETED' ? 'Alterações salvas' : 'Rascunho salvo'),
    });

  const handleFinalize = async () => {
    try {
      await saveMutation.mutateAsync(true);
      toast.success('Anamnese finalizada');
      navigate(`/patients/${patientId}`);
    } catch {
      /* onError already toasted */
    }
  };

  useAutosave({
    enabled: !!type && !isLegacy && status === 'DRAFT' && dirty && !saveMutation.isPending,
    onSave: () => saveMutation.mutate(false),
  });
  useUnsavedChangesGuard(dirty, setPendingPath);

  const requestNavigate = (path: string) => (dirty ? setPendingPath(path) : navigate(path));

  const setSection = (id: string, value: unknown) => {
    setSections((prev) => ({ ...prev, [id]: value }));
    setDirty(true);
  };

  const handleUltrasoundChange = (next: UltrasoundData) => {
    setSections((prev) => {
      if (prev.gestationalData === undefined) return { ...prev, ultrasound: next };
      return {
        ...prev,
        ultrasound: next,
        gestationalData: recomputeGestational(asGestationalData(prev.gestationalData), {
          assessmentDate,
          ultrasound: next,
        }),
      };
    });
    setDirty(true);
  };

  const handleAssessmentDateChange = (value: string) => {
    setAssessmentDate(value);
    setDirty(true);
    if (type === 'PREGNANCY') {
      setSections((prev) =>
        prev.gestationalData === undefined
          ? prev
          : {
              ...prev,
              gestationalData: recomputeGestational(asGestationalData(prev.gestationalData), {
                assessmentDate: value,
                ultrasound: asUltrasound(prev.ultrasound),
              }),
            },
      );
    }
  };

  const activePackage = packages.find((p) => p.status === 'ACTIVE');
  const shortcuts = [
    hasPerineal && {
      icon: <Activity className="w-4 h-4 shrink-0" />,
      label: 'Avaliação perineal',
      to: `/patients/${patientId}/perineal-assessment/new`,
    },
    hasEvolutions && {
      icon: <ClipboardList className="w-4 h-4 shrink-0" />,
      label: 'Nova evolução',
      to: `/patients/${patientId}`,
    },
    hasPackages && {
      icon: <Package className="w-4 h-4 shrink-0" />,
      label: 'Adicionar pacote',
      to: `/patients/${patientId}`,
    },
  ].filter(Boolean) as { icon: JSX.Element; label: string; to: string }[];

  if (isNew && !newType) return <Navigate to={`/patients/${patientId}`} replace />;

  if (loadingPatient || (!isNew && loadingExisting && !savedId)) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const backButton = (
    <button
      type="button"
      onClick={() => requestNavigate(`/patients/${patientId}`)}
      className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Voltar para perfil
    </button>
  );

  const title = (
    <div>
      <h1
        className="text-[24px] font-semibold leading-8"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
      >
        {isLegacy ? 'Anamnese' : type ? ANAMNESIS_TYPE_LABELS[type] : 'Anamnese'}
        {patient ? ` · ${patient.name}` : ''}
      </h1>
      <div className="text-[12.5px] text-muted-foreground">
        {existing
          ? [
              `criada em ${format(new Date(existing.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
              existing.professional?.person?.name && `por ${existing.professional.person.name}`,
              `última atualização ${format(new Date(existing.updatedAt), 'dd/MM/yyyy HH:mm')}`,
            ]
              .filter(Boolean)
              .join(' · ')
          : 'Nova avaliação'}
      </div>
    </div>
  );

  if (isLegacy && existing) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between gap-4">{backButton}</div>
        {title}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Formato anterior — somente leitura. Este registro foi preservado como foi salvo; para uma
            nova avaliação, crie uma Anamnese Pélvica Geral ou Gestacional.
          </AlertDescription>
        </Alert>
        <Card className="p-5">
          <LegacyAnamnesisView data={existing.data} />
        </Card>
      </div>
    );
  }

  const gestational = asGestationalData(sections.gestationalData);
  const ultrasound = asUltrasound(sections.ultrasound);

  const renderSection = (def: SectionDef) => {
    if (def.component === 'identification') {
      const identification = asRecord(sections.identification);
      return (
        <IdentificationSection
          patient={patient}
          referral={typeof identification.referral === 'string' ? identification.referral : ''}
          onReferralChange={(v) => setSection('identification', { ...identification, referral: v })}
          onEditPatient={() => requestNavigate(`/patients/${patientId}`)}
        />
      );
    }
    if (def.component === 'gestationalData') {
      return (
        <GestationalDataFields
          value={gestational}
          ultrasound={ultrasound}
          assessmentDate={assessmentDate}
          onChange={(v) => setSection('gestationalData', v)}
        />
      );
    }
    if (def.component === 'ultrasound') {
      return <UltrasoundFields value={ultrasound} onChange={handleUltrasoundChange} />;
    }
    const raw = sections[def.id];
    return (
      <ClinicalNarrativeField
        id={`field-${def.id}`}
        title={def.title}
        hideTitle
        placeholder={def.placeholder}
        guidance={def.guidance}
        value={typeof raw === 'string' ? raw : ''}
        onChange={(v) => setSection(def.id, v)}
      />
    );
  };

  const isCompleted = status === 'COMPLETED';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {backButton}
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground" aria-live="polite">
            {dirty
              ? 'Alterações não salvas'
              : lastSavedAt
                ? `Salvo às ${format(lastSavedAt, 'HH:mm')}`
                : ''}
          </span>
          <Button variant="outline" size="sm">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Exportar PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending || (isCompleted && !dirty)}
          >
            {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {isCompleted ? 'Salvar alterações' : 'Salvar rascunho'}
          </Button>
          {!isCompleted && (
            <Button size="sm" onClick={handleFinalize} disabled={saveMutation.isPending}>
              <Check className="w-3.5 h-3.5 mr-1.5" />
              Salvar e finalizar
            </Button>
          )}
        </div>
      </div>

      {title}

      {isCompleted && (
        <Alert>
          <AlertDescription>
            Esta anamnese foi finalizada. Você pode continuar editando; cada alteração fica registrada
            no histórico.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 items-start lg:grid-cols-[1fr_280px]">
        <Card className="p-5 space-y-4">
          <div className="max-w-xs space-y-2">
            <label htmlFor="assessment-date" className="block text-[12.5px] font-medium text-muted-foreground">
              Data da avaliação
            </label>
            <Input
              id="assessment-date"
              type="date"
              value={assessmentDate}
              onChange={(e) => handleAssessmentDateChange(e.target.value || todayIso())}
            />
          </div>

          {type === 'PREGNANCY' && (
            <ObstetricSummary
              gestational={gestational}
              ultrasound={ultrasound}
              assessmentDate={assessmentDate}
            />
          )}

          {type &&
            ANAMNESIS_FORMS[type].map((def) => (
              <CollapsibleSection key={def.id} id={def.id} title={def.title}>
                {renderSection(def)}
              </CollapsibleSection>
            ))}
        </Card>

        <AnamnesisPatientSidebar
          patient={patient}
          activePackage={activePackage}
          shortcuts={shortcuts}
          onNavigate={requestNavigate}
        />
      </div>

      <AlertDialog open={pendingPath !== null} onOpenChange={(open) => !open && setPendingPath(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Há alterações que ainda não foram salvas nesta anamnese. Se sair agora, elas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const path = pendingPath;
                setDirty(false);
                setPendingPath(null);
                if (path) navigate(path);
              }}
            >
              Sair sem salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

Notes for the implementer:
- `JSX.Element` is used as a global type as in the previous page. If `tsc` complains, import `type JSX` from `react`.
- The `handleSave` `onSuccess` option runs in addition to the mutation-level `onSuccess`.
- `AlertDialogAction` closes the dialog itself; `setPendingPath(null)` is harmless.

- [ ] **Step 7: Run tests to verify they pass**

Run (from `frontend/`): `bunx vitest run src/components/anamnesis src/pages/AnamnesisEditorPage.test.tsx src/hooks`
Expected: PASS. Typical fixes if something fails:
- `getByLabelText('Queixa principal')` finds both the `sr-only` label and nothing else; if multiple matches appear, scope with `getByRole('textbox', { name: 'Queixa principal' })`.
- A `Button variant="link"` that does not exist in `ui/button.tsx` → use `variant="ghost"`.
- Pages that call `anamnesisApi.update` with `{ data, assessmentDate }` only (the draft-PATCH test asserts exact args — if the implementation sends extra keys, fix the implementation, not the test).

- [ ] **Step 8: Type-check**

Run: `bunx tsc --noEmit -p tsconfig.app.json` (or `bunx tsc --noEmit` if there is no `tsconfig.app.json`).
Expected: no new errors (TypeScript is loose here; pre-existing errors in unrelated files may exist — do not fix them).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/anamnesis frontend/src/pages/AnamnesisEditorPage.tsx frontend/src/pages/AnamnesisEditorPage.test.tsx
git commit -m "feat(anamnese): editor com duas fichas, rascunho, autosave e aviso de saída

Part of SOU-66

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Patient profile — Anamnese tab (`AnamnesisTab`)

**Files:**
- Create: `frontend/src/components/anamnesis/AnamnesisTab.tsx`, `frontend/src/components/anamnesis/AnamnesisTab.test.tsx`
- Modify: `frontend/src/pages/PatientProfile.tsx` (replace the Anamnese `TabsContent` body; remove now-unused imports), `frontend/src/pages/PatientProfile.test.tsx` (only if existing assertions about the old anamnesis card break)

**Interfaces:**
- Consumes: `Anamnesis`, `AnamnesisType` (Task 5); `ANAMNESIS_FORMS`, `ANAMNESIS_TYPE_LABELS`, `getSections` (Task 7); `LegacyAnamnesisView`, `ObstetricSummary` (Tasks 9–10).
- Produces: `<AnamnesisTab anamneses onCreate(type) onOpen(id) onDelete(id) />`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/anamnesis/AnamnesisTab.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AnamnesisTab } from './AnamnesisTab';
import type { Anamnesis } from '@/types/clinic';

const make = (over: Partial<Anamnesis>): Anamnesis => ({
  id: 'a1',
  organizationId: 'org',
  patientId: 'p1',
  professionalId: 'pr1',
  type: 'PELVIC_GENERAL',
  status: 'DRAFT',
  assessmentDate: '2026-06-10T00:00:00.000Z',
  completedAt: null,
  data: { sections: {} },
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
  professional: { id: 'pr1', person: { name: 'Dra. Ana' } },
  ...over,
});

const noop = { onCreate: vi.fn(), onOpen: vi.fn(), onDelete: vi.fn() };

describe('AnamnesisTab', () => {
  it('estado vazio', () => {
    render(<AnamnesisTab anamneses={[]} {...noop} />);
    expect(screen.getByText('Nenhuma avaliação registrada')).toBeInTheDocument();
  });

  it('botões criam cada tipo de anamnese', () => {
    const onCreate = vi.fn();
    render(<AnamnesisTab anamneses={[]} {...noop} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: /pélvica geral/i }));
    expect(onCreate).toHaveBeenLastCalledWith('PELVIC_GENERAL');
    fireEvent.click(screen.getByRole('button', { name: /gestacional/i }));
    expect(onCreate).toHaveBeenLastCalledWith('PREGNANCY');
  });

  it('lista tipo, status, profissional e só o conteúdo preenchido', () => {
    render(
      <AnamnesisTab
        {...noop}
        anamneses={[
          make({
            id: 'a1',
            status: 'COMPLETED',
            data: { sections: { chiefComplaint: 'Dor pélvica', urinarySymptoms: '' } },
          }),
        ]}
      />,
    );
    const card = screen.getByTestId('anamnesis-a1');
    expect(within(card).getByText('Anamnese Pélvica Geral')).toBeInTheDocument();
    expect(within(card).getByText('Finalizada')).toBeInTheDocument();
    expect(within(card).getByText(/Dra\. Ana/)).toBeInTheDocument();
    expect(within(card).getByText('Queixa principal')).toBeInTheDocument();
    expect(within(card).getByText('Dor pélvica')).toBeInTheDocument();
    expect(within(card).queryByText('Sintomas urinários')).not.toBeInTheDocument();
  });

  it('rascunho sem conteúdo informa que está vazio', () => {
    render(<AnamnesisTab {...noop} anamneses={[make({ id: 'a1' })]} />);
    expect(within(screen.getByTestId('anamnesis-a1')).getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByText('Nenhum conteúdo registrado')).toBeInTheDocument();
  });

  it('excluir só aparece para rascunho (finalizada não pode ser excluída)', () => {
    render(
      <AnamnesisTab
        {...noop}
        anamneses={[make({ id: 'draft', status: 'DRAFT' }), make({ id: 'done', status: 'COMPLETED' })]}
      />,
    );
    expect(within(screen.getByTestId('anamnesis-draft')).getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
    expect(within(screen.getByTestId('anamnesis-done')).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  });

  it('legado: "Formato anterior", botão Visualizar (não Editar), sem excluir quando finalizado', () => {
    const onOpen = vi.fn();
    render(
      <AnamnesisTab
        {...noop}
        onOpen={onOpen}
        anamneses={[
          make({
            id: 'old',
            type: null,
            status: 'COMPLETED',
            data: {
              queixaPrincipal: { texto: 'Queixa antiga', hipoteses: [] },
              impacto: { texto: '', hipoteses: [] },
              historiaAtual: { texto: '', hipoteses: [] },
              historiaPregressa: { texto: '', hipoteses: [] },
            },
          }),
        ]}
      />,
    );
    const card = screen.getByTestId('anamnesis-old');
    expect(within(card).getByText('Formato anterior')).toBeInTheDocument();
    expect(within(card).getByText('Queixa antiga')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Visualizar' }));
    expect(onOpen).toHaveBeenCalledWith('old');
  });

  it('legado ainda em rascunho continua tratado como legado (Visualizar) e pode ser excluído', () => {
    render(
      <AnamnesisTab
        {...noop}
        anamneses={[make({ id: 'old-draft', type: null, status: 'DRAFT', data: { queixa: 'x' } })]}
      />,
    );
    const card = screen.getByTestId('anamnesis-old-draft');
    expect(within(card).getByText('Formato anterior')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Visualizar' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
  });

  it('gestacional mostra o resumo obstétrico', () => {
    render(
      <AnamnesisTab
        {...noop}
        anamneses={[
          make({
            id: 'g1',
            type: 'PREGNANCY',
            data: { sections: { gestationalData: { dpp: '2027-01-18', obstetricRisk: 'HABITUAL' } } },
          }),
        ]}
      />,
    );
    const card = screen.getByTestId('anamnesis-g1');
    expect(within(card).getByText('Anamnese Gestacional')).toBeInTheDocument();
    expect(within(card).getByText('DPP')).toBeInTheDocument();
    expect(within(card).getByText('18/01/2027')).toBeInTheDocument();
  });

  it('Editar chama onOpen com o id', () => {
    const onOpen = vi.fn();
    render(<AnamnesisTab {...noop} onOpen={onOpen} anamneses={[make({ id: 'a1' })]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(onOpen).toHaveBeenCalledWith('a1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/components/anamnesis/AnamnesisTab.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `AnamnesisTab`**

Create `frontend/src/components/anamnesis/AnamnesisTab.tsx`:

```tsx
import { format } from 'date-fns';
import { Edit, Eye, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Anamnesis, AnamnesisType } from '@/types/clinic';
import { ANAMNESIS_FORMS, ANAMNESIS_TYPE_LABELS, getSections } from './anamnesis-forms';
import { asGestationalData, asUltrasound } from './gestational-data';
import { LegacyAnamnesisView } from './LegacyAnamnesisView';
import { ObstetricSummary } from './ObstetricSummary';

function dateOf(a: Anamnesis): string {
  return a.assessmentDate
    ? a.assessmentDate.slice(0, 10).split('-').reverse().join('/')
    : format(new Date(a.createdAt), 'dd/MM/yyyy');
}

function FilledSections({ anamnesis }: { anamnesis: Anamnesis & { type: AnamnesisType } }) {
  const sections = getSections(anamnesis.data);
  const filled = ANAMNESIS_FORMS[anamnesis.type].filter(
    (def) => def.kind === 'narrative' && typeof sections[def.id] === 'string' && (sections[def.id] as string).trim() !== '',
  );
  const isPregnancy = anamnesis.type === 'PREGNANCY';

  if (filled.length === 0 && !isPregnancy) {
    return <p className="text-[13px] text-muted-foreground">Nenhum conteúdo registrado</p>;
  }

  return (
    <div className="space-y-3">
      {isPregnancy && (
        <ObstetricSummary
          gestational={asGestationalData(sections.gestationalData)}
          ultrasound={asUltrasound(sections.ultrasound)}
          assessmentDate={anamnesis.assessmentDate?.slice(0, 10) ?? anamnesis.createdAt.slice(0, 10)}
        />
      )}
      {filled.length === 0 && <p className="text-[13px] text-muted-foreground">Nenhum conteúdo registrado</p>}
      {filled.map((def) => (
        <div key={def.id} className="p-3 rounded-lg bg-secondary/50">
          <p className="text-[12px] text-muted-foreground">{def.title}</p>
          <p className="text-[13px] font-medium mt-1 whitespace-pre-wrap">{sections[def.id] as string}</p>
        </div>
      ))}
    </div>
  );
}

export function AnamnesisTab({
  anamneses, onCreate, onOpen, onDelete,
}: {
  anamneses: Anamnesis[];
  onCreate: (type: AnamnesisType) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 flex-wrap p-4 border-b border-border">
        <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Anamnese</div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onCreate('PELVIC_GENERAL')}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Pélvica geral
          </Button>
          <Button size="sm" variant="outline" onClick={() => onCreate('PREGNANCY')}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Gestacional
          </Button>
        </div>
      </div>
      <CardContent className="p-4">
        {anamneses.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground text-center py-8">Nenhuma avaliação registrada</p>
        ) : (
          <div className="space-y-6">
            {anamneses.map((a) => {
              const isLegacy = a.type === null;
              const canDelete = a.status !== 'COMPLETED';
              return (
                <div key={a.id} data-testid={`anamnesis-${a.id}`} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-semibold">
                          {isLegacy ? 'Formato anterior' : ANAMNESIS_TYPE_LABELS[a.type as AnamnesisType]}
                        </span>
                        <span
                          className={
                            a.status === 'COMPLETED'
                              ? 'text-[11px] font-medium rounded-full px-2 py-0.5 bg-primary/10 text-primary'
                              : 'text-[11px] font-medium rounded-full px-2 py-0.5 bg-secondary text-muted-foreground'
                          }
                        >
                          {a.status === 'COMPLETED' ? 'Finalizada' : 'Rascunho'}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-muted-foreground">
                        {dateOf(a)}
                        {a.professional?.person?.name && ` · ${a.professional.person.name}`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onOpen(a.id)}>
                        {isLegacy ? <Eye className="w-3.5 h-3.5 mr-1" /> : <Edit className="w-3.5 h-3.5 mr-1" />}
                        {isLegacy ? 'Visualizar' : 'Editar'}
                      </Button>
                      {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Excluir"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir rascunho</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. O rascunho será permanentemente excluído.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => onDelete(a.id)}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  {isLegacy ? (
                    <LegacyAnamnesisView data={a.data} />
                  ) : (
                    <FilledSections anamnesis={a as Anamnesis & { type: AnamnesisType }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Wire it into `PatientProfile.tsx`**

1. Replace the import line `import { ANAMNESIS_FIELDS, GroupedHypotheses, isAnamnesisData, formatAnamnesisKey } from '@/components/anamnesis/anamnesis-fields';` with:
```tsx
import { AnamnesisTab } from '@/components/anamnesis/AnamnesisTab';
```
2. Replace everything inside `<TabsContent value="anamnesis" className="mt-0">` … `</TabsContent>` (the whole `<Card className="p-0 overflow-hidden">…</Card>` — the block from `{/* === Anamnese === */}` ~L543 to its closing `)}` ~L655) with:

```tsx
            {/* === Anamnese === */}
            {hasAnamnesis && (
              <TabsContent value="anamnesis" className="mt-0">
                <AnamnesisTab
                  anamneses={anamneses}
                  onCreate={(type) => navigate(`/patients/${id}/anamnesis/new?type=${type}`)}
                  onOpen={(anamnesisId) => navigate(`/patients/${id}/anamnesis/${anamnesisId}`)}
                  onDelete={(anamnesisId) => deleteAnamnesismutation.mutate(anamnesisId)}
                />
              </TabsContent>
            )}
```
3. Remove imports that became unused **only if** ESLint/tsc flags them (e.g. `Eye`, `Edit`, `Trash2`, `Pencil` are probably still used elsewhere in the file — check before deleting).
4. `deleteAnamnesismutation` (around L116) stays. Its error path: the backend now answers 409 for finalized records (the UI hides the button, so this is defense in depth). Add to that mutation an `onError` toast if it has none: `onError: () => toast.error('Não foi possível excluir a anamnese')`.

- [ ] **Step 5: Run the suites**

Run (from `frontend/`): `bunx vitest run src/components/anamnesis src/pages/PatientProfile.test.tsx`
Expected: PASS. If `PatientProfile.test.tsx` has assertions tied to the old card (e.g. the "Nova avaliação" button label, "Editar" for any anamnesis, the old hypothesis rendering), update them to the new behavior (two "Nova …" buttons, statuses, legacy label). Keep the intent of each test.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/anamnesis/AnamnesisTab.tsx frontend/src/components/anamnesis/AnamnesisTab.test.tsx frontend/src/pages/PatientProfile.tsx frontend/src/pages/PatientProfile.test.tsx
git commit -m "feat(anamnese): aba Anamnese do perfil com tipos, status e legado somente leitura

Part of SOU-66

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Cleanup, docs, version bump and full verification

**Files:**
- Modify: `frontend/src/components/anamnesis/anamnesis-fields.tsx` and `anamnesis-fields.test.tsx` (remove editor-only pieces), `CLAUDE.md`, `docs/superpowers/specs/2026-09-30-anamnese-pelvica-gestacional-design.md`, `frontend/package.json`

- [ ] **Step 1: Remove the dead editor-only code**

`HypothesisField`, `FormRow`, `FieldTextarea`, `emptyAnamnesisFieldData` and `emptyAnamnesisData` are no longer used by any editor. Confirm with the graph/grep first (`graft callers HypothesisField` or `grep -rn "HypothesisField\|emptyAnamnesisData" frontend/src`); only the test file and `anamnesis-fields.tsx` itself should match.

In `anamnesis-fields.tsx` delete `FormRow`, `FieldTextarea`, `HypothesisFieldProps`, `HypothesisField`, `emptyAnamnesisFieldData`, `emptyAnamnesisData`, and the now-unused `useState`/`X` imports. **Keep** `AnamnesisFieldData`, `ANAMNESIS_FIELDS`, `AnamnesisFieldKey`, `AnamnesisData`, `formatAnamnesisKey`, `groupHypotheses`, `GroupedHypotheses`, `isAnamnesisData` (used by the legacy view).

In `anamnesis-fields.test.tsx` delete the `describe('HypothesisField', ...)` block, `renderField`, and the unused imports; keep the `GroupedHypotheses` / `groupHypotheses` / `isAnamnesisData` tests. If a kept test used `emptyAnamnesisData()`, replace it with an inline object literal of the same shape.

Run: `bunx vitest run src/components/anamnesis`
Expected: PASS.

- [ ] **Step 2: Fix the spec where the implementation deliberately differs**

In `docs/superpowers/specs/2026-09-30-anamnese-pelvica-gestacional-design.md`:
- Replace the mention of `useBlocker` with: "`beforeunload` + interceptação de cliques em links internos (`useUnsavedChangesGuard`) — `useBlocker` exige data router e o app usa `BrowserRouter`; o botão Voltar do navegador não é interceptado."
- Remove `SectionNav` from the components list and state: "navegação por seções expansíveis/recolhíveis (`CollapsibleSection`)" (the issue allows either option).
- In the `gestationalData` shape, replace `gestationalAge: { weeks, days, source, manualOverride }` with `gaSource` (top-level) + `gestationalAge: { weeks, days, manualOverride }`.
- In "Autosave", keep "somente em rascunho".
- Add under Backend: "`POST` também valida que o paciente pertence à organização (antes não havia checagem)."
- Add under Frontend: "Seleção de tipo na aba do paciente são dois botões (Pélvica geral / Gestacional), não um menu."

- [ ] **Step 3: Update `CLAUDE.md`**

- Pages table, "Anamnese" row → `AnamnesisEditorPage.tsx`: "Duas fichas (`PELVIC_GENERAL`, `PREGNANCY`) com seções narrativas opcionais e orientação "Investigar:" fora do registro; rascunho/finalizada, autosave (30 s, só rascunho), aviso ao sair; reached via patient profile's Anamnese tab (`/patients/:id/anamnesis/new?type=`)".
- Backend module table, `anamnesis` row → add: "tipos, status DRAFT/COMPLETED, merge por seção, revisões em `anamnesis_revisions`, legado (`type = null`) somente leitura, DELETE só de rascunho".
- Prisma "Models" list: add `AnamnesisRevision`; "Enums": add `AnamnesisType`, `AnamnesisStatus`.
- Domain model: `Patient` gains `occupation?`, `maritalStatus?` (`SINGLE|MARRIED|STABLE_UNION|DIVORCED|WIDOWED|OTHER`).
- Test suites table: update the `anamnesis.service.spec.ts` row to "Criação por tipo, merge por seção, revisões ao editar finalizada, legado 409, exclusão só de rascunho, isolamento por org" and add `anamnesis-sections.spec.ts` ("ids por tipo, validação, chaves de protótipo").

- [ ] **Step 4: Bump the frontend version (project convention)**

In `frontend/package.json` change `"version": "0.7.2"` to `"version": "0.8.0"`.

- [ ] **Step 5: Full verification**

Run from the repo root, in this order, and do not claim success without the outputs:

```bash
bun run backend:test
bun run frontend:test
(cd frontend && bun run lint)
bun run backend:build
bun run frontend:build
```

Expected: all green. Do **not** run `bun run lint` in `backend/`. If `frontend:lint` reports pre-existing warnings unrelated to touched files, leave them and list them in the PR; fix any introduced by this change.

Also run `bun run test:cov` in `backend/` and confirm the thresholds (80% statements/functions/lines, 75% branches) still hold.

- [ ] **Step 6: Manual check (only after the user approves applying the migration — see Execution notes)**

With the migration applied and `bun run backend:dev` + `bun run frontend:dev`: (1) create a Pélvica Geral, type in a field, confirm "Investigar:" stays below and is absent from the saved content, save as draft, reload and continue; (2) finalize, edit, confirm an `anamnesis_revisions` row exists; (3) create a Gestacional, enter a DUM and confirm DPP + IG, enter an ultrasound and switch the source; (4) open a legacy record and confirm it is read-only with no delete; (5) in the patient form set Profissão/Estado civil and see them in the profile header and in the anamnesis Identificação. If the migration is not applied, say so explicitly in the PR instead of claiming manual verification.

- [ ] **Step 7: Commit, then open the PR**

```bash
git add -A frontend/src frontend/package.json CLAUDE.md docs/superpowers/specs
git commit -m "chore: bump version to 0.8.0

Remove código morto do editor antigo, atualiza CLAUDE.md e spec.

Part of SOU-66

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Stage only the files above (never `.mcp.json` / `AGENTS.md`). Push and open the PR against `main` only when the user asks. PR description must say: **merging runs `prisma migrate deploy` on prod** (additive migration + legacy backfill `UPDATE`), list the SQL file, and end with:

```
Fixes SOU-66

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Self-Review (completed while writing)

**Spec coverage**

| Spec section | Task |
|---|---|
| Schema, enums, revisions, backfill | 1 |
| `Patient.occupation/maritalStatus` (backend) | 2 |
| Section ids/validation per type, `sectionId` hardening | 3 |
| Create/PATCH/DELETE rules, merge por seção, revisão transacional, 409 legado, delete só rascunho, tenant check | 4 |
| Patient form/profile + frontend types/API | 5 |
| IG/DPP (DUM+280, ultrassom, manual, ranges) | 6 |
| Form definitions (literal texts), obstetric recompute logic (manual never overwritten) | 7 |
| `ClinicalNarrativeField`, guidance not stored, collapsible sections, unsaved-changes warning, autosave | 8 |
| `GestationalDataFields`, `UltrasoundFields`, `ObstetricSummary`, risco select | 9 |
| Editor page: drafts/finalize, status banner, identification from registry, legacy read-only, autoload/continue | 10 |
| Profile tab: type, status, legacy label, delete rules | 11 |
| Docs, dead code, version bump, verification | 12 |

**Deliberate deviations from the spec (recorded in Task 12 Step 2):** `useBlocker` → `beforeunload` + link-click interception (app uses `BrowserRouter`); `SectionNav` dropped (collapsible sections satisfy the "ou" in the issue); `gestationalAge.source` → top-level `gaSource`; type chooser is two buttons; `POST` now verifies the patient belongs to the org.

**Type/name consistency checked:** `normalizeAnamnesisData`/`extractSections` (Tasks 3→4); `recomputeGestational`, `changeGaSource`, `editDpp`, `applyCalculatedDpp`, `setManualGa`, `calculatedDpp`, `asGestationalData`, `asUltrasound` (Tasks 7→9→10); `getSections`, `asRecord`, `ANAMNESIS_FORMS`, `ANAMNESIS_TYPE_LABELS` (Tasks 7→10→11); `useUnsavedChangesGuard(dirty, onBlocked)` and `useAutosave({ enabled, intervalMs, onSave })` (Tasks 8→10); API signatures `create({patientId,type,assessmentDate?,data?})`, `update(id,{data?,assessmentDate?,status?})` (Tasks 4→5→10); `gaSource`/`dppSource` values `DUM|ULTRASSONOGRAFIA|MANUAL` and `obstetricRisk` values match across backend validation, frontend labels, and tests.

**Known limitations (documented, not fixed):** the browser Back button is not intercepted by the unsaved-changes guard; the patient form only sends non-empty values, so `occupation`/`maritalStatus` cannot be cleared from the form (same pre-existing behavior as every other optional patient field); revisions have no UI yet (by design).
