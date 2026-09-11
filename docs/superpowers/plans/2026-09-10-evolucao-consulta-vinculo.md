# Evolução — Exclusão e Vínculo 1:1 com Consulta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir excluir evoluções clínicas, garantir vínculo 1:1 entre evolução e consulta, e exibir a consulta vinculada nas telas de Evoluções e Perfil do Paciente.

**Architecture:** Adiciona `@unique` na FK `Evolution.appointmentId` (com migração que desvincula duplicatas existentes sem apagá-las), um `DELETE /evolutions/:id` restrito a ADMIN/PROFESSIONAL (auditoria automática via interceptor existente), validação de disponibilidade da consulta no `EvolutionService`, e componentes de frontend para exibir/excluir. Hard delete, consistente com Anamnese e Avaliação Perineal.

**Tech Stack:** NestJS + Prisma 7 + PostgreSQL (backend, Bun/Jest); React + TypeScript + Vite + TanStack Query + shadcn/ui (frontend, Vitest).

**Spec:** `docs/superpowers/specs/2026-09-10-evolucao-consulta-vinculo-design.md`

## Global Constraints

- Backend TypeScript estrito (`noImplicitAny: true`, `strictNullChecks: true`).
- Frontend TypeScript solto (`noImplicitAny: false`, `strictNullChecks: false`); imports de `src/` usam alias `@/`.
- Cobertura backend obrigatória: ≥ 80% statements/functions/lines, ≥ 75% branches (coletada só de `**/*.service.ts`).
- **Nunca** rodar `bun run lint` em `backend/` — é `eslint --fix` e reescreve ~195 arquivos.
- UI em português do Brasil.
- Todo endpoint de domínio usa `@OrgId()` — nunca confiar em `organizationId` vindo do cliente.
- Migrações: `bunx prisma migrate dev --name <nome>` em dev; `NODE_ENV=prod bunx prisma migrate deploy` em prod.
- Auditoria de `DELETE` é automática via `AuditInterceptor` (`evolutions` → entity `Evolution`) — não escrever código de auditoria.
- Commits frequentes; mensagens em português seguindo o padrão do repo (`feat(...)`, `fix(...)`, `test(...)`, `chore(...)`).
- Branch de trabalho: `bravilal/evolucao-consulta-vinculo` (já criada).
- Atribuição em todo commit:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01BjFm3MnLpUHTiUeLC5K4BW
  ```

---

### Task 1: Schema + migração (dedup + `@unique` em `appointment_id`)

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `Evolution` ~L355-376, model `Appointment` ~L246-275)
- Create: `backend/prisma/migrations/<timestamp>_evolution_appointment_unique/migration.sql`

**Interfaces:**
- Consumes: nada.
- Produces: coluna `evolutions.appointment_id` com índice único `evolutions_appointment_id_key`; relação Prisma `Appointment.evolution: Evolution?` e `Evolution.appointmentId` marcado `@unique`.

- [ ] **Step 1: Alterar o schema**

Em `backend/prisma/schema.prisma`, model `Evolution`, trocar a linha do campo:

```prisma
  appointmentId  String?             @unique @map("appointment_id")
```

No model `Appointment`, trocar a linha:

```prisma
  evolutions       Evolution[]
```

por:

```prisma
  evolution        Evolution?
```

- [ ] **Step 2: Validar o schema**

Run: `cd backend && bunx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Gerar a migração (sem aplicar ainda)**

Run: `cd backend && bunx prisma migrate dev --name evolution_appointment_unique --create-only`
Expected: cria a pasta `backend/prisma/migrations/<timestamp>_evolution_appointment_unique/` com `migration.sql` contendo o `CREATE UNIQUE INDEX`.

- [ ] **Step 4: Editar o `migration.sql` para desvincular duplicatas antes do índice**

Abrir o `migration.sql` gerado e inserir, **antes** do `CREATE UNIQUE INDEX`:

```sql
-- Desvincula evoluções duplicadas na mesma consulta (mantém a mais recente).
-- Não apaga nenhuma evolução; apenas zera o vínculo das excedentes.
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

O arquivo final deve ter o `UPDATE` acima seguido do `CREATE UNIQUE INDEX "evolutions_appointment_id_key" ON "evolutions"("appointment_id");` que o Prisma já gerou.

- [ ] **Step 5: Aplicar a migração no banco de dev**

Run: `cd backend && bunx prisma migrate dev`
Expected: `Your database is now in sync with your schema.` e o Prisma Client é regenerado.

- [ ] **Step 6: Verificar manualmente o comportamento do dedup**

Run:
```bash
cd backend && bunx prisma db execute --stdin <<'SQL'
INSERT INTO "evolutions" (id, organization_id, patient_id, professional_id, appointment_id, description, evolution_date, created_at, updated_at)
SELECT gen_random_uuid(), organization_id, patient_id, professional_id, appointment_id, 'dup-check', now() - interval '1 day', now() - interval '1 day', now()
FROM "evolutions" WHERE appointment_id IS NOT NULL LIMIT 1;
SQL
```
Se o INSERT acima falhar com `duplicate key value violates unique constraint "evolutions_appointment_id_key"`, a constraint está ativa — comportamento correto. Remover qualquer linha `dup-check` que tenha entrado:
```bash
cd backend && bunx prisma db execute --stdin <<'SQL'
DELETE FROM "evolutions" WHERE description = 'dup-check';
SQL
```
Expected: o INSERT é rejeitado pela constraint OU (se o seed não tiver evolução com consulta) não insere nada — em ambos os casos a constraint existe. `bunx prisma migrate status` deve mostrar a migração como aplicada.

- [ ] **Step 7: Rodar a suíte backend para garantir que nada quebrou com a regeneração do client**

Run: `cd backend && bun run test`
Expected: PASS (a suíte atual não conhece a nova constraint; deve passar inalterada).

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "$(cat <<'EOF'
feat(evolution): vínculo 1:1 com consulta (unique + migração de dedup)

Adiciona @unique em evolutions.appointment_id. A migração desvincula
evoluções duplicadas na mesma consulta (mantém a mais recente) sem
apagá-las, e então cria o índice único.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BjFm3MnLpUHTiUeLC5K4BW
EOF
)"
```

