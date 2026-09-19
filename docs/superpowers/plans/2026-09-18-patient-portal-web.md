# Patient Portal — Web (pelvi-ui/frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `pelvi-ui/frontend` half of the patient-portal fundação sub-project — a "Portal da paciente" section on the existing patient profile page (invite/status/plan-toggle), and the public `/paciente/ativar-conta` page where a newly-invited patient sets her password. The `pelvi-ui/backend` half (all `/patient-portal/*` endpoints) is already merged; the `pelvi-app` mobile client is a separate repo/plan.

**Architecture:** One new self-contained component (`PatientPortalCard`) added to the existing `PatientProfile` page's sidebar, fetching/mutating through a new `patientPortalApi` client module following the exact conventions of the existing `patientsApi`/`proceduresApi`. One new public, unauthenticated page (`ActivatePatientAccount`) modeled directly on the existing `ResetPassword` page (same brand panel, same layout, same error-handling shape), registered in `App.tsx` alongside `/login`, `/esqueci-senha`, `/redefinir-senha`.

**Tech Stack:** React + TypeScript + Vite, TanStack React Query, React Router v6, shadcn/ui (`Card`, `Button`, `Switch`, `Input`, `Label`), `sonner` toasts, `date-fns` (ptBR), Vitest + Testing Library.

**Spec:** `pelvi-app/docs/superpowers/specs/2026-09-18-app-paciente-fundacao-design.md` (see the `## Web (pelvi-ui/frontend)` section, lines 229–240, and `## Testes`, lines 277–288). Backend endpoints this plan consumes are implemented in `pelvi-ui/backend/src/patient-portal/` (see `patient-invite.controller.ts`, `patient-treatment-plan.controller.ts`, `patient-auth.controller.ts`).

## Global Constraints

