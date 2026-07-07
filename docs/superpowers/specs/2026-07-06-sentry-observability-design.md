# Sentry Observability Improvements — Design

**Data**: 2026-07-06
**Escopo**: backend apenas (`backend/`)

## Contexto

O backend já tem Sentry configurado (`@sentry/nestjs`, `@sentry/profiling-node`):

- `backend/src/instrument.ts` — `Sentry.init()` com `tracesSampleRate: 0.1`, `profilesSampleRate: 1.0`, `enableLogs: true`, `consoleLoggingIntegration`.
- `backend/src/common/logger/sentry.logger.ts` — `SentryLogger` (extends `ConsoleLogger`) sanitiza (`sanitize.ts`) e encaminha `log`/`warn`/`error`/`debug` pra `Sentry.logger.*`. `verbose` é pulado de propósito (ruído).
- `backend/src/common/filters/http-exception.filter.ts` — `AllExceptionsFilter` captura só 5xx via `Sentry.captureException`, com tag `organizationId` e `user.id` do JWT.
- `backend/src/audit/audit.service.ts` — `AuditService.log()` persiste `AuditLog` no Postgres (compliance/histórico), mas **não** emite nada pro Sentry.
- Não existe `SentryModule.forRoot()` no `app.module.ts` — sem isso, o SDK do Nest não gera spans automáticos por handler/controller, só o span raiz HTTP.
- Zero uso de `Sentry.addBreadcrumb` em todo o backend.
- Apenas ~19 chamadas de logger em todo o backend — cobertura esparsa de eventos de negócio.

## Objetivo

Dar mais visibilidade no Sentry de ações do usuário e erros, e aprofundar trace, **sem**:
- Expor dado sensível (CPF, nome, telefone, JSON clínico livre, etc.)
- Poluir o Sentry com log desnecessário (sucesso de toda ação, healthcheck, refresh de rotina)
- Mudar comportamento existente (fail-closed do reminder continua fail-closed; guards continuam lançando as mesmas exceptions)

## Arquitetura — 3 pilares

### Pilar 1 — Hook central no `AuditService.log()`

Toda ação já auditada (create/update/delete em patient, appointment, financial, treatment-package, professional, procedure, etc. — qualquer service que já chama `AuditService.log()`) ganha breadcrumb + log estruturado automaticamente, sem tocar nos services individuais.

Em `backend/src/audit/audit.service.ts`, depois do `prisma.auditLog.create(...)`:

```ts
Sentry.addBreadcrumb({
  category: 'audit',
  message: `${entry.action} ${entry.entity}`,
  level: 'info',
  data: { entityId: entry.entityId, organizationId: entry.organizationId },
});
Sentry.logger.info(`${entry.action} ${entry.entity}`, {
  userId: entry.userId,
  organizationId: entry.organizationId,
  entityId: entry.entityId,
});
```

**Sem dado sensível**: nunca inclui `entry.details` (pode conter CPF, nome, JSON clínico livre). Só metadata estrutural (IDs, action, entity) — já não é PII, não precisa passar por `sanitize()`.

### Pilar 2 — Eventos críticos fora do audit

Nenhum destes passa por `AuditService` hoje. Adições pontuais nos branches de erro/negação já existentes (não cria fluxo novo):

