# Design Spec — Status do Paciente (SOU-17)

**Data:** 2026-09-05
**Status:** Aprovado
**Escopo:** Backend (`patient` module + migração) + Frontend (`Patients.tsx`, `PatientProfile.tsx`, `AppointmentFormDialog.tsx`, `StatusBadge`, tipos, API client)
**Linear:** SOU-17

---

## Problema

O cadastro de paciente não tem forma de sinalizar que um paciente não está mais em
acompanhamento (recebeu alta, encerrou tratamento). Todos os pacientes já cadastrados
aparecem para sempre em toda listagem e no seletor de novos agendamentos, poluindo a
operação do dia a dia de clínicas com histórico longo.

## Requisitos confirmados com o usuário

- Novo campo de **status** no paciente: `ACTIVE` / `INACTIVE`.
- Representação no banco: **enum** `PatientStatus` (não boolean) — deixa porta aberta para
  novos estados sem migração de tipo de coluna.
- Status **não bloqueia nada**: um paciente inativo pode voltar a ser ativo a qualquer
  momento para um segundo tratamento. Nenhuma regra de negócio impede operações sobre
  paciente inativo.
- **Agendamento** (`AppointmentFormDialog`): o seletor de paciente esconde inativos por
  padrão, com um toggle "incluir pacientes inativos" para revelá-los quando necessário.
- **Lista de pacientes** (`Patients.tsx`): abre filtrada em "Ativos"; seletor de 3 estados
  Ativos / Inativos / Todos.
- **Onde trocar o status:** ação no header do Perfil do Paciente **e** menu de ação por
  linha na listagem. *Não* no formulário de cadastro/edição.
- **Default do backend:** `GET /patients` sem o parâmetro `status` retorna **todos** os
  pacientes (opt-in). Comportamento atual preservado para os demais consumidores da API
  (Dashboard, GlobalSearch, Evolutions, Anamnese, Avaliação Perineal, Professionals).

---

## Solução

### 1. Modelo de dados

**Arquivo:** `backend/prisma/schema.prisma`

Novo enum:

```prisma
enum PatientStatus {
  ACTIVE
  INACTIVE
}
```

No `model Patient`:

```prisma
  status              PatientStatus @default(ACTIVE)
```

Novo índice (mantém a listagem "Ativos" barata):

```prisma
  @@index([organizationId, status, deletedAt])
```

- Campo **non-null**. Linhas existentes recebem `ACTIVE` pelo `@default` na migração — sem
  backfill manual.
- Migração: `bunx prisma migrate dev --name add_patient_status` (dev) /
  `NODE_ENV=prod bunx prisma migrate deploy` (prod).

**Arquivo:** `backend/prisma/seed.ts`

- Marcar **1** dos 5 pacientes seed como `INACTIVE`, para dado de teste manual.

### 2. Backend — `patient` module

**`backend/src/patient/dto/query-patient.dto.ts`**

```ts
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
```

**`backend/src/patient/dto/update-patient.dto.ts`**

```ts
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
```

**`backend/src/patient/dto/create-patient.dto.ts`** — sem mudança. Paciente nasce sempre
`ACTIVE` pelo default do banco.

**`backend/src/patient/patient.service.ts`**

- `findAll`: destructar `status` do `query` e, quando presente, `where.status = status`.
  Ausente → sem cláusula (retorna todos, respeitando `deletedAt: null`).
- `update`: nenhuma mudança de código — o método já faz `data: { ...dto, ... }`, então
  `status` passa direto. (O `ValidationPipe` global com `whitelist` aceita o campo porque
  ele agora está no DTO.)

**`backend/src/patient/patient.controller.ts`** — sem mudança. Trocar status é
`PATCH /patients/:id { "status": "INACTIVE" }`, sem endpoint dedicado.

**Nenhuma mudança em `appointment`** — o issue proíbe bloqueio.

### 3. Tipos compartilhados + API client (frontend)

**`frontend/src/types/clinic.ts`**

```ts
export type PatientStatus = 'ACTIVE' | 'INACTIVE';
```

- `Patient` += `status: PatientStatus`.
- `CreatePatientData` — sem mudança.

**`frontend/src/lib/api.ts`**

- `patientsApi.list` params += `status?: PatientStatus`.
- `patientsApi.update` — assinatura passa a aceitar `status`. Usar
  `Partial<CreatePatientData> & { status?: PatientStatus }` (ou um tipo `UpdatePatientData`
  dedicado se ficar mais limpo).

### 4. `StatusBadge`

**`frontend/src/components/ui/status-badge.tsx`**

- `DomainStatus` union += `PatientStatus`.
- `STATUS_MAP` += `INACTIVE: { label: 'Inativo', variant: 'soft-muted' }`.
- `ACTIVE` já existe no mapa (`{ label: 'Ativo', variant: 'soft-success' }`) — reaproveitado,
  label idêntico. O `Record<DomainStatus, StatusConfig>` força o TS a cobrar `INACTIVE` em
  compile-time.

### 5. Perfil do Paciente — `frontend/src/pages/PatientProfile.tsx`

- No header card (bloco a partir da linha ~298), ao lado do nome do paciente:
  `<StatusBadge status={patient.status} />` — sempre visível.
- Quando `patient.status === 'INACTIVE'`: hint textual sutil no header —
  *"Paciente inativo — não aparece em novos agendamentos por padrão."*
- Nas ações do topo (linha ~286, junto de "Editar dados" / "Nova consulta"): botão que
  alterna conforme o status atual:
  - `ACTIVE` → `<Button variant="outline">` "Marcar como inativo"
  - `INACTIVE` → `<Button variant="outline">` "Reativar paciente"