> **Nota para deploy em prod (não é um passo de código):** antes do `migrate deploy`, rodar
> `SELECT "appointment_id", COUNT(*) FROM "evolutions" WHERE "appointment_id" IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;`
> para dimensionar quantas evoluções serão desvinculadas.

---

### Task 2: Backend — validação de consulta disponível (`assertAppointmentAvailable`)

**Files:**
- Modify: `backend/src/evolution/evolution.service.ts` (método privado `assertAppointmentBelongsToPatient` L131-144; chamadas em `create` L26-32 e `update` L105-111)
- Modify: `backend/src/evolution/evolution.service.spec.ts` (testes existentes de vínculo L66-98 e L267-304; novos testes)

**Interfaces:**
- Consumes: `PrismaService` (`prisma.evolution.findFirst`, `prisma.appointment.findFirst`).
- Produces: método privado `assertAppointmentAvailable(organizationId: string, patientId: string, appointmentId: string, currentEvolutionId?: string): Promise<void>` — lança `BadRequestException('Agendamento não pertence a este paciente')` ou `ConflictException('Este atendimento já possui uma evolução vinculada')`.

- [ ] **Step 1: Atualizar os testes existentes de vínculo para o novo fluxo**

Em `backend/src/evolution/evolution.service.spec.ts`, adicionar `prisma.evolution.findFirst.mockResolvedValue(null);` no início dos testes que hoje vinculam uma consulta com sucesso (o de `create` em ~L66 "deve criar evolução vinculada a um agendamento..." e o de `update` em ~L267 "deve vincular a um agendamento do mesmo paciente..."). Sem isso, o novo `findFirst` da checagem 1:1 retorna `undefined` e o teste continua passando, mas queremos deixá-lo explícito.

- [ ] **Step 2: Escrever os testes que falham (regra 1:1)**

Adicionar ao `describe('create', ...)`:

```ts
it('deve lançar ConflictException quando a consulta já tem outra evolução', async () => {
  prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
  prisma.appointment.findFirst.mockResolvedValue({ id: 'apt-1' });
  prisma.evolution.findFirst.mockResolvedValue({ id: 'evo-existente' });

  await expect(
    service.create(orgId, personId, {
      patientId: 'patient-1',
      description: 'Evolução clínica de teste.',
      appointmentId: 'apt-1',
    }),
  ).rejects.toThrow('Este atendimento já possui uma evolução vinculada');

  expect(prisma.evolution.create).not.toHaveBeenCalled();
});
```

Adicionar ao `describe('update', ...)` (usar o mesmo `existing` já definido no bloco):

```ts
it('deve lançar ConflictException quando outra evolução usa a consulta', async () => {
  prisma.evolution.findFirst
    .mockResolvedValueOnce(existing) // busca da própria evolução
    .mockResolvedValueOnce({ id: 'outra-evo' }); // busca 1:1
  prisma.appointment.findFirst.mockResolvedValue({ id: 'apt-1' });

  await expect(
    service.update(orgId, 'evo-1', { appointmentId: 'apt-1' }),
  ).rejects.toThrow('Este atendimento já possui uma evolução vinculada');
});

it('deve permitir manter a consulta já vinculada à própria evolução', async () => {
  prisma.evolution.findFirst
    .mockResolvedValueOnce(existing) // busca da própria evolução
    .mockResolvedValueOnce(null); // busca 1:1 com NOT: { id: 'evo-1' } não acha nada
  prisma.appointment.findFirst.mockResolvedValue({ id: 'apt-1' });
  prisma.evolution.update.mockResolvedValue({ ...existing, appointmentId: 'apt-1' });

  await expect(
    service.update(orgId, 'evo-1', { appointmentId: 'apt-1' }),
  ).resolves.toBeDefined();
});
```

> Observação: o `update` atual busca a evolução existente com `prisma.evolution.findFirst` (L93). Confirmar na implementação a ordem das chamadas a `findFirst` e ajustar `mockResolvedValueOnce` se necessário.

- [ ] **Step 3: Rodar os testes e ver falhar**

Run: `cd backend && bun run test src/evolution/evolution.service.spec.ts`
Expected: FAIL nos 3 testes novos (`ConflictException` não é lançada / `assertAppointmentAvailable` não existe).

- [ ] **Step 4: Implementar `assertAppointmentAvailable`**

Em `backend/src/evolution/evolution.service.ts`:

1. Adicionar `ConflictException` ao import de `@nestjs/common` (já importa `BadRequestException, Injectable, NotFoundException, ForbiddenException`).

2. Substituir o método `assertAppointmentBelongsToPatient` (L131-144) por:

```ts
  private async assertAppointmentAvailable(
    organizationId: string,
    patientId: string,
    appointmentId: string,
    currentEvolutionId?: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, organizationId, patientId, deletedAt: null },
      select: { id: true },
    });

    if (!appointment) {
      throw new BadRequestException('Agendamento não pertence a este paciente');
    }

    const linked = await this.prisma.evolution.findFirst({
      where: {
        appointmentId,
        ...(currentEvolutionId && { NOT: { id: currentEvolutionId } }),
      },
      select: { id: true },
    });

    if (linked) {
      throw new ConflictException(
        'Este atendimento já possui uma evolução vinculada',
      );
    }
  }
```

3. Em `create` (L26-32), trocar a chamada para:

```ts
    if (dto.appointmentId) {
      await this.assertAppointmentAvailable(
        organizationId,
        dto.patientId,
        dto.appointmentId,
      );
    }
```

4. Em `update` (L105-111), trocar para:

```ts
    if (dto.appointmentId) {
      await this.assertAppointmentAvailable(
        organizationId,
        existing.patientId,
        dto.appointmentId,
        id,
      );
    }
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `cd backend && bun run test src/evolution/evolution.service.spec.ts`
Expected: PASS (todos, incluindo os atualizados no Step 1).

- [ ] **Step 6: Commit**

```bash
git add backend/src/evolution/evolution.service.ts backend/src/evolution/evolution.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(evolution): rejeitar vínculo com consulta que já tem evolução

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BjFm3MnLpUHTiUeLC5K4BW
EOF
)"
```

---

### Task 3: Backend — tratar corrida (`P2002`) em `create`/`update`

**Files:**
- Modify: `backend/src/evolution/evolution.service.ts` (`create` L34-53, `update` L113-128)
- Modify: `backend/src/evolution/evolution.service.spec.ts`

**Interfaces:**
- Consumes: `Prisma` de `@prisma/client`.
- Produces: `create` e `update` convertem `Prisma.PrismaClientKnownRequestError` com `code === 'P2002'` em `ConflictException('Este atendimento já possui uma evolução vinculada')`.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao `describe('create', ...)` de `evolution.service.spec.ts`:

```ts
it('deve converter erro P2002 do Prisma em ConflictException', async () => {
  prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
  prisma.appointment.findFirst.mockResolvedValue({ id: 'apt-1' });
  prisma.evolution.findFirst.mockResolvedValue(null);
  const p2002 = new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: 'test',
  });
  prisma.evolution.create.mockRejectedValue(p2002);

  await expect(
    service.create(orgId, personId, {
      patientId: 'patient-1',
      description: 'Evolução clínica de teste.',
      appointmentId: 'apt-1',
    }),
  ).rejects.toThrow('Este atendimento já possui uma evolução vinculada');
});
```

Adicionar `import { Prisma } from '@prisma/client';` no topo do spec.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && bun run test src/evolution/evolution.service.spec.ts -t P2002`
Expected: FAIL (o erro P2002 vaza como está, não vira `ConflictException`).

- [ ] **Step 3: Implementar o tratamento**

Em `backend/src/evolution/evolution.service.ts`:

1. Adicionar `import { Prisma } from '@prisma/client';`.

2. Adicionar um helper privado:

```ts
  private rethrowAppointmentConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Este atendimento já possui uma evolução vinculada',
      );
    }
    throw error;
  }
```

3. Em `create`, envolver o `return this.prisma.evolution.create({...})` em try/catch:

```ts
    try {
      return await this.prisma.evolution.create({
        // ...conteúdo atual inalterado...
      });
    } catch (error) {
      this.rethrowAppointmentConflict(error);
    }
```

4. Fazer o mesmo com o `return this.prisma.evolution.update({...})` em `update`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && bun run test src/evolution/evolution.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/evolution/evolution.service.ts backend/src/evolution/evolution.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(evolution): converter P2002 de vínculo duplicado em 409

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BjFm3MnLpUHTiUeLC5K4BW
EOF
)"
```

---

### Task 4: Backend — `DELETE /evolutions/:id`

**Files:**
- Modify: `backend/src/evolution/evolution.service.ts` (novo método `remove`)
- Modify: `backend/src/evolution/evolution.controller.ts`
- Modify: `backend/src/evolution/evolution.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (`prisma.evolution.findFirst`, `prisma.evolution.delete`).
- Produces:
  - `EvolutionService.remove(organizationId: string, id: string): Promise<void>` — `NotFoundException('Evolução não encontrada')` se não existir na org; senão hard delete.
  - `DELETE /api/v1/evolutions/:id` → `204 No Content`, restrito a `Role.ADMIN` e `Role.PROFESSIONAL`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar a `evolution.service.spec.ts`:

```ts
describe('remove', () => {
  it('deve excluir a evolução quando ela existe na org', async () => {
    prisma.evolution.findFirst.mockResolvedValue({ id: 'evo-1' });
    prisma.evolution.delete = jest.fn().mockResolvedValue({ id: 'evo-1' });

    await service.remove(orgId, 'evo-1');

    expect(prisma.evolution.delete).toHaveBeenCalledWith({ where: { id: 'evo-1' } });
  });

  it('deve lançar NotFoundException quando a evolução não existe na org', async () => {
    prisma.evolution.findFirst.mockResolvedValue(null);
    prisma.evolution.delete = jest.fn();

    await expect(service.remove(orgId, 'evo-x')).rejects.toThrow(
      'Evolução não encontrada',
    );
    expect(prisma.evolution.delete).not.toHaveBeenCalled();
  });
});
```

Adicionar `delete: jest.fn()` ao mock `prisma.evolution` no `beforeEach` (L18-23).

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && bun run test src/evolution/evolution.service.spec.ts -t remove`
Expected: FAIL (`service.remove` não existe).

- [ ] **Step 3: Implementar `remove` no service**

Em `backend/src/evolution/evolution.service.ts`, adicionar após `update`:

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

- [ ] **Step 4: Adicionar o endpoint no controller**

Em `backend/src/evolution/evolution.controller.ts`:

1. Ampliar o import de `@nestjs/common` para incluir `Delete, HttpCode, HttpStatus`.
2. Adicionar imports:
   ```ts
   import { Roles } from '../auth/decorators/roles.decorator';
   import { Role } from '@prisma/client';
   ```
3. Adicionar o método após `update`:
   ```ts
     @Delete(':id')
     @Roles(Role.ADMIN, Role.PROFESSIONAL)
     @HttpCode(HttpStatus.NO_CONTENT)
     remove(@OrgId() orgId: string, @Param('id') id: string) {
       return this.evolutionService.remove(orgId, id);
     }
   ```

- [ ] **Step 5: Rodar os testes do service e ver passar**

Run: `cd backend && bun run test src/evolution/evolution.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Verificar cobertura da service**

Run: `cd backend && bun run test:cov -- src/evolution`
Expected: `evolution.service.ts` ≥ 80% linhas/funções/statements, ≥ 75% branches.

- [ ] **Step 7: Commit**

```bash
git add backend/src/evolution
git commit -m "$(cat <<'EOF'
feat(evolution): endpoint DELETE restrito a ADMIN/PROFESSIONAL

Hard delete, auditado automaticamente pelo AuditInterceptor.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BjFm3MnLpUHTiUeLC5K4BW
EOF
)"
```

---

### Task 5: Backend — enriquecer os includes de consulta

**Files:**
- Modify: `backend/src/appointment/appointment.service.ts` (const `appointmentIncludes` L30-39)
- Modify: `backend/src/evolution/evolution.service.ts` (4 blocos `include` em `create`, `findByPatient`, `findById`, `update`)

**Interfaces:**
- Consumes: nada novo.
- Produces:
  - Cada `Appointment` retornado pelo módulo de agendamento passa a incluir `evolution: { id: string } | null`.
  - Cada `evolution.appointment` retornado pelo `EvolutionService` passa a incluir `endAt: string` e `procedure: { name: string }`.

- [ ] **Step 1: Adicionar `evolution` ao `appointmentIncludes`**

Em `backend/src/appointment/appointment.service.ts`, dentro da const `appointmentIncludes` (após a linha `treatmentPackage: { select: { id: true, name: true } },`):

```ts
  evolution: { select: { id: true } },
```

- [ ] **Step 2: Enriquecer o `include` de `appointment` no `EvolutionService`**

Nos 4 blocos `include` de `backend/src/evolution/evolution.service.ts` (`create`, `findByPatient`, `findById`, `update`), trocar:

```ts
        appointment: {
          select: { id: true, startAt: true, status: true },
        },
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
        },
```

- [ ] **Step 3: Rodar a suíte backend inteira**

Run: `cd backend && bun run test`
Expected: PASS. (`appointment.service.spec.ts` usa `include: expect.anything()` — não quebra. `evolution.service.spec.ts` não assere o shape do include — não quebra.)

- [ ] **Step 4: Commit**

```bash
git add backend/src/appointment/appointment.service.ts backend/src/evolution/evolution.service.ts
git commit -m "$(cat <<'EOF'
feat(evolution): incluir procedimento/fim da consulta e flag de evolução no agendamento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BjFm3MnLpUHTiUeLC5K4BW
EOF
)"
```

---

### Task 6: Frontend — types + `evolutionsApi.remove` + `LinkedAppointmentLine`

**Files:**
- Modify: `frontend/src/types/clinic.ts` (`interface Appointment` L130-149, `interface Evolution` L191-204)
- Modify: `frontend/src/lib/api.ts` (`evolutionsApi` L298-305)
- Create: `frontend/src/components/evolutions/LinkedAppointmentLine.tsx`
- Create: `frontend/src/components/evolutions/LinkedAppointmentLine.test.tsx`

**Interfaces:**
- Consumes: `Evolution['appointment']` (agora com `endAt` e `procedure`), `StatusBadge` de `@/components/ui/status-badge`.
- Produces:
  - `Appointment.evolution?: { id: string } | null`
  - `Evolution.appointment?: { id: string; startAt: string; endAt: string; status: AppointmentStatus; procedure?: { name: string } } | null`
  - `evolutionsApi.remove: (id: string) => Promise<void>`
  - `<LinkedAppointmentLine appointment={NonNullable<Evolution['appointment']>} />` — componente de exibição.

- [ ] **Step 1: Atualizar os types**

