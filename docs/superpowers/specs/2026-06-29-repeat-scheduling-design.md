# Agendamento Repetido + Dedução de Pacote

**Data:** 2026-06-29
**Branch:** feat/repetirAgendamento

---

## Escopo

1. Repetição de agendamentos (diário/semanal/mensal) com resolução de dias fechados
2. Edição de agendamento recorrente com escopo ("somente este" / "este e seguintes")
3. Dedução de sessão de pacote por status (`DONE` decrementa; `CANCELED` pergunta)
4. Bug fix: botão "Criar Pacote" sem ação no `TreatmentPackageFormDialog`

---

## 1. Schema — Migração

Adicionar dois campos ao model `Appointment` em `backend/prisma/schema.prisma`:

```prisma
recurrenceGroupId  String?  @db.Uuid @map("recurrence_group_id")
recurrenceIndex    Int?     @map("recurrence_index")
```

Padrão idêntico ao já existente em `FinancialRecord`.

---

## 2. Backend

### 2.1 Endpoint: criação em lote

`POST /api/appointments/bulk`

**Body:**
```ts
{
  recurrenceGroupId: string          // UUID v4 gerado no frontend
  appointments: Array<{
    patientId: string
    professionalId: string
    procedureId: string
    startAt: string                  // ISO datetime
    notes?: string
    treatmentPackageId?: string
    recurrenceIndex: number          // 0, 1, 2, …
  }>
}
```

- Valida conflito de horário para cada appointment (lógica já existente)
- Cria todos numa única `prisma.$transaction`
- Retorna array completo de appointments criados
- **Não** decrementa sessões de pacote na criação — apenas na mudança para `DONE`

### 2.2 Endpoint: edição "este e seguintes"

`PATCH /api/appointments/:id/recurrence-forward`

- Lê `recurrenceGroupId` e `recurrenceIndex` do appointment alvo
- Atualiza o alvo + todos com mesmo `recurrenceGroupId` e `recurrenceIndex >= alvo`
- Body idêntico ao `PATCH /api/appointments/:id` existente
- Não altera appointments com `recurrenceIndex < alvo` (passado da série)

### 2.3 Cancelamento com pacote

`PATCH /api/appointments/:id/status` — body existente ganha campo opcional:
```ts
{ status: 'CANCELED', deductFromPackage?: boolean }
```

- Se `status = CANCELED` e `treatmentPackageId` presente e `deductFromPackage = true`: chama `TreatmentPackageService.incrementUsedSessions`
- Se `deductFromPackage` ausente/false: não desconta
- Se `status = DONE` e `treatmentPackageId` presente: decrementa sempre (comportamento atual mantido)

---

## 3. Frontend

### 3.1 AppointmentFormDialog — modo criação

Novo bloco abaixo de "Observações" (visível apenas no modo criação):

```
[ ] Repetir agendamento
    [Diário ▼]  [Repetir: 5 vezes]
```

- Checkbox `repeat: boolean`
- Select `repeatPattern: 'daily' | 'weekly' | 'monthly'`
- Input numérico `repeatCount: number` (mín 1, máx 52)
- Quando `repeat = false`: comportamento atual inalterado

**Geração de datas** (frontend, `date-fns`):
```
daily   → addDays(baseDate, i)
weekly  → addWeeks(baseDate, i)
monthly → addMonths(baseDate, i)
```
para `i` de `1` até `repeatCount` (a data base é o índice 0).

**Verificação de horário de funcionamento:**
Para cada data gerada, chama `isSlotBlocked(time, date, businessHours)`.
Se `businessHours` não disponível no momento do submit, busca via `organizationApi.getSettings()`.

**Se houver conflitos:** abre `RecurrenceConflictDialog` antes de submeter.

**Se sem conflitos:** gera `recurrenceGroupId = crypto.randomUUID()` e chama `POST /api/appointments/bulk`.