- The new sidebar section is added to the **existing** patient profile page (`PatientProfile.tsx`) — it is a new `Card`, not a new tab/route.
- Four states, exact copy from the spec: no link → "Convidar para o app" (disabled without CPF, with a reason shown); `PENDING_CONSENT` → "Convite/solicitação pendente desde [data]"; `DECLINED` → "Recusado em [data]" + "Reenviar solicitação"; `ACTIVE` → "Vinculada desde [data]" + 3 `Switch`es for `diarioMiccional`, `diarioEvacuatorio`, `cronometros` (no effect elsewhere yet — only persists the flag).
- `/paciente/ativar-conta` is public (outside `MainLayout`, no sidebar), same route group as `/login`/`/esqueci-senha`/`/redefinir-senha` in `App.tsx`.
- All professional-facing `/patient-portal/*` endpoints already derive `organizationId` from the JWT server-side — the frontend never sends `organizationId` explicitly, only `patientId`/`linkId` path params (matches every other `*Api` module in `lib/api.ts`).
- Follow existing conventions exactly: `useQuery`/`useMutation` + `queryClient.invalidateQueries` (no optimistic updates — see `Procedures.tsx`'s `toggleMutation`), `sonner` toasts in Portuguese, Vitest component tests mocking `@/lib/api` per-file the same way `PatientProfile.test.tsx` and `ResetPassword.test.tsx` already do.
- This worktree has no `frontend/node_modules` yet — run `cd frontend && bun install` once before Task 1.
- Run `bun run test` (from `frontend/`) after each task. `bunx tsc --noEmit -p tsconfig.app.json` is **not** a clean gate in this repo today — it already reports ~15 pre-existing errors in unrelated files (confirmed by running it before this plan started; `bun run build` uses esbuild and doesn't type-check, `bun run lint` is ESLint, not `tsc`). Task 1's verification step scopes the check to only the files it touches for this reason.

---

## Task 1: Patient-portal domain types + API client

**Files:**
- Modify: `frontend/src/types/clinic.ts` (append at end of file, after the `Task` interface at line 394)
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Consumes: nothing new (pure additions).
- Produces: types `PatientPortalLinkStatus`, `PatientTreatmentPlanFeatures`, `PatientPortalInfo`; `api.put<T>()`; `patientPortalApi.{invite, resendConsent, getPortalStatus, updatePlan, activate}` — consumed by Tasks 3 and 5.

- [ ] **Step 1: Append the new types to `types/clinic.ts`**

```typescript
// frontend/src/types/clinic.ts — append after the closing brace of `Task` (line 394)

export type PatientPortalLinkStatus = 'PENDING_CONSENT' | 'ACTIVE' | 'DECLINED';

export interface PatientTreatmentPlanFeatures {
  diarioMiccional: boolean;
  diarioEvacuatorio: boolean;
  cronometros: boolean;
}

export interface PatientPortalInfo {
  linkId: string | null;
  linkStatus: PatientPortalLinkStatus | null;
  invitedAt: string | null;
  confirmedAt: string | null;
  features: PatientTreatmentPlanFeatures;
}
```

- [ ] **Step 2: Add `PatientPortalInfo`/`PatientTreatmentPlanFeatures` to the `lib/api.ts` type import block**

```typescript
// frontend/src/lib/api.ts — extend the existing `import type { ... } from '@/types/clinic';` block
// (top of file) by adding these two names to the list:
  PatientPortalInfo,
  PatientTreatmentPlanFeatures,
```

- [ ] **Step 3: Add `put` to the `api` helper**

```typescript
// frontend/src/lib/api.ts — replace the existing `export const api = { ... }` block with:
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

- [ ] **Step 4: Add the `patientPortalApi` module**

```typescript
// frontend/src/lib/api.ts — append after `subscriptionApi` (end of file)

export const patientPortalApi = {
  invite: (patientId: string) =>
    api.post<{ message: string }>(`/patient-portal/patients/${patientId}/invite`, {}),

  resendConsent: (linkId: string) =>
    api.post<{ message: string }>(`/patient-portal/links/${linkId}/resend`, {}),

  getPortalStatus: (patientId: string) =>
    api.get<PatientPortalInfo>(`/patient-portal/patients/${patientId}/portal`),

  updatePlan: (patientId: string, features: PatientTreatmentPlanFeatures) =>
    api.put<PatientTreatmentPlanFeatures>(`/patient-portal/patients/${patientId}/plan`, { features }),

  activate: (token: string, password: string) =>
    api.post<{ message: string }>('/patient-portal/auth/activate', { token, password }),
};
```

- [ ] **Step 5: Type-check only the files this task touched**

Run: `cd frontend && bunx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "types/clinic\.ts|lib/api\.ts"`
Expected: no output (the full `tsc --noEmit` run has pre-existing, unrelated errors elsewhere — see Global Constraints — so this greps for just the two files this task modified). No unit test here — these are thin typed wrappers with no branching logic of their own; Tasks 2 and 4 exercise them through the components that call them.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/clinic.ts frontend/src/lib/api.ts
git commit -m "feat(patient-portal): add web API client and domain types

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `PatientPortalCard` component

**Files:**
- Create: `frontend/src/components/patients/PatientPortalCard.tsx`
- Create: `frontend/src/components/patients/PatientPortalCard.test.tsx`

**Interfaces:**
- Consumes: `patientPortalApi` (Task 1), `PatientTreatmentPlanFeatures` (Task 1).
- Produces: `PatientPortalCard({ patientId, patientCpf }: { patientId: string; patientCpf?: string })` — consumed by Task 3.

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/components/patients/PatientPortalCard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', () => ({
  patientPortalApi: {
    getPortalStatus: vi.fn(),
    invite: vi.fn(),
    resendConsent: vi.fn(),
    updatePlan: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { patientPortalApi } from '@/lib/api';
import { toast } from 'sonner';
import { PatientPortalCard } from './PatientPortalCard';

function renderCard(props: Partial<React.ComponentProps<typeof PatientPortalCard>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PatientPortalCard patientId="pat-1" {...props} />
    </QueryClientProvider>,
  );
}

const noLink = {
  linkId: null,
  linkStatus: null,
  invitedAt: null,
  confirmedAt: null,
  features: { diarioMiccional: false, diarioEvacuatorio: false, cronometros: false },
};

describe('PatientPortalCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem vínculo e sem CPF: botão de convite desabilitado com aviso', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue(noLink as any);
    renderCard({ patientCpf: undefined });

    expect(await screen.findByRole('button', { name: /convidar para o app/i })).toBeDisabled();
    expect(screen.getByText(/cadastre o cpf/i)).toBeInTheDocument();
  });

  it('sem vínculo e com CPF: convite habilitado e chama a API ao clicar', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue(noLink as any);
    vi.mocked(patientPortalApi.invite).mockResolvedValue({ message: 'Convite enviado' });
    renderCard({ patientCpf: '12345678901' });

    const button = await screen.findByRole('button', { name: /convidar para o app/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    await waitFor(() => expect(patientPortalApi.invite).toHaveBeenCalledWith('pat-1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Convite enviado'));
  });

  it('PENDING_CONSENT: mostra a data do convite pendente', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue({
      ...noLink,
      linkId: 'link-1',
      linkStatus: 'PENDING_CONSENT',
      invitedAt: '2026-09-10T12:00:00Z',
    } as any);
    renderCard({ patientCpf: '12345678901' });

    expect(await screen.findByText(/pendente desde 10\/09\/2026/i)).toBeInTheDocument();
  });

  it('DECLINED: mostra a data de recusa e reenvia ao clicar', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue({
      ...noLink,
      linkId: 'link-1',
      linkStatus: 'DECLINED',
      confirmedAt: '2026-09-11T12:00:00Z',
    } as any);
    vi.mocked(patientPortalApi.resendConsent).mockResolvedValue({ message: 'Solicitação reenviada' });
    renderCard({ patientCpf: '12345678901' });

    expect(await screen.findByText(/recusado em 11\/09\/2026/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reenviar solicitação/i }));

    await waitFor(() => expect(patientPortalApi.resendConsent).toHaveBeenCalledWith('link-1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Solicitação reenviada'));
  });

  it('ACTIVE: mostra a data do vínculo e os 3 switches do plano; alterna um deles', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue({
      linkId: 'link-1',
      linkStatus: 'ACTIVE',
      invitedAt: '2026-09-01T12:00:00Z',
      confirmedAt: '2026-09-02T12:00:00Z',
      features: { diarioMiccional: false, diarioEvacuatorio: true, cronometros: false },
    } as any);
    vi.mocked(patientPortalApi.updatePlan).mockResolvedValue({
      diarioMiccional: true,
      diarioEvacuatorio: true,
      cronometros: false,
    });
    renderCard({ patientCpf: '12345678901' });

    expect(await screen.findByText(/vinculada desde 02\/09\/2026/i)).toBeInTheDocument();
    const diarioMiccional = screen.getByLabelText('Diário miccional');
    expect(diarioMiccional).not.toBeChecked();
    expect(screen.getByLabelText('Diário evacuatório')).toBeChecked();

    fireEvent.click(diarioMiccional);

    await waitFor(() =>
      expect(patientPortalApi.updatePlan).toHaveBeenCalledWith('pat-1', {
        diarioMiccional: true,
        diarioEvacuatorio: true,
        cronometros: false,
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Plano atualizado'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && bunx vitest run src/components/patients/PatientPortalCard.test.tsx`
Expected: FAIL — cannot find module `./PatientPortalCard`.

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/components/patients/PatientPortalCard.tsx
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { patientPortalApi } from '@/lib/api';
import type { PatientTreatmentPlanFeatures } from '@/types/clinic';

interface PatientPortalCardProps {
  patientId: string;
  patientCpf?: string;
}

const FEATURE_LABELS: Record<keyof PatientTreatmentPlanFeatures, string> = {
  diarioMiccional: 'Diário miccional',
  diarioEvacuatorio: 'Diário evacuatório',
  cronometros: 'Cronômetros',
};

export function PatientPortalCard({ patientId, patientCpf }: PatientPortalCardProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['patient-portal', patientId],
    queryFn: () => patientPortalApi.getPortalStatus(patientId),
  });

  const inviteMutation = useMutation({
    mutationFn: () => patientPortalApi.invite(patientId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['patient-portal', patientId] });
      toast.success(res.message);
    },
    onError: () => toast.error('Erro ao enviar convite'),
  });

  const resendMutation = useMutation({
    mutationFn: (linkId: string) => patientPortalApi.resendConsent(linkId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['patient-portal', patientId] });
      toast.success(res.message);
    },
    onError: () => toast.error('Erro ao reenviar solicitação'),
  });

  const updatePlanMutation = useMutation({
    mutationFn: (features: PatientTreatmentPlanFeatures) =>
      patientPortalApi.updatePlan(patientId, features),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-portal', patientId] });
      toast.success('Plano atualizado');
    },
    onError: () => toast.error('Erro ao atualizar plano'),
  });

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          Portal da paciente
        </div>
      </div>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : isError || !data ? null : data.linkStatus === null ? (
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              onClick={() => inviteMutation.mutate()}
              disabled={!patientCpf}
              loading={inviteMutation.isPending}
            >
              Convidar para o app
            </Button>
            {!patientCpf && (
              <p className="text-[12px] text-muted-foreground">
                Cadastre o CPF da paciente para habilitar o convite.
              </p>
            )}
          </div>
        ) : data.linkStatus === 'PENDING_CONSENT' ? (
          <p className="text-[13px] text-muted-foreground">
            Convite/solicitação pendente desde{' '}
            {data.invitedAt && format(new Date(data.invitedAt), 'dd/MM/yyyy')}
          </p>
        ) : data.linkStatus === 'DECLINED' ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-muted-foreground">
              Recusado em {data.confirmedAt && format(new Date(data.confirmedAt), 'dd/MM/yyyy')}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => data.linkId && resendMutation.mutate(data.linkId)}
              loading={resendMutation.isPending}
            >
              Reenviar solicitação
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-muted-foreground">
              Vinculada desde {data.confirmedAt && format(new Date(data.confirmedAt), 'dd/MM/yyyy')}
            </p>
            <div className="flex flex-col gap-2.5 pt-1">
              {(Object.keys(FEATURE_LABELS) as Array<keyof PatientTreatmentPlanFeatures>).map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <label htmlFor={`plan-${key}`} className="text-[13px] text-foreground/80">
                    {FEATURE_LABELS[key]}
                  </label>
                  <Switch
                    id={`plan-${key}`}
                    checked={data.features[key]}
                    onCheckedChange={(checked) =>
                      updatePlanMutation.mutate({ ...data.features, [key]: checked })
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run src/components/patients/PatientPortalCard.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/patients/PatientPortalCard.tsx frontend/src/components/patients/PatientPortalCard.test.tsx
git commit -m "feat(patient-portal): add PatientPortalCard component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Wire `PatientPortalCard` into `PatientProfile.tsx`

**Files:**
- Modify: `frontend/src/pages/PatientProfile.tsx`
- Modify: `frontend/src/pages/PatientProfile.test.tsx`

**Interfaces:**
- Consumes: `PatientPortalCard` (Task 2).
- Produces: nothing new — pure integration. `PatientPortalCard`'s own behavior is already covered by Task 2's tests; this task only proves the page renders it and that existing `PatientProfile` tests still pass with it mocked out (same pattern the file already uses for `PatientFormDialog`, `AppointmentFormDialog`, etc.).

- [ ] **Step 1: Mock the new component in `PatientProfile.test.tsx`**

```typescript
// frontend/src/pages/PatientProfile.test.tsx — add this line next to the other
// `vi.mock('@/components/.../XyzDialog', ...)` calls (after the
// TreatmentPackageFormDialog mock, line 25):
vi.mock('@/components/patients/PatientPortalCard', () => ({ PatientPortalCard: () => null }));
```

- [ ] **Step 2: Run the existing `PatientProfile` tests to confirm they still pass (baseline before wiring)**

Run: `cd frontend && bunx vitest run src/pages/PatientProfile.test.tsx`
Expected: PASS (2 tests) — the mock is a no-op addition at this point since `PatientProfile.tsx` doesn't import the component yet.

- [ ] **Step 3: Import and render `PatientPortalCard` in the sidebar**

```typescript
// frontend/src/pages/PatientProfile.tsx — add to the imports (near the other
// component imports, after `TreatmentPackageFormDialog`, line 25):
import { PatientPortalCard } from '@/components/patients/PatientPortalCard';
```

```typescript
// frontend/src/pages/PatientProfile.tsx — in the "Right sidebar" div (starts
// line 1001), add the card as the last item, right after the closing `</Card>`
// of "Próximas consultas" (line 1130) and before the sidebar div's closing
// `</div>` (line 1131):
            </Card>

            <PatientPortalCard patientId={id!} patientCpf={patient.cpf} />
          </div>
```

- [ ] **Step 4: Run the `PatientProfile` tests again to confirm no regression**

Run: `cd frontend && bunx vitest run src/pages/PatientProfile.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PatientProfile.tsx frontend/src/pages/PatientProfile.test.tsx
git commit -m "feat(patient-portal): show the Portal da paciente card on the patient profile

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `ActivatePatientAccount` public page + route

**Files:**
- Create: `frontend/src/pages/ActivatePatientAccount.tsx`
- Create: `frontend/src/pages/ActivatePatientAccount.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `patientPortalApi.activate` (Task 1).
- Produces: route `/paciente/ativar-conta` — the terminal step of the "convite — conta nova" flow (invite is created server-side by Task 3's "Convidar para o app" button; this page is where the e-mail link lands).

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/pages/ActivatePatientAccount.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/lib/api', () => ({
  patientPortalApi: { activate: vi.fn() },
}));

