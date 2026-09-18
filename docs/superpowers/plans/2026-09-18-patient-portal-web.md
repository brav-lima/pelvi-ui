# Patient Portal Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Portal da paciente" section to the patient profile page in `pelvi-ui/frontend` (invite, resend, treatment-plan toggles) and the public account-activation page the first-invite email links to.

**Architecture:** A `patientPortalApi` client added to the existing `src/lib/api.ts`, a small hooks module wrapping it in `@tanstack/react-query`, a self-contained `PatientPortalSection` card slotted into the existing `PatientProfile` sidebar, and a public page (`PatientActivateAccount`) modeled directly on the existing `ResetPassword` page.

**Tech Stack:** React 18, TypeScript, Vite, `@tanstack/react-query`, `react-router-dom`, shadcn/ui (Radix), Vitest + Testing Library.

**Spec:** `../pelvi-app/docs/superpowers/specs/2026-09-18-app-paciente-fundacao-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-18-patient-portal-backend.md` (this plan calls the endpoints it defines: `GET/PUT /patient-portal/patients/:patientId/{portal,plan}`, `POST /patient-portal/patients/:patientId/invite`, `POST /patient-portal/links/:linkId/resend`, `POST /patient-portal/auth/activate`).

## Global Constraints

- Every new component/page follows the existing visual language exactly (font sizes, `var(--font-display)`, spacing) — no new design system.
- `patientPortalApi` calls go through the existing `api.get/post/put` helpers in `src/lib/api.ts` — never `fetch` directly.
- Every new component/page ships with a Vitest + Testing Library test in the same task.
- Run `npm test -- --run` after each task.

---

## Task 1: `patientPortalApi` client

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/lib/api.test.ts`

**Interfaces:**
- Produces: `api.put`, `patientPortalApi.{getPortalStatus,invite,resend,updatePlan,activate}`, `PatientPortalFeatures`, `PatientPortalLinkStatus`, `PatientPortalStatus` — consumed by every later task in this plan.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/api.test.ts — add this describe block. If the file doesn't already
// mock `fetch` globally, check the top of the file for the existing pattern
// (this repo's api.test.ts stubs `global.fetch` with `vi.fn()` per test) and
// follow it for these assertions too.
describe('patientPortalApi', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('getPortalStatus faz GET em /patient-portal/patients/:id/portal', async () => {
    (global.fetch as unknown as Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        linkId: 'link-1', linkStatus: 'ACTIVE', invitedAt: null, confirmedAt: '2026-09-18',
        features: { diarioMiccional: false, diarioEvacuatorio: false, cronometros: false },
      }),
    });

    const result = await patientPortalApi.getPortalStatus('patient-1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/patient-portal/patients/patient-1/portal'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(result.linkStatus).toBe('ACTIVE');
  });

  it('invite faz POST em /patient-portal/patients/:id/invite', async () => {
    (global.fetch as unknown as Mock).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ message: 'Convite enviado' }),
    });

    await patientPortalApi.invite('patient-1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/patient-portal/patients/patient-1/invite'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('resend faz POST em /patient-portal/links/:id/resend', async () => {
    (global.fetch as unknown as Mock).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ message: 'Solicitação reenviada' }),
    });

    await patientPortalApi.resend('link-1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/patient-portal/links/link-1/resend'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('updatePlan faz PUT em /patient-portal/patients/:id/plan com o body correto', async () => {
    const features = { diarioMiccional: true, diarioEvacuatorio: false, cronometros: false };
    (global.fetch as unknown as Mock).mockResolvedValue({
      ok: true, status: 200, json: async () => features,
    });

    await patientPortalApi.updatePlan('patient-1', features);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/patient-portal/patients/patient-1/plan'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ features }) }),
    );
  });

  it('activate faz POST em /patient-portal/auth/activate', async () => {
    (global.fetch as unknown as Mock).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ message: 'Conta ativada com sucesso' }),
    });

    await patientPortalApi.activate('token-abc', 'novaSenha123');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/patient-portal/auth/activate'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'token-abc', password: 'novaSenha123' }),
      }),
    );
  });
});
```

