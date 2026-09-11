# Evolução — Exclusão e Vínculo 1:1 com Consulta — Design Spec

**Data:** 2026-09-10
**Status:** Aprovado

---

## Visão Geral

Três melhorias no módulo de Evoluções clínicas:

1. **Excluir evolução** — hoje só é possível criar e editar. Um erro de gravação
   indevida (evolução no paciente errado, texto colado errado, duplicata) fica
   permanente. Passa a existir exclusão definitiva, restrita a ADMIN/PROFESSIONAL
   e registrada em auditoria.
2. **Vínculo 1:1 evolução ↔ consulta** — o campo `Evolution.appointmentId` já
   existe e é opcional, mas hoje **várias** evoluções podem apontar para a mesma
   consulta. Passa a valer: uma consulta pode ter **no máximo uma** evolução. O
   vínculo continua opcional; uma vez feito, a consulta some do seletor de novas
   evoluções/edições até o vínculo ser removido (ou a evolução ser excluída).
3. **Exibir a consulta vinculada** — hoje o `PatientProfile` não mostra o vínculo
   e a página de Evoluções mostra só a data. Passa a exibir procedimento + data/
   hora + status da consulta nas duas telas.

---

## Estado Atual (para referência)

- **Schema**: `Evolution.appointmentId String?` — FK opcional, **sem** `@unique`.
  `Appointment` tem o lado reverso `evolutions Evolution[]`.
- **Backend** (`backend/src/evolution/`):
  - `EvolutionService.create/update` chamam `assertAppointmentBelongsToPatient`
    (valida que a consulta é do paciente) — não checam se a consulta já tem
    evolução.
  - `create/update/findByPatient/findById` já incluem
    `appointment: { select: { id, startAt, status } }`.
  - **Não existe** endpoint `DELETE` (anamnese e perineal têm `remove` com hard
    delete via `prisma.<model>.delete`).
  - `EvolutionController` tem `@RequireFeature('EVOLUTIONS')` e throttle.
- **Auditoria**: `AuditInterceptor` audita automaticamente `POST/PATCH/PUT/DELETE`
  em rotas mapeadas; `evolutions` → entity `Evolution`. Um `DELETE /evolutions/:id`
  gera log `{ action: 'DELETE', entity: 'Evolution', entityId, userId, ipAddress }`
  sem nenhum código extra no service.
- **Frontend**:
  - `EvolutionFormDialog.tsx` — seletor "Atendimento relacionado" que lista
    `appointmentsApi.list({ patientId })` filtrando só `status !== 'CANCELED'`
    (ou a atualmente selecionada).
  - `Evolutions.tsx` (linha ~185) — exibe `Atendimento: dd/MM/yyyy 'às' HH:mm`
    (só quando `evolution.appointment`), sem procedimento nem status.
  - `PatientProfile.tsx` timeline de evoluções (linha ~694-731) — não exibe
    vínculo; só tem botão de editar (lápis), sem excluir.
  - Nenhuma das telas tem botão de excluir evolução.
- Nenhum código (backend ou frontend) lê a relação `appointment.evolutions` —
  verificado por grep. Só o template PDF `evolution-summary.tsx` consome
  `evolution.appointment.procedure`, via query própria de evoluções.

---

## Modelo de Dados

### Alteração na entidade `Evolution`

```prisma
model Evolution {
  // ...
  appointmentId String? @unique @map("appointment_id")   // + @unique
  // ...
  appointment Appointment? @relation(fields: [appointmentId], references: [id])
}
```

### Alteração na entidade `Appointment`

```prisma
model Appointment {
  // ...
  evolution Evolution?   // era: evolutions Evolution[]
}
```

O `@unique` num campo anulável no PostgreSQL permite múltiplos `NULL`, então
evoluções sem consulta continuam válidas sem limite.

### Migração — `evolution_appointment_unique`

Gerada com `bunx prisma migrate dev --name evolution_appointment_unique` e depois
**editada manualmente** para inserir o passo de dedup **antes** da criação do
índice único. Ordem final do SQL:

1. **Desvincular duplicatas** (não apaga evoluções):

   ```sql
   UPDATE "evolutions"
   SET "appointment_id" = NULL
   WHERE "appointment_id" IS NOT NULL
     AND "id" NOT IN (
       SELECT DISTINCT ON ("appointment_id") "id"
       FROM "evolutions"
       WHERE "appointment_id" IS NOT NULL
       ORDER BY "appointment_id", "evolution_date" DESC, "created_at" DESC
     );
   ```

   Regra de escolha: mantém vinculada a evolução de `evolution_date` mais
   recente; empate resolvido por `created_at` mais recente. As demais evoluções
   daquela consulta ficam com `appointment_id = NULL` (continuam existindo, só
   perdem o vínculo).

2. **Criar o índice único**:

   ```sql
   CREATE UNIQUE INDEX "evolutions_appointment_id_key" ON "evolutions"("appointment_id");
   ```