import { patientPortalApi } from '@/lib/api';
import ActivatePatientAccount from '@/pages/ActivatePatientAccount';

function renderPage(token = 'abc123token') {
  return render(
    <MemoryRouter
      initialEntries={[`/paciente/ativar-conta?token=${token}`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/paciente/ativar-conta" element={<ActivatePatientAccount />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ActivatePatientAccount page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza campos de senha e confirmação', () => {
    renderPage();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ativar conta/i })).toBeInTheDocument();
  });

  it('exibe erro se as senhas não coincidem', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'diferente' } });
    fireEvent.click(screen.getByRole('button', { name: /ativar conta/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/senhas não coincidem/i);
    });
    expect(patientPortalApi.activate).not.toHaveBeenCalled();
  });

  it('chama patientPortalApi.activate com o token da URL e a senha', async () => {
    vi.mocked(patientPortalApi.activate).mockResolvedValue({ message: 'ok' } as any);
    renderPage('meu-token-valido');

    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'novaSenha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'novaSenha123' } });
    fireEvent.click(screen.getByRole('button', { name: /ativar conta/i }));

    await waitFor(() => {
      expect(patientPortalApi.activate).toHaveBeenCalledWith('meu-token-valido', 'novaSenha123');
    });
  });

  it('exibe a mensagem de sucesso pedindo para baixar o app', async () => {
    vi.mocked(patientPortalApi.activate).mockResolvedValue({ message: 'ok' } as any);
    renderPage();

    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'novaSenha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'novaSenha123' } });
    fireEvent.click(screen.getByRole('button', { name: /ativar conta/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /ativar conta/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/expirou/i);
    });
  });

  it('exibe aviso quando o token está ausente na URL', () => {
    render(
      <MemoryRouter
        initialEntries={['/paciente/ativar-conta']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/paciente/ativar-conta" element={<ActivatePatientAccount />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/link inválido/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && bunx vitest run src/pages/ActivatePatientAccount.test.tsx`
Expected: FAIL — cannot find module `@/pages/ActivatePatientAccount`.

- [ ] **Step 3: Write the page implementation**

```typescript
// frontend/src/pages/ActivatePatientAccount.tsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { patientPortalApi } from '@/lib/api';
import { appVersion } from '@/lib/version';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function ActivatePatientAccount() {
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
        setError('Este convite expirou ou já foi utilizado. Peça um novo convite à sua clínica.');
      } else {
        setError('Não foi possível ativar sua conta. Tente novamente.');
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
            Gestão clínica
          </div>
        </div>
      </div>
      <div className="mt-auto">
        <h2
          className="text-[36px] leading-[44px] font-semibold text-white max-w-[380px]"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.022em' }}
        >
          Cuidando de quem cuida do assoalho pélvico.
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
              Link inválido. Peça um novo convite à sua clínica.
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
                  Sua senha foi definida. Baixe o app Sou Pelvi e entre com seu CPF.
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
                  Ative sua conta
                </h1>
                <p className="text-[13.5px] text-muted-foreground mt-1.5">
                  Defina uma senha com no mínimo 6 caracteres para acessar o app Sou Pelvi.
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

- [ ] **Step 4: Register the route in `App.tsx`**

```typescript
// frontend/src/App.tsx — add the lazy import next to `ResetPassword` (line 34):
const ActivatePatientAccount = lazy(() => import("./pages/ActivatePatientAccount"));
```

```typescript
// frontend/src/App.tsx — add the route next to `/redefinir-senha` (line 66),
// in the same public/unauthenticated group:
                  <Route path="/redefinir-senha" element={<ResetPassword />} />
                  <Route path="/paciente/ativar-conta" element={<ActivatePatientAccount />} />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run src/pages/ActivatePatientAccount.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Run the full frontend test suite to confirm no regressions**

Run: `cd frontend && bun run test`
Expected: PASS (all suites, including `PatientPortalCard.test.tsx` and `PatientProfile.test.tsx` from Tasks 2–3).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/ActivatePatientAccount.tsx frontend/src/pages/ActivatePatientAccount.test.tsx frontend/src/App.tsx
git commit -m "feat(patient-portal): add the public account-activation page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Version bump

**Files:**
- Modify: `frontend/package.json`

**Interfaces:** none — this is the standard end-of-feature-branch chore for this repo (shown in the Sidebar's version tooltip).

- [ ] **Step 1: Bump the version**

```json
// frontend/package.json — line 4
  "version": "0.7.0",
```

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json
git commit -m "chore: bump version to 0.7.0

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