Em `frontend/src/types/clinic.ts`:

Na `interface Appointment`, adicionar antes do `}`:
```ts
  evolution?: { id: string } | null;
```

Substituir o campo `appointment?` da `interface Evolution` por:
```ts
  appointment?: {
    id: string;
    startAt: string;
    endAt: string;
    status: AppointmentStatus;
    procedure?: { name: string };
  } | null;
```

- [ ] **Step 2: Adicionar `remove` ao `evolutionsApi`**

Em `frontend/src/lib/api.ts`, dentro de `evolutionsApi` (após `update`):
```ts
  remove: (id: string) => api.delete<void>(`/evolutions/${id}`),
```

- [ ] **Step 3: Escrever o teste do componente (falha)**

Criar `frontend/src/components/evolutions/LinkedAppointmentLine.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { LinkedAppointmentLine } from './LinkedAppointmentLine';

it('mostra procedimento, data/hora e status da consulta', () => {
  render(
    <LinkedAppointmentLine
      appointment={{
        id: 'apt-1',
        startAt: '2026-03-10T13:00:00.000Z',
        endAt: '2026-03-10T14:00:00.000Z',
        status: 'DONE',
        procedure: { name: 'Fisioterapia Pélvica' },
      }}
    />,
  );

  expect(screen.getByText(/Fisioterapia Pélvica/)).toBeInTheDocument();
  expect(screen.getByText(/10\/03\/2026/)).toBeInTheDocument();
  expect(screen.getByText('Concluído')).toBeInTheDocument();
});

it('funciona sem procedimento', () => {
  render(
    <LinkedAppointmentLine
      appointment={{
        id: 'apt-2',
        startAt: '2026-03-10T13:00:00.000Z',
        endAt: '2026-03-10T14:00:00.000Z',
        status: 'SCHEDULED',
      }}
    />,
  );
  expect(screen.getByText(/Atendimento:/)).toBeInTheDocument();
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `cd frontend && bunx vitest run src/components/evolutions/LinkedAppointmentLine.test.tsx`
Expected: FAIL (arquivo do componente não existe).

- [ ] **Step 5: Implementar o componente**

Criar `frontend/src/components/evolutions/LinkedAppointmentLine.tsx`:

```tsx
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Evolution } from '@/types/clinic';

interface LinkedAppointmentLineProps {
  appointment: NonNullable<Evolution['appointment']>;
}

export function LinkedAppointmentLine({ appointment }: LinkedAppointmentLineProps) {
  const when = format(new Date(appointment.startAt), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>
        Atendimento: {appointment.procedure?.name ? `${appointment.procedure.name} — ` : ''}
        {when}
      </span>
      <StatusBadge status={appointment.status} />
    </div>
  );
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd frontend && bunx vitest run src/components/evolutions/LinkedAppointmentLine.test.tsx`
Expected: PASS.

- [ ] **Step 7: Verificar o build de tipos**

Run: `cd frontend && bunx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/clinic.ts frontend/src/lib/api.ts frontend/src/components/evolutions/LinkedAppointmentLine.tsx frontend/src/components/evolutions/LinkedAppointmentLine.test.tsx
git commit -m "$(cat <<'EOF'
feat(evolution): componente LinkedAppointmentLine + evolutionsApi.remove

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BjFm3MnLpUHTiUeLC5K4BW
EOF
)"
```

---

### Task 7: Frontend — ocultar consultas já vinculadas no `EvolutionFormDialog`

**Files:**
- Modify: `frontend/src/components/evolutions/EvolutionFormDialog.tsx` (filtro do `<Select>` L165-172; texto de ajuda L175-177)
- Create: `frontend/src/components/evolutions/EvolutionFormDialog.test.tsx` (se ainda não existir)

**Interfaces:**
- Consumes: `appointmentsApi.list({ patientId })` retornando `Appointment[]` com `evolution?: { id } | null`; `Evolution` (prop `evolution`).
- Produces: nenhuma nova interface — comportamento de UI.

- [ ] **Step 1: Escrever o teste que falha**

Criar/atualizar `frontend/src/components/evolutions/EvolutionFormDialog.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EvolutionFormDialog } from './EvolutionFormDialog';
import * as api from '@/lib/api';

vi.mock('@/lib/api');

const appointments = [
  { id: 'apt-livre', startAt: '2026-03-10T13:00:00.000Z', status: 'DONE', evolution: null, procedure: { name: 'Livre' } },
  { id: 'apt-usada', startAt: '2026-03-11T13:00:00.000Z', status: 'DONE', evolution: { id: 'evo-outra' }, procedure: { name: 'Usada' } },
];

function renderDialog(props = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EvolutionFormDialog open onOpenChange={() => {}} onSuccess={() => {}} patientId="p-1" {...props} />
    </QueryClientProvider>,
  );
}

it('esconde consultas que já possuem evolução', async () => {
  vi.mocked(api.appointmentsApi.list).mockResolvedValue(appointments as never);
  renderDialog();

  await userEvent.click(await screen.findByRole('combobox'));

  await waitFor(() => expect(screen.getByText(/Livre/)).toBeInTheDocument());
  expect(screen.queryByText(/Usada/)).not.toBeInTheDocument();
});

