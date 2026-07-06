# PostHog Analytics (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instrument Pelvi's frontend with PostHog Cloud to measure which staff-facing features are actually used, via pageview autocapture + 10 typed business events, with zero patient PII.

**Architecture:** A single wrapper module (`frontend/src/lib/analytics.ts`) is the only code that talks to `posthog-js`. It's initialized in `main.tsx`, wired to identify/reset in `AuthContext.tsx` at the same points `Sentry.setUser()` already runs, and called from the `onSuccess` path of each domain create/complete mutation across existing dialogs and pages.

**Tech Stack:** `posthog-js` (new dependency), React, TypeScript, Vitest + Testing Library (existing).

## Global Constraints

- Zero PII de paciente em qualquer evento ou property (nome, CPF, e-mail, telefone, endereço, texto livre de anamnese/evolução/avaliação são proibidos). IDs (UUID) são permitidos como referência opaca.
- `autocapture: false` — não usar autocapture de clique. Só `capture_pageview: true` + eventos manuais.
- `disable_session_recording: true` — sem session replay nesta fase.
- Todo evento de negócio usa o enum `AnalyticsEvent` — nunca uma string literal solta em `posthog.capture(...)`.
- Nenhum componente chama `posthog.*` diretamente — sempre via `frontend/src/lib/analytics.ts`.
- `initAnalytics()`/`track()`/`identifyUser()`/`resetUser()` são no-op seguro quando `VITE_POSTHOG_KEY` não está definido (dev local, testes).
- Spec de referência: `docs/superpowers/specs/2026-07-06-posthog-analytics-design.md`.

---

### Task 1: Add `posthog-js` dependency

**Files:**
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `posthog-js` importable as `import posthog from 'posthog-js'` in later tasks.

- [ ] **Step 1: Install the dependency**

Run (from `frontend/`):
```bash
bun add posthog-js
```

- [ ] **Step 2: Verify it's in `package.json` dependencies**

Run: `grep posthog-js package.json`
Expected: a line like `"posthog-js": "^1.x.x",` under `"dependencies"`.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/bun.lock
git commit -m "chore: add posthog-js dependency"
```

---

### Task 2: Create the analytics wrapper module

**Files:**
- Create: `frontend/src/lib/analytics.ts`
- Test: `frontend/src/lib/analytics.test.ts`

**Interfaces:**
- Consumes: `posthog-js` default export (`posthog.init`, `posthog.capture`, `posthog.identify`, `posthog.group`, `posthog.reset`).
- Produces (used by all later tasks):
  - `export enum AnalyticsEvent { PatientCreated, AppointmentCreated, AppointmentCanceled, ProcedureCreated, FinancialRecordCreated, FinancialRecordPaid, TreatmentPackageCreated, EvolutionCreated, PerinealAssessmentCreated, Login }` (string values, see step 3)
  - `export function initAnalytics(): void`
  - `export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void`
  - `export function identifyUser(personId: string, props: { role: string; organizationId: string }): void`
  - `export function resetUser(): void`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/analytics.test.ts`:

