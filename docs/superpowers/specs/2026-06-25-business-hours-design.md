# Design Spec — Horários de Funcionamento com Reflexo na Agenda

**Data:** 2026-06-25  
**Status:** Aprovado  
**Escopo:** Frontend only (Settings.tsx + Agenda.tsx)  
**Abordagem escolhida:** B — enforcement no frontend

---

## Problema

Dois bugs relacionados:

1. **Settings.tsx** — inputs de horário (`from`/`to`) usam `defaultValue` sem `onChange`. Edições do usuário nunca entram no estado `hours`. `saveMutation` sempre salva os valores carregados inicialmente, ignorando o que foi digitado.

2. **Agenda.tsx** — grade de slots usa constantes hardcoded (`START_HOUR = 8`, `END_HOUR = 21`). Não consulta `businessHours` da organização. Qualquer slot pode ser clicado ou receber drag-and-drop independente do horário configurado.

A UI de Settings já anuncia: *"Bloqueia agendamentos fora desses horários"* — mas não cumpre.

---

## Solução

### 1. Fix Settings — inputs controlados

**Arquivo:** `frontend/src/pages/Settings.tsx`

Converter os dois inputs de horário para controlados com `type="time"`:

```tsx
<input
  type="time"
  value={h.on ? h.from : ''}
  disabled={!h.on}
  onChange={(e) => setHours(prev =>
    prev.map((d, j) => j === i ? { ...d, from: e.target.value } : d)
  )}
/>
<input
  type="time"
  value={h.on ? h.to : ''}
  disabled={!h.on}
  onChange={(e) => setHours(prev =>
    prev.map((d, j) => j === i ? { ...d, to: e.target.value } : d)
  )}
/>
```

`type="time"` valida formato HH:MM no browser. `saveMutation` já está correto — apenas precisa receber o valor atualizado do estado.

O Switch de ativar/desativar dia já funciona corretamente (usa `onCheckedChange`). Não muda.

---

### 2. Agenda — busca de horários

**Arquivo:** `frontend/src/pages/Agenda.tsx`

Adicionar query de perfil da org dentro do componente `Agenda`. Reutiliza cache `['organization-profile']` — mesma chave do Settings, sem request adicional se o usuário navegou por Configurações na sessão.

```tsx
const { data: orgProfile } = useQuery({
  queryKey: ['organization-profile'],
  queryFn: organizationApi.getProfile,
  staleTime: 5 * 60 * 1000,
});

const businessHours = orgProfile?.settings?.businessHours as BusinessHour[] | undefined;
```

Tipo auxiliar (definir no topo do arquivo ou em `types/clinic.ts`):
```ts
type BusinessHour = { day: string; from: string | null; to: string | null; enabled: boolean };
```

---

### 3. Helpers de verificação

```ts
const DAY_KEYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

function getBusinessHourForDate(date: Date, bh: BusinessHour[] | undefined) {
  if (!bh) return null;
  const key = DAY_KEYS[date.getDay()];
  return bh.find(h => h.day === key) ?? null;
}

function isSlotBlocked(slotTime: string, date: Date, bh: BusinessHour[] | undefined): boolean {
  const rule = getBusinessHourForDate(date, bh);
  if (!rule || !rule.enabled) return true;   // dia desabilitado = tudo bloqueado
  if (!rule.from || !rule.to) return false;  // sem horário configurado = livre
  return slotTime < rule.from || slotTime >= rule.to;
}
```

Comparação de strings `'09:00' < '10:00'` funciona corretamente para HH:MM em ordem lexicográfica.

---

### 4. DroppableSlot — visual + bloqueio

**Arquivo:** `frontend/src/pages/Agenda.tsx`

Adicionar prop `isBlocked: boolean` ao componente `DroppableSlot`:

- `useDroppable({ id, disabled: isBlocked })` — DnD não aceita drop em slot bloqueado
- `onClick={isBlocked ? undefined : onClick}` — clique não abre formulário
- Classes CSS:
  - Bloqueado: `bg-muted/50 cursor-not-allowed` (sem hover)
  - Livre: comportamento atual mantido

```tsx
function DroppableSlot({ id, style, isFullHour, isToday, onClick, isBlocked }: {
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

---

### 5. handleDragEnd — rejeitar drop fora do horário

```tsx
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
  const timeStr = parts[1];

  // Bloquear drop fora do horário de funcionamento
  if (isSlotBlocked(timeStr, parseISO(dateStr + 'T00:00:00'), businessHours)) return;

  const [hourStr, minStr] = timeStr.split(':');
  const newDate = setMinutes(setHours(parseISO(dateStr + 'T00:00:00'), parseInt(hourStr, 10)), parseInt(minStr, 10));
  const newStartAt = newDate.toISOString();

  const originalDate = parseISO(apt.startAt);
  if (format(originalDate, 'yyyy-MM-dd HH:mm') === `${dateStr} ${timeStr}`) return;

  dragMutation.mutate({ id: apt.id, startAt: newStartAt });
};
```

---

### 6. Renderização dos slots

Passar `isBlocked` calculado para cada `DroppableSlot`:

```tsx
{halfHourSlots.map((slot) => {
  const slotId = `slot-${dateStr}_${slot.time}`;
  const blocked = isSlotBlocked(slot.time, day, businessHours);
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

Dias inteiramente desabilitados ficam com coluna totalmente dimeiada sem lógica extra — todos os slots do dia retornam `isBlocked = true`.

---

## Comportamento resultante

| Situação | Resultado |
|---|---|
| Slot dentro do horário | comportamento atual (clique abre form, aceita drop) |
| Slot fora do horário | dimeiado, clique ignorado, drop rejeitado |
| Dia desabilitado (ex: Domingo) | coluna inteira dimeiada e bloqueada |
| `businessHours` não configurado (org nova) | todos os slots livres (fallback seguro) |
| Agendamento existente fora do horário | exibido normalmente — não é removido |

---

## Fora de escopo

- Validação no backend (AppointmentService) — iteração futura se necessário
- AppointmentFormDialog: time picker não filtra horários bloqueados — usuário pode digitar qualquer hora no form; o bloqueio é só na grade visual
- Vista mensal: não tem grade de slots, sem impacto

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/pages/Settings.tsx` | inputs controlados (`value` + `onChange` + `type="time"`) |
| `frontend/src/pages/Agenda.tsx` | query org profile, helpers `isSlotBlocked`, prop `isBlocked` no DroppableSlot, guard no handleDragEnd |