it('mantém visível a consulta vinculada à evolução em edição', async () => {
  vi.mocked(api.appointmentsApi.list).mockResolvedValue(appointments as never);
  renderDialog({
    evolution: {
      id: 'evo-outra',
      description: 'x',
      evolutionDate: '2026-03-11T00:00:00.000Z',
      appointment: { id: 'apt-usada', startAt: '2026-03-11T13:00:00.000Z', endAt: '2026-03-11T14:00:00.000Z', status: 'DONE' },
    },
  });

  await userEvent.click(await screen.findByRole('combobox'));
  await waitFor(() => expect(screen.getByText(/Usada/)).toBeInTheDocument());
});
```

> Se já existir um `EvolutionFormDialog.test.tsx`, acrescentar só estes dois `it(...)` e reaproveitar helpers do arquivo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && bunx vitest run src/components/evolutions/EvolutionFormDialog.test.tsx`
Expected: FAIL no teste "esconde consultas que já possuem evolução" (a consulta "Usada" ainda aparece).

- [ ] **Step 3: Implementar o filtro**

Em `frontend/src/components/evolutions/EvolutionFormDialog.tsx`, substituir o `.filter(...)` atual (L166) por:

```tsx
                {appointments
                  .filter((apt) => {
                    const linkedId =
                      evolution?.appointment?.id ?? evolution?.appointmentId ?? null;
                    if (apt.status === 'CANCELED' && apt.id !== appointmentId) return false;
                    // consultas com evolução some da lista, exceto a desta evolução
                    if (apt.evolution && apt.id !== linkedId) return false;
                    return true;
                  })
                  .map((apt) => (
```

Atualizar o texto de ajuda (L175-177) para:

```tsx
            <p className="text-xs text-muted-foreground">
              Selecione a qual atendimento esta evolução se refere, especialmente se ela for
              registrada depois da sessão. Atendimentos que já possuem evolução não aparecem na lista.
            </p>
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && bunx vitest run src/components/evolutions/EvolutionFormDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/evolutions/EvolutionFormDialog.tsx frontend/src/components/evolutions/EvolutionFormDialog.test.tsx
git commit -m "$(cat <<'EOF'
feat(evolution): ocultar consultas já vinculadas no seletor de evolução

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BjFm3MnLpUHTiUeLC5K4BW
EOF
)"
```

---

### Task 8: Frontend — exibir e excluir evolução na página `Evolutions.tsx`

**Files:**
- Modify: `frontend/src/pages/Evolutions.tsx` (imports L1-22; render da timeline L158-192; render do dialog L200-211)

**Interfaces:**
- Consumes: `LinkedAppointmentLine`, `evolutionsApi.remove`, `useHasRole` de `@/components/auth/RoleGuard`, `AlertDialog*` de `@/components/ui/alert-dialog`, `Trash2` de `lucide-react`, `useMutation`, `toast` de `sonner`.
- Produces: nenhuma nova interface.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/pages/Evolutions.test.tsx` (ou acrescentar a um existente):

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Evolutions from './Evolutions';

// mock mínimo de auth: usuário ADMIN
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'ADMIN' }, clinic: { id: 'c1' } }),
}));

it('renderiza a página de evoluções', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Evolutions />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByText('Evoluções')).toBeInTheDocument();
});
```

> Este teste é um smoke test — o comportamento de exclusão em si já está coberto no nível de componente/serviço. Se o projeto tiver um harness de teste de página mais completo (mock de `@/lib/api`), acrescentar um caso que clica na lixeira → confirma → espera `evolutionsApi.remove` ser chamado.

- [ ] **Step 2: Rodar e ver o estado atual**

Run: `cd frontend && bunx vitest run src/pages/Evolutions.test.tsx`
Expected: PASS já no smoke test (ou FAIL se o mock de auth precisar de mais campos — ajustar o mock até passar).

- [ ] **Step 3: Adicionar imports em `Evolutions.tsx`**

```tsx
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react'; // juntar aos ícones já importados de lucide-react
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useHasRole } from '@/components/auth/RoleGuard';
import { LinkedAppointmentLine } from '@/components/evolutions/LinkedAppointmentLine';
```

- [ ] **Step 4: Adicionar a mutation de exclusão dentro do componente**

Logo após `const patient = patients.find(...)`:

```tsx
  const canDelete = useHasRole('ADMIN', 'PROFESSIONAL');

  const deleteMutation = useMutation({
    mutationFn: (evolutionId: string) => evolutionsApi.remove(evolutionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evolutions', selectedPatient] });
      queryClient.invalidateQueries({ queryKey: ['appointments', 'patient', selectedPatient] });
      toast.success('Evolução excluída');
    },
    onError: () => toast.error('Erro ao excluir evolução'),
  });
```

- [ ] **Step 5: Trocar a exibição crua do atendimento pelo componente**

No bloco da timeline (L185-189), trocar:

```tsx
                        {evolution.appointment && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Atendimento: {format(new Date(evolution.appointment.startAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
```

por:

```tsx
                        {evolution.appointment && (
                          <LinkedAppointmentLine appointment={evolution.appointment} />
                        )}
```

- [ ] **Step 6: Adicionar o botão de excluir ao lado do lápis**

No `<div className="flex items-center gap-2">` que contém o botão de editar (L168-180), após o `<button>` de editar:

```tsx
                            {canDelete && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label="Excluir evolução"
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir evolução?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. A consulta vinculada, se houver,
                                      voltará a ficar disponível para outra evolução.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => deleteMutation.mutate(evolution.id)}
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
```

- [ ] **Step 7: Rodar os testes da página e o tsc**

Run: `cd frontend && bunx vitest run src/pages/Evolutions.test.tsx && bunx tsc --noEmit`
Expected: PASS / sem erros.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/Evolutions.tsx frontend/src/pages/Evolutions.test.tsx
git commit -m "$(cat <<'EOF'
feat(evolution): exibir consulta vinculada e excluir evolução na página Evoluções

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BjFm3MnLpUHTiUeLC5K4BW
EOF
)"
```

---

### Task 9: Frontend — exibir e excluir evolução na timeline do `PatientProfile.tsx`

**Files:**
- Modify: `frontend/src/pages/PatientProfile.tsx` (imports L1-30; hooks/mutations ~L112-125; render da timeline de evoluções L694-731)

**Interfaces:**
- Consumes: `LinkedAppointmentLine`, `evolutionsApi.remove`, `useHasRole`, `AlertDialog*` (já importado no arquivo, L28-29), `Trash2` (já importado, L12), `useMutation` (já usado), `toast` (já usado).
- Produces: nenhuma nova interface.

- [ ] **Step 1: Adicionar imports faltantes**

No topo de `frontend/src/pages/PatientProfile.tsx`:

```tsx
import { useHasRole } from '@/components/auth/RoleGuard';
import { LinkedAppointmentLine } from '@/components/evolutions/LinkedAppointmentLine';
```

(`Trash2` e os `AlertDialog*` já estão importados; confirmar antes de duplicar.)

- [ ] **Step 2: Adicionar a mutation de exclusão**

Junto às outras mutations de exclusão (após `deletePerinealMutation`, ~L128):

```tsx
  const canDeleteEvolution = useHasRole('ADMIN', 'PROFESSIONAL');

  const deleteEvolutionMutation = useMutation({
    mutationFn: (evolutionId: string) => evolutionsApi.remove(evolutionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-evolutions', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-appointments', id] });
      toast.success('Evolução excluída');
    },
    onError: () => toast.error('Erro ao excluir evolução'),
  });
```

- [ ] **Step 3: Exibir a consulta vinculada na timeline**

No `map` das evoluções (L707-728), após o bloco da descrição (`<div className="text-[12.5px] text-muted-foreground mt-0.5 ...">{evo.description}</div>`, L722):

```tsx
                                {evo.appointment && (
                                  <LinkedAppointmentLine appointment={evo.appointment} />
                                )}
```

- [ ] **Step 4: Adicionar o botão de excluir ao lado do lápis**

No `<div className="flex items-start justify-between gap-2">` (L708), o botão de editar (L710-720) está solto. Envolvê-lo num flex e adicionar a lixeira:

```tsx
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      aria-label="Editar evolução"
                                      onClick={() => {
                                        setEditingEvolution(evo);
                                        setEvolutionOpen(true);
                                      }}
                                      className="text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    {canDeleteEvolution && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <button
                                            type="button"
                                            aria-label="Excluir evolução"
                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Excluir evolução?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Esta ação não pode ser desfeita. A consulta vinculada, se houver,
                                              voltará a ficar disponível para outra evolução.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                              onClick={() => deleteEvolutionMutation.mutate(evo.id)}
                                            >
                                              Excluir
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                  </div>
```

Remover o `<button>` de editar antigo que ficava solto (agora está dentro do novo `<div>`).

- [ ] **Step 5: Rodar os testes de PatientProfile e o tsc**

Run: `cd frontend && bunx vitest run src/pages/PatientProfile && bunx tsc --noEmit`
Expected: PASS / sem erros. Se não existir teste de `PatientProfile`, rodar a suíte inteira: `cd frontend && bun run test`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/PatientProfile.tsx
git commit -m "$(cat <<'EOF'
feat(evolution): exibir consulta vinculada e excluir evolução no perfil do paciente

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BjFm3MnLpUHTiUeLC5K4BW
EOF
)"
```

---

### Task 10: Verificação de ponta a ponta + bump de versão

**Files:**
- Modify: `frontend/package.json` (campo `version`, L4)

**Interfaces:**
- Consumes: tudo anterior.
- Produces: `frontend/package.json` version `0.5.0`.

- [ ] **Step 1: Rodar a suíte backend completa com cobertura**

Run: `cd backend && bun run test:cov`
Expected: PASS; thresholds de cobertura respeitados (≥ 80% / ≥ 75% branches).

- [ ] **Step 2: Rodar a suíte frontend completa**

Run: `cd frontend && bun run test`
Expected: PASS.

- [ ] **Step 3: Lint do frontend (backend NÃO)**

Run: `cd frontend && bun run lint`
Expected: sem erros. (Não rodar lint no backend — reescreve o repo inteiro.)

- [ ] **Step 4: Build do frontend**

Run: `cd frontend && bun run build`
Expected: build conclui sem erros de tipo.

- [ ] **Step 5: Smoke manual (opcional, se o stack local estiver de pé)**