```ts
import { vi, beforeEach, describe, it, expect } from 'vitest';

const posthogMock = {
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  group: vi.fn(),
  reset: vi.fn(),
};

vi.mock('posthog-js', () => ({ default: posthogMock }));

describe('analytics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('does not call posthog.init when VITE_POSTHOG_KEY is not set', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    const { initAnalytics } = await import('./analytics');
    initAnalytics();
    expect(posthogMock.init).not.toHaveBeenCalled();
  });

  it('calls posthog.init with the expected config when VITE_POSTHOG_KEY is set', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    const { initAnalytics } = await import('./analytics');
    initAnalytics();
    expect(posthogMock.init).toHaveBeenCalledWith(
      'phc_test_key',
      expect.objectContaining({
        api_host: 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: true,
        autocapture: false,
        disable_session_recording: true,
      }),
    );
  });

  it('track() is a no-op before initAnalytics() runs', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    const { track, AnalyticsEvent } = await import('./analytics');
    track(AnalyticsEvent.Login);
    expect(posthogMock.capture).not.toHaveBeenCalled();
  });

  it('track() calls posthog.capture with the event and properties after init', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    const { initAnalytics, track, AnalyticsEvent } = await import('./analytics');
    initAnalytics();
    track(AnalyticsEvent.PatientCreated, { foo: 'bar' });
    expect(posthogMock.capture).toHaveBeenCalledWith('patient_created', { foo: 'bar' });
  });

  it('identifyUser() calls posthog.identify and posthog.group after init', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    const { initAnalytics, identifyUser } = await import('./analytics');
    initAnalytics();
    identifyUser('person-1', { role: 'ADMIN', organizationId: 'org-1' });
    expect(posthogMock.identify).toHaveBeenCalledWith('person-1', { role: 'ADMIN' });
    expect(posthogMock.group).toHaveBeenCalledWith('organization', 'org-1');
  });

  it('identifyUser() is a no-op before initAnalytics() runs', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    const { identifyUser } = await import('./analytics');
    identifyUser('person-1', { role: 'ADMIN', organizationId: 'org-1' });
    expect(posthogMock.identify).not.toHaveBeenCalled();
  });

  it('resetUser() calls posthog.reset after init', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    const { initAnalytics, resetUser } = await import('./analytics');
    initAnalytics();
    resetUser();
    expect(posthogMock.reset).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && bunx vitest run src/lib/analytics.test.ts`
Expected: FAIL — `Cannot find module './analytics'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/analytics.ts`:

```ts
import posthog from 'posthog-js';

export enum AnalyticsEvent {
  PatientCreated = 'patient_created',
  AppointmentCreated = 'appointment_created',
  AppointmentCanceled = 'appointment_canceled',
  ProcedureCreated = 'procedure_created',
  FinancialRecordCreated = 'financial_record_created',
  FinancialRecordPaid = 'financial_record_paid',
  TreatmentPackageCreated = 'treatment_package_created',
  EvolutionCreated = 'evolution_created',
  PerinealAssessmentCreated = 'perineal_assessment_created',
  Login = 'login',
}

let initialized = false;

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    autocapture: false,
    disable_session_recording: true,
  });
  initialized = true;
}

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function identifyUser(
  personId: string,
  props: { role: string; organizationId: string },
): void {
  if (!initialized) return;
  posthog.identify(personId, { role: props.role });
  posthog.group('organization', props.organizationId);
}

export function resetUser(): void {
  if (!initialized) return;
  posthog.reset();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run src/lib/analytics.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/analytics.ts frontend/src/lib/analytics.test.ts
git commit -m "feat(analytics): add PostHog wrapper with typed events"
```

---

### Task 3: Initialize analytics in `main.tsx`

**Files:**
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Consumes: `initAnalytics` from Task 2 (`frontend/src/lib/analytics.ts`).

- [ ] **Step 1: Add the import and call**

In `frontend/src/main.tsx`, add the import alongside the existing Sentry import, and call `initAnalytics()` before `createRoot(...).render(...)`:

```ts
import * as Sentry from "@sentry/react";
import { browserTracingIntegration, replayIntegration } from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAnalytics } from "@/lib/analytics";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  release: import.meta.env.VITE_APP_VERSION,
  environment: import.meta.env.MODE,
  integrations: [
    browserTracingIntegration(),
    replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  tracePropagationTargets: [import.meta.env.VITE_API_URL ?? "http://localhost:3000"],
});

initAnalytics();

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>Algo deu errado. Recarregue a página.</p>}>
    <App />
  </Sentry.ErrorBoundary>
);
```

There's no existing test file for `main.tsx` (it's an entry point with no exported logic) — no test step here, this is bootstrap wiring only.

- [ ] **Step 2: Run the full frontend test suite to confirm nothing broke**