**Pré-merge em produção**: `backend/docker-entrypoint.sh` roda `prisma migrate
deploy` automaticamente (via `set -e`) no boot do container quando o Coolify
sobe a nova imagem — não é um passo manual que alguém executa depois do merge.
Isso significa que o `SELECT` de contagem de duplicatas abaixo precisa ser
rodado **antes de dar merge na branch**, para dimensionar o impacto e comunicar,
se relevante, enquanto ainda há tempo de reagir:

```sql
SELECT "appointment_id", COUNT(*)
FROM "evolutions"
WHERE "appointment_id" IS NOT NULL
GROUP BY "appointment_id"
HAVING COUNT(*) > 1;
```

Aplicação em prod: `NODE_ENV=prod bunx prisma migrate deploy` (fluxo padrão do
projeto, disparado automaticamente pelo `docker-entrypoint.sh` no boot).

**Recuperação em caso de falha do índice único durante o deploy** (ex.: um
container antigo, ainda de pé durante um rolling deploy, grava um vínculo
duplicado depois do `SELECT` de checagem e antes do índice ser criado):

```bash
bunx prisma migrate resolve --rolled-back 20260911010534_evolution_appointment_unique
```

Em seguida, execute manualmente o `UPDATE` de dedup desta migration (ver
`migration.sql`) para remover a duplicata remanescente e faça o deploy
novamente.

---

## Backend

Arquivos: `backend/src/evolution/{evolution.service.ts,evolution.controller.ts}`,
`backend/src/appointment/appointment.service.ts`.

### `EvolutionService`

**`assertAppointmentBelongsToPatient` → `assertAppointmentAvailable`**

Renomear e estender. Assinatura:

```ts
private async assertAppointmentAvailable(
  organizationId: string,
  patientId: string,
  appointmentId: string,
  currentEvolutionId?: string,
): Promise<void>
```

- Mantém a checagem atual: consulta existe, é da org, é do paciente, não está
  soft-deletada → senão `BadRequestException('Agendamento não pertence a este paciente')`.
- Nova checagem: existe outra evolução vinculada a essa consulta?

  ```ts
  const linked = await this.prisma.evolution.findFirst({
    where: {
      appointmentId,
      ...(currentEvolutionId && { NOT: { id: currentEvolutionId } }),
    },
    select: { id: true },
  });
  if (linked) {
    throw new ConflictException('Este atendimento já possui uma evolução vinculada');
  }
  ```

**`create` / `update`**

- `create`: chama `assertAppointmentAvailable(orgId, dto.patientId, dto.appointmentId)`
  (sem `currentEvolutionId`).
- `update`: chama `assertAppointmentAvailable(orgId, existing.patientId, dto.appointmentId, id)`.
- Ambos: envolver o `prisma.evolution.create/update` em try/catch e converter
  `Prisma.PrismaClientKnownRequestError` com `code === 'P2002'` no
  `appointment_id` para `ConflictException('Este atendimento já possui uma evolução vinculada')`
  — rede de segurança contra corrida entre a checagem e a escrita.

**`remove` (novo)**

```ts
async remove(organizationId: string, id: string): Promise<void> {
  const existing = await this.prisma.evolution.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) {
    throw new NotFoundException('Evolução não encontrada');
  }
  await this.prisma.evolution.delete({ where: { id } });
}
```

Hard delete, consistente com `AnamnesisService.remove` /
`PerinealAssessmentService.remove`. A consulta antes vinculada volta a ficar
disponível automaticamente (linha removida → `appointment_id` livre).

### `EvolutionController`

```ts
import { Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Delete(':id')
@Roles(Role.ADMIN, Role.PROFESSIONAL)
@HttpCode(HttpStatus.NO_CONTENT)
remove(@OrgId() orgId: string, @Param('id') id: string) {
  return this.evolutionService.remove(orgId, id);
}
```

- `RolesGuard` é global; `@Roles` no método restringe só o `DELETE`. RECEPCIONISTA
  fica de fora (além de já não ter, tipicamente, a feature EVOLUTIONS).
- Auditoria: automática via `AuditInterceptor`, nada a fazer no service.

### `appointment.service.ts` — `appointmentIncludes`

Adicionar ao objeto `appointmentIncludes` (constante compartilhada por todas as
queries de agendamento):

```ts
evolution: { select: { id: true } },
```

Isso passa `appointment.evolution` (`{ id } | null`) para o frontend, que usa para
esconder consultas já vinculadas no seletor.

### Include de `appointment` nas respostas de evolução

Nos quatro `include` de `EvolutionService` (`create`, `findByPatient`, `findById`,
`update`), trocar:

```ts
appointment: { select: { id: true, startAt: true, status: true } }
```

por:

```ts
appointment: {
  select: {
    id: true,
    startAt: true,
    endAt: true,
    status: true,
    procedure: { select: { name: true } },
  },
}
```

---

## Frontend

### Types (`frontend/src/types/clinic.ts`)

```ts
export interface Appointment {
  // ...
  evolution?: { id: string } | null;
}

export interface Evolution {
  // ...
  appointment?: {
    id: string;
    startAt: string;
    endAt: string;
    status: AppointmentStatus;
    procedure?: { name: string };
  } | null;
}
```

### API client (`frontend/src/lib/api.ts`)

