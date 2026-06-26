# Business Hours Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os inputs de horário de funcionamento em Settings e fazer a Agenda bloquear slots fora do horário configurado.

**Architecture:** Helpers de horário extraídos para `lib/business-hours.ts` (testáveis isoladamente). Settings.tsx recebe inputs controlados. Agenda.tsx consome org profile via React Query (cache compartilhado) e passa `isBlocked` para cada `DroppableSlot`.

**Tech Stack:** React + TypeScript + Vitest + @testing-library/react + @dnd-kit/core + TanStack React Query

## Global Constraints

- Linguagem da UI: Português Brasileiro — nenhuma string nova em inglês visível ao usuário
- Sem mudanças de schema no backend — `settings.businessHours` já existe como `Json?`
- `type="time"` nos inputs — formato HH:MM nativo do browser
- Comparação de slot via string lexicográfica HH:MM — válida para este formato
- `staleTime: 5 * 60 * 1000` no query de org profile — horários mudam raramente
- Branch: `feat/business-hours-enforcement` — todos os commits nesta branch

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `frontend/src/lib/business-hours.ts` | Criar | Tipo `BusinessHour`, helpers `getBusinessHourForDate` e `isSlotBlocked` |
| `frontend/src/lib/business-hours.test.ts` | Criar | Testes unitários dos helpers |
| `frontend/src/pages/Settings.tsx` | Modificar | Inputs `from`/`to` controlados com `value` + `onChange` + `type="time"` |
| `frontend/src/pages/Agenda.tsx` | Modificar | Query org profile, `isBlocked` em `DroppableSlot`, guard em `handleDragEnd` |

---

## Task 1: Helpers de horário de funcionamento

**Files:**
- Create: `frontend/src/lib/business-hours.ts`
- Create: `frontend/src/lib/business-hours.test.ts`

**Interfaces:**
- Produz: tipo `BusinessHour`, funções `getBusinessHourForDate(date, bh)` e `isSlotBlocked(slotTime, date, bh)`

---

- [ ] **Step 1: Criar o arquivo de helpers**

Crie `frontend/src/lib/business-hours.ts` com o conteúdo abaixo:

```typescript
export type BusinessHour = {
  day: string;
  from: string | null;
  to: string | null;
  enabled: boolean;
};

// Índice alinhado com Date.getDay(): 0 = domingo
const DAY_KEYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export function getBusinessHourForDate(
  date: Date,
  bh: BusinessHour[] | undefined,
): BusinessHour | null {
  if (!bh) return null;
  const key = DAY_KEYS[date.getDay()];
  return bh.find(h => h.day === key) ?? null;
}

/**
 * Retorna true se o slot (HH:MM) está fora do horário de funcionamento para a data.
 * - Dia desabilitado → sempre bloqueado
 * - businessHours ausente → nunca bloqueado (fallback seguro)
 * - from/to ausentes → nunca bloqueado (sem restrição configurada)
 */
export function isSlotBlocked(
  slotTime: string,
  date: Date,
  bh: BusinessHour[] | undefined,
): boolean {
  const rule = getBusinessHourForDate(date, bh);
  if (!rule || !rule.enabled) return true;
  if (!rule.from || !rule.to) return false;
  return slotTime < rule.from || slotTime >= rule.to;
}
```

- [ ] **Step 2: Escrever os testes unitários**