Run: `cd frontend && bun run test`
Expected: all existing test files still pass (no regressions from the new import).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/main.tsx
git commit -m "feat(analytics): initialize PostHog on app boot"
```

---

### Task 4: Wire identify/reset/login into `AuthContext`

**Files:**
- Modify: `frontend/src/contexts/AuthContext.tsx`
- Test: `frontend/src/contexts/AuthContext.test.tsx` (add assertions, no new mocks needed)

**Interfaces:**
- Consumes: `identifyUser`, `resetUser`, `track`, `AnalyticsEvent` from Task 2.
- Note: `frontend/src/contexts/AuthContext.test.tsx` does **not** mock `@/lib/analytics` today, and does not need to — `identifyUser`/`resetUser`/`track` are no-ops in the test environment because `VITE_POSTHOG_KEY` is never set there (verified in Task 2). The existing `Sentry.setUser()` calls already run unmocked in these tests the same way.

- [ ] **Step 1: Add the import**

In `frontend/src/contexts/AuthContext.tsx`, add after the existing Sentry import (line 2):

```ts
import * as Sentry from '@sentry/react';
import { identifyUser, resetUser, track, AnalyticsEvent } from '@/lib/analytics';
```

- [ ] **Step 2: Wire `resetUser()` into `clearSession`**

Replace (around line 42-49):
```ts
  const clearSession = useCallback(() => {
    queryClient.clear();
    setUser(null);
    setSelectedClinic(null);
    setClinics([]);
    setPendingPreAuthToken(null);
    Sentry.setUser(null);
  }, [queryClient]);
```
with:
```ts
  const clearSession = useCallback(() => {
    queryClient.clear();
    setUser(null);
    setSelectedClinic(null);
    setClinics([]);
    setPendingPreAuthToken(null);
    Sentry.setUser(null);
    resetUser();
  }, [queryClient]);
```

- [ ] **Step 3: Wire `identifyUser()` into session restoration**

Replace (around line 77):
```ts
          setSelectedClinic(profile.organization);
          Sentry.setUser({ id: profile.person.id, username: profile.person.name, organizationId: profile.organization.id });
        }
```
with:
```ts
          setSelectedClinic(profile.organization);
          Sentry.setUser({ id: profile.person.id, username: profile.person.name, organizationId: profile.organization.id });
          identifyUser(profile.person.id, { role: profile.role, organizationId: profile.organization.id });
        }
```

- [ ] **Step 4: Wire `identifyUser()` + `track(Login)` into single-clinic login**

Replace (around line 114-115):
```ts
      setSelectedClinic(response.organization);
      Sentry.setUser({ id: response.person.id, username: response.person.name, organizationId: response.organization.id });
      return { success: true, multiClinic: false };
```
with:
```ts
      setSelectedClinic(response.organization);
      Sentry.setUser({ id: response.person.id, username: response.person.name, organizationId: response.organization.id });
      identifyUser(response.person.id, { role: response.role, organizationId: response.organization.id });
      track(AnalyticsEvent.Login, { role: response.role });
      return { success: true, multiClinic: false };
```

- [ ] **Step 5: Wire `identifyUser()` + `track(Login)` into `selectClinic` (multi-clinic flow)**

Replace (around line 136-138):
```ts
      setSelectedClinic(response.organization);
      Sentry.setUser({ id: response.person.id, username: response.person.name, organizationId: response.organization.id });
      setPendingPreAuthToken(null);
      return true;
```
with:
```ts
      setSelectedClinic(response.organization);
      Sentry.setUser({ id: response.person.id, username: response.person.name, organizationId: response.organization.id });
      identifyUser(response.person.id, { role: response.role, organizationId: response.organization.id });
      track(AnalyticsEvent.Login, { role: response.role });
      setPendingPreAuthToken(null);
      return true;
```

- [ ] **Step 6: Run the existing AuthContext test suite**

Run: `cd frontend && bunx vitest run src/contexts/AuthContext.test.tsx`
Expected: PASS — all existing tests still green (the new calls are no-ops in the test env).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/contexts/AuthContext.tsx
git commit -m "feat(analytics): identify/reset user and track login in AuthContext"
```

---

### Task 5: Track `patient_created`

**Files:**
- Modify: `frontend/src/components/patients/PatientFormDialog.tsx`

