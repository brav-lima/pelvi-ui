# Integração PostHog — Analytics de Produto (Fase 1)

**Data:** 2026-07-06
**Branch:** (a definir na implementação)

---

## Contexto e Objetivo

Pelvi ainda não tem nenhuma instrumentação de analytics de produto (só Sentry para erros/APM). O objetivo desta fase é medir **quais funcionalidades são efetivamente usadas** pelos usuários staff (ADMIN, PROFESSIONAL, RECEPTIONIST) das clínicas, para orientar decisões de limpeza/simplificação do produto.

Fora de escopo nesta fase: funil de abandono de fluxos multi-step (ex.: wizard de avaliação perineal, criação de agendamento). Isso fica para uma spec futura, reaproveitando a mesma infraestrutura descrita aqui.

**Não rastreamos pacientes.** Todo evento se refere à ação de um usuário staff. IDs de paciente/agendamento podem aparecer como referência opaca (string), nunca nome, CPF, e-mail ou dado clínico.

---

## Decisões de Escopo

| Decisão | Escolha |
|---|---|
| Quem é rastreado | Só staff (ADMIN/PROFESSIONAL/RECEPTIONIST). Zero PII de paciente. |
| Hosting | PostHog Cloud (US region) |
| Captura | Pageview automático (`capture_pageview: true`) + eventos de negócio manuais. **Sem** autocapture de cliques genéricos. |
| Identificação | `identify(personId)` + `group('organization', organizationId)` |
| Session replay | Desligado nesta fase (`disable_session_recording: true`) |
| Abandono de fluxo | Fora de escopo — fase futura |

### Por que não autocapture de clique

Autocapture de clique (`autocapture: true`) gera volume alto de eventos de baixo sinal (`button_clicked`, `menu_clicked`) que não respondem à pergunta de negócio ("quais features são usadas", "onde os usuários desistem de uma ação"). Optamos por:

- Manter `capture_pageview: true` — sinal barato de "página mais visitada", zero instrumentação.
- Substituir cliques genéricos por **eventos de negócio nomeados e tipados**, disparados manualmente nos pontos de sucesso de cada ação (criar paciente, criar agendamento, etc.).

Essa escolha também prepara o terreno para a fase de abandono: pares como `wizard_started` / `wizard_completed` usam a mesma função `track()`, sem re-arquitetura.

---

## 1. Wrapper de Analytics

Novo arquivo `frontend/src/lib/analytics.ts` — segue a mesma convenção de módulo utilitário isolado de `frontend/src/lib/api.ts` e `frontend/src/lib/formatters.ts`. Todo o app chama **apenas** as funções deste módulo — nunca `posthog.capture`/`identify`/`group`/`reset` diretamente em componentes.

```ts
import posthog from "posthog-js";

export enum AnalyticsEvent {
  PatientCreated = "patient_created",
  AppointmentCreated = "appointment_created",
  AppointmentCanceled = "appointment_canceled",
  ProcedureCreated = "procedure_created",
  FinancialRecordCreated = "financial_record_created",
  FinancialRecordPaid = "financial_record_paid",
  TreatmentPackageCreated = "treatment_package_created",
  EvolutionCreated = "evolution_created",
  PerinealAssessmentCreated = "perineal_assessment_created",
  Login = "login",
}

let initialized = false;

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return; // no-op em dev local sem key configurada

  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    autocapture: false,
    disable_session_recording: true,
  });
  initialized = true;
}

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function identifyUser(personId: string, props: { role: string; organizationId: string }) {
  if (!initialized) return;
  posthog.identify(personId, { role: props.role });
  posthog.group("organization", props.organizationId);
}

export function resetUser() {
  if (!initialized) return;
  posthog.reset();
}
```

Vantagens do wrapper (reforçando a motivação original): trocar provedor (PostHog → outro) é uma mudança de arquivo único; desligar analytics localmente é uma checagem de env; eventos tipados eliminam divergência de nomenclatura (`patient-created` vs `patientCreated` vs `PatientCreated` virando 3 eventos diferentes no PostHog).

**Dependência nova:** `posthog-js` (frontend, via `bun add`).

---

## 2. Inicialização