Crie `frontend/src/lib/business-hours.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isSlotBlocked, getBusinessHourForDate, type BusinessHour } from './business-hours';

const monday = new Date('2026-06-22T00:00:00'); // segunda-feira
const sunday = new Date('2026-06-28T00:00:00'); // domingo

const bh: BusinessHour[] = [
  { day: 'MONDAY',    from: '08:00', to: '18:00', enabled: true },
  { day: 'TUESDAY',   from: '08:00', to: '18:00', enabled: true },
  { day: 'WEDNESDAY', from: '08:00', to: '18:00', enabled: true },
  { day: 'THURSDAY',  from: '08:00', to: '18:00', enabled: true },
  { day: 'FRIDAY',    from: '08:00', to: '17:00', enabled: true },
  { day: 'SATURDAY',  from: '09:00', to: '13:00', enabled: true },
  { day: 'SUNDAY',    from: null,    to: null,     enabled: false },
];

describe('getBusinessHourForDate', () => {
  it('retorna regra correta para segunda-feira', () => {
    const rule = getBusinessHourForDate(monday, bh);
    expect(rule?.day).toBe('MONDAY');
    expect(rule?.from).toBe('08:00');
  });

  it('retorna null quando bh é undefined', () => {
    expect(getBusinessHourForDate(monday, undefined)).toBeNull();
  });

  it('retorna null quando dia não está na lista', () => {
    expect(getBusinessHourForDate(monday, [])).toBeNull();
  });
});

describe('isSlotBlocked', () => {
  it('slot dentro do horário → não bloqueado', () => {
    expect(isSlotBlocked('10:00', monday, bh)).toBe(false);
    expect(isSlotBlocked('08:00', monday, bh)).toBe(false); // borda inicial incluída
    expect(isSlotBlocked('17:30', monday, bh)).toBe(false);
  });

  it('slot no limite final (to) → bloqueado (>=)', () => {
    expect(isSlotBlocked('18:00', monday, bh)).toBe(true);
  });

  it('slot antes do início → bloqueado', () => {
    expect(isSlotBlocked('07:30', monday, bh)).toBe(true);
    expect(isSlotBlocked('07:00', monday, bh)).toBe(true);
  });

  it('slot depois do fim → bloqueado', () => {
    expect(isSlotBlocked('18:30', monday, bh)).toBe(true);
    expect(isSlotBlocked('20:00', monday, bh)).toBe(true);
  });

  it('dia desabilitado (domingo) → sempre bloqueado', () => {
    expect(isSlotBlocked('10:00', sunday, bh)).toBe(true);
    expect(isSlotBlocked('00:00', sunday, bh)).toBe(true);
  });

  it('businessHours undefined → nunca bloqueado (fallback seguro)', () => {
    expect(isSlotBlocked('10:00', monday, undefined)).toBe(false);
    expect(isSlotBlocked('07:00', monday, undefined)).toBe(false);
  });

  it('businessHours vazio → nunca bloqueado', () => {
    expect(isSlotBlocked('10:00', monday, [])).toBe(false);
  });

  it('from/to null com dia enabled → nunca bloqueado', () => {
    const noTime: BusinessHour[] = [{ day: 'MONDAY', from: null, to: null, enabled: true }];
    expect(isSlotBlocked('10:00', monday, noTime)).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar os testes e confirmar que passam**

```bash
cd frontend && bunx vitest run src/lib/business-hours.test.ts
```

Esperado: todos os testes PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/business-hours.ts frontend/src/lib/business-hours.test.ts
git commit -m "feat(business-hours): add isSlotBlocked helper with unit tests"
```

---

## Task 2: Fix Settings.tsx — inputs controlados

**Files:**
- Modify: `frontend/src/pages/Settings.tsx:472-480`

**Interfaces:**
- Consome: estado `hours` (já existente), `setHours` (já existente)
- Produz: inputs controlados que atualizam `hours` ao digitar

---

- [ ] **Step 1: Escrever teste que verifica comportamento do input controlado**

Abra `frontend/src/pages/Settings.test.tsx` e adicione este describe ao final do arquivo (antes do último `}`):

```typescript
import { fireEvent, waitFor } from '@testing-library/react';

// Adicionar ao arquivo após os describes existentes:

describe('inputs de horário de funcionamento', () => {
  it('atualiza valor do input "de" ao digitar', async () => {
    renderSettings();
    // Aguardar inputs renderizarem (há 7 linhas, primeira = Segunda-feira)
    const inputs = await screen.findAllByDisplayValue('08:00');
    const firstFromInput = inputs[0];
    fireEvent.change(firstFromInput, { target: { value: '09:00' } });
    expect(firstFromInput).toHaveValue('09:00');
  });

  it('atualiza valor do input "até" ao digitar', async () => {
    renderSettings();
    const inputs = await screen.findAllByDisplayValue('19:00');
    const firstToInput = inputs[0];
    fireEvent.change(firstToInput, { target: { value: '20:00' } });
    expect(firstToInput).toHaveValue('20:00');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que FALHA**

```bash
cd frontend && bunx vitest run src/pages/Settings.test.tsx
```

Esperado: os novos testes FAIL — `findAllByDisplayValue` não retorna nada ou `toHaveValue` falha porque o input é `defaultValue`.

- [ ] **Step 3: Corrigir os inputs em Settings.tsx**

Em `frontend/src/pages/Settings.tsx`, localize o bloco de renderização dos inputs de horário (aprox. linha 472-480) e substitua:

```tsx
// ANTES:
<input
  className="h-8 px-2.5 rounded-lg bg-background border border-border text-[13px] font-mono outline-none focus:border-primary transition-all disabled:opacity-50 text-center"
  defaultValue={h.from}
  disabled={!h.on}