**Interfaces:**
- Consumes: `track`, `AnalyticsEvent` from Task 2.

- [ ] **Step 1: Add the import**

Add near the top of `frontend/src/components/patients/PatientFormDialog.tsx`, after the `zod` import:
```ts
import { track, AnalyticsEvent } from '@/lib/analytics';
```

- [ ] **Step 2: Fire the event on successful creation**

Replace (around line 147-149):
```ts
        const created = await patientsApi.create({ ...payload, name: data.name });
        toast.success('Paciente cadastrado com sucesso');
        onSuccess(created);
```
with:
```ts
        const created = await patientsApi.create({ ...payload, name: data.name });
        toast.success('Paciente cadastrado com sucesso');
        track(AnalyticsEvent.PatientCreated);
        onSuccess(created);
```

- [ ] **Step 3: Run the frontend test suite to confirm no regressions**

Run: `cd frontend && bun run test`
Expected: all tests pass (there is no existing `PatientFormDialog.test.tsx`, so this is a manual-verification-only change — no assertions to add).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/patients/PatientFormDialog.tsx
git commit -m "feat(analytics): track patient_created"
```

---

### Task 6: Track `appointment_created`

**Files:**
- Modify: `frontend/src/components/appointments/AppointmentFormDialog.tsx`
- Test: `frontend/src/components/appointments/AppointmentFormDialog.test.tsx`

**Interfaces:**
- Consumes: `track`, `AnalyticsEvent` from Task 2.

- [ ] **Step 1: Write the failing test**

In `frontend/src/components/appointments/AppointmentFormDialog.test.tsx`, add a mock for `@/lib/analytics` near the other `vi.mock` calls (after the `sonner` mock, around line 27):
```ts
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  AnalyticsEvent: { AppointmentCreated: 'appointment_created' },
}));
```

Add the import at the top (with the other imports, after `import { toast } from 'sonner';` if present, or alongside the `@/lib/api` import):
```ts
import { track } from '@/lib/analytics';
```

Add a new test right after the existing `'chama onSuccess e fecha o dialog após criar com sucesso'` test (after line 266):
```ts
  it('dispara analytics track(appointment_created) ao criar com sucesso', async () => {
    vi.mocked(appointmentsApi.create).mockResolvedValue({} as any);
    renderDialog();
    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: /agendar/i }));

    await waitFor(() => {
      expect(track).toHaveBeenCalledWith('appointment_created');
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && bunx vitest run src/components/appointments/AppointmentFormDialog.test.tsx -t "analytics"`
Expected: FAIL — `track` was not called (not wired yet).

- [ ] **Step 3: Wire the event in the component**

In `frontend/src/components/appointments/AppointmentFormDialog.tsx`, add the import after the `import type { Appointment, Patient } from '@/types/clinic';` line:
```ts
import { track, AnalyticsEvent } from '@/lib/analytics';
```

Replace (around line 234-242, the `else` branch of `submitSingle` that creates a single non-recurring appointment):
```ts
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
```
with:
```ts
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
      track(AnalyticsEvent.AppointmentCreated);
    }
```

Note: `submitBulk` (recurring appointment series) is **not** instrumented in this phase — the spec's event table only covers single-appointment creation.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && bunx vitest run src/components/appointments/AppointmentFormDialog.test.tsx`
Expected: PASS — all tests in the file, including the new one.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/appointments/AppointmentFormDialog.tsx frontend/src/components/appointments/AppointmentFormDialog.test.tsx
git commit -m "feat(analytics): track appointment_created"
```

---

### Task 7: Track `appointment_canceled`

**Files:**
- Modify: `frontend/src/pages/Agenda.tsx`

**Interfaces:**
- Consumes: `track`, `AnalyticsEvent` from Task 2.

- [ ] **Step 1: Add the import**

Add in `frontend/src/pages/Agenda.tsx` after the `import { isSlotBlocked, type BusinessHour } from '@/lib/business-hours';` line:
```ts
import { track, AnalyticsEvent } from '@/lib/analytics';
```

- [ ] **Step 2: Fire the event only when the new status is CANCELED**

Replace (around line 321-332, `statusMutation`'s `onSuccess`):
```ts
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
```
with:
```ts
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
      if (updated.status === 'CANCELED') {
        track(AnalyticsEvent.AppointmentCanceled);
      }
    },
