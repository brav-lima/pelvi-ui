# Financial Recurrence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add monthly recurrence to financial records — user defines N months, system generates N records sharing a `recurrenceGroupId`; delete supports `single` or `this_and_future` modes.

**Architecture:** New fields on `FinancialRecord` (`recurrenceGroupId`, `recurrenceIndex`) link series records. Service creates all records in one `$transaction`. Delete extends existing soft-delete with an optional `mode` query param. Frontend adds a recurrence toggle (mutually exclusive with installments) and a smarter delete dialog for recurring records.

**Tech Stack:** NestJS, Prisma 7, PostgreSQL (Neon), React + react-hook-form + zod, TanStack Query, shadcn/ui

---

## File Map

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add `recurrenceGroupId`, `recurrenceIndex` to `FinancialRecord` |
| `backend/prisma/migrations/<ts>_add_financial_recurrence/migration.sql` | New migration (auto-generated via `prisma migrate dev`) |
| `backend/src/financial/dto/create-financial.dto.ts` | Add `isRecurring`, `recurrenceMonths` fields |
| `backend/src/financial/financial.service.ts` | Add `createRecurring()`, extend `remove()` with mode |
| `backend/src/financial/financial.service.spec.ts` | Fix broken test + add recurrence + remove-mode tests |
| `backend/src/financial/financial.controller.ts` | Add `?mode` query param to `DELETE` endpoint |
| `frontend/src/types/clinic.ts` | Add `recurrenceGroupId?`, `recurrenceIndex?` to `FinancialRecord` |
| `frontend/src/lib/api.ts` | Update `financialApi.create` type + `financialApi.remove` signature |
| `frontend/src/components/financial/FinancialFormDialog.tsx` | Add recurrence toggle, months select, preview |
| `frontend/src/pages/Financial.tsx` | Extract `DeleteRecordDialog`, add mode selection for recurring records |

---

## Task 1: Fix broken spec — `findAll` month filter

The filter in `financial.service.ts` was changed from `createdAt` to `OR [dueDate, createdAt]`. The existing spec checks the old shape and will fail.

**Files:**
- Modify: `backend/src/financial/financial.service.spec.ts:170-180`

- [ ] **Step 1: Run the existing spec to confirm failure**

```bash
cd backend && bun run test --testPathPattern=financial.service.spec
```

Expected: FAIL — `Cannot read properties of undefined (reading 'gte')`

- [ ] **Step 2: Update the failing test**

In `financial.service.spec.ts`, replace the test `'deve filtrar por mês/ano quando startDate não informado'`:

```typescript
it('deve filtrar por mês/ano quando startDate não informado', async () => {
  prisma.financialRecord.findMany.mockResolvedValue([]);
  prisma.financialRecord.count.mockResolvedValue(0);

  await service.findAll(orgId, { month: 3, year: 2025 });

  const callArgs = prisma.financialRecord.findMany.mock.calls[0][0];
  expect(callArgs.where.organizationId).toBe(orgId);
  expect(callArgs.where.OR).toHaveLength(2);
  // primeiro branch: registros com dueDate no mês
  expect(callArgs.where.OR[0].dueDate.gte).toEqual(new Date(2025, 2, 1));
  expect(callArgs.where.OR[0].dueDate.lt).toEqual(new Date(2025, 3, 1));
  // segundo branch: registros sem dueDate, filtro por createdAt
  expect(callArgs.where.OR[1].dueDate).toBeNull();
  expect(callArgs.where.OR[1].createdAt.gte).toEqual(new Date(2025, 2, 1));
  expect(callArgs.where.OR[1].createdAt.lt).toEqual(new Date(2025, 3, 1));
});
```

- [ ] **Step 3: Run spec to confirm passing**

```bash
cd backend && bun run test --testPathPattern=financial.service.spec
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/financial/financial.service.spec.ts
git commit -m "test(financial): fix findAll month-filter spec after dueDate OR change"
```

---

