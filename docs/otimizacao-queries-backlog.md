# Otimização de Queries — Backlog

Avaliação das queries do backend do ponto de vista de um DBA (índices, N+1, sargability). Levantado em 2026-09-14.

> **Atualizado em 2026-09-14:** Itens 1 e 4 implementados (índice de `dueDate` em `FinancialRecord` + `createMany` no parcelamento de pacotes de tratamento). Itens 2, 3, 5, 6 e as notas de baixo impacto ficam para tratamento posterior.

---

## 1. ✅ `FinancialRecord` sem índice em `dueDate` — implementado

**Arquivo:** `backend/prisma/schema.prisma` (model `FinancialRecord`)

As duas queries mais chamadas do módulo Financeiro — `FinancialService.findAll` (listagem mensal) e `FinancialService.summary` (cards do dashboard/financeiro) — filtram principalmente por `dueDate` (com fallback para `createdAt` quando nulo). Só existiam índices em `[organizationId, createdAt, deletedAt]` e `[organizationId, status, type, deletedAt]` — nenhum cobria `dueDate`, o campo mais usado no filtro de período.

**Solução aplicada:** adicionado `@@index([organizationId, dueDate, deletedAt])` (migration `20260914162610_add_financial_record_due_date_index`).

---

## 2. `AppointmentService.createBulk` — N+1 sequencial dentro de transação `Serializable`

**Arquivo:** `backend/src/appointment/appointment.service.ts:338-425`

- Antes da transação: um `findFirst` por paciente único + um por profissional único, em loop (linhas 351-355) — devia ser 2 `findMany({ where: { id: { in: [...] } } })`.
- Dentro da transação: para cada item do agendamento (ex.: recorrência semanal), 2 `findFirst` (conflito de agendamento + conflito de bloqueio de agenda) + 1 `create`, todos sequenciais e `await`ados um por um. Uma recorrência de 52 semanas gera ~150+ round-trips sequenciais mantendo uma transação `Serializable` aberta o tempo todo, aumentando a janela de lock e o risco de *serialization failure* sob concorrência (o `withSerializationRetry` que já envolve essa chamada é sintoma disso).

**O que falta:** pré-carregar todos os agendamentos/bloqueios do(s) profissional(is) envolvidos no range de datas da recorrência numa única query e validar conflito em memória, em vez de 1 `findFirst` por item. Os `validatePatient`/`validateProfessional` de fora da transação podem virar 2 `findMany` com `id: { in: [...] }` comparando o tamanho do resultado.

---

## 3. `AppointmentService.updateRecurrenceForward` — mesmo padrão de N+1

**Arquivo:** `backend/src/appointment/appointment.service.ts:447-499`

Loop `for (const sibling of siblings)` fazendo `checkConflict` (2 queries) + `update` sequenciais por ocorrência da recorrência, dentro de outra transação `Serializable`. Mesma solução do item 2: carregar o conjunto de conflitos candidatos de uma vez e validar em memória antes de disparar os `update`s.

---

## 4. ✅ `TreatmentPackageService.create` — parcelas via loop de `create()` — implementado

**Arquivo:** `backend/src/treatment-package/treatment-package.service.ts`

Tanto o modo "parcelas customizadas" quanto o "parcelas fixas" faziam `await tx.financialRecord.create(...)` dentro de um `for`. Como nenhuma parcela depende do ID gerado pela anterior, isso era um caso claro de `createMany()`.

**Solução aplicada:** os dois branches agora constroem um array de registros e disparam um único `tx.financialRecord.createMany({ data: [...] })` (down payment + parcelas fixas combinados num só array/call). Testes em `treatment-package.service.spec.ts` atualizados para mockar `createMany` em vez de `create`.

---

## 5. Busca de pacientes não é sargável

**Arquivo:** `backend/src/patient/patient.service.ts:55-59` · schema: `patients` (linha `@@index([organizationId, name, deletedAt])`)

`findAll` usa `where.OR` com `{ name: { contains, mode: 'insensitive' } }` e `{ cpf: { contains } }`. Um btree comum (mesmo o composto `[organizationId, name, deletedAt]` que já existe) não serve para `contains` — só ajuda igualdade/prefixo. O campo `cpf` não tem índice nenhum. Hoje o filtro por `organizationId` já reduz bem o dataset por clínica, então não é urgente, mas se a base de pacientes por clínica crescer, isso se torna sequential scan.

**O que falta:** avaliar extensão `pg_trgm` + índice GIN (`CREATE INDEX ... USING gin (name gin_trgm_ops)`), que torna `ILIKE '%x%'` sargável de fato independente da posição do termo buscado. Precisa de migration com SQL raw (Prisma não modela `USING gin` nativamente sem `previewFeatures` extras).

---

## 6. `FinancialService.summary` faz 3 `aggregate()` no mesmo range

**Arquivo:** `backend/src/financial/financial.service.ts:266-279`

`received`, `pending` e `expenses` são 3 idas ao banco sobre a mesma janela de datas, cada uma filtrando por `status`+`type`. Pode virar uma única query (`$queryRaw` com `SUM(CASE WHEN ...)`) — 1 scan em vez de 3. Ganho real porque é chamado em toda carga do Dashboard/Financeiro; hoje amortizado pelo índice `[organizationId, status, type, deletedAt]`, mas ainda são 3x round-trips desnecessários.

**O que falta:** substituir os 3 `aggregate()` por 1 `$queryRaw` com `SUM(CASE WHEN status = 'PAID' AND type = 'INCOME' THEN amount ELSE 0 END)` etc., preservando o cast `Number(...)` no resultado (raw query retorna `Decimal`/`string` dependendo do driver).

---

## Notas de baixo impacto (não priorizadas)

- **`Procedure`** é a única tabela de domínio sem nenhum índice em `organizationId` (`schema.prisma`, model `Procedure`). Irrelevante no volume atual, mas inconsistente com o resto do schema — vale um `@@index([organizationId])` por padronização quando outras migrations forem feitas nessa tabela.
- Índices de overlap de intervalo (`[organizationId, startAt, endAt, ...]` em `Appointment`/`AgendaBlock`) só aproveitam a coluna `startAt` como range no btree; o lado `endAt` do overlap sempre cai como filtro pós-scan. Não é problema hoje porque `organizationId` já isola a clínica a um punhado de linhas — vale só como nota de "não escalaria" caso uma clínica única cresça muito (milhares de agendamentos/mês).
- Listagens sem paginação (`document.service.ts`, `task.service.ts`, e as timelines de evolução/anamnese/avaliação perineal por paciente) — hoje limitadas por tenant/paciente e pequenas, mas `tasks` em particular tende a acumular ao longo dos anos sem soft-delete de conclusão visível.

## Pontos positivos identificados na avaliação

`patient.service.ts` e `financial.service.ts` já fazem o certo: `Promise.all([findMany, count])` para paginação, `aggregate()` no banco em vez de somar em JS, `select` explícito nos includes (sem over-fetch), e a Agenda já tem cache Redis de 30s para o caso mais pesado (`AppointmentService.findAll` sem `patientId`).