```

- [ ] **Step 3: Run the frontend test suite to confirm no regressions**

Run: `cd frontend && bun run test`
Expected: all tests pass (there is no existing `Agenda.test.tsx`, so this is a manual-verification-only change).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Agenda.tsx
git commit -m "feat(analytics): track appointment_canceled"
```

---

### Task 8: Track `procedure_created`

**Files:**
- Modify: `frontend/src/components/procedures/ProcedureFormDialog.tsx`

**Interfaces:**
- Consumes: `track`, `AnalyticsEvent` from Task 2.

- [ ] **Step 1: Add the import**

Add near the top of `frontend/src/components/procedures/ProcedureFormDialog.tsx`, after the `zod` import:
```ts
import { track, AnalyticsEvent } from '@/lib/analytics';
```

- [ ] **Step 2: Fire the event on successful creation**

Replace (around line 67-72):
```ts
    try {
      if (isEditing) {
        await proceduresApi.update(procedure.id, payload);
      } else {
        await proceduresApi.create(payload);
      }
      toast.success(isEditing ? 'Procedimento atualizado com sucesso' : 'Procedimento cadastrado com sucesso');
```
with:
```ts
    try {
      if (isEditing) {
        await proceduresApi.update(procedure.id, payload);
      } else {
        await proceduresApi.create(payload);
        track(AnalyticsEvent.ProcedureCreated);
      }
      toast.success(isEditing ? 'Procedimento atualizado com sucesso' : 'Procedimento cadastrado com sucesso');
```

- [ ] **Step 3: Run the frontend test suite to confirm no regressions**