### 3.2 RecurrenceConflictDialog (novo componente)

`frontend/src/components/appointments/RecurrenceConflictDialog.tsx`

Lista cada data com conflito. Para cada item:
```
⚠ Segunda-feira, 14/07/2026 — Clínica fechada
  ● Agendar no próximo dia disponível (15/07)
  ○ Pular este dia
```

- "Próximo dia disponível": itera `+1 dia` até achar dia com `enabled = true` nos business hours
- Botões: `[Cancelar]` `[Confirmar e Agendar]`
- Ao confirmar: datas resolvidas substituem as originais; pulos removem da lista; submit para `/bulk`

### 3.3 Edit de agendamento recorrente

Ao abrir `AppointmentFormDialog` em modo edição com `appointment.recurrenceGroupId` presente:

1. Exibe `RecurrenceScopeDialog` antes do form principal
2. Opções:
   - "Somente este agendamento" → submit normal `PATCH /:id`
   - "Este e todos os seguintes" → submit `PATCH /:id/recurrence-forward`
3. Scope armazenado em state local; form principal idêntico ao atual

`frontend/src/components/appointments/RecurrenceScopeDialog.tsx` (novo componente)

### 3.4 Cancelamento com pacote

Em `Agenda.tsx`, ao mudar status para `CANCELED` de appointment com `treatmentPackageId`:

1. Exibe `CancelWithPackageDialog` (novo componente ou `AlertDialog` inline):
   ```
   Cancelar agendamento
   Deseja descontar esta sessão do pacote "[nome]"?
   [Não descontar]  [Sim, descontar]
   ```
2. Envia `PATCH /:id/status` com `{ status: 'CANCELED', deductFromPackage: boolean }`

### 3.5 Bug fix: TreatmentPackageFormDialog

**Causa investigar:** `Button` component com prop `loading={true}` pode renderizar sem `type="submit"`, quebrando o submit nativo do form.

**Fix:** No `Button` component (`frontend/src/components/ui/button.tsx`), garantir que quando `loading` está ativo o elemento `<button>` mantém `type={props.type ?? 'button'}`. Se o componente renderizar um `<span>` ou `<div>` durante loading, mover o spinner para dentro do `<button>` sem trocar a tag.

Verificar também se há erro de validação Zod silencioso: adicionar `console.log(form.formState.errors)` temporariamente para confirmar se o schema rejeita os valores default antes de qualquer interação.

---

## 4. Fluxo completo: criação com repetição

```
Usuário preenche form
  └─ marca "Repetir": pattern=Diário, count=5
     └─ clica "Agendar"
        └─ frontend calcula datas [D0, D1, D2, D3, D4, D5]
           └─ verifica businessHours para cada data
              ├─ sem conflitos → gera UUID → POST /bulk → sucesso
              └─ com conflitos → RecurrenceConflictDialog
                 └─ usuário resolve → POST /bulk com datas resolvidas → sucesso
```

---

## 5. Componentes novos

| Componente | Caminho |
|---|---|
| `RecurrenceConflictDialog` | `frontend/src/components/appointments/RecurrenceConflictDialog.tsx` |
| `RecurrenceScopeDialog` | `frontend/src/components/appointments/RecurrenceScopeDialog.tsx` |
| `CancelWithPackageDialog` | inline em `Agenda.tsx` via `AlertDialog` |

---

## 6. Testes

**Backend (unit):**
- `appointment.service.spec.ts`: `createBulk` — conflito numa das datas, transação atômica
- `appointment.service.spec.ts`: `updateRecurrenceForward` — só atualiza índice >= alvo
- Status `CANCELED` com e sem `deductFromPackage`

**Frontend (vitest):**
- `RecurrenceConflictDialog`: renderiza lista correta, resolve conflitos, pula dias
- `AppointmentFormDialog`: com `repeat=true` gera datas corretas por padrão
- Bug fix `Button`: `type="submit"` preservado com `loading=true`
