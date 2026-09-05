# Status do Paciente (SOU-17) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um status `ACTIVE`/`INACTIVE` ao paciente para que pacientes com alta possam ser ocultados das listagens e do seletor de novos agendamentos, sem bloquear nenhuma operação.

**Architecture:** Novo enum Prisma `PatientStatus` + coluna `status` (default `ACTIVE`) em `Patient`. O backend ganha um filtro opcional `status` em `GET /patients` (ausente → retorna todos) e aceita `status` no `PATCH /patients/:id`. No frontend, um hook compartilhado `usePatientStatusMutation` centraliza a troca de status; a página Pacientes ganha um filtro de 3 estados (padrão "Ativos") e um menu de ação por linha; o perfil do paciente ganha um badge e um botão ativar/inativar; o `AppointmentFormDialog` esconde inativos por padrão com um toggle "incluir inativos".

**Tech Stack:** NestJS + Prisma 7 + PostgreSQL (backend, Jest), React + TypeScript + Vite + TanStack Query + react-hook-form + shadcn/ui (frontend, Vitest + @testing-library/react). Package manager: Bun.

**Spec:** `docs/superpowers/specs/2026-09-05-patient-status-design.md`

## Global Constraints

- UI em português do Brasil (pt-BR).
- Backend: TypeScript estrito (`noImplicitAny: true`, `strictNullChecks: true`). Cobertura mínima: 80% statements/functions/lines, 75% branches (só `*.service.ts`).
- Frontend: TypeScript loose (`strictNullChecks: false`). Imports de `src/` usam o alias `@/`.
- Nunca confiar em `organizationId` vindo do cliente — controllers usam `@OrgId()`.
- Status **não bloqueia** nenhuma operação. Um paciente inativo pode ser reativado a qualquer momento.
- `GET /patients` sem o parâmetro `status` **retorna todos** os pacientes (comportamento atual preservado para Dashboard, GlobalSearch, Evolutions, Anamnese, Avaliação Perineal, Professionals).
- Enum values exatos: `ACTIVE`, `INACTIVE`. Labels pt-BR: "Ativo" / "Inativo".
- Migração dev: `cd backend && bunx prisma migrate dev --name add_patient_status`. Prod (não roda agora): `NODE_ENV=prod bunx prisma migrate deploy`.
- Rodar testes: `bun run backend:test` e `bun run frontend:test` a partir da raiz do repo.
- **Não** rodar `bun run lint` no `backend/` (é `eslint --fix` e reescreve ~195 arquivos).
- Mensagens de commit terminam com:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01QYfmfxD4nzTDCZQyLQsCE1
  ```
- A branch de trabalho deve conter `sou-17` (ex.: `bravilal/sou-17-status-do-paciente`) para o Linear linkar.

---

### Task 1: Backend — enum, migração, DTOs, filtro no service, seed

**Files:**
- Modify: `backend/prisma/schema.prisma` (enum `PatientStatus`, campo `Patient.status`, novo `@@index`)
- Create: `backend/prisma/migrations/<timestamp>_add_patient_status/migration.sql` (gerada pelo Prisma)
- Modify: `backend/src/patient/dto/query-patient.dto.ts` (campo `status`)
- Modify: `backend/src/patient/dto/update-patient.dto.ts` (campo `status` + import `IsIn`)
- Modify: `backend/src/patient/patient.service.ts:47-90` (`findAll` — filtro `status`)
- Modify: `backend/prisma/seed.ts` (marcar 1 paciente como `INACTIVE`)
- Test: `backend/src/patient/patient.service.spec.ts` (bloco `describe('filtros e ordenação')` + bloco `describe('isolamento por organizationId')`)

**Interfaces:**
- Consumes: nada (primeira task).
- Produces:
  - Enum Prisma `PatientStatus` com membros `ACTIVE`, `INACTIVE`. Prisma Client expõe o tipo string-literal `'ACTIVE' | 'INACTIVE'` e o campo `Patient.status: PatientStatus` (non-null).
  - `QueryPatientDto.status?: 'ACTIVE' | 'INACTIVE'` — quando presente, `PatientService.findAll` adiciona `where.status = status`; quando ausente, nenhuma cláusula de status.
  - `UpdatePatientDto.status?: 'ACTIVE' | 'INACTIVE'` — repassado direto a `prisma.patient.update({ data })` pelo spread já existente no `update`.
  - Sem endpoint novo: troca de status é `PATCH /patients/:id { "status": "INACTIVE" }`.

- [ ] **Step 1: Adicionar o enum e o campo no schema**

Em `backend/prisma/schema.prisma`, imediatamente **antes** de `model Patient {` (linha ~173), adicionar:

```prisma
enum PatientStatus {
  ACTIVE
  INACTIVE
}
```

Dentro de `model Patient`, adicionar o campo logo após a linha `notes String?` (linha ~189) e antes de `deletedAt`:

```prisma
  status              PatientStatus @default(ACTIVE) @map("status")
```

Ainda dentro de `model Patient`, adicionar o índice junto aos `@@index` existentes (após a linha `@@index([organizationId, name, deletedAt])`, linha ~203):

```prisma
  @@index([organizationId, status, deletedAt])
```

- [ ] **Step 2: Validar o schema**

Run: `cd backend && bunx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Gerar a migração**

Run: `cd backend && bunx prisma migrate dev --name add_patient_status`
Expected: cria `prisma/migrations/<timestamp>_add_patient_status/migration.sql` contendo `CREATE TYPE "PatientStatus"`, `ALTER TABLE "patients" ADD COLUMN "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE'` e `CREATE INDEX ... ON "patients"("organization_id", "status", "deleted_at")`. Também roda `prisma generate`.

Se o comando reclamar de conexão com o banco (sem `.env.dev` local), pare e avise — a migração precisa de um Postgres acessível.

- [ ] **Step 4: Escrever os testes que falham (service)**

Em `backend/src/patient/patient.service.spec.ts`, dentro do `describe('filtros e ordenação', () => { ... })` (linha ~168), adicionar:

```ts
    it('status deve adicionar filtro de status ao where', async () => {
      await service.findAll(orgA, { page: 1, limit: 20, status: 'INACTIVE' });

      const callArgs = prisma.patient.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toBe('INACTIVE');
    });

    it('sem status não deve adicionar filtro de status ao where', async () => {
      await service.findAll(orgA, { page: 1, limit: 20 });

      const callArgs = prisma.patient.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toBeUndefined();
    });
```

Dentro do `describe('isolamento por organizationId', () => { ... })` (linha ~38), adicionar:

```ts
    it('update deve repassar status ao prisma.patient.update', async () => {
      prisma.patient.findFirst.mockResolvedValue({
        id: 'patient-1', organizationId: orgA, name: 'X',
      } as any);
      prisma.patient.update.mockResolvedValue({ id: 'patient-1' } as any);

      await service.update(orgA, 'patient-1', { status: 'INACTIVE' });

      expect(prisma.patient.update).toHaveBeenCalledWith({
        where: { id: 'patient-1' },
        data: expect.objectContaining({ status: 'INACTIVE' }),
      });
    });
```

- [ ] **Step 5: Rodar os testes e confirmar que falham**

Run: `cd backend && bunx jest src/patient/patient.service.spec.ts -t "status"`
Expected: FAIL. Os dois testes de `findAll` falham (hoje `where.status` é sempre `undefined` porque o service ignora `query.status`); o teste de `update` pode falhar na compilação TS porque `UpdatePatientDto` ainda não tem `status`.

- [ ] **Step 6: Adicionar `status` ao `QueryPatientDto`**

Em `backend/src/patient/dto/query-patient.dto.ts`, `IsIn` já está importado. Adicionar o campo ao final da classe:

```ts
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
```

- [ ] **Step 7: Adicionar `status` ao `UpdatePatientDto`**

Em `backend/src/patient/dto/update-patient.dto.ts`, adicionar `IsIn` à lista de imports de `class-validator`:

```ts
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
```

E adicionar o campo ao final da classe `UpdatePatientDto`:

```ts
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
```

- [ ] **Step 8: Aplicar o filtro no `findAll`**

Em `backend/src/patient/patient.service.ts`, no método `findAll` (linha ~47), incluir `status` na desestruturação de `query`:

```ts
    const { search, page = 1, limit = 20, orderBy, hasActivePackage, hasNoUpcomingAppointment, status } = query;
```

E adicionar, logo após o bloco `if (search) { ... }` (antes do `if (hasActivePackage)`):

```ts
    if (status) {
      where.status = status;
    }
```

- [ ] **Step 9: Rodar os testes e confirmar que passam**

Run: `cd backend && bunx jest src/patient/patient.service.spec.ts`
Expected: PASS (todos os testes do arquivo, incluindo os antigos).

- [ ] **Step 10: Marcar um paciente como inativo no seed**

Em `backend/prisma/seed.ts`, no array `patients = await Promise.all([ ... ])` (linha ~194), no objeto do paciente **"Roberto Ferreira"** (o 5º, sem CPF), adicionar `status: 'INACTIVE',` ao `data`:

```ts
    prisma.patient.create({
      data: {
        organizationId: clinicA.id,
        name: 'Roberto Ferreira',
        status: 'INACTIVE',
        email: 'roberto@email.com',
        phone: '11988880005',
        birthDate: new Date('1960-05-12'),
        gender: 'M',
        addressStreet: 'Rua das Flores',
        addressNumber: '123',
        addressCity: 'São Paulo',
        // ...demais campos existentes inalterados
      },
    }),
```

- [ ] **Step 11: Compilar o backend**

Run: `bun run backend:build`
Expected: build sem erros de tipo.

- [ ] **Step 12: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/prisma/seed.ts backend/src/patient
git commit -m "$(cat <<'EOF'
feat(backend): status ACTIVE/INACTIVE no paciente (SOU-17)

Enum PatientStatus + coluna status (default ACTIVE) em Patient, filtro
opcional status em GET /patients e suporte a status no PATCH /patients/:id.
GET /patients sem o parametro continua retornando todos.

Part of SOU-17

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QYfmfxD4nzTDCZQyLQsCE1
EOF
)"
```

---

### Task 2: Frontend — tipo `PatientStatus`, API client, `StatusBadge`

**Files:**
- Modify: `frontend/src/types/clinic.ts:73-91` (`Patient`) e `:98-113` (`CreatePatientData` — sem mudança, apenas contexto), adicionar `PatientStatus`
- Modify: `frontend/src/lib/api.ts:163-178` (`patientsApi.list` params + `patientsApi.update` assinatura)
- Modify: `frontend/src/components/ui/status-badge.tsx` (`DomainStatus` + entrada `INACTIVE`)
- Create: `frontend/src/components/ui/status-badge.test.tsx`

**Interfaces:**
- Consumes: enum values `'ACTIVE' | 'INACTIVE'` da Task 1 (contrato de API).
- Produces:
  - `export type PatientStatus = 'ACTIVE' | 'INACTIVE'` em `@/types/clinic`.
  - `Patient.status: PatientStatus`.
  - `patientsApi.list(params?: { search?; page?; limit?; orderBy?; hasActivePackage?; hasNoUpcomingAppointment?; status?: PatientStatus })`.
  - `patientsApi.update(id: string, data: Partial<CreatePatientData> & { status?: PatientStatus })`.
  - `<StatusBadge status="ACTIVE" />` → "Ativo" (verde); `<StatusBadge status="INACTIVE" />` → "Inativo" (cinza).

- [ ] **Step 1: Escrever o teste que falha (StatusBadge)**

Create `frontend/src/components/ui/status-badge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renderiza "Ativo" para status ACTIVE', () => {
    render(<StatusBadge status="ACTIVE" />);
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('renderiza "Inativo" para status INACTIVE', () => {
    render(<StatusBadge status="INACTIVE" />);
    expect(screen.getByText('Inativo')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd frontend && bunx vitest run src/components/ui/status-badge.test.tsx`
Expected: FAIL — o teste `INACTIVE` quebra em runtime (`config` é `undefined` em `STATUS_MAP['INACTIVE']`) e/ou o TS reclama que `"INACTIVE"` não é atribuível a `DomainStatus`.

- [ ] **Step 3: Adicionar `PatientStatus` aos tipos**

Em `frontend/src/types/clinic.ts`, adicionar acima de `export interface Patient {` (linha ~73):

```ts
export type PatientStatus = 'ACTIVE' | 'INACTIVE';
```

E dentro de `export interface Patient`, adicionar o campo (após `notes?: string;`, antes de `createdAt`):

```ts
  status: PatientStatus;
```

Não alterar `CreatePatientData`.

- [ ] **Step 4: Atualizar o `patientsApi`**

Em `frontend/src/lib/api.ts`, garantir que `PatientStatus` está no import de `@/types/clinic` (junto de `CreatePatientData`, linha ~8):

```ts
  CreatePatientData,
  PatientStatus,
```

No objeto `patientsApi` (linha ~163), adicionar `status?: PatientStatus` ao tipo do parâmetro de `list` e ampliar a assinatura de `update`:

```ts
export const patientsApi = {
  list: (params?: {
    search?: string;
    page?: number;
    limit?: number;
    orderBy?: 'name_asc' | 'name_desc';
    hasActivePackage?: boolean;
    hasNoUpcomingAppointment?: boolean;
    status?: PatientStatus;
  }) =>
    api.get<PaginatedResponse<Patient>>(`/patients?${queryString(params)}`),
  getById: (id: string) => api.get<Patient>(`/patients/${id}`),
  create: (data: CreatePatientData) => api.post<Patient>('/patients', data),
  update: (id: string, data: Partial<CreatePatientData> & { status?: PatientStatus }) =>
    api.patch<Patient>(`/patients/${id}`, data),
  remove: (id: string) => api.delete<void>(`/patients/${id}`),
};
```

(Confirmar que `queryString` ignora chaves `undefined` — ele já é usado assim para `hasActivePackage` na página Pacientes, então nenhuma mudança é necessária ali.)

- [ ] **Step 5: Adicionar `INACTIVE` ao `StatusBadge`**

Em `frontend/src/components/ui/status-badge.tsx`:

1. Importar o tipo:

```ts
import type {
  AppointmentStatus,
  FinancialStatus,
  FinancialType,
  PatientStatus,
  TreatmentPackageStatus,
} from '@/types/clinic';
```

2. Adicionar `PatientStatus` à union `DomainStatus`:

```ts
export type DomainStatus =
  | AppointmentStatus
  | FinancialStatus
  | FinancialType
  | PatientStatus
  | TreatmentPackageStatus;
```

3. Adicionar a entrada `INACTIVE` ao `STATUS_MAP` (a chave `ACTIVE` já existe com `{ label: 'Ativo', variant: 'soft-success' }` e é reaproveitada). Adicionar em um bloco novo:

```ts
  // Patient status
  INACTIVE:  { label: 'Inativo',    variant: 'soft-muted' },
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `cd frontend && bunx vitest run src/components/ui/status-badge.test.tsx`
Expected: PASS.

- [ ] **Step 7: Rodar a suíte completa do frontend + build**

Run: `bun run frontend:test`
Expected: PASS (nenhuma regressão).

Run: `bun run frontend:build`
Expected: build sem erros de tipo.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/clinic.ts frontend/src/lib/api.ts frontend/src/components/ui/status-badge.tsx frontend/src/components/ui/status-badge.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): tipo PatientStatus, filtro status na API e badge Inativo (SOU-17)

Part of SOU-17

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QYfmfxD4nzTDCZQyLQsCE1
EOF
)"
```

---

### Task 3: Frontend — hook `usePatientStatusMutation`

**Files:**
- Create: `frontend/src/components/patients/use-patient-status-mutation.ts`
- Create: `frontend/src/components/patients/use-patient-status-mutation.test.tsx`

**Interfaces:**
- Consumes: `patientsApi.update(id, { status })` (Task 2), `PatientStatus` (Task 2).
- Produces:
  - `usePatientStatusMutation(patientId: string)` → objeto de mutation do TanStack Query. `mutation.mutate('INACTIVE' | 'ACTIVE')` chama `patientsApi.update(patientId, { status })`, invalida as query keys `['patient', patientId]`, `['patients']`, `['patients-select']` e dispara um `toast` de sucesso/erro. `mutation.isPending` disponível para desabilitar botões.

- [ ] **Step 1: Escrever o teste que falha**

Create `frontend/src/components/patients/use-patient-status-mutation.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePatientStatusMutation } from './use-patient-status-mutation';

vi.mock('@/lib/api', () => ({
  patientsApi: { update: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { patientsApi } from '@/lib/api';
import { toast } from 'sonner';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('usePatientStatusMutation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chama patientsApi.update com o status e mostra toast de sucesso', async () => {
    vi.mocked(patientsApi.update).mockResolvedValue({} as any);
    const { result } = renderHook(() => usePatientStatusMutation('pat-1'), { wrapper });

    result.current.mutate('INACTIVE');

    await waitFor(() => expect(patientsApi.update).toHaveBeenCalledWith('pat-1', { status: 'INACTIVE' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Paciente marcado como inativo'));
  });

  it('mostra toast de erro quando a API falha', async () => {
    vi.mocked(patientsApi.update).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => usePatientStatusMutation('pat-1'), { wrapper });

    result.current.mutate('ACTIVE');

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro ao alterar status do paciente'));
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd frontend && bunx vitest run src/components/patients/use-patient-status-mutation.test.tsx`
Expected: FAIL — `Failed to resolve import './use-patient-status-mutation'`.

- [ ] **Step 3: Implementar o hook**

Create `frontend/src/components/patients/use-patient-status-mutation.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { patientsApi } from '@/lib/api';
import type { PatientStatus } from '@/types/clinic';

/**
 * Centraliza a troca de status (ACTIVE/INACTIVE) de um paciente:
 * chama PATCH /patients/:id, invalida as listagens que dependem do status
 * e dá o feedback via toast. Usado pelo perfil do paciente e pela listagem.
 */
export function usePatientStatusMutation(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: PatientStatus) => patientsApi.update(patientId, { status }),
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients-select'] });
      toast.success(
        status === 'INACTIVE' ? 'Paciente marcado como inativo' : 'Paciente reativado',
      );
    },
    onError: () => toast.error('Erro ao alterar status do paciente'),
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd frontend && bunx vitest run src/components/patients/use-patient-status-mutation.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/patients/use-patient-status-mutation.ts frontend/src/components/patients/use-patient-status-mutation.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): hook usePatientStatusMutation (SOU-17)

Part of SOU-17

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QYfmfxD4nzTDCZQyLQsCE1
EOF
)"
```

---

### Task 4: Frontend — `AppointmentFormDialog` esconde inativos por padrão + toggle

**Files:**
- Modify: `frontend/src/components/appointments/AppointmentFormDialog.tsx` (query `patients-select`, novo estado `includeInactive`, checkbox abaixo do select de paciente)
- Test: `frontend/src/components/appointments/AppointmentFormDialog.test.tsx`

**Interfaces:**
- Consumes: `patientsApi.list({ ..., status })` (Task 2).
- Produces: nenhum export novo. Comportamento: em modo criação o select de paciente carrega só `status: 'ACTIVE'`; um checkbox "Incluir pacientes inativos" recarrega sem filtro; em modo edição (`appointment` presente) o checkbox já inicia marcado.

- [ ] **Step 1: Escrever os testes que falham**

Em `frontend/src/components/appointments/AppointmentFormDialog.test.tsx`, adicionar um novo bloco `describe` (o mock de `@/components/ui/checkbox` já existe no arquivo, linha ~88; `pagedPatients` e `patient` já são helpers do arquivo):

```ts
describe('AppointmentFormDialog — filtro de pacientes inativos', () => {
  it('em modo criação, carrega apenas pacientes ativos', async () => {
    renderDialog();
    await waitFor(() =>
      expect(patientsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' }),
      ),
    );
  });

  it('marcar "Incluir pacientes inativos" recarrega a lista sem filtro de status', async () => {
    renderDialog();
    await waitFor(() => expect(patientsApi.list).toHaveBeenCalled());

    const toggle = screen.getByLabelText(/incluir pacientes inativos/i);
    await act(async () => {
      fireEvent.click(toggle);
    });

    await waitFor(() => {
      const calledWithoutStatus = vi
        .mocked(patientsApi.list)
        .mock.calls.some((c) => c[0] != null && c[0].status === undefined);
      expect(calledWithoutStatus).toBe(true);
    });
  });

  it('em modo edição, carrega todos os pacientes (inclui inativos)', async () => {
    renderDialog({
      appointment: {
        id: 'a1', patientId: 'p1', professionalId: 'pr1', procedureId: 'proc1',
        startAt: '2026-06-01T09:00:00.000Z', endAt: '2026-06-01T10:00:00.000Z',
        status: 'SCHEDULED',
      },
    });

    await waitFor(() => {
      const everCalledWithActive = vi
        .mocked(patientsApi.list)
        .mock.calls.some((c) => c[0]?.status === 'ACTIVE');
      expect(everCalledWithActive).toBe(false);
      expect(patientsApi.list).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd frontend && bunx vitest run src/components/appointments/AppointmentFormDialog.test.tsx -t "filtro de pacientes inativos"`
Expected: FAIL — hoje `patientsApi.list` é chamado com `{ page: 1, limit: 100 }` (sem `status`) e não existe checkbox "Incluir pacientes inativos".

- [ ] **Step 3: Adicionar estado e ajustar a query**

Em `frontend/src/components/appointments/AppointmentFormDialog.tsx`:

1. `isEditMode` já é `const isEditMode = !!appointment;` (linha ~114). Adicionar o estado logo abaixo dos outros `useState` (junto de `quickPatientOpen`, linha ~107):

```ts
  const [includeInactive, setIncludeInactive] = useState(isEditMode);
```

2. Trocar a query `patients-select` (linha ~116):

```ts
  const { data: patientsData } = useQuery({
    queryKey: ['patients-select', includeInactive],
    queryFn: () =>
      patientsApi.list({
        page: 1,
        limit: 100,
        status: includeInactive ? undefined : 'ACTIVE',
      }),
    enabled: open,
  });
```

- [ ] **Step 4: Adicionar o checkbox abaixo do select de paciente**

Em `frontend/src/components/appointments/AppointmentFormDialog.tsx`, dentro do bloco do campo "Paciente" (o `<div className="space-y-2">` que começa na linha ~403), logo **depois** do fechamento do bloco de erro `{form.formState.errors.patientId && (...)}` e antes do `</div>` que fecha o campo:

```tsx
            <div className="flex items-center gap-2 pt-0.5">
              <Checkbox
                id="apt-include-inactive"
                checked={includeInactive}
                onCheckedChange={(checked) => setIncludeInactive(!!checked)}
              />
              <Label htmlFor="apt-include-inactive" className="cursor-pointer text-xs text-muted-foreground font-normal">
                Incluir pacientes inativos
              </Label>
            </div>
```

`Checkbox` e `Label` já estão importados no arquivo.

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `cd frontend && bunx vitest run src/components/appointments/AppointmentFormDialog.test.tsx`
Expected: PASS (o arquivo inteiro, sem regressão nos testes existentes).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/appointments/AppointmentFormDialog.tsx frontend/src/components/appointments/AppointmentFormDialog.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): agendamento esconde pacientes inativos por padrao (SOU-17)

Select de paciente carrega so ACTIVE; checkbox "Incluir pacientes inativos"
revela os demais. Em modo edicao ja inicia incluindo inativos para nao
perder o paciente selecionado.

Part of SOU-17

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QYfmfxD4nzTDCZQyLQsCE1
EOF
)"
```

---

### Task 5: Frontend — `Patients.tsx` filtro de status + menu de ação por linha

**Files:**
- Modify: `frontend/src/pages/Patients.tsx` (estado `statusFilter`, chips Ativos/Inativos/Todos, query key + params, reset de página, `DropdownMenu` por linha, `StatusBadge` na célula do nome, textos de empty-state)
- Create: `frontend/src/pages/Patients.test.tsx`

**Interfaces:**
- Consumes: `patientsApi.list({ ..., status })` (Task 2), `usePatientStatusMutation` (Task 3), `<StatusBadge>` (Task 2).
- Produces: nenhum export novo.

- [ ] **Step 1: Escrever os testes que falham**

Create `frontend/src/pages/Patients.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/api', () => ({
  patientsApi: { list: vi.fn(), update: vi.fn() },
  appointmentsApi: { list: vi.fn() },
  treatmentPackagesApi: { list: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn(), AnalyticsEvent: {} }));
vi.mock('@/components/patients/PatientFormDialog', () => ({ PatientFormDialog: () => null }));

import Patients from './Patients';
import { patientsApi, appointmentsApi, treatmentPackagesApi } from '@/lib/api';

const paged = (data: any[], total = data.length) => ({
  data,
  meta: { total, page: 1, limit: 12, totalPages: 1 },
});
const patA = { id: 'a', name: 'Ana Ativa', status: 'ACTIVE', createdAt: '', updatedAt: '' };
const patI = { id: 'i', name: 'Ines Inativa', status: 'INACTIVE', createdAt: '', updatedAt: '' };

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Patients />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Patients — filtro de status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patientsApi.list).mockResolvedValue(paged([patA]) as any);
    vi.mocked(patientsApi.update).mockResolvedValue({} as any);
    vi.mocked(appointmentsApi.list).mockResolvedValue([] as any);
    vi.mocked(treatmentPackagesApi.list).mockResolvedValue([] as any);
  });

  it('ao abrir, busca apenas pacientes ativos', async () => {
    renderPage();
    await waitFor(() =>
      expect(patientsApi.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE' })),
    );
  });

  it('clicar no chip "Inativos" refaz a busca com status INACTIVE', async () => {
    renderPage();
    await waitFor(() => expect(patientsApi.list).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /inativos/i }));

    await waitFor(() =>
      expect(patientsApi.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'INACTIVE' })),
    );
  });

  it('clicar no chip "Todos" refaz a busca sem filtro de status', async () => {
    renderPage();
    await waitFor(() => expect(patientsApi.list).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /^todos/i }));

    await waitFor(() => {
      const calledWithoutStatus = vi
        .mocked(patientsApi.list)
        .mock.calls.some((c) => c[0] != null && c[0].status === undefined);
      expect(calledWithoutStatus).toBe(true);
    });
  });

  it('o menu de ação da linha inativa o paciente ativo', async () => {
    renderPage();
    const row = await screen.findByText('Ana Ativa');
    const rowEl = row.closest('[role="row"], div') as HTMLElement;

    fireEvent.click(within(rowEl).getByRole('button', { name: /ações|abrir menu/i }));
    fireEvent.click(await screen.findByText('Marcar como inativo'));

    await waitFor(() =>
      expect(patientsApi.update).toHaveBeenCalledWith('a', { status: 'INACTIVE' }),
    );
  });
});
```

> Nota de implementação: dar ao trigger do `DropdownMenu` de cada linha um `aria-label="Ações"` (via `<span className="sr-only">Ações</span>` dentro do botão ou `aria-label` no trigger) para o teste localizar o botão. Se o seletor de linha (`closest`) ficar frágil, ancore pelo `data-testid={`patient-row-${patient.id}`}` no `<div>` da linha e ajuste o teste para `screen.getByTestId`.

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd frontend && bunx vitest run src/pages/Patients.test.tsx`
Expected: FAIL — não há chips "Ativos/Inativos/Todos" com esse comportamento, `patientsApi.list` é chamado sem `status`, e não há menu de ação por linha.

- [ ] **Step 3: Adicionar o estado `statusFilter` e ligar na query**

Em `frontend/src/pages/Patients.tsx`:

1. Importar o hook e ícones — adicionar aos imports:

```ts
import { MoreVertical } from 'lucide-react';
import { usePatientStatusMutation } from '@/components/patients/use-patient-status-mutation';
import { StatusBadge } from '@/components/ui/status-badge';
import type { PatientStatus } from '@/types/clinic';
```

`DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` já estão importados (linha ~5).

2. Adicionar o estado junto dos outros (após `filterNoAppointment`, linha ~55):

```ts
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
```

3. Incluir `statusFilter` no `useEffect` de reset de página (linha ~63):

```ts
  useEffect(() => { setPage(1); }, [sortOrder, filterActivePackage, filterNoAppointment, statusFilter]);
```

4. Ligar na query (linha ~66):

```ts
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['patients', debouncedSearch, page, sortOrder === 'name_asc' ? undefined : sortOrder, filterActivePackage, filterNoAppointment, statusFilter],
    queryFn: () => patientsApi.list({
      search: debouncedSearch,
      page,
      limit: 12,
      orderBy: sortOrder !== 'name_asc' ? sortOrder : undefined,
      hasActivePackage: filterActivePackage || undefined,
      hasNoUpcomingAppointment: filterNoAppointment || undefined,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    }),
  });
```

- [ ] **Step 4: Adicionar os chips de status na filter bar**

Em `frontend/src/pages/Patients.tsx`, dentro do `{/* Filter bar */}` (`<div className="flex items-center gap-2 flex-wrap">`, linha ~156), logo **depois** do campo de busca (o `<div>` com o `<Search />` e o `<input>`) e **antes** do botão "Todos" existente, inserir o grupo de 3 chips de status:

```tsx
        <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5">
          {([
            { value: 'ACTIVE', label: 'Ativos' },
            { value: 'INACTIVE', label: 'Inativos' },
            { value: 'ALL', label: 'Todos' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                'h-[26px] px-2.5 rounded-full text-[12.5px] font-medium transition-colors',
                statusFilter === opt.value
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
```

> O botão "Todos" pré-existente (que zera `filterActivePackage`/`filterNoAppointment`) permanece — ele age sobre os toggles de pacote/agendamento, não sobre status. Se ficar confuso ter dois "Todos" lado a lado, renomeie o pré-existente para "Limpar filtros" nesta mesma etapa. (Decisão de UI: renomear.)

- [ ] **Step 5: Ajustar os textos de empty-state**

Em `frontend/src/pages/Patients.tsx`, no bloco `patients.length === 0` (linha ~229), trocar as condições `debouncedSearch || filterActivePackage || filterNoAppointment` por uma flag que também considere status filtrado:

```tsx
        <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-14 gap-3 text-center">
          <Users className="w-9 h-9 text-muted-foreground/40" />
          <p className="text-[13.5px] font-medium text-foreground/80">
            {debouncedSearch || filterActivePackage || filterNoAppointment || statusFilter !== 'ALL'
              ? 'Nenhum paciente encontrado'
              : 'Nenhum paciente cadastrado'}
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            {debouncedSearch || filterActivePackage || filterNoAppointment || statusFilter !== 'ALL'
              ? 'Tente ajustar a busca ou os filtros.'
              : 'Cadastre o primeiro paciente da clínica.'}
          </p>
          {!debouncedSearch && !filterActivePackage && !filterNoAppointment && statusFilter === 'ALL' && (
            <Button size="sm" className="mt-1" onClick={() => setFormOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Novo paciente
            </Button>
          )}
        </div>
```

- [ ] **Step 6: Adicionar o `StatusBadge` na célula do nome (quando não estiver filtrando só ativos)**

Em `frontend/src/pages/Patients.tsx`, dentro do `.map((patient) => { ... })` das linhas (linha ~261), na célula "Avatar + name", ao lado do `<div className="text-[13.5px] font-medium truncate">{patient.name}</div>`:

```tsx
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13.5px] font-medium truncate">{patient.name}</span>
                      {statusFilter !== 'ACTIVE' && patient.status === 'INACTIVE' && (
                        <StatusBadge status="INACTIVE" className="shrink-0" />
                      )}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground mt-0.5">
                      {/* ...conteúdo de idade/gênero inalterado... */}
                    </div>
                  </div>
```

- [ ] **Step 7: Adicionar o menu de ação na coluna de 40px**

Em `frontend/src/pages/Patients.tsx`, primeiro adicionar o hook de mutation no corpo do componente (perto da declaração de `navigate`, linha ~56). Como o hook precisa de um `patientId`, criar um sub-componente para a célula de ações no mesmo arquivo (acima de `export default function Patients`):

```tsx
function PatientRowActions({ patient }: { patient: import('@/types/clinic').Patient }) {
  const statusMutation = usePatientStatusMutation(patient.id);
  const targetStatus: PatientStatus = patient.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const label = patient.status === 'ACTIVE' ? 'Marcar como inativo' : 'Reativar';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Ações"
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-muted/60 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          disabled={statusMutation.isPending}
          onClick={(e) => { e.stopPropagation(); statusMutation.mutate(targetStatus); }}
        >
          {label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

Trocar o `<div />` final de cada linha (linha ~340) por:

```tsx
                {/* More */}
                <div className="flex justify-end">
                  <PatientRowActions patient={patient} />
                </div>
```

- [ ] **Step 8: Rodar os testes e confirmar que passam**

Run: `cd frontend && bunx vitest run src/pages/Patients.test.tsx`
Expected: PASS. Se o seletor de linha no teste do menu falhar, aplicar o `data-testid={`patient-row-${patient.id}`}` sugerido no Step 1 e ajustar o teste.

- [ ] **Step 9: Rodar a suíte completa + build**

Run: `bun run frontend:test`
Expected: PASS.

Run: `bun run frontend:build`
Expected: build sem erros.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/Patients.tsx frontend/src/pages/Patients.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): filtro de status e acao inativar/reativar na lista de pacientes (SOU-17)

Lista abre em "Ativos" com seletor Ativos/Inativos/Todos; menu de acao por
linha alterna o status via usePatientStatusMutation.

Part of SOU-17

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QYfmfxD4nzTDCZQyLQsCE1
EOF
)"
```

---

### Task 6: Frontend — `PatientProfile.tsx` badge de status + ação ativar/inativar

**Files:**
- Modify: `frontend/src/pages/PatientProfile.tsx` (badge no header card, botão de ação no topo, `AlertDialog` de confirmação, `usePatientStatusMutation`, hint quando inativo)
- Create: `frontend/src/pages/PatientProfile.test.tsx`

**Interfaces:**
- Consumes: `usePatientStatusMutation` (Task 3), `<StatusBadge>` (Task 2), `Patient.status` (Task 2).
- Produces: nenhum export novo.

- [ ] **Step 1: Escrever o teste que falha**

Create `frontend/src/pages/PatientProfile.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('@/lib/api', () => ({
  patientsApi: { getById: vi.fn(), update: vi.fn() },
  appointmentsApi: { list: vi.fn() },
  anamnesisApi: { list: vi.fn() },
  evolutionsApi: { list: vi.fn() },
  treatmentPackagesApi: { list: vi.fn() },
  financialApi: { listByPatient: vi.fn() },
  perinealAssessmentsApi: { list: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn(), AnalyticsEvent: {} }));
vi.mock('@/contexts/SubscriptionContext', () => ({ useFeature: () => true }));
vi.mock('@/components/patients/PatientFormDialog', () => ({ PatientFormDialog: () => null }));
vi.mock('@/components/appointments/AppointmentFormDialog', () => ({ AppointmentFormDialog: () => null }));
vi.mock('@/components/evolutions/EvolutionFormDialog', () => ({ EvolutionFormDialog: () => null }));
vi.mock('@/components/treatment-packages/TreatmentPackageFormDialog', () => ({ TreatmentPackageFormDialog: () => null }));

import PatientProfile from './PatientProfile';
import { patientsApi, appointmentsApi, anamnesisApi, evolutionsApi, treatmentPackagesApi, financialApi, perinealAssessmentsApi } from '@/lib/api';

const patient = (status: 'ACTIVE' | 'INACTIVE') => ({
  id: 'p1', name: 'Maria Teste', status, createdAt: '2024-01-01', updatedAt: '2024-01-01',
});

function renderProfile() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/patients/p1']}>
        <Routes>
          <Route path="/patients/:id" element={<PatientProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(appointmentsApi.list).mockResolvedValue([] as any);
  vi.mocked(anamnesisApi.list).mockResolvedValue([] as any);
  vi.mocked(evolutionsApi.list).mockResolvedValue([] as any);
  vi.mocked(treatmentPackagesApi.list).mockResolvedValue([] as any);
  vi.mocked(financialApi.listByPatient).mockResolvedValue([] as any);
  vi.mocked(perinealAssessmentsApi.list).mockResolvedValue([] as any);
  vi.mocked(patientsApi.update).mockResolvedValue({} as any);
});

describe('PatientProfile — status', () => {
  it('mostra badge "Inativo" e botão "Reativar paciente" quando inativo', async () => {
    vi.mocked(patientsApi.getById).mockResolvedValue(patient('INACTIVE') as any);
    renderProfile();

    expect(await screen.findByText('Inativo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reativar paciente/i })).toBeInTheDocument();
  });

  it('botão "Marcar como inativo" → confirmar chama patientsApi.update', async () => {
    vi.mocked(patientsApi.getById).mockResolvedValue(patient('ACTIVE') as any);
    renderProfile();

    fireEvent.click(await screen.findByRole('button', { name: /marcar como inativo/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^confirmar$/i }));

    await waitFor(() =>
      expect(patientsApi.update).toHaveBeenCalledWith('p1', { status: 'INACTIVE' }),
    );
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd frontend && bunx vitest run src/pages/PatientProfile.test.tsx`
Expected: FAIL — não existe badge de status nem botão "Marcar como inativo"/"Reativar paciente".

- [ ] **Step 3: Importar o hook e o AlertDialog**

Em `frontend/src/pages/PatientProfile.tsx`:

- `StatusBadge` já está importado (linha 7).
- `AlertDialog*` já está importado (linhas 27-30).
- Adicionar:

```ts
import { usePatientStatusMutation } from '@/components/patients/use-patient-status-mutation';
```

- [ ] **Step 4: Instanciar a mutation e o estado do diálogo**

Em `frontend/src/pages/PatientProfile.tsx`, junto dos outros `useState` (perto de `editOpen`, linha ~100) e após a query de `patient` (linha ~127) estar disponível:

```ts
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const patientStatusMutation = usePatientStatusMutation(id!);
```

(`id` vem de `useParams`, linha ~90; já é usado com `!` em todo o arquivo.)

- [ ] **Step 5: Renderizar o badge no header card**

Em `frontend/src/pages/PatientProfile.tsx`, no header card (linha ~311), dentro do `<div className="flex items-center gap-2.5 flex-wrap">` que contém o `<h2>{patient.name}</h2>`, adicionar após o bloco `{activePackage && (...)}`:

```tsx
            <StatusBadge status={patient.status} />
```

- [ ] **Step 6: Adicionar o botão de ação + AlertDialog no topo**

Em `frontend/src/pages/PatientProfile.tsx`, no bloco `{/* Back + page actions */}` (linha ~277), dentro do `<div className="flex items-center gap-2">` que tem "Editar dados" e "Nova consulta", adicionar como primeiro item:

```tsx
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatusDialogOpen(true)}
            disabled={patientStatusMutation.isPending}
          >
            {patient.status === 'ACTIVE' ? 'Marcar como inativo' : 'Reativar paciente'}
          </Button>
```

E, em qualquer ponto dentro do JSX retornado (por ex. logo antes do `<PatientFormDialog ... />` no final do componente), adicionar o diálogo controlado:

```tsx
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {patient.status === 'ACTIVE' ? 'Marcar paciente como inativo?' : 'Reativar paciente?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {patient.status === 'ACTIVE'
                ? 'O paciente deixa de aparecer nas listagens e no seletor de novos agendamentos por padrão. Você pode reativá-lo a qualquer momento.'
                : 'O paciente volta a aparecer normalmente nas listagens e agendamentos.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                patientStatusMutation.mutate(patient.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
                setStatusDialogOpen(false);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

- [ ] **Step 7: Adicionar o hint quando inativo**

Em `frontend/src/pages/PatientProfile.tsx`, no header card, logo abaixo da linha de meta (o `<div className="flex items-center gap-4 mt-2 flex-wrap">` que fecha por volta da linha ~345), adicionar:

```tsx
          {patient.status === 'INACTIVE' && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Paciente inativo — não aparece em novos agendamentos por padrão.
            </p>
          )}
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `cd frontend && bunx vitest run src/pages/PatientProfile.test.tsx`
Expected: PASS. Se o `AlertDialog` mockado do shadcn não renderizar o conteúdo sem um portal/trigger, o teste usa o `AlertDialog` controlado (`open`), que renderiza inline — deve funcionar. Se `name: /^confirmar$/i` não achar o botão, verifique se o `AlertDialogAction` renderiza como `<button>` (renderiza).

- [ ] **Step 9: Rodar a suíte completa + build**

Run: `bun run frontend:test`
Expected: PASS.

Run: `bun run frontend:build`
Expected: build sem erros.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/PatientProfile.tsx frontend/src/pages/PatientProfile.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): badge e acao de status no perfil do paciente (SOU-17)

Part of SOU-17

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QYfmfxD4nzTDCZQyLQsCE1
EOF
)"
```

---

### Task 7: Verificação final + spec de fechamento

**Files:**
- Modify: `docs/superpowers/specs/2026-09-05-patient-status-design.md` (marcar como implementado, se desejado)

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: nada.

- [ ] **Step 1: Rodar as duas suítes completas**

Run: `bun run backend:test`
Expected: PASS, cobertura dentro dos limites (80/75).

Run: `bun run frontend:test`
Expected: PASS.

- [ ] **Step 2: Builds**

Run: `bun run backend:build && bun run frontend:build`
Expected: ambos sem erro.

- [ ] **Step 3: Smoke manual (opcional, se houver banco local)**

- `cd backend && bun run seed` — recria dados; "Roberto Ferreira" nasce `INACTIVE`.
- `bun run backend:dev` + `bun run frontend:dev`.
- Login admin (`11111111111` / `123456`), clínica "Clinica Bem Estar".
- Página Pacientes: abre em "Ativos", "Roberto Ferreira" não aparece; chip "Inativos" → só ele, com badge "Inativo"; chip "Todos" → todos.
- Menu da linha de "Roberto" → "Reativar" → some da aba "Inativos".
- Perfil de um paciente ativo → "Marcar como inativo" → confirma → badge muda, hint aparece.
- Nova consulta: "Roberto" não aparece no select; marcar "Incluir pacientes inativos" → aparece.
- Editar uma consulta cujo paciente foi inativado → paciente continua selecionado.

- [ ] **Step 4: Revisar o diff completo**

Run: `git log --oneline main..HEAD` e `git diff main...HEAD --stat`
Expected: 6 commits de feature (Tasks 1-6), arquivos batendo com a seção "Arquivos afetados" da spec.

- [ ] **Step 5: Abrir o PR**

Seguir `superpowers:finishing-a-development-branch`. Título/descrição do PR devem conter `Closes SOU-17`. Descrição termina com:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Self-Review

**1. Spec coverage:**

| Requisito da spec | Task |
|---|---|
| Enum `PatientStatus` + `Patient.status @default(ACTIVE)` + índice | Task 1 (Steps 1-3) |
| Migração `add_patient_status` | Task 1 (Step 3) |
| Seed: 1 paciente `INACTIVE` | Task 1 (Step 10) |
| `QueryPatientDto.status` + `findAll` filtra | Task 1 (Steps 6, 8) |
| `UpdatePatientDto.status` | Task 1 (Step 7) |
| `CreatePatientDto` sem mudança | respeitado (Task 1 não toca) |
| Sem mudança em `appointment` backend | respeitado (nenhuma task toca) |
| `PatientStatus` type + `Patient.status` (frontend) | Task 2 (Step 3) |
| `patientsApi.list` param `status` + `update` aceita `status` | Task 2 (Step 4) |
| `StatusBadge` `INACTIVE` + `DomainStatus` | Task 2 (Step 5) |
| Perfil: `<StatusBadge>` sempre visível | Task 6 (Step 5) |
| Perfil: hint quando `INACTIVE` | Task 6 (Step 7) |
| Perfil: botão ativar/inativar + AlertDialog | Task 6 (Step 6) |
| Perfil: invalidação `['patient', id]`, `['patients']`, `['patients-select']` + toast | Task 3 (hook, Step 3) |
| Lista: `statusFilter` default `ACTIVE`, chips Ativos/Inativos/Todos | Task 5 (Steps 3-4) |
| Lista: query key + params + reset de página | Task 5 (Step 3) |
| Lista: menu de ação por linha (inativar/reativar) | Task 5 (Step 7) |
| Lista: `<StatusBadge>` na linha quando `statusFilter !== 'ACTIVE'` | Task 5 (Step 6) |
| Lista: wording dos empty-states | Task 5 (Step 5) |
| Agendamento: query `['patients-select', includeInactive]` + `status` | Task 4 (Step 3) |
| Agendamento: checkbox "Incluir pacientes inativos" | Task 4 (Step 4) |
| Agendamento: modo edição default `includeInactive = true` | Task 4 (Step 3) |
| Quick cadastro inalterado | respeitado (nenhuma task toca `PatientFormDialog`) |
| Testes backend (`patient.service.spec.ts`) | Task 1 (Step 4) |
| Testes frontend (Patients, AppointmentFormDialog, PatientProfile) | Tasks 4, 5, 6 |

Sem lacunas.

**2. Placeholder scan:** Sem "TBD"/"TODO"/"etc." em passos de implementação. As duas notas com decisão de UI ("renomear o botão Todos pré-existente"; "usar `data-testid` se o seletor de linha ficar frágil") são instruções concretas com a escolha já feita, não placeholders.

**3. Type consistency:**
- `PatientStatus = 'ACTIVE' | 'INACTIVE'` — mesmo nome e forma em `types/clinic.ts` (Task 2), `api.ts` (Task 2), hook (Task 3), páginas (Tasks 5, 6).
- `usePatientStatusMutation(patientId: string)` retornando objeto de mutation com `.mutate(status)` e `.isPending` — definido na Task 3, consumido igual nas Tasks 5 e 7.
- `patientsApi.update(id, { status })` — assinatura ampliada na Task 2, chamada com esse shape na Task 3 e nos testes das Tasks 5/6.
- `patientsApi.list({ ..., status })` — param adicionado na Task 2, usado nas Tasks 4 e 5.
- Query keys `['patients']`, `['patients-select']`, `['patient', id]` — batem com as já existentes em `Patients.tsx`, `AppointmentFormDialog.tsx` e `PatientProfile.tsx` (verificado no código atual).
- `StatusBadge` prop `status: DomainStatus` — `INACTIVE`/`ACTIVE` incluídos na union na Task 2.

Sem inconsistências.