Run: `cd frontend && bun run test`
Expected: all tests pass (no existing `ProcedureFormDialog.test.tsx`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/procedures/ProcedureFormDialog.tsx
git commit -m "feat(analytics): track procedure_created"
```

---

### Task 9: Track `financial_record_created`

**Files:**
- Modify: `frontend/src/components/financial/FinancialFormDialog.tsx`

**Interfaces:**
- Consumes: `track`, `AnalyticsEvent` from Task 2.
- Property: `type` (`'INCOME' | 'EXPENSE'`, already present on `payload.type` — not PII).

- [ ] **Step 1: Add the import**

Add near the top of `frontend/src/components/financial/FinancialFormDialog.tsx`, after the `zod` import:
```ts
import { track, AnalyticsEvent } from '@/lib/analytics';
```

- [ ] **Step 2: Fire the event on successful creation**

Replace (around line 164-165):
```ts
      await financialApi.create(payload);

      const msg = data.isRecurring
```
with:
```ts
      await financialApi.create(payload);
      track(AnalyticsEvent.FinancialRecordCreated, { type: payload.type });

      const msg = data.isRecurring
```

- [ ] **Step 3: Run the frontend test suite to confirm no regressions**

Run: `cd frontend && bun run test`
Expected: all tests pass (no existing `FinancialFormDialog.test.tsx`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/financial/FinancialFormDialog.tsx
git commit -m "feat(analytics): track financial_record_created"
```

---

### Task 10: Track `financial_record_paid`

**Files:**
- Modify: `frontend/src/pages/Financial.tsx`
- Test: `frontend/src/pages/Financial.test.tsx`

**Interfaces:**
- Consumes: `track`, `AnalyticsEvent` from Task 2.

- [ ] **Step 1: Write the failing test**

In `frontend/src/pages/Financial.test.tsx`, add a mock for `@/lib/analytics` near the other `vi.mock` calls (after the `sonner` mock, around line 18):
```ts
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  AnalyticsEvent: { FinancialRecordPaid: 'financial_record_paid' },
}));
```

Add the import near the top with the other imports:
```ts
import { track } from '@/lib/analytics';
```

Add a new test right after the existing `'chama financialApi.update com status PAID ao confirmar "dar baixa"'` test:
```ts
  it('dispara analytics track(financial_record_paid) ao confirmar "dar baixa"', async () => {
    vi.mocked(useHasRole).mockReturnValue(true);
    vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([pendingRecord]));
    vi.mocked(financialApi.update).mockResolvedValue({ ...pendingRecord, status: 'PAID' } as any);

    render(<Financial />, { wrapper: makeWrapper() });

    fireEvent.click(await screen.findByRole('button', { name: /dar baixa/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(track).toHaveBeenCalledWith('financial_record_paid');
    });
  });
```

If the existing "dar baixa" test uses a different render/interaction pattern (e.g. a different button label or a different wrapper helper), mirror that exact pattern instead of the one shown above — read the existing test at line 179 first and copy its setup verbatim before adding the assertion.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && bunx vitest run src/pages/Financial.test.tsx -t "analytics"`
Expected: FAIL — `track` was not called.

- [ ] **Step 3: Wire the event in the component**

In `frontend/src/pages/Financial.tsx`, add the import after the last `@/lib` or `@/components` import at the top of the file:
```ts
import { track, AnalyticsEvent } from '@/lib/analytics';
```

Replace (around line 143-151, `markPaidMutation`):
```ts
  const markPaidMutation = useMutation({
    mutationFn: (id: string) => financialApi.update(id, { status: 'PAID' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial', 'month'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Pagamento confirmado');
    },
    onError: () => toast.error('Erro ao confirmar pagamento'),
  });
```
with:
```ts
  const markPaidMutation = useMutation({
    mutationFn: (id: string) => financialApi.update(id, { status: 'PAID' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial', 'month'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Pagamento confirmado');
      track(AnalyticsEvent.FinancialRecordPaid);
    },
    onError: () => toast.error('Erro ao confirmar pagamento'),
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && bunx vitest run src/pages/Financial.test.tsx`
Expected: PASS — all tests in the file, including the new one.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Financial.tsx frontend/src/pages/Financial.test.tsx
git commit -m "feat(analytics): track financial_record_paid"
```

---

### Task 11: Track `treatment_package_created`

**Files:**
- Modify: `frontend/src/components/treatment-packages/TreatmentPackageFormDialog.tsx`

**Interfaces:**
- Consumes: `track`, `AnalyticsEvent` from Task 2.

- [ ] **Step 1: Add the import**

Add near the top of `frontend/src/components/treatment-packages/TreatmentPackageFormDialog.tsx`, after the `zod` import:
```ts
import { track, AnalyticsEvent } from '@/lib/analytics';
```

- [ ] **Step 2: Fire the event once, after both creation branches converge**

Both the `flexible` and fixed-installment branches call `treatmentPackagesApi.create(...)` and then fall through to a shared `toast.success(...)` call. Replace (around line 243-246):
```ts
      }

      toast.success('Pacote de tratamento criado com sucesso');
      onSuccess();
```
with:
```ts
      }

      toast.success('Pacote de tratamento criado com sucesso');
      track(AnalyticsEvent.TreatmentPackageCreated);
      onSuccess();
```

- [ ] **Step 3: Run the frontend test suite to confirm no regressions**

Run: `cd frontend && bun run test`
Expected: all tests pass (no existing `TreatmentPackageFormDialog.test.tsx`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/treatment-packages/TreatmentPackageFormDialog.tsx
git commit -m "feat(analytics): track treatment_package_created"
```

---

### Task 12: Track `evolution_created`

**Files:**
- Modify: `frontend/src/components/evolutions/EvolutionFormDialog.tsx`

**Interfaces:**
- Consumes: `track`, `AnalyticsEvent` from Task 2.

- [ ] **Step 1: Add the import**

Add near the top of `frontend/src/components/evolutions/EvolutionFormDialog.tsx`, after the `zod` import:
```ts
import { track, AnalyticsEvent } from '@/lib/analytics';
```

- [ ] **Step 2: Fire the event on successful creation**

Replace (around line 48-52):
```ts
      await evolutionsApi.create({
        patientId,
        description: data.description,
      });
      toast.success('Evolução registrada com sucesso');
```
with:
```ts
      await evolutionsApi.create({
        patientId,
        description: data.description,
      });
      toast.success('Evolução registrada com sucesso');
      track(AnalyticsEvent.EvolutionCreated);
```

- [ ] **Step 3: Run the frontend test suite to confirm no regressions**

Run: `cd frontend && bun run test`
Expected: all tests pass (no existing `EvolutionFormDialog.test.tsx`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/evolutions/EvolutionFormDialog.tsx
git commit -m "feat(analytics): track evolution_created"
```

---

### Task 13: Track `perineal_assessment_created`

**Files:**
- Modify: `frontend/src/components/perineal-assessment/PerinealAssessmentWizard.tsx`

**Interfaces:**
- Consumes: `track`, `AnalyticsEvent` from Task 2.

- [ ] **Step 1: Add the import**

Add near the top of `frontend/src/components/perineal-assessment/PerinealAssessmentWizard.tsx`, after the `zodResolver` import:
```ts
import { track, AnalyticsEvent } from '@/lib/analytics';
```

- [ ] **Step 2: Fire the event only on the definite-success creation path**

Replace (around line 93-98):
```ts
      if (isEditing) {
        await perinealAssessmentsApi.update(assessment.id, { data: formData });
        toast.success('Avaliação perineal atualizada com sucesso');
      } else {
        await perinealAssessmentsApi.create({ patientId, data: formData });
        toast.success('Avaliação perineal registrada com sucesso');
      }
```
with:
```ts
      if (isEditing) {
        await perinealAssessmentsApi.update(assessment.id, { data: formData });
        toast.success('Avaliação perineal atualizada com sucesso');
      } else {
        await perinealAssessmentsApi.create({ patientId, data: formData });
        toast.success('Avaliação perineal registrada com sucesso');
        track(AnalyticsEvent.PerinealAssessmentCreated);
      }
```

Note: the `catch` block's 408-timeout branch (around line 105-110) is deliberately **not** instrumented — a 408 means the request timed out client-side and it's unknown whether the server actually persisted the record, so firing a "created" event there would be a false positive.

- [ ] **Step 3: Run the frontend test suite to confirm no regressions**

Run: `cd frontend && bun run test`
Expected: all tests pass (no existing `PerinealAssessmentWizard.test.tsx`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/perineal-assessment/PerinealAssessmentWizard.tsx
git commit -m "feat(analytics): track perineal_assessment_created"
```

---

### Task 14: Document env vars in `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Add the new env vars to the Frontend section**

In `CLAUDE.md`, under `### Environment Variables` → `Frontend (build-time only):`, add after the existing `VITE_SENTRY_DSN` line:
```markdown
- `VITE_POSTHOG_KEY` — PostHog project API key. If absent, analytics is a no-op (dev default).
- `VITE_POSTHOG_HOST` — PostHog ingestion host. Defaults to `https://us.i.posthog.com`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document PostHog env vars"
```

---

## Notes from Planning

Checked during planning: no file in `frontend/src/` sets `document.title` (grepped the whole tree, zero matches). `capture_pageview` therefore only ever sends the route URL, never a patient name via page title — no extra masking task needed for spec section 5.

## Manual Verification (after all tasks)

Not a task with automated tests — do this once all 14 tasks are merged, per the spec's section 7:

1. Create a test PostHog Cloud project, get its API key.
2. Run `cd frontend && VITE_POSTHOG_KEY=<test-key> bun run dev`.
3. Log in, trigger each of the 10 actions (create patient, create appointment, cancel appointment, create procedure, create financial record, mark financial record as paid, create treatment package, create evolution, complete perineal assessment wizard, log in again in a fresh session).
4. In the PostHog dashboard, confirm all 10 events arrived with the expected name and properties, and that no patient name/CPF/email appears anywhere in event payload or in the captured pageview URLs.