## Task 2: Prisma schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_financial_recurrence/migration.sql` (auto)

- [ ] **Step 1: Add fields to `FinancialRecord` in schema**

In `backend/prisma/schema.prisma`, locate the `FinancialRecord` model and add after the `installmentTotal` field (or after `dueDate` if `installmentTotal` doesn't exist):

```prisma
recurrenceGroupId  String?   @db.Uuid @map("recurrence_group_id")
recurrenceIndex    Int?      @map("recurrence_index")
```

- [ ] **Step 2: Create and apply migration**

```bash
cd backend && bunx prisma migrate dev --name add_financial_recurrence
```

Expected output includes: `✔  Generated Prisma Client` and the new migration folder appears in `backend/prisma/migrations/`.

- [ ] **Step 3: Verify migration SQL was generated**

```bash
ls backend/prisma/migrations/ | grep recurrence
```

Expected: one folder named `<timestamp>_add_financial_recurrence`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(financial): add recurrenceGroupId and recurrenceIndex to schema"
```

---

## Task 3: Backend DTO — `isRecurring` + `recurrenceMonths`

**Files:**
- Modify: `backend/src/financial/dto/create-financial.dto.ts`

- [ ] **Step 1: Add fields to DTO**

Add `IsBoolean` to the import from `class-validator`. Then add after the existing `dueDate` field:

```typescript
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
```

```typescript
@IsOptional()
@IsBoolean()
isRecurring?: boolean;

@IsOptional()
@IsInt({ message: 'Número de meses deve ser inteiro' })
@Min(2, { message: 'Mínimo de 2 meses' })
@Max(60, { message: 'Máximo de 60 meses' })
recurrenceMonths?: number;
```

- [ ] **Step 2: Validate schema compiles**

```bash
cd backend && bunx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/financial/dto/create-financial.dto.ts
git commit -m "feat(financial): add isRecurring and recurrenceMonths to CreateFinancialDto"
```

---

## Task 4: Backend Service — recurrence creation

**Files:**
- Modify: `backend/src/financial/financial.service.ts`
- Modify: `backend/src/financial/financial.service.spec.ts`

- [ ] **Step 1: Write failing tests for recurrence creation**

In `financial.service.spec.ts`, add `updateMany: jest.fn()` to the `prisma.financialRecord` mock inside `beforeEach`:

```typescript
prisma = {
  financialRecord: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
  },
  $transaction: jest.fn((ops) => Promise.all(ops)),
};
```

Then add a new `describe` block after `'create (parcelamento)'`:

```typescript
describe('create (recorrência)', () => {
  it('deve criar N registros com valor integral (sem divisão)', async () => {
    const dto = {
      amount: 1500,
      type: FinancialType.EXPENSE,
      isRecurring: true,
      recurrenceMonths: 3,
      dueDate: '2026-06-10',
      description: 'Aluguel',
    };
    prisma.financialRecord.create.mockResolvedValue({ id: 'fin-x' });

    await service.create(orgId, dto as any);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.financialRecord.create).toHaveBeenCalledTimes(3);
    const calls = prisma.financialRecord.create.mock.calls;
    expect(calls[0][0].data.amount).toBe(1500);
    expect(calls[1][0].data.amount).toBe(1500);
    expect(calls[2][0].data.amount).toBe(1500);
  });

  it('deve compartilhar o mesmo recurrenceGroupId em todos os registros', async () => {
    const dto = {
      amount: 1500,
      type: FinancialType.EXPENSE,
      isRecurring: true,
      recurrenceMonths: 2,
      dueDate: '2026-06-10',
    };
    prisma.financialRecord.create.mockResolvedValue({ id: 'fin-x' });

    await service.create(orgId, dto as any);

    const calls = prisma.financialRecord.create.mock.calls;
    const g0 = calls[0][0].data.recurrenceGroupId;
    const g1 = calls[1][0].data.recurrenceGroupId;
    expect(g0).toBeDefined();
    expect(g0).toBe(g1);
  });

  it('deve atribuir recurrenceIndex sequencial começando em 0', async () => {
    const dto = {
      amount: 500,
      type: FinancialType.EXPENSE,
      isRecurring: true,
      recurrenceMonths: 3,
      dueDate: '2026-06-10',
    };
    prisma.financialRecord.create.mockResolvedValue({ id: 'fin-x' });

    await service.create(orgId, dto as any);

    const calls = prisma.financialRecord.create.mock.calls;
    expect(calls[0][0].data.recurrenceIndex).toBe(0);
    expect(calls[1][0].data.recurrenceIndex).toBe(1);
    expect(calls[2][0].data.recurrenceIndex).toBe(2);
  });

  it('deve avançar dueDate mês a mês mantendo o dia', async () => {
    const dto = {
      amount: 500,
      type: FinancialType.EXPENSE,
      isRecurring: true,
      recurrenceMonths: 3,
      dueDate: '2026-06-10',
    };
    prisma.financialRecord.create.mockResolvedValue({ id: 'fin-x' });

    await service.create(orgId, dto as any);

    const calls = prisma.financialRecord.create.mock.calls;
    const d0: Date = calls[0][0].data.dueDate;
    const d1: Date = calls[1][0].data.dueDate;
    const d2: Date = calls[2][0].data.dueDate;
    // junho → julho → agosto
    expect(d0.getMonth()).toBe(5);
    expect(d1.getMonth()).toBe(6);
    expect(d2.getMonth()).toBe(7);
    // dia preservado
    expect(d0.getDate()).toBe(10);
    expect(d1.getDate()).toBe(10);
    expect(d2.getDate()).toBe(10);
  });

  it('não deve usar $transaction quando não é recorrente', async () => {
    const dto = { amount: 200, type: FinancialType.INCOME };
    prisma.financialRecord.create.mockResolvedValue({ id: 'fin-1' });

    await service.create(orgId, dto as any);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && bun run test --testPathPattern=financial.service.spec
```

Expected: new recurrence tests FAIL

- [ ] **Step 3: Implement `createRecurring` in `financial.service.ts`**

Add the import at the top of the file:
```typescript
import { randomUUID } from 'crypto';
```

Replace the `create` method:
```typescript
async create(organizationId: string, dto: CreateFinancialDto) {
  const installments = dto.installments ?? 1;

  if (dto.isRecurring && (dto.recurrenceMonths ?? 0) > 1) {
    return this.createRecurring(organizationId, dto, dto.recurrenceMonths!);
  }

  if (installments > 1) {
    return this.createInstallments(organizationId, dto, installments);
  }

  return this.prisma.financialRecord.create({
    data: {
      organizationId,
      patientId: dto.patientId,
      appointmentId: dto.appointmentId,
      amount: dto.amount,
      type: dto.type,
      paymentMethod: dto.paymentMethod,
      description: dto.description,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    },
    include: financialIncludes,
  });
}
```

Add the private method after `createInstallments`:
```typescript
private async createRecurring(
  organizationId: string,
  dto: CreateFinancialDto,
  months: number,
) {
  const groupId = randomUUID();
  const firstDueDate = new Date(dto.dueDate! + 'T00:00:00');
  const include = financialIncludes;

  return this.prisma.$transaction(
    Array.from({ length: months }, (_, i) => {
      const dueDate = new Date(firstDueDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      return this.prisma.financialRecord.create({
        data: {
          organizationId,
          patientId: dto.patientId,
          appointmentId: dto.appointmentId,
          amount: dto.amount,
          type: dto.type,
          paymentMethod: dto.paymentMethod,
          description: dto.description,
          dueDate,
          recurrenceGroupId: groupId,
          recurrenceIndex: i,
        },
        include,
      });
    }),
  );
}
```

- [ ] **Step 4: Run tests to confirm passing**

```bash
cd backend && bun run test --testPathPattern=financial.service.spec
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/financial/financial.service.ts backend/src/financial/financial.service.spec.ts
git commit -m "feat(financial): add monthly recurrence creation via createRecurring()"
```

---

## Task 5: Backend Service — `remove` with mode

**Files:**
- Modify: `backend/src/financial/financial.service.ts`
- Modify: `backend/src/financial/financial.service.spec.ts`

- [ ] **Step 1: Write failing tests for remove with mode**

In `financial.service.spec.ts`, replace the existing `describe('remove', ...)` block entirely:

```typescript
describe('remove', () => {
  it('deve aplicar soft delete quando pertence à organização (mode=single)', async () => {
    const existing = { id: 'fin-1', organizationId: orgId, recurrenceGroupId: null, recurrenceIndex: null };
    prisma.financialRecord.findFirst.mockResolvedValue(existing);
    prisma.financialRecord.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

    await service.remove(orgId, 'fin-1', 'single');

    expect(prisma.financialRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'fin-1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
    expect(prisma.financialRecord.updateMany).not.toHaveBeenCalled();
  });

  it('deve usar single delete por padrão quando mode omitido', async () => {
    const existing = { id: 'fin-1', organizationId: orgId, recurrenceGroupId: 'grp-1', recurrenceIndex: 0 };
    prisma.financialRecord.findFirst.mockResolvedValue(existing);
    prisma.financialRecord.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

    await service.remove(orgId, 'fin-1');

    expect(prisma.financialRecord.update).toHaveBeenCalled();
    expect(prisma.financialRecord.updateMany).not.toHaveBeenCalled();
  });

  it('deve soft-deletar este e posteriores quando mode=this_and_future', async () => {
    const existing = { id: 'fin-2', organizationId: orgId, recurrenceGroupId: 'grp-1', recurrenceIndex: 2 };
    prisma.financialRecord.findFirst.mockResolvedValue(existing);
    prisma.financialRecord.updateMany.mockResolvedValue({ count: 3 });

    await service.remove(orgId, 'fin-2', 'this_and_future');

    expect(prisma.financialRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: orgId,
          recurrenceGroupId: 'grp-1',
          recurrenceIndex: { gte: 2 },
          deletedAt: null,
        }),
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
    expect(prisma.financialRecord.update).not.toHaveBeenCalled();
  });

  it('deve cair em single delete quando recurrenceGroupId é null e mode=this_and_future', async () => {
    const existing = { id: 'fin-3', organizationId: orgId, recurrenceGroupId: null, recurrenceIndex: null };
    prisma.financialRecord.findFirst.mockResolvedValue(existing);
    prisma.financialRecord.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

    await service.remove(orgId, 'fin-3', 'this_and_future');

    expect(prisma.financialRecord.update).toHaveBeenCalled();
    expect(prisma.financialRecord.updateMany).not.toHaveBeenCalled();
  });

  it('deve lançar NotFoundException antes de deletar quando não existe na org', async () => {
    prisma.financialRecord.findFirst.mockResolvedValue(null);

    await expect(service.remove(orgId, 'fin-inexistente')).rejects.toThrow(NotFoundException);
    expect(prisma.financialRecord.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && bun run test --testPathPattern=financial.service.spec
```

Expected: new remove tests FAIL

- [ ] **Step 3: Update `remove` in `financial.service.ts`**

Replace the existing `remove` method:

```typescript
async remove(
  organizationId: string,
  id: string,
  mode: 'single' | 'this_and_future' = 'single',
) {
  const record = await this.findById(organizationId, id);

  if (mode === 'this_and_future' && record.recurrenceGroupId) {
    return this.prisma.financialRecord.updateMany({
      where: {
        organizationId,
        recurrenceGroupId: record.recurrenceGroupId,
        recurrenceIndex: { gte: record.recurrenceIndex },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
  }

  return this.prisma.financialRecord.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
```

- [ ] **Step 4: Run tests to confirm passing**

```bash
cd backend && bun run test --testPathPattern=financial.service.spec
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/financial/financial.service.ts backend/src/financial/financial.service.spec.ts
git commit -m "feat(financial): extend remove() with this_and_future mode for recurring series"
```

---

## Task 6: Backend Controller — `?mode` query param

**Files:**
- Modify: `backend/src/financial/financial.controller.ts`

- [ ] **Step 1: Add `mode` query param to `DELETE` endpoint**

Replace the existing `remove` method in `financial.controller.ts`:

```typescript
@Delete(':id')
@Roles(Role.ADMIN)
@ApiOperation({ summary: 'Remover registro financeiro' })
remove(
  @OrgId() orgId: string,
  @Param('id') id: string,
  @Query('mode') mode: 'single' | 'this_and_future' = 'single',
) {
  return this.financialService.remove(orgId, id, mode);
}
```

Add `Query` to the imports from `@nestjs/common` if not already there (it's already imported).

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd backend && bunx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/financial/financial.controller.ts
git commit -m "feat(financial): add ?mode=single|this_and_future to DELETE /financial/:id"
```

---

## Task 7: Frontend — types + API client

**Files:**
- Modify: `frontend/src/types/clinic.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add recurrence fields to `FinancialRecord` type**

In `frontend/src/types/clinic.ts`, locate the `FinancialRecord` interface and add after `dueDate?`:

```typescript
recurrenceGroupId?: string;
recurrenceIndex?: number;
```

- [ ] **Step 2: Update `financialApi` in `api.ts`**

Update the `create` function type to accept recurrence fields:

```typescript
create: async (data: {
  patientId?: string;
  amount: number;
  type: string;
  description?: string;
  paymentMethod?: string;
  appointmentId?: string;
  installments?: number;
  dueDate?: string;
  isRecurring?: boolean;
  recurrenceMonths?: number;
}) => {
  const result = await api.post<RawFinancialRecord | RawFinancialRecord[]>('/financial', data);
  return Array.isArray(result) ? normalizeFinancialRecords(result) : normalizeFinancialRecord(result);
},
```

Update the `remove` function to accept optional mode:

```typescript
remove: (id: string, mode: 'single' | 'this_and_future' = 'single') =>
  api.delete<void>(`/financial/${id}?mode=${mode}`),
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd frontend && bunx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/clinic.ts frontend/src/lib/api.ts
git commit -m "feat(financial): add recurrence fields to FinancialRecord type and api client"
```

---

## Task 8: Frontend — `FinancialFormDialog` recurrence UI

**Files:**
- Modify: `frontend/src/components/financial/FinancialFormDialog.tsx`

- [ ] **Step 1: Update the zod schema**

In `FinancialFormDialog.tsx`, update `financialSchema` to add:

```typescript
const financialSchema = z.object({
  patientId: z.string().optional(),
  amount: z.string().min(1, 'Informe o valor'),
  type: z.enum(['INCOME', 'EXPENSE'], { required_error: 'Selecione o tipo' }),
  status: z.enum(['PENDING', 'PAID']),
  description: z.string().optional(),
  paymentMethod: z.string().optional(),
  installments: z.string().default('1'),
  dueDate: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurrenceMonths: z.string().default('12'),
});
```

- [ ] **Step 2: Update `defaultValues` and watched values**

In the `useForm` call, add default values:

```typescript
const form = useForm<FinancialFormData>({
  resolver: zodResolver(financialSchema),
  defaultValues: {
    patientId: '',
    amount: '',
    type: 'INCOME',
    status: 'PENDING',
    description: '',
    paymentMethod: '',
    installments: '1',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    isRecurring: false,
    recurrenceMonths: '12',
  },
});
```

Add watched values below the existing `const isInstallment = ...` line:

```typescript
const watchIsRecurring = form.watch('isRecurring');
const watchRecurrenceMonths = parseInt(form.watch('recurrenceMonths') || '12', 10);
```

- [ ] **Step 3: Add recurrence preview computation**

Add after the existing `installmentPreview` useMemo:

```typescript
const recurrencePreview = useMemo(() => {
  if (!watchIsRecurring || !watchAmount || !watchDueDate) return null;
  const amount = parseCurrency(watchAmount);
  if (!amount || amount <= 0 || watchRecurrenceMonths < 2) return null;

  const firstDate = new Date(watchDueDate + 'T00:00:00');
  const lastDate = addMonths(firstDate, watchRecurrenceMonths - 1);

  return {
    months: watchRecurrenceMonths,
    amount,
    from: format(firstDate, 'MM/yyyy'),
    to: format(lastDate, 'MM/yyyy'),
    day: firstDate.getDate(),
  };
}, [watchIsRecurring, watchAmount, watchDueDate, watchRecurrenceMonths]);
```

- [ ] **Step 4: Update `onSubmit` to handle recurrence**

Replace the `onSubmit` function:

```typescript
const onSubmit = async (data: FinancialFormData) => {
  setLoading(true);
  setError('');

  const installments = parseInt(data.installments, 10);

  try {
    let payload: Parameters<typeof financialApi.create>[0];

    if (data.isRecurring) {
      payload = {
        patientId: data.patientId || undefined,
        amount: parseCurrency(data.amount),
        type: data.type,
        description: data.description || undefined,
        paymentMethod: data.paymentMethod || undefined,
        isRecurring: true,
        recurrenceMonths: parseInt(data.recurrenceMonths, 10),
        dueDate: data.dueDate || undefined,
      };
    } else {
      payload = {
        patientId: data.patientId || undefined,
        amount: parseCurrency(data.amount),
        type: data.type,
        description: data.description || undefined,
        paymentMethod: data.paymentMethod || undefined,
        ...(installments > 1 && {
          installments,
          dueDate: data.dueDate || undefined,
        }),
        ...(installments === 1 && data.dueDate && {
          dueDate: data.dueDate,
        }),
      };
    }

    await financialApi.create(payload);

    const msg = data.isRecurring
      ? `${parseInt(data.recurrenceMonths, 10)} registros recorrentes criados`
      : installments > 1
        ? `${installments} parcelas criadas com sucesso`
        : 'Registro financeiro criado com sucesso';

    toast.success(msg);
    onSuccess();
    onOpenChange(false);
    form.reset();
    setLinkPatient(false);
  } catch {
    toast.error('Erro ao salvar registro financeiro');
    setError('Erro ao salvar registro financeiro. Tente novamente.');
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 5: Add mutual exclusion — reset isRecurring when installments > 1**

In the `Select` for installments (the `onValueChange`), add:

```typescript
onValueChange={(v) => {
  form.setValue('installments', v);
  if (parseInt(v, 10) > 1) {
    form.setValue('isRecurring', false);
  }
}}
```

- [ ] **Step 6: Add recurrence UI section in the form**

After the installments/dueDate grid block and before the installment preview block, add:

```tsx
{/* Recorrência — só visível quando à vista */}
{!isInstallment && (
  <div className="space-y-3">
    <div className="flex items-center gap-3">
      <input
        id="isRecurring"
        type="checkbox"
        className="h-4 w-4 rounded border-border"
        checked={form.watch('isRecurring')}
        onChange={(e) => form.setValue('isRecurring', e.target.checked)}
      />
      <Label htmlFor="isRecurring" className="cursor-pointer font-normal">
        Recorrência mensal
      </Label>
    </div>

    {watchIsRecurring && (
      <div className="space-y-2">
        <Label>Repetir por (meses)</Label>
        <Select
          value={form.watch('recurrenceMonths')}
          onValueChange={(v) => form.setValue('recurrenceMonths', v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 59 }, (_, i) => i + 2).map((n) => (
              <SelectItem key={n} value={String(n)}>{n} meses</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )}

    {recurrencePreview && (
      <div className="rounded-md border border-border bg-muted/30 p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
          Recorrência gerada
        </p>
        <p className="text-sm text-foreground">
          {recurrencePreview.months} registros de{' '}
          <span className="font-medium">R$ {formatCurrency(recurrencePreview.amount)}</span>
          {' '}· todo dia {recurrencePreview.day}
          {' '}· {recurrencePreview.from} – {recurrencePreview.to}
        </p>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 7: Update submit button label**

Replace the submit button label logic:

```tsx
<Button type="submit" loading={loading}>
  {watchIsRecurring
    ? `Registrar ${watchRecurrenceMonths}x recorrente`
    : isInstallment
      ? `Registrar ${watchInstallments}x`
      : 'Registrar'}
</Button>
```

- [ ] **Step 8: Verify TypeScript**

```bash
cd frontend && bunx tsc --noEmit
```

Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/financial/FinancialFormDialog.tsx
git commit -m "feat(financial): add monthly recurrence toggle to FinancialFormDialog"
```

---

## Task 9: Frontend — `Financial.tsx` delete dialog for recurring records

**Files:**
- Modify: `frontend/src/pages/Financial.tsx`

- [ ] **Step 1: Add `useState` import if needed and update delete mutation**

The `useState` import already exists. Update the `deleteMutation` to accept id + mode:

```typescript
const deleteMutation = useMutation({
  mutationFn: ({ id, mode }: { id: string; mode: 'single' | 'this_and_future' }) =>
    financialApi.remove(id, mode),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['financial', 'month'] });
    queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
    toast.success('Registro excluído com sucesso');
  },
  onError: () => toast.error('Erro ao excluir registro'),
});
```

- [ ] **Step 2: Add `DeleteRecordDialog` component**

Add this component definition **before** the `export default function Financial()` line:

```tsx
function DeleteRecordDialog({
  record,
  onDelete,
}: {
  record: import('@/types/clinic').FinancialRecord;
  onDelete: (id: string, mode: 'single' | 'this_and_future') => void;
}) {
  const [mode, setMode] = useState<'single' | 'this_and_future'>('single');
  const isRecurring = !!record.recurrenceGroupId;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Registro</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              {isRecurring ? (
                <div className="space-y-3">
                  <p>Este registro faz parte de uma série recorrente.</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name={`deleteMode-${record.id}`}
                        value="single"
                        checked={mode === 'single'}
                        onChange={() => setMode('single')}
                      />
                      Excluir apenas este registro
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name={`deleteMode-${record.id}`}
                        value="this_and_future"
                        checked={mode === 'this_and_future'}
                        onChange={() => setMode('this_and_future')}
                      />
                      Excluir este e todos os posteriores
                    </label>
                  </div>
                </div>
              ) : (
                <span>
                  Tem certeza que deseja excluir este registro financeiro?
                  Esta ação não pode ser desfeita.
                </span>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onDelete(record.id, mode)}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 3: Replace inline delete AlertDialog in the records map**

In the `records.map(...)`, locate the existing delete `AlertDialog` block (the one with `<Trash2>` trigger) and replace it entirely with:

```tsx
<DeleteRecordDialog
  record={record}
  onDelete={(id, mode) => deleteMutation.mutate({ id, mode })}
/>
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd frontend && bunx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Run frontend tests**

```bash
cd frontend && bun run test
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Financial.tsx
git commit -m "feat(financial): add recurring-aware delete dialog with single/this_and_future mode"
```

---

## Final Verification

- [ ] **Run all backend tests**

```bash
cd backend && bun run test
```

Expected: all PASS, coverage thresholds met (80% statements/functions/lines, 75% branches)

- [ ] **Run all frontend tests**

```bash
cd frontend && bun run test
```

Expected: all 125+ tests PASS

- [ ] **TypeScript check both**

```bash
cd backend && bunx tsc --noEmit && cd ../frontend && bunx tsc --noEmit
```

Expected: no errors in either
