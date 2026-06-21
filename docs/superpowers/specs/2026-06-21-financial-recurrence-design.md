# Financial Recurrence — Design Spec

**Date:** 2026-06-21  
**Status:** Approved

## Summary

Add monthly recurrence to financial records. User defines a fixed number of months; system generates N records upfront. Each record is independent but linked via `recurrenceGroupId`. Delete supports single or "this and future" modes.

---

## Constraints & Decisions

- **Frequency:** Monthly only (day preserved from `dueDate`)
- **Duration:** Fixed quantity chosen by user (2–60 months)
- **Amount:** Full amount repeated each month (not split — different from installments)
- **Recurrence + Installments:** Mutually exclusive
- **Edit series:** Out of scope — edit applies to single record only
- **Migrations:** Must be saved in `backend/prisma/migrations/YYYYMMDDHHMMSS_description/`

---

## Schema Changes

**Model:** `FinancialRecord`

```prisma
recurrenceGroupId  String?  @db.Uuid  @map("recurrence_group_id")
recurrenceIndex    Int?               @map("recurrence_index")
```

**Migration:** `backend/prisma/migrations/20260621000000_add_financial_recurrence/migration.sql`

```sql
ALTER TABLE "financial_records"
  ADD COLUMN "recurrence_group_id" UUID,
  ADD COLUMN "recurrence_index"    INTEGER;

CREATE INDEX "financial_records_recurrence_group_id_idx"
  ON "financial_records"("recurrence_group_id");
```

---

## Backend

### DTO — `CreateFinancialDto`

Add:
```ts
isRecurring?: boolean      // default false
recurrenceMonths?: number  // required when isRecurring = true; range 2–60
```

Validation: if `isRecurring = true`, then `dueDate` is required and `installments` must be absent/1.

### `FinancialService.create`

```
if isRecurring && recurrenceMonths > 1:
  groupId = randomUUID()
  $transaction → create recurrenceMonths records:
    - amount = dto.amount (full, not split)
    - dueDate = firstDueDate + i months
    - recurrenceGroupId = groupId
    - recurrenceIndex = i
    - description = dto.description (unchanged, no suffix)
else:
  existing single-record path
```

### `FinancialService.remove` — extend

New signature: `remove(orgId, id, mode: 'single' | 'this_and_future')`

- `single` → existing soft-delete
- `this_and_future`:
  1. Load record → get `recurrenceGroupId` + `recurrenceIndex`
  2. If no `recurrenceGroupId` → fall back to single
  3. Soft-delete all where `recurrenceGroupId = X AND recurrenceIndex >= current`

### Controller — `DELETE /api/financial/:id`

Add optional query param `?mode=single|this_and_future` (default: `single`).

---

## Frontend

### `FinancialFormDialog`

**New fields (shown only when `installments = '1'`):**

- Toggle `isRecurring` — "Recorrência mensal"
- When toggled on:
  - Select "Repetir por X meses" (options 2–60)
  - `dueDate` becomes required (label: "Dia do vencimento")
  - Preview: `"12 registros de R$ 1.500,00 · todo dia 10 · Jun/2026 – Mai/2027"`

**Mutual exclusion:** when `installments > 1`, recurrence toggle is hidden/reset to off.

**Submit payload when recurring:**
```ts
{
  isRecurring: true,
  recurrenceMonths: 12,
  dueDate: "2026-06-10",
  amount: 1500,
  ...
}
```

### `Financial.tsx` — Delete Dialog

Current: single AlertDialog with one confirm action.

**New behavior when `record.recurrenceGroupId` is set:**

Replace description text with two radio options:
- `single` — "Excluir apenas este registro (Jun/2026)"
- `this_and_future` — "Excluir este e todos os posteriores"

Confirm calls `DELETE /api/financial/:id?mode=<selected>`.

When `record.recurrenceGroupId` is null/undefined → existing behavior unchanged.

### `clinic.ts` — `FinancialRecord` type

Add:
```ts
recurrenceGroupId?: string;
recurrenceIndex?: number;
```

---

## API Change Summary

| Endpoint | Change |
|----------|--------|
| `POST /api/financial` | Accepts `isRecurring`, `recurrenceMonths`; creates N records |
| `DELETE /api/financial/:id` | Adds `?mode=single\|this_and_future` query param |

---

## Out of Scope

- Edit series (all future / all)
- Weekly, yearly frequencies
- Pause/resume recurrence
- Indefinite recurrence with background job