```ts
export const evolutionsApi = {
  // ...
  remove: (id: string) => api.delete<void>(`/evolutions/${id}`),
};
```

### `EvolutionFormDialog.tsx`

No `.filter(...)` do `<Select>` de atendimentos, além de
`apt.status !== 'CANCELED'`, esconder as já vinculadas:

```ts
appointments
  .filter((apt) => {
    if (apt.status === 'CANCELED' && apt.id !== appointmentId) return false;
    // esconde consultas que já têm evolução, exceto a vinculada a ESTA evolução
    if (apt.evolution && apt.id !== (evolution?.appointment?.id ?? evolution?.appointmentId))
      return false;
    return true;
  })
```

Ajustar o texto de ajuda abaixo do seletor para mencionar que consultas que já
possuem evolução não aparecem na lista.

### Componente compartilhado — `frontend/src/components/evolutions/LinkedAppointmentLine.tsx`

Pequeno componente de exibição, usado nas duas telas:

```tsx
interface Props {
  appointment: NonNullable<Evolution['appointment']>;
}
```

Renderiza uma linha discreta: `Atendimento: {procedure?.name ? procedure.name + ' — ' : ''}{dd/MM/yyyy 'às' HH:mm}` +
`<StatusBadge>` do status da consulta (reaproveitar o badge/labels já usados na
Agenda). Estilo `text-xs text-muted-foreground`, alinhado ao padrão atual.

### Exibição do vínculo (requisito 3)

- `Evolutions.tsx` (~linha 185): substituir o `<p>` cru atual por
  `<LinkedAppointmentLine appointment={evolution.appointment} />`.
- `PatientProfile.tsx` timeline (~linha 722, depois da descrição): renderizar
  `{evo.appointment && <LinkedAppointmentLine appointment={evo.appointment} />}`.

### Exclusão na UI

Nas duas telas (`Evolutions.tsx` e `PatientProfile.tsx` timeline), ao lado do
botão de editar (lápis):

- Botão lixeira (`Trash2`), `aria-label="Excluir evolução"`.
- Visível apenas para `useHasRole('ADMIN', 'PROFESSIONAL')`.
- `AlertDialog` de confirmação: título "Excluir evolução?", corpo "Esta ação não
  pode ser desfeita. A consulta vinculada, se houver, voltará a ficar disponível.",
  ação destrutiva "Excluir".
- `useMutation`:
  - `mutationFn: () => evolutionsApi.remove(evolution.id)`
  - `onSuccess`: invalidar
    - `['evolutions', selectedPatient]` / `['patient-evolutions', id]`
    - `['patient-appointments', id]` / `['appointments', 'patient', patientId]`
      (consulta volta a ficar livre)
    - `toast.success('Evolução excluída')`
  - `onError`: `toast.error('Erro ao excluir evolução')`

---

## Testes

### Backend — `backend/src/evolution/evolution.service.spec.ts`

Novos casos (mock de `PrismaService`, sem DB):

- `remove`: sucesso (chama `delete` com o id) e `NotFoundException` quando a
  evolução não existe / é de outra org.
- `create`: `ConflictException` quando `assertAppointmentAvailable` encontra outra
  evolução na mesma consulta.
- `update`: `ConflictException` quando outra evolução usa a consulta;
  **sucesso** quando a única evolução vinculada é a própria (`currentEvolutionId`).
- Tratamento de `P2002`: `create`/`update` convertem
  `PrismaClientKnownRequestError { code: 'P2002' }` em `ConflictException`.

Manter cobertura ≥ 80% statements/functions/lines, ≥ 75% branches (threshold do
projeto).

### Frontend

Seguir o padrão de testes existente do módulo, se houver. Cobrir no mínimo:

- `EvolutionFormDialog`: consulta já vinculada não aparece no seletor; a consulta
  da evolução em edição continua aparecendo.
- Fluxo de exclusão: botão só aparece para ADMIN/PROFESSIONAL; confirmação chama
  `evolutionsApi.remove` e invalida as queries.

---

## Sequência de Implementação

1. Schema + migração (com dedup) + `bunx prisma generate`.
2. Backend: `assertAppointmentAvailable`, `remove`, controller `DELETE`,
   `appointmentIncludes`, include enriquecido de `appointment`.
3. Testes backend.
4. Frontend: types + `evolutionsApi.remove`.
5. `LinkedAppointmentLine` + uso nas duas telas.
6. Filtro do seletor no `EvolutionFormDialog`.
7. Botão + `AlertDialog` de exclusão nas duas telas.
8. Testes frontend.
9. `chore: bump version` em `frontend/package.json`.

---

## Fora de Escopo

- Soft-delete / lixeira / restauração de evoluções.
- Aplicar o mesmo vínculo 1:1 ou padrão de exclusão a Anamnese / Avaliação
  Perineal.
- Mudanças no fluxo de "evolução rápida" do `PatientProfile` além da invalidação
  de cache já descrita.
- Vincular automaticamente evolução ↔ consulta (continua ação manual do usuário).
- Migrar o histórico de evoluções "órfãs" (sem consulta) para alguma consulta.