- Clique abre `AlertDialog` de confirmação leve (uma frase + confirmar/cancelar).
- `useMutation` → `patientsApi.update(id, { status })`:
  - `onSuccess`: `queryClient.invalidateQueries` para `['patient', id]`, `['patients']`,
    `['patients-select']`; `toast.success`.
  - `onError`: `toast.error('Erro ao alterar status')`.

### 6. Lista de Pacientes — `frontend/src/pages/Patients.tsx`

- Novo estado: `const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE')`.
- Filter bar (bloco a partir da linha ~155): 3 chips reusando o padrão visual dos chips
  atuais — **Ativos · Inativos · Todos** (seleção única, mutuamente exclusiva; diferente dos
  toggles multi-seleção "com pacote ativo" / "sem agendamento" que continuam como estão).
- `useQuery`:
  - `queryKey` += `statusFilter`.
  - `queryFn`: `status: statusFilter === 'ALL' ? undefined : statusFilter`.
- `useEffect` de reset de página (linha ~63) += `statusFilter` nas deps.
- Coluna de 40px por linha (hoje `<div />` na linha ~340, e header na linha ~256):
  `DropdownMenu` (trigger `MoreVertical`, `size="icon"`, `variant="ghost"`) com itens:
  - "Marcar como inativo" / "Reativar" (conforme `patient.status`)
  - "Editar dados" (abre `PatientFormDialog` em modo edição — hoje só acessível pelo perfil)
  - Handlers com `e.stopPropagation()` para não disparar o `navigate` da linha.
- Mutation de status: mesma lógica do Perfil (invalida `['patients']`, `['patients-select']`).
- `<StatusBadge status={patient.status} />` renderizado na célula do nome **quando
  `statusFilter !== 'ACTIVE'`** (distingue inativos em "Todos" / confirma em "Inativos").
- Empty-states (linhas ~233 e ~236): incluir o filtro de status no texto condicional
  ("Nenhum paciente inativo", etc.).
- **Não há card view** para pacientes hoje — só a table view. Sem trabalho de card view.

### 7. Seletor de paciente no agendamento — `frontend/src/components/appointments/AppointmentFormDialog.tsx`

- Novo estado local: `const [includeInactive, setIncludeInactive] = useState(false)`.
- Query `['patients-select']` (linha ~116):
  - `queryKey` → `['patients-select', includeInactive]`.
  - `queryFn` → `patientsApi.list({ page: 1, limit: 100, status: includeInactive ? undefined : 'ACTIVE' })`.
- Checkbox discreto abaixo do `<Select>` de paciente (linha ~419): "Incluir pacientes
  inativos" → controla `includeInactive`.
- **Modo edição** (`isEditMode` / `appointment` presente): inicializar `includeInactive`
  como `true`. Garante que uma consulta cujo paciente ficou `INACTIVE` continue exibindo o
  paciente selecionado no `<Select>` (senão o valor fica órfão e o campo aparece vazio).
- `handleQuickPatientSuccess` já invalida `['patients-select']` — funciona com a nova
  queryKey por prefixo.
- Quick cadastro (`PatientFormDialog` mode `quick`) — sem mudança; nasce `ACTIVE`.

### 8. Testes

**Backend — `backend/src/patient/patient.service.spec.ts`**

- `findAll` com `status: 'ACTIVE'` → `where.status` presente no `findMany`/`count`.
- `findAll` sem `status` → sem `where.status` (retorna todos).
- `update` com `{ status: 'INACTIVE' }` → repassado ao `prisma.patient.update`.

**Frontend**

- `Patients` (novo ou existente test file): trocar chip de status refaz a query com o
  parâmetro correto; item do menu de linha dispara a mutation de `update`.
- `AppointmentFormDialog.test.tsx`: seletor esconde inativos por padrão; toggle
  "incluir inativos" refaz a query sem `status`; modo edição inicia com inativos incluídos.
- `PatientProfile` (se houver test file): botão de ação alterna o status e chama
  `patientsApi.update`.

**Comandos:** `bun run frontend:test` + `bun run backend:test`.

---

## Fora de escopo (YAGNI)

- Bloqueio de qualquer operação (agendamento, financeiro, etc.) para paciente inativo — o
  issue proíbe explicitamente.
- Campo de status no formulário de cadastro novo e no cadastro rápido.
- Motivo da inativação / data de alta / observação de encerramento.
- Auditoria dedicada da mudança de status — o `AuditInterceptor` já registra
  `PATCH /patients/:id` genericamente.
- Estados adicionais além de `ACTIVE` / `INACTIVE` (ex.: `DISCHARGED`, `IN_TREATMENT`).

---

## Arquivos afetados

**Backend**
- `backend/prisma/schema.prisma` (enum + campo + índice)
- `backend/prisma/migrations/*_add_patient_status/` (gerada)
- `backend/prisma/seed.ts`
- `backend/src/patient/dto/query-patient.dto.ts`
- `backend/src/patient/dto/update-patient.dto.ts`
- `backend/src/patient/patient.service.ts`
- `backend/src/patient/patient.service.spec.ts`

**Frontend**
- `frontend/src/types/clinic.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/components/ui/status-badge.tsx`
- `frontend/src/pages/PatientProfile.tsx`
- `frontend/src/pages/Patients.tsx`
- `frontend/src/components/appointments/AppointmentFormDialog.tsx`
- test files correspondentes
