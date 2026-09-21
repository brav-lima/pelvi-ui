# Patient Portal — Feature Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the patient-portal feature (invite/consent-status/plan-toggle on the professional side) behind the existing per-plan feature-flag system, so it ships to prod dark — off for every real clinic — until the product owner enables it for internal testing and decides whether it becomes a paid-tier differentiator.

**Architecture:** Reuse the existing `PlanFeature` mechanism end to end — no new gating infrastructure. Add `'PATIENT_PORTAL'` as a new key to the shared `PlanFeature` union (backend `plan-features.ts`, frontend `types/clinic.ts`), apply the existing `@RequireFeature('PATIENT_PORTAL')` class decorator to the two professional-facing patient-portal controllers, and wrap the frontend's `PatientPortalCard` render with the existing `<FeatureGate feature="PATIENT_PORTAL">` component. Because no plan in pelvi-admin's database will list this key yet, every org's `SubscriptionService.hasFeature('PATIENT_PORTAL')` returns `false` immediately on merge — no separate "off by default" step needed.

**Tech Stack:** NestJS `PlanGuard` + `@RequireFeature`, React `useFeature`/`<FeatureGate>` (both already built, unmodified by this plan).

**Spec:** No new spec — this reuses the feature-gating system documented in this repo's `CLAUDE.md` under "Feature Gating (Subscription)". Builds on top of the already-merged `patient-portal` backend (PR #179, not yet in `main`) and the already-merged web UI (PR #180, merged into `worktree-patient-portal-backend`).

## Global Constraints

- The two `@Public()` patient-facing controllers (`PatientAuthController`, `PatientConsentController`, `PatientMeController`) must **not** get `@RequireFeature` — `@Public()` already skips `PlanGuard` entirely for them, and they're only reachable in practice once an org's invite flow (which *is* gated) has created a `PatientAccountLink`. Do not touch those controllers.
- Only the two professional-facing, org-authenticated controllers get the decorator: `PatientInviteController` and `PatientTreatmentPlanController`.
- `PATIENT_PORTAL` must not appear in any pelvi-admin plan's `features` array as part of this plan — that assignment (and any internal/beta plan setup) is explicitly out of scope; the product owner handles it in pelvi-admin separately.
- No e2e test file exists yet for `patient-portal` endpoints, and the e2e helper (`test/helpers/app.helper.ts`) mocks subscription status from `ALL_PLAN_FEATURES` dynamically — adding the key there is sufficient; no e2e test changes needed.
- `PatientPortalCard`'s own component/tests (Task 2 of the prior plan) are already reviewed and merged — do not modify `PatientPortalCard.tsx`/`.test.tsx`. Gate at the call site (`PatientProfile.tsx`) instead, using the existing `<FeatureGate>` wrapper — this is a zero-risk, purely additive change to already-shipped code.
- `PatientProfile.test.tsx` already mocks `@/contexts/SubscriptionContext` with `useFeature: () => true` unconditionally — `<FeatureGate>` calls that same mocked hook internally, so wrapping the card in `<FeatureGate>` needs no test changes.

---

## Task 1: Backend — add `PATIENT_PORTAL` feature key and gate the two professional-facing controllers

**Files:**
- Modify: `backend/src/subscription/plan-features.ts`
- Modify: `backend/src/patient-portal/patient-invite.controller.ts`
- Modify: `backend/src/patient-portal/patient-treatment-plan.controller.ts`

- [ ] **Step 1: Add the new key to the `PlanFeature` union and `ALL_PLAN_FEATURES`**

```typescript
// backend/src/subscription/plan-features.ts
export type PlanFeature =
  | 'AGENDA'
  | 'PATIENTS'
  | 'FINANCIAL_BASIC'
  | 'FINANCIAL_ADVANCED'
  | 'PERINEAL_ASSESSMENT'
  | 'TREATMENT_PACKAGES'
  | 'ANAMNESIS'
  | 'EVOLUTIONS'
  | 'ROLES'
  | 'MULTI_PROFESSIONAL'
  | 'MULTI_CLINIC'
  | 'PRIORITY_SUPPORT'
  | 'DOCUMENTS'
  | 'PATIENT_PORTAL';

export const ALL_PLAN_FEATURES: PlanFeature[] = [
  'AGENDA',
  'PATIENTS',
  'FINANCIAL_BASIC',
  'FINANCIAL_ADVANCED',
  'PERINEAL_ASSESSMENT',
  'TREATMENT_PACKAGES',
  'ANAMNESIS',
  'EVOLUTIONS',
  'ROLES',
  'MULTI_PROFESSIONAL',
  'MULTI_CLINIC',
  'PRIORITY_SUPPORT',
  'DOCUMENTS',
  'PATIENT_PORTAL',
];
```

- [ ] **Step 2: Gate `PatientInviteController`**

```typescript
// backend/src/patient-portal/patient-invite.controller.ts
import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequireFeature } from '../subscription/decorators/require-feature.decorator';
import { PatientInviteService } from './patient-invite.service';

@RequireFeature('PATIENT_PORTAL')
@ApiBearerAuth()
@ApiTags('Patient Portal - Convites')
@Controller('patient-portal')
export class PatientInviteController {
  // ... rest of the class is unchanged
```