Com `docker compose up` ou `bun run backend:dev` + `bun run frontend:dev`:
1. Login como Admin (`11111111111` / `123456`), entrar numa clínica.
2. Abrir um paciente → aba Evoluções → criar evolução vinculada a uma consulta.
3. Tentar criar outra evolução: a consulta usada não aparece no seletor.
4. Ver a linha "Atendimento: … — dd/MM/yyyy às HH:mm" + badge de status na timeline (perfil e página de Evoluções).
5. Excluir a evolução → confirmar → some da lista; a consulta volta a aparecer no seletor.
6. Login como Recepcionista (`44444444444`) — botão de excluir não aparece (e, se o módulo não estiver no plano, a aba nem aparece).

- [ ] **Step 6: Bump de versão**

Em `frontend/package.json`, trocar `"version": "0.4.2"` por `"version": "0.5.0"`.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json
git commit -m "$(cat <<'EOF'
chore: bump version to 0.5.0

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BjFm3MnLpUHTiUeLC5K4BW
EOF
)"
```

- [ ] **Step 8: Abrir o PR**

```bash
git push -u origin bravilal/evolucao-consulta-vinculo
gh pr create --base main --title "feat(evolution): exclusão e vínculo 1:1 com consulta" --body "$(cat <<'EOF'
## O que muda

1. **Excluir evolução** — `DELETE /evolutions/:id`, restrito a ADMIN/PROFESSIONAL, hard delete, auditado automaticamente. Botão de lixeira + confirmação nas telas de Evoluções e Perfil do Paciente.
2. **Vínculo 1:1 evolução ↔ consulta** — `@unique` em `evolutions.appointment_id`. Migração desvincula duplicatas existentes (mantém a mais recente) sem apagá-las. Consultas já com evolução somem do seletor.
3. **Exibir consulta vinculada** — novo componente `LinkedAppointmentLine` (procedimento + data/hora + status) nas duas telas.

## Migração

`evolution_appointment_unique` — roda dedup antes de criar o índice único. Antes do deploy em prod, medir duplicatas com o SELECT documentado no spec.

## Spec / Plano

- `docs/superpowers/specs/2026-09-10-evolucao-consulta-vinculo-design.md`
- `docs/superpowers/plans/2026-09-10-evolucao-consulta-vinculo.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01BjFm3MnLpUHTiUeLC5K4BW
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**

| Requisito do spec | Task |
|---|---|
| Schema `@unique` + `Appointment.evolution` | Task 1 |
| Migração com dedup (mantém mais recente, não apaga) | Task 1 |
| SELECT de contagem pré-prod | Task 1 (nota) + Task 10 nota do PR |
| `assertAppointmentAvailable` (paciente + 1:1) | Task 2 |
| `create`/`update` passam `currentEvolutionId` | Task 2 |
| Tratamento de `P2002` | Task 3 |
| `EvolutionService.remove` (hard delete) | Task 4 |
| `DELETE` controller + `@Roles(ADMIN, PROFESSIONAL)` + 204 | Task 4 |
| Auditoria automática (sem código) | Task 4 (verificado no spec/plano) |
| `evolution: { id }` em `appointmentIncludes` | Task 5 |
| Include enriquecido de `appointment` (endAt + procedure) | Task 5 |
| Types `Appointment.evolution`, `Evolution.appointment` | Task 6 |
| `evolutionsApi.remove` | Task 6 |
| `LinkedAppointmentLine` compartilhado | Task 6 |
| Filtro do seletor no `EvolutionFormDialog` | Task 7 |
| Texto de ajuda ajustado | Task 7 |
| Exibir vínculo em `Evolutions.tsx` | Task 8 |
| Exclusão em `Evolutions.tsx` (role-gated + AlertDialog + invalidação) | Task 8 |
| Exibir vínculo na timeline de `PatientProfile.tsx` | Task 9 |
| Exclusão na timeline de `PatientProfile.tsx` | Task 9 |
| Testes backend (remove, conflito, P2002) | Tasks 2, 3, 4 |
| Testes frontend (dialog filter, delete flow) | Tasks 6, 7, 8 |
| Bump de versão | Task 10 |

Sem lacunas.

**2. Placeholder scan:** Sem "TBD"/"TODO". Todos os passos de código têm bloco de código. As duas notas explícitas ("Nota para deploy", "Observação sobre ordem de `findFirst`") são orientações de verificação, não lacunas de implementação.

**3. Type consistency:**
- `assertAppointmentAvailable(organizationId, patientId, appointmentId, currentEvolutionId?)` — mesma assinatura em Task 2 (definição) e Tasks 3/4 (contexto).
- `EvolutionService.remove(organizationId, id): Promise<void>` — Task 4 consistente.
- `Evolution['appointment']` shape (`id, startAt, endAt, status, procedure?`) — idêntico em Task 5 (backend select), Task 6 (type + componente) e usado em Tasks 8/9.
- `Appointment.evolution?: { id: string } | null` — Task 5 (backend), Task 6 (type), Task 7 (filtro).
- `useHasRole('ADMIN', 'PROFESSIONAL')` — mesmo nome/args em Tasks 8 e 9.
- `evolutionsApi.remove` — Task 6 define, Tasks 8/9 consomem.
- Query keys de invalidação: `['evolutions', selectedPatient]` / `['appointments', 'patient', selectedPatient]` (Evolutions.tsx) e `['patient-evolutions', id]` / `['patient-appointments', id]` (PatientProfile.tsx) — batem com as keys já usadas nesses arquivos (verificado no código atual).

Sem inconsistências.