/>
<input
  className="h-8 px-2.5 rounded-lg bg-background border border-border text-[13px] font-mono outline-none focus:border-primary transition-all disabled:opacity-50 text-center"
  defaultValue={h.to}
  disabled={!h.on}
/>
```

Por:

```tsx
// DEPOIS:
<input
  type="time"
  className="h-8 px-2.5 rounded-lg bg-background border border-border text-[13px] font-mono outline-none focus:border-primary transition-all disabled:opacity-50 text-center"
  value={h.on ? h.from : ''}
  disabled={!h.on}
  onChange={(e) => setHours(prev =>
    prev.map((d, j) => j === i ? { ...d, from: e.target.value } : d)
  )}
/>
<input
  type="time"
  className="h-8 px-2.5 rounded-lg bg-background border border-border text-[13px] font-mono outline-none focus:border-primary transition-all disabled:opacity-50 text-center"
  value={h.on ? h.to : ''}
  disabled={!h.on}
  onChange={(e) => setHours(prev =>
    prev.map((d, j) => j === i ? { ...d, to: e.target.value } : d)
  )}
/>
```

- [ ] **Step 4: Rodar todos os testes de Settings e confirmar que passam**

```bash
cd frontend && bunx vitest run src/pages/Settings.test.tsx
```

Esperado: todos os testes PASS (incluindo os novos).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Settings.tsx frontend/src/pages/Settings.test.tsx
git commit -m "fix(settings): make business hours inputs controlled with type=time"
```

---

## Task 3: Agenda — enforcement de horários

**Files:**
- Modify: `frontend/src/pages/Agenda.tsx`

**Interfaces:**
- Consome: `BusinessHour`, `isSlotBlocked` de `@/lib/business-hours`; `organizationApi` de `@/lib/api`; `OrganizationProfile` de `@/types/clinic`
- Produz: grade com slots bloqueados visualmente e funcionalmente fora do horário

---

- [ ] **Step 1: Adicionar import dos helpers e query no componente**

Em `frontend/src/pages/Agenda.tsx`, adicione ao bloco de imports no topo:

```typescript
import { organizationApi } from '@/lib/api';
import type { OrganizationProfile } from '@/types/clinic';
import { isSlotBlocked, type BusinessHour } from '@/lib/business-hours';
```

Dentro do componente `Agenda()`, após os `useState` existentes, adicione:

```typescript
const { data: orgProfile } = useQuery<OrganizationProfile>({
  queryKey: ['organization-profile'],
  queryFn: organizationApi.getProfile,
  staleTime: 5 * 60 * 1000,
});

const businessHours = orgProfile?.settings?.businessHours as BusinessHour[] | undefined;
```

- [ ] **Step 2: Atualizar a assinatura e implementação de `DroppableSlot`**

Localize a função `DroppableSlot` (aprox. linha 153) e substitua pela versão abaixo:

```tsx
function DroppableSlot({
  id,
  style,
  isFullHour,
  isToday,
  onClick,
  isBlocked,
}: {
  id: string;
  style: React.CSSProperties;
  isFullHour: boolean;
  isToday: boolean;
  onClick: () => void;
  isBlocked: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: isBlocked });

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={isBlocked ? undefined : onClick}
      className={cn(
        'absolute left-0 right-0 border-t transition-colors',
        isFullHour ? 'border-border' : 'border-border/30 border-dashed',
        isBlocked
          ? 'bg-muted/50 cursor-not-allowed'
          : cn(
              'cursor-pointer',
              isToday && 'bg-primary/5',
              isOver ? 'bg-primary/10' : 'hover:bg-muted/30',
            ),
      )}
    />
  );
}
```

- [ ] **Step 3: Adicionar guard em `handleDragEnd`**

Localize `handleDragEnd` (aprox. linha 328). Após a linha que extrai `timeStr` e antes do `dragMutation.mutate`, adicione o guard:

```typescript
// Rejeitar drop em slot fora do horário de funcionamento
if (isSlotBlocked(timeStr, parseISO(dateStr + 'T00:00:00'), businessHours)) return;
```

O trecho completo ficará:

```typescript
const handleDragEnd = (event: DragEndEvent) => {
  setDraggedAppointment(null);
  const { active, over } = event;
  if (!over) return;

  const apt = active.data.current?.appointment as Appointment;
  if (!apt) return;

  const slotId = over.id as string;
  if (!slotId.startsWith('slot-')) return;

  const parts = slotId.replace('slot-', '').split('_');
  const dateStr = parts[0];
  const timeStr = parts[1]; // HH:MM

  if (isSlotBlocked(timeStr, parseISO(dateStr + 'T00:00:00'), businessHours)) return;

  const [hourStr, minStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);

  const newDate = setMinutes(setHours(parseISO(dateStr + 'T00:00:00'), hour), min);
  const newStartAt = newDate.toISOString();

  const originalDate = parseISO(apt.startAt);
  if (format(originalDate, 'yyyy-MM-dd HH:mm') === `${dateStr} ${timeStr}`) return;

  dragMutation.mutate({ id: apt.id, startAt: newStartAt });
};
```

- [ ] **Step 4: Passar `isBlocked` na renderização dos slots**

Localize o bloco `{halfHourSlots.map(...)}` na renderização da grade (aprox. linha 604) e substitua:

```tsx
// ANTES:
{halfHourSlots.map((slot) => {
  const slotId = `slot-${dateStr}_${slot.time}`;
  return (
    <DroppableSlot
      key={slotId}
      id={slotId}
      isFullHour={slot.isFullHour}
      isToday={isToday}
      style={{ top: slot.index * SLOT_HEIGHT, height: SLOT_HEIGHT }}
      onClick={() => {
        setSlotPreset({ date: dateStr, time: slot.time });
        setCreateOpen(true);
      }}
    />
  );
})}
```

Por:

```tsx
// DEPOIS:
{halfHourSlots.map((slot) => {
  const slotId = `slot-${dateStr}_${slot.time}`;
  const blocked = isSlotBlocked(slot.time, d, businessHours);
  return (
    <DroppableSlot
      key={slotId}
      id={slotId}
      isFullHour={slot.isFullHour}
      isBlocked={blocked}
      isToday={isToday}
      style={{ top: slot.index * SLOT_HEIGHT, height: SLOT_HEIGHT }}
      onClick={() => {
        setSlotPreset({ date: dateStr, time: slot.time });
        setCreateOpen(true);
      }}
    />
  );
})}
```

> **Nota:** A variável `d` (o `Date` do dia sendo renderizado) já existe no escopo do `map` das colunas da semana — é a mesma usada para `dateStr` e `isToday`.

- [ ] **Step 5: Rodar lint e testes**

```bash
cd frontend && bun run lint && bunx vitest run
```

Esperado: lint OK, todos os 125+ testes PASS (Agenda não tem testes de componente — a cobertura vem dos helpers testados na Task 1).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Agenda.tsx
git commit -m "feat(agenda): enforce business hours — block slots outside configured range"
```

---

## Self-Review

**Spec coverage:**
- ✅ Fix Settings inputs controlados → Task 2
- ✅ Buscar businessHours na Agenda → Task 3, Step 1
- ✅ Helpers `isSlotBlocked` / `getBusinessHourForDate` → Task 1
- ✅ DroppableSlot com `isBlocked` → Task 3, Step 2
- ✅ Guard no `handleDragEnd` → Task 3, Step 3
- ✅ Slot rendering com `isBlocked` → Task 3, Step 4
- ✅ Fallback seguro quando `businessHours` ausente → coberto nos testes (Task 1, Step 2)
- ✅ Dia desabilitado = coluna inteira bloqueada → coberto pelo `!rule.enabled` no helper

**Placeholders:** nenhum.

**Type consistency:**
- `BusinessHour` definido em Task 1, importado em Task 3 ✓
- `isSlotBlocked(slotTime: string, date: Date, bh: BusinessHour[] | undefined)` — assinatura usada identicamente em Task 3 ✓
- `blocked` calculado com `d` (Date do loop) — não com `dateStr` (string) ✓