| Local | Evento | Nível | Ação |
|---|---|---|---|
| `auth/auth.service.ts` `login()` (branches de CPF/senha inválidos) | login falho | `warning` | breadcrumb categoria `auth` + `Sentry.logger.warn` (sem CPF/senha — só `{ hasAttempt: true }` ou equivalente não identificável) |
| `auth/auth.service.ts` `rotateRefreshToken()` (branches `UnauthorizedException`) | refresh inválido / vínculo inativo | `warning` | breadcrumb `auth` + `Sentry.logger.warn` com `personId` |
| `auth/guards/roles.guard.ts` (antes do `throw ForbiddenException`) | 403 por role | `warning` | breadcrumb `authz` com `requiredRoles` vs role atual |
| `subscription/plan.guard.ts` (antes do `throw ForbiddenException`) | 403 por feature de plano | `warning` | breadcrumb `authz` com `requiredFeature`, `organizationId` |
| `queue/processors/reminder.processor.ts` `process()` | falha ao processar lembrete | `error` | try/catch: `Sentry.captureException` + breadcrumb `queue`, **rethrow** (preserva retry do BullMQ) |
| `appointment/appointment.service.ts` `scheduleReminder`/`rescheduleReminder` | falha ao enfileirar (ex.: Redis fora) | `error` | try/catch: `Sentry.captureException` + breadcrumb `queue`, **rethrow** (preserva fail-closed do PR #137 — só ganha visibilidade, não implementa outbox do item 5 do `docs/hardening-backlog.md`) |

Login **bem-sucedido** não gera log novo (ruído alto, sem valor incremental — ações pós-login já cobertas pelo Pilar 1).

### Pilar 3 — Trace mais profundo + controle de ruído

- Adicionar `SentryModule.forRoot()` como primeiro import em `backend/src/app.module.ts` (padrão `@sentry/nestjs`) — gera span automático por handler/controller dentro de cada trace.
- Habilitar instrumentação de query Prisma (via integração do Sentry ou `@prisma/instrumentation` — API exata a confirmar na implementação, dado Prisma 7.x) — timeline mostra tempo de cada query dentro do trace.
- Excluir `/api/v1/health` de trace (via `ignoreTransactions`/filtro equivalente) — zero trace gerado pro polling de healthcheck.
- `tracesSampleRate` continua em 0.1 (env `SENTRY_TRACES_SAMPLE_RATE`) — não mexe em sampling, só na profundidade dos spans já amostrados.
- Refresh de rotina bem-sucedido não gera log novo (só o branch de erro do Pilar 2 loga) — mantém comportamento silencioso atual.

## Disciplina de nível de log

| Nível | Quando usar | Exemplos deste design |
|---|---|---|
| `info` | Ação de negócio normal, sem problema | Pilar 1 (audit hook) |
| `warning` | Fora do fluxo feliz mas esperado/tratado | login falho, 403, refresh inválido |
| `error` | Falha real que impacta usuário/sistema | falha de queue reminder, exceção 5xx (já existente via `AllExceptionsFilter`) |

`debug`/`verbose` continuam fora do Sentry (comportamento já existente do `SentryLogger`). Nenhum log incondicional por requisição ou em loop — só em pontos de decisão (branch de erro/negação), nunca em toda chamada bem-sucedida.

## Testes

- `audit.service.spec.ts` — assert `Sentry.addBreadcrumb` / `Sentry.logger.info` chamados com a metadata certa, sem `details`.
- `auth.service.spec.ts` — assert breadcrumb/warn nos branches de login falho e refresh inválido, sem alterar o `throw` existente.
- `roles.guard.spec.ts`, `plan.guard.spec.ts` (novos, se não existirem) — assert breadcrumb antes do `throw ForbiddenException`.
- `reminder.processor.spec.ts` (novo) — mock de falha no job → `Sentry.captureException` chamado + erro re-lançado (rethrow preservado).
- E2E existente (`auth.e2e-spec.ts`) continua validando login/refresh sem regressão.
- Manual (local, com `SENTRY_DSN` configurado): forçar 403, refresh inválido, falha de job de reminder — conferir evento chega no Sentry no nível certo.

## Fora de escopo

- Frontend (breadcrumbs de navegação/ação do usuário no React) — não incluído nesta rodada.
- Padrão outbox para reminders (item 5 do `docs/hardening-backlog.md`) — fica só com captura de erro, não implementa fila persistente/retry.
- Mudança de `tracesSampleRate`/`profilesSampleRate` — mantidos como estão.