If `src/lib/api.test.ts` doesn't already import `Mock` from `vitest` or doesn't
have a `describe`/`beforeEach` importing `vi`, add those imports at the top of
the file matching whatever the existing suites in that file already use —
read the file first and match its exact mocking style before adding this
block, since this task only appends to it.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api.test.ts`
Expected: FAIL — `patientPortalApi is not defined`.

- [ ] **Step 3: Add the `put` helper and `patientPortalApi` to `src/lib/api.ts`**

```typescript
// src/lib/api.ts — inside the existing `api` object, add `put` alongside
// the existing get/post/patch/delete:
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

```typescript
// src/lib/api.ts — append at the end of the file, after subscriptionApi
export interface PatientPortalFeatures {
  diarioMiccional: boolean;
  diarioEvacuatorio: boolean;
  cronometros: boolean;
}

export type PatientPortalLinkStatus = 'PENDING_CONSENT' | 'ACTIVE' | 'DECLINED';

export interface PatientPortalStatus {
  linkId: string | null;
  linkStatus: PatientPortalLinkStatus | null;
  invitedAt: string | null;
  confirmedAt: string | null;
  features: PatientPortalFeatures;
}

export const patientPortalApi = {
  getPortalStatus: (patientId: string) =>
    api.get<PatientPortalStatus>(`/patient-portal/patients/${patientId}/portal`),
  invite: (patientId: string) =>
    api.post<{ message: string }>(`/patient-portal/patients/${patientId}/invite`, {}),
  resend: (linkId: string) =>
    api.post<{ message: string }>(`/patient-portal/links/${linkId}/resend`, {}),
  updatePlan: (patientId: string, features: PatientPortalFeatures) =>
    api.put<PatientPortalFeatures>(`/patient-portal/patients/${patientId}/plan`, { features }),
  activate: (token: string, password: string) =>
    api.post<{ message: string }>('/patient-portal/auth/activate', { token, password }),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/lib/api.test.ts
git commit -m "feat(api): add patientPortalApi client"
```

---

## Task 2: `usePatientPortal` hooks

**Files:**
- Create: `src/components/patients/use-patient-portal.ts`
- Create: `src/components/patients/use-patient-portal.test.tsx`