`frontend/src/main.tsx` ganha uma chamada a `initAnalytics()` antes do `createRoot(...).render(...)`, ao lado do `Sentry.init()` já existente. Não substitui nem interage com Sentry — são instrumentações independentes.

---

## 3. Identify / Group / Reset — `AuthContext.tsx`

Mesmo padrão já usado para `Sentry.setUser()` / `Sentry.setUser(null)`:

- **Login single-clinic**, **`selectClinic`**, **restauração de sessão** (todos os pontos onde `Sentry.setUser()` já é chamado hoje) → chamar `identifyUser(personId, { role, organizationId })`. No fluxo de login (não na restauração de sessão), disparar também `track(AnalyticsEvent.Login)`.
- **`clearSession`** (cobre logout e expiração de sessão) → chamar `resetUser()`.

---

## 4. Eventos de Negócio — Fase 1 (conjunto completo)

Um evento por ação-chave de cada módulo, disparado no `onSuccess` da mutation correspondente (React Query) na página que já possui esse handler hoje:

| Evento | Página / Mutation | Properties sugeridas |
|---|---|---|
| `patient_created` | `Patients.tsx` — criar paciente | — |
| `appointment_created` | `Agenda.tsx` — criar agendamento | `status` |
| `appointment_canceled` | `Agenda.tsx` — mudança de status para CANCELED | — |
| `procedure_created` | `Procedures.tsx` — criar procedimento | — |
| `financial_record_created` | `Financial.tsx` — criar registro | `type` (INCOME/EXPENSE) |
| `financial_record_paid` | `Financial.tsx` — "dar baixa" | — |
| `treatment_package_created` | `TreatmentPackageFormDialog` | — |
| `evolution_created` | `Evolutions.tsx` — criar evolução | — |
| `perineal_assessment_created` | Wizard de avaliação perineal — conclusão | — |
| `login` | `AuthContext` — login bem-sucedido | `role` |

**Regra de PII para properties:** só valores não-identificáveis (enums de status/tipo, booleanos, contadores). Nunca nome, CPF, e-mail, telefone, endereço, texto livre de anamnese/evolução/avaliação.

**Local de instrumentação:** dentro do `onSuccess` de cada `useMutation`, ao lado do `toast` de sucesso já existente — não centralizado em `frontend/src/lib/api.ts`, porque o cliente HTTP genérico não tem contexto semântico de negócio (só sabe method + path).

---

## 5. Proteção de PII adicional (pageview)

Como `capture_pageview` está ligado, o PostHog registra a URL da página visitada. Rotas como `/patients/:id` (PatientProfile) incluem o ID do paciente na URL — é um UUID opaco, não é PII por si só, então nenhuma máscara adicional é necessária aqui. Nenhum título de página ou `document.title` deve incluir nome de paciente (verificar `PatientProfile.tsx` durante implementação).

---

## 6. Variáveis de Ambiente

Build-time, mesmo padrão do Sentry (`VITE_SENTRY_DSN`):

- `VITE_POSTHOG_KEY` — chave do projeto PostHog
- `VITE_POSTHOG_HOST` — opcional, default `https://us.i.posthog.com`

Configurar em Coolify no serviço `pelvi-web` (build arg).

---

## 7. Testes

- Sem testes unitários novos obrigatórios (wrapper é fino, sem lógica de negócio própria) — mas `track()`/`identifyUser()`/`resetUser()` devem ser no-op seguro quando `initialized === false`, garantido pela guarda no próprio wrapper.
- Verificação manual: rodar `frontend:dev` com uma key de projeto PostHog de teste, disparar cada uma das 10 ações da tabela acima, e confirmar no dashboard do PostHog que os eventos chegam com o nome e properties esperados e sem nenhum campo de PII de paciente.

---

## Fora de Escopo (Fase 2 — futura)

- Funil de abandono de fluxos multi-step (wizard de avaliação perineal, criação de agendamento com repetição).
- Qualquer proxy reverso (`/ingest` via nginx) para resiliência a ad-blocker — hoje o SDK chama PostHog Cloud direto; migrar para proxy é só trocar `api_host`, sem mudança de código adicional.
- Session replay.