(Add the `RequireFeature` import alongside the existing imports, and the `@RequireFeature('PATIENT_PORTAL')` class decorator directly above `@ApiBearerAuth()` — matching the exact placement `AppointmentController` uses for `@RequireFeature('AGENDA')`. Do not change anything else in the file.)

- [ ] **Step 3: Gate `PatientTreatmentPlanController`**

```typescript
// backend/src/patient-portal/patient-treatment-plan.controller.ts
import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequireFeature } from '../subscription/decorators/require-feature.decorator';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientTreatmentPlanService } from './patient-treatment-plan.service';
import { UpdatePatientTreatmentPlanDto } from './dto/update-patient-treatment-plan.dto';

@RequireFeature('PATIENT_PORTAL')
@ApiBearerAuth()
@ApiTags('Patient Portal - Plano de tratamento')
@Controller('patient-portal/patients')
export class PatientTreatmentPlanController {
  // ... rest of the class is unchanged
```

(Same placement convention as Step 2. Do not change anything else in the file.)

- [ ] **Step 4: Verify**

Run: `cd backend && npx jest src/subscription src/patient-portal --forceExit`
Expected: all existing suites still PASS unchanged — these are service-level unit tests that mock `PrismaService` directly and never go through `PlanGuard`, so they are unaffected by the new class decorator. This step confirms nothing broke, not new coverage (there is no controller-level spec file anywhere in this codebase to update — see Global Constraints).

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/subscription/plan-features.ts backend/src/patient-portal/patient-invite.controller.ts backend/src/patient-portal/patient-treatment-plan.controller.ts
git commit -m "feat(patient-portal): gate invite and treatment-plan endpoints behind PATIENT_PORTAL feature flag

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Frontend — add `PATIENT_PORTAL` type and gate `PatientPortalCard`'s render

**Files:**
- Modify: `frontend/src/types/clinic.ts`
- Modify: `frontend/src/pages/PatientProfile.tsx`
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Add the new key to the `PlanFeature` union**

```typescript
// frontend/src/types/clinic.ts — line ~305
export type PlanFeature =
  | 'AGENDA'
  | 'PATIENTS'
  | 'FINANCIAL_BASIC'
  | 'FINANCIAL_ADVANCED'
  | 'PERINEAL_ASSESSMENT'
  | 'TREATMENT_PACKAGES'
  | 'ANAMNESIS'
  | 'EVOLUTIONS'
  | 'ROLES'
  | 'MULTI_PROFESSIONAL'
  | 'MULTI_CLINIC'
  | 'PRIORITY_SUPPORT'
  | 'DOCUMENTS'
  | 'PATIENT_PORTAL';
```

- [ ] **Step 2: Wrap `PatientPortalCard`'s render in `PatientProfile.tsx` with `<FeatureGate>`**

```typescript
// frontend/src/pages/PatientProfile.tsx — add to the imports, next to the
// existing PatientPortalCard import:
import { FeatureGate } from '@/components/auth/FeatureGate';
```

```typescript
// frontend/src/pages/PatientProfile.tsx — replace:
            <PatientPortalCard patientId={id!} patientCpf={patient.cpf} />

// with:
            <FeatureGate feature="PATIENT_PORTAL">
              <PatientPortalCard patientId={id!} patientCpf={patient.cpf} />
            </FeatureGate>
```

- [ ] **Step 3: Add the Portuguese label to `Settings.tsx`'s `FEATURE_LABELS` map**

```typescript
// frontend/src/pages/Settings.tsx — add to the FEATURE_LABELS object, after DOCUMENTS:
  DOCUMENTS:            'Módulo de Documentos',
  PATIENT_PORTAL:       'Portal da Paciente',
};
```

- [ ] **Step 4: Verify**

Run: `cd frontend && bunx vitest run src/pages/PatientProfile.test.tsx`
Expected: PASS (2/2, unchanged) — the file's existing `vi.mock('@/contexts/SubscriptionContext', () => ({ useFeature: () => true }))` mock makes `<FeatureGate>` render its children unconditionally, so no test changes are needed (see Global Constraints).

Run: `cd frontend && bun run test`
Expected: full suite PASS, same count as before (36 files / 273 tests) — this task touches no test files.

Run: `cd frontend && bunx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "types/clinic\.ts|pages/PatientProfile\.tsx|pages/Settings\.tsx"`
Expected: no output (this repo has pre-existing, unrelated `tsc` errors elsewhere — see the prior plan's Global Constraints for why this file-scoped grep is used instead of a clean full-repo run).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/clinic.ts frontend/src/pages/PatientProfile.tsx frontend/src/pages/Settings.tsx
git commit -m "feat(patient-portal): gate the Portal da paciente card behind PATIENT_PORTAL feature flag

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Version bump

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Bump the version**

```json
// frontend/package.json — line 4
  "version": "0.7.1",
```

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json
git commit -m "chore: bump version to 0.7.1

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