**Interfaces:**
- Consumes: `patientPortalApi` (Task 1).
- Produces: `usePatientPortalStatus(patientId)`, `useInvitePatientMutation(patientId)`, `useResendPatientLinkMutation(patientId)`, `useUpdatePatientPlanMutation(patientId)` — consumed by Task 3.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/patients/use-patient-portal.test.tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    patientPortalApi: {
      getPortalStatus: vi.fn(),
      invite: vi.fn(),
      resend: vi.fn(),
      updatePlan: vi.fn(),
    },
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { patientPortalApi } from '@/lib/api';
import {
  usePatientPortalStatus,
  useInvitePatientMutation,
  useResendPatientLinkMutation,
  useUpdatePatientPlanMutation,
} from './use-patient-portal';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('usePatientPortal hooks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usePatientPortalStatus busca o status do portal da paciente', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue({
      linkId: 'link-1', linkStatus: 'ACTIVE', invitedAt: null, confirmedAt: null,
      features: { diarioMiccional: false, diarioEvacuatorio: false, cronometros: false },
    });

    const { result } = renderHook(() => usePatientPortalStatus('patient-1'), { wrapper });

    await waitFor(() => expect(result.current.data?.linkStatus).toBe('ACTIVE'));
    expect(patientPortalApi.getPortalStatus).toHaveBeenCalledWith('patient-1');
  });

  it('useInvitePatientMutation chama patientPortalApi.invite', async () => {
    vi.mocked(patientPortalApi.invite).mockResolvedValue({ message: 'ok' });

    const { result } = renderHook(() => useInvitePatientMutation('patient-1'), { wrapper });

    await act(async () => result.current.mutate());

    expect(patientPortalApi.invite).toHaveBeenCalledWith('patient-1');
  });

  it('useResendPatientLinkMutation chama patientPortalApi.resend com o linkId', async () => {
    vi.mocked(patientPortalApi.resend).mockResolvedValue({ message: 'ok' });

    const { result } = renderHook(() => useResendPatientLinkMutation('patient-1'), { wrapper });

    await act(async () => result.current.mutate('link-1'));

    expect(patientPortalApi.resend).toHaveBeenCalledWith('link-1');
  });

  it('useUpdatePatientPlanMutation chama patientPortalApi.updatePlan com os recursos', async () => {
    const features = { diarioMiccional: true, diarioEvacuatorio: false, cronometros: false };
    vi.mocked(patientPortalApi.updatePlan).mockResolvedValue(features);

    const { result } = renderHook(() => useUpdatePatientPlanMutation('patient-1'), { wrapper });

    await act(async () => result.current.mutate(features));

    expect(patientPortalApi.updatePlan).toHaveBeenCalledWith('patient-1', features);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/patients/use-patient-portal.test.tsx`
Expected: FAIL — cannot find module `./use-patient-portal`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/patients/use-patient-portal.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { patientPortalApi, type PatientPortalFeatures } from '@/lib/api';

export function usePatientPortalStatus(patientId: string) {
  return useQuery({
    queryKey: ['patient-portal', patientId],
    queryFn: () => patientPortalApi.getPortalStatus(patientId),
    enabled: !!patientId,
  });
}

export function useInvitePatientMutation(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => patientPortalApi.invite(patientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-portal', patientId] });
      toast.success('Convite enviado');
    },
    onError: () => toast.error('Erro ao enviar convite'),
  });
}

export function useResendPatientLinkMutation(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => patientPortalApi.resend(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-portal', patientId] });
      toast.success('Solicitação reenviada');
    },
    onError: () => toast.error('Erro ao reenviar solicitação'),
  });
}

export function useUpdatePatientPlanMutation(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (features: PatientPortalFeatures) => patientPortalApi.updatePlan(patientId, features),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-portal', patientId] });
      toast.success('Plano de tratamento atualizado');
    },
    onError: () => toast.error('Erro ao atualizar plano de tratamento'),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/patients/use-patient-portal.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/patients/use-patient-portal.ts src/components/patients/use-patient-portal.test.tsx
git commit -m "feat(patients): add usePatientPortal query/mutation hooks"
```

---

## Task 3: `PatientPortalSection` component

**Files:**
- Create: `src/components/patients/PatientPortalSection.tsx`
- Create: `src/components/patients/PatientPortalSection.test.tsx`

**Interfaces:**
- Consumes: hooks from Task 2.
- Produces: `<PatientPortalSection patientId={string} patientCpf={string | null | undefined} />` — consumed by Task 4.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/patients/PatientPortalSection.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    patientPortalApi: {
      getPortalStatus: vi.fn(),
      invite: vi.fn(),
      resend: vi.fn(),
      updatePlan: vi.fn(),
    },
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { patientPortalApi } from '@/lib/api';
import { PatientPortalSection } from './PatientPortalSection';

function renderSection(patientCpf: string | null = '12345678901') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PatientPortalSection patientId="patient-1" patientCpf={patientCpf} />
    </QueryClientProvider>,
  );
}

describe('PatientPortalSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem vínculo: mostra botão de convidar, habilitado quando há CPF', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue({
      linkId: null, linkStatus: null, invitedAt: null, confirmedAt: null,
      features: { diarioMiccional: false, diarioEvacuatorio: false, cronometros: false },
    });

    renderSection('12345678901');

    const button = await screen.findByRole('button', { name: /convidar para o app/i });
    expect(button).not.toBeDisabled();
  });

  it('sem vínculo e sem CPF: botão de convidar fica desabilitado', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue({
      linkId: null, linkStatus: null, invitedAt: null, confirmedAt: null,
      features: { diarioMiccional: false, diarioEvacuatorio: false, cronometros: false },
    });

    renderSection(null);

    const button = await screen.findByRole('button', { name: /convidar para o app/i });
    expect(button).toBeDisabled();
  });

  it('chama patientPortalApi.invite ao clicar em convidar', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue({
      linkId: null, linkStatus: null, invitedAt: null, confirmedAt: null,
      features: { diarioMiccional: false, diarioEvacuatorio: false, cronometros: false },
    });
    vi.mocked(patientPortalApi.invite).mockResolvedValue({ message: 'ok' });

    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /convidar para o app/i }));

    await waitFor(() => expect(patientPortalApi.invite).toHaveBeenCalledWith('patient-1'));
  });

  it('pendente: mostra a mensagem de solicitação pendente', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue({
      linkId: 'link-1', linkStatus: 'PENDING_CONSENT', invitedAt: '2026-09-18T00:00:00.000Z', confirmedAt: null,
      features: { diarioMiccional: false, diarioEvacuatorio: false, cronometros: false },
    });

    renderSection();

    expect(await screen.findByText(/pendente/i)).toBeInTheDocument();
  });

  it('recusado: mostra o botão de reenviar e chama resend com o linkId', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue({
      linkId: 'link-1', linkStatus: 'DECLINED', invitedAt: null, confirmedAt: '2026-09-18T00:00:00.000Z',
      features: { diarioMiccional: false, diarioEvacuatorio: false, cronometros: false },
    });
    vi.mocked(patientPortalApi.resend).mockResolvedValue({ message: 'ok' });

    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /reenviar solicitação/i }));

    await waitFor(() => expect(patientPortalApi.resend).toHaveBeenCalledWith('link-1'));
  });

  it('ativo: mostra os três toggles e chama updatePlan ao alternar um deles', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue({
      linkId: 'link-1', linkStatus: 'ACTIVE', invitedAt: null, confirmedAt: '2026-09-18T00:00:00.000Z',
      features: { diarioMiccional: false, diarioEvacuatorio: false, cronometros: false },
    });
    vi.mocked(patientPortalApi.updatePlan).mockResolvedValue({
      diarioMiccional: true, diarioEvacuatorio: false, cronometros: false,
    });

    renderSection();

    const toggle = await screen.findByLabelText('Diário miccional');
    fireEvent.click(toggle);

    await waitFor(() =>
      expect(patientPortalApi.updatePlan).toHaveBeenCalledWith('patient-1', {
        diarioMiccional: true, diarioEvacuatorio: false, cronometros: false,
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/patients/PatientPortalSection.test.tsx`
Expected: FAIL — cannot find module `./PatientPortalSection`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/patients/PatientPortalSection.tsx
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Smartphone, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { PatientPortalFeatures } from '@/lib/api';
import {
  usePatientPortalStatus,
  useInvitePatientMutation,
  useResendPatientLinkMutation,
  useUpdatePatientPlanMutation,
} from './use-patient-portal';

const FEATURE_LABELS: Record<keyof PatientPortalFeatures, string> = {
  diarioMiccional: 'Diário miccional',
  diarioEvacuatorio: 'Diário evacuatório',
  cronometros: 'Cronômetros/treinamentos',
};

const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as Array<keyof PatientPortalFeatures>;

interface PatientPortalSectionProps {
  patientId: string;
  patientCpf?: string | null;
}

export function PatientPortalSection({ patientId, patientCpf }: PatientPortalSectionProps) {
  const { data: portal, isLoading } = usePatientPortalStatus(patientId);
  const inviteMutation = useInvitePatientMutation(patientId);
  const resendMutation = useResendPatientLinkMutation(patientId);
  const updatePlanMutation = useUpdatePatientPlanMutation(patientId);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Smartphone className="w-4 h-4 text-muted-foreground" />
        <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          Portal da paciente
        </div>
      </div>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : !portal || portal.linkStatus === null ? (
          <div className="flex flex-col gap-2">
            <p className="text-[12.5px] text-muted-foreground">
              A paciente ainda não tem acesso ao app.
            </p>
            <Button
              size="sm"
              disabled={!patientCpf || inviteMutation.isPending}
              onClick={() => inviteMutation.mutate()}
            >
              Convidar para o app
            </Button>
            {!patientCpf && (
              <p className="text-[11.5px] text-muted-foreground/80">
                Cadastre o CPF da paciente para poder convidá-la.
              </p>
            )}
          </div>
        ) : portal.linkStatus === 'PENDING_CONSENT' ? (
          <p className="text-[12.5px] text-muted-foreground">
            Convite/solicitação pendente
            {portal.invitedAt && ` desde ${format(new Date(portal.invitedAt), 'dd/MM/yyyy')}`}.
          </p>
        ) : portal.linkStatus === 'DECLINED' ? (
          <div className="flex flex-col gap-2">
            <p className="text-[12.5px] text-muted-foreground">
              Recusado{portal.confirmedAt && ` em ${format(new Date(portal.confirmedAt), 'dd/MM/yyyy')}`}.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={!portal.linkId || resendMutation.isPending}
              onClick={() => portal.linkId && resendMutation.mutate(portal.linkId)}
            >
              Reenviar solicitação
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[12.5px] text-muted-foreground">
              Vinculada{portal.confirmedAt && ` desde ${format(new Date(portal.confirmedAt), 'dd/MM/yyyy')}`}.
            </p>
            <div className="flex flex-col gap-3">
              {FEATURE_KEYS.map((key) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`feature-${key}`} className="text-[13px] font-normal">
                    {FEATURE_LABELS[key]}
                  </Label>
                  <Switch
                    id={`feature-${key}`}
                    checked={portal.features[key]}
                    disabled={updatePlanMutation.isPending}
                    onCheckedChange={(checked) =>
                      updatePlanMutation.mutate({ ...portal.features, [key]: checked })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/patients/PatientPortalSection.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/patients/PatientPortalSection.tsx src/components/patients/PatientPortalSection.test.tsx
git commit -m "feat(patients): add PatientPortalSection card"
```

---

## Task 4: Wire `PatientPortalSection` into `PatientProfile`

**Files:**
- Modify: `src/pages/PatientProfile.tsx`
- Modify: `src/pages/PatientProfile.test.tsx`

**Interfaces:**
- Consumes: `PatientPortalSection` (Task 3).

- [ ] **Step 1: Write the failing test**

Read `src/pages/PatientProfile.test.tsx` first to see how it already mocks
`@/lib/api` and renders the page (it must already provide a `QueryClientProvider`
and a mocked `patient` query result, since the page fetches `patientsApi.getById`
on mount). Add this test, adapting the render helper name/signature to whatever
that file already exports — do not introduce a second render helper:

```typescript
// src/pages/PatientProfile.test.tsx — add this test, reusing the existing
// render helper and api mocks already set up in this file. Also add
// `patientPortalApi` to the file's existing `vi.mock('@/lib/api', ...)` block
// with a `getPortalStatus: vi.fn().mockResolvedValue({ linkId: null, linkStatus: null,
// invitedAt: null, confirmedAt: null, features: { diarioMiccional: false,
// diarioEvacuatorio: false, cronometros: false } })` so the new section
// doesn't hang on a pending query in every other existing test in this file.

it('renderiza a seção Portal da paciente', async () => {
  renderPatientProfile(); // use this file's existing render helper name
  expect(await screen.findByText('Portal da paciente')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/PatientProfile.test.tsx`
Expected: FAIL — "Portal da paciente" not found (and, before this task, every
other test in the file may also start failing once `patientPortalApi` is
added to the mock without a corresponding render — that's expected and fixed
in the next step, not a regression to chase down first).

- [ ] **Step 3: Add the section to the sidebar**

```typescript
// src/pages/PatientProfile.tsx — add the import near the other
// src/components/patients import:
import { PatientPortalSection } from '@/components/patients/PatientPortalSection';
```

```typescript
// src/pages/PatientProfile.tsx — inside the right sidebar `<div className="flex
// flex-col gap-4">`, add <PatientPortalSection /> as the last card, right
// after the "Próximas consultas" <Card> closes and before the sidebar's own
// closing </div>:
            </Card>

            <PatientPortalSection patientId={id!} patientCpf={patient.cpf} />
          </div>
        </div>
      </Tabs>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/PatientProfile.test.tsx`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PatientProfile.tsx src/pages/PatientProfile.test.tsx
git commit -m "feat(patients): show Portal da paciente in the patient profile sidebar"
```

---

## Task 5: `PatientActivateAccount` public page

**Files:**
- Create: `src/pages/PatientActivateAccount.tsx`
- Create: `src/pages/PatientActivateAccount.test.tsx`

**Interfaces:**
- Consumes: `patientPortalApi.activate` (Task 1).
- Produces: default-exported `PatientActivateAccount` page component — consumed by Task 6 (route registration).

This page is modeled directly on `src/pages/ResetPassword.tsx` — same two-column
layout (`brandPanel` + form), same success/error/loading states — with three
differences: the copy ("Ativar minha conta" instead of "Nova senha"), the call
target (`patientPortalApi.activate` instead of `authApi.resetPassword`), and
the "invalid link" copy pointing nowhere (there is no "request a new one" self
-service flow for a first invite — the copy says to contact the clinic instead).

- [ ] **Step 1: Write the failing test**

```typescript
// src/pages/PatientActivateAccount.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/lib/api', () => ({
  patientPortalApi: { activate: vi.fn() },
}));

import { patientPortalApi } from '@/lib/api';
import PatientActivateAccount from '@/pages/PatientActivateAccount';

function renderPage(token = 'abc123token') {
  return render(
    <MemoryRouter
      initialEntries={[`/paciente/ativar-conta?token=${token}`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/paciente/ativar-conta" element={<PatientActivateAccount />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PatientActivateAccount page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza os campos de senha e confirmação', () => {
    renderPage();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ativar/i })).toBeInTheDocument();
  });

  it('exibe erro se as senhas não coincidem', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'diferente' } });
    fireEvent.click(screen.getByRole('button', { name: /ativar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/senhas não coincidem/i);
    });
    expect(patientPortalApi.activate).not.toHaveBeenCalled();
  });

  it('chama patientPortalApi.activate com o token da URL e a senha', async () => {
    vi.mocked(patientPortalApi.activate).mockResolvedValue({ message: 'ok' });
    renderPage('meu-token-valido');

    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'novaSenha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'novaSenha123' } });
    fireEvent.click(screen.getByRole('button', { name: /ativar/i }));

    await waitFor(() => {
      expect(patientPortalApi.activate).toHaveBeenCalledWith('meu-token-valido', 'novaSenha123');
    });
  });

  it('exibe mensagem de sucesso pedindo para baixar o app', async () => {
    vi.mocked(patientPortalApi.activate).mockResolvedValue({ message: 'ok' });
    renderPage();

    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'novaSenha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'novaSenha123' } });
    fireEvent.click(screen.getByRole('button', { name: /ativar/i }));

    await waitFor(() => {
      expect(screen.getByText(/conta ativada/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/baixe o app sou pelvi/i)).toBeInTheDocument();
  });

  it('exibe erro quando o token é inválido ou expirado (400 da API)', async () => {
    vi.mocked(patientPortalApi.activate).mockRejectedValue(
      Object.assign(new Error('Bad Request'), { status: 400 }),
    );
    renderPage();

    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'novaSenha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'novaSenha123' } });
    fireEvent.click(screen.getByRole('button', { name: /ativar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/link expirou/i);
    });
  });

  it('exibe aviso quando o token está ausente na URL', () => {
    render(
      <MemoryRouter
        initialEntries={['/paciente/ativar-conta']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/paciente/ativar-conta" element={<PatientActivateAccount />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/link inválido/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/PatientActivateAccount.test.tsx`
Expected: FAIL — cannot find module `@/pages/PatientActivateAccount`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/pages/PatientActivateAccount.tsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { patientPortalApi } from '@/lib/api';
import { appVersion } from '@/lib/version';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function PatientActivateAccount() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!token) return;

    setLoading(true);
    try {
      await patientPortalApi.activate(token, password);
      setSuccess(true);
    } catch (err) {
      if ((err as { status?: number })?.status === 400) {
        setError('Este link expirou ou já foi utilizado. Entre em contato com a sua clínica.');
      } else {
        setError('Não foi possível ativar a conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const brandPanel = (
    <div
      className="hidden md:flex flex-col p-10 text-white relative overflow-hidden"
      style={{
        background: `
          radial-gradient(120% 80% at 100% 0%, hsl(296 38% 35% / 0.55), transparent 60%),
          radial-gradient(80% 60% at 0% 100%, hsl(280 32% 45% / 0.45), transparent 60%),
          linear-gradient(160deg, hsl(296 32% 22%) 0%, hsl(290 22% 10%) 100%)
        `,
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm text-white shrink-0"
          style={{
            background: 'rgba(255,255,255,0.12)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.02em',
          }}
        >
          P
        </div>
        <div>
          <div
            className="font-semibold text-[15px] leading-5 text-white"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.012em' }}
          >
            <span className="opacity-50">Sou</span>{' '}
            <span>Pelvi</span>
          </div>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-white/55">
            Acompanhamento do tratamento
          </div>
        </div>
      </div>
      <div className="mt-auto">
        <h2
          className="text-[36px] leading-[44px] font-semibold text-white max-w-[380px]"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.022em' }}
        >
          O Sou Pelvi acompanha o seu tratamento fora do consultório.
        </h2>
      </div>
      <div className="mt-7 flex justify-between text-[11px] text-white/45">
        <span>© 2026 Sou Pelvi · Todos os direitos reservados</span>
        <span>v{appVersion}</span>
      </div>
    </div>
  );

  if (!token) {
    return (
      <div className="min-h-screen grid md:grid-cols-2 bg-background">
        {brandPanel}
        <div className="flex items-center justify-center p-9 bg-card">
          <div className="w-full max-w-[380px] text-center flex flex-col gap-4">
            <p className="text-muted-foreground text-[14px]">
              Link inválido. Peça para a sua clínica reenviar o convite.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {brandPanel}
      <div className="flex items-center justify-center p-9 bg-card">
        <div className="w-full max-w-[380px] flex flex-col gap-[18px] animate-fade-in">
          {success ? (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
                <CheckCircle2 className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1
                  className="text-[22px] font-semibold leading-7"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
                >
                  Conta ativada!
                </h1>
                <p className="text-[13.5px] text-muted-foreground mt-2">
                  Baixe o app Sou Pelvi e entre com o seu CPF e a senha que você acabou de criar.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h1
                  className="text-[26px] font-semibold leading-8"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
                >
                  Ativar minha conta
                </h1>
                <p className="text-[13.5px] text-muted-foreground mt-1.5">
                  Escolha uma senha com no mínimo 6 caracteres para acessar o app.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
                <div>
                  <Label htmlFor="password" className="text-[12px] font-medium text-foreground/80 mb-1.5 block">
                    Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      error={!!error}
                      className="h-[38px] pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-[12px] font-medium text-foreground/80 mb-1.5 block">
                    Confirmar senha
                  </Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    error={!!error}
                    aria-describedby={error ? 'activate-error' : undefined}
                    className="h-[38px]"
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <p id="activate-error" role="alert" className="text-sm text-destructive -mt-2">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="h-10 justify-center text-[14px]"
                  style={{ boxShadow: 'var(--shadow-brand), inset 0 1px 0 rgba(255,255,255,0.16)' }}
                  loading={loading}
                >
                  {loading ? 'Ativando...' : 'Ativar conta'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/PatientActivateAccount.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/PatientActivateAccount.tsx src/pages/PatientActivateAccount.test.tsx
git commit -m "feat(patient-portal): add the public account activation page"
```

---

## Task 6: Register the public route

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `PatientActivateAccount` (Task 5).

- [ ] **Step 1: Add the lazy import**

```typescript
// src/App.tsx — add alongside the other lazy page imports
const PatientActivateAccount = lazy(() => import("./pages/PatientActivateAccount"));
```

- [ ] **Step 2: Add the public route**

```typescript
// src/App.tsx — add next to the other public, top-level routes
// (/esqueci-senha, /redefinir-senha), outside <MainLayout>
<Route path="/paciente/ativar-conta" element={<PatientActivateAccount />} />
```

The full public-routes block becomes:

```typescript
<Route path="/login" element={<Login />} />
<Route path="/select-clinic" element={<SelectClinic />} />
<Route path="/esqueci-senha" element={<ForgotPassword />} />
<Route path="/redefinir-senha" element={<ResetPassword />} />
<Route path="/paciente/ativar-conta" element={<PatientActivateAccount />} />
```

- [ ] **Step 3: Manually verify the route is public**

Run: `npm run dev`, then visit `http://localhost:8080/paciente/ativar-conta?token=anything`
in a browser with no session cookie set.
Expected: the page renders (form or "link inválido" state) without redirecting
to `/login` — confirming it sits outside `<MainLayout>`/`ProtectedRoute`.

- [ ] **Step 4: Run the full frontend test suite**

Run: `npm test -- --run`
Expected: every suite passes, including all suites this plan touched.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(patient-portal): route /paciente/ativar-conta publicly"
```

---

## Self-Review Notes

- **Spec coverage:** the four "Portal da paciente" states (no link / pending / declined / active with toggles) from the design spec are all in Task 3; the first-invite activation page (Task 5) and its public routing (Task 6) match the spec's "página web simples" decision. The web plan intentionally does not touch anything about diaries/timers — those features don't exist yet, matching the Fundação scope.
- **Placeholder scan:** no TBD/TODO; every step has runnable code, except the two explicit "read the existing file first and match its style" notes in Tasks 1 and 4 — those aren't placeholders, they're instructions to append to files whose current exact content this plan didn't capture verbatim (unlike every file it creates from scratch).
- **Type consistency:** `PatientPortalFeatures`/`PatientPortalStatus`/`PatientPortalLinkStatus` are defined once in Task 1 and reused with the same field names throughout.
