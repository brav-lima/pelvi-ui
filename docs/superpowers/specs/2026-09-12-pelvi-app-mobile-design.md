# Pelvi App — Mobile (Design)

> Substitui `2026-08-14-pelvi-app-mobile-lite-design.md`. Mantém as decisões de
> arquitetura, escopo de Agenda/Pacientes e fluxo de autenticação daquela spec,
> e adiciona push notifications (que lá estava explicitamente fora de escopo).

## 1. Visão geral

Nova aplicação mobile (`pelvi-app`, repo separado, React Native/Expo) voltada
ao fisioterapeuta, com escopo de consulta (somente leitura) sobre dados já
existentes no Sou Pelvi, mais notificação push de lembrete de consulta. Não é
um produto novo — é um cliente adicional para a mesma API/domínio do
`pelvi-ui`, sem separar o backend do monorepo atual.

Motivação: o fisioterapeuta quer conferir a própria agenda e ativar lembretes
de consulta sem depender de estar no computador da clínica — por exemplo,
enquanto está numa conversa de WhatsApp.

## 2. Escopo da v1

**Usuário:** fisioterapeuta (role `PROFESSIONAL`), não paciente.

**Módulos incluídos:**
- **Agenda** — visualizar atendimentos (dia/semana), por padrão filtrada para
  o próprio profissional logado (usa o parâmetro `professionalId` já aceito
  por `GET /appointments`).
- **Pacientes** — listar (com busca) e ver ficha (dados básicos, histórico de
  atendimentos, evoluções).
- **Notificações push** — lembrete de consulta 1h antes do horário (reaproveita
  a fila de lembrete já existente no backend).

**Fora de escopo v1:** anamnese, avaliação perineal, financeiro, documentos,
qualquer ação de escrita (criar/editar/cancelar/confirmar presença), suporte
offline com cache persistente, integração real com WhatsApp (bot).

**Modo de operação:** 100% leitura nos dados de domínio. A única escrita do
app é o registro do próprio token de push do dispositivo.

**Conectividade:** sempre online. Sem rede, tela mostra estado vazio/erro com
retry. Cache em memória do React Query é aceitável como efeito colateral, não
é requisito.

## 3. Arquitetura

```
pelvi-app (Expo, React Native, TypeScript) — repo separado
      │  Bearer JWT (Authorization header)
      ▼
pelvi-ui/backend (NestJS) — mesmo processo/deploy do backend web, sem mudança de infra
      │
      ├── endpoints de auth mobile (novos, dentro do módulo `auth` existente)
      ├── endpoints de domínio existentes (appointments, patients, evolutions, ...) — reusados sem alteração
      ├── endpoint de device token (novo módulo `device`)
      └── fila de lembrete existente (`queue`/`reminder`) → Expo Push API → dispositivo
```

Decisão (herdada da spec anterior): **sem BFF separado e sem namespace
`/mobile/*` duplicado** para rotas de domínio. `JwtStrategy` já aceita
`Authorization: Bearer` em todas as rotas de domínio
(`backend/src/auth/strategies/jwt.strategy.ts`), então `/api/v1/appointments`,
`/api/v1/patients`, etc. funcionam para o app assim que ele tiver um access
token válido — sem controllers mobile-specific para agenda/pacientes.

O gap real está em como o token chega ao cliente (login/refresh) e em como o
push é entregue (novo, tratado nas seções 5 e 8).

## 4. Backend — mudanças no módulo `auth` existente

```
backend/src/auth/
├── auth.controller.ts
│     + POST /api/v1/auth/mobile-login
│           CPF + senha → { accessToken, refreshToken, ...perfil } no BODY (sem cookie)
│           Se multi-clínica: mesmo shape de resposta que /login (lista de orgs), sem tokens
│     + POST /api/v1/auth/mobile-select-organization
│           organizationId (+ preAuthToken) → { accessToken, refreshToken, ...perfil } no BODY
│     ~ POST /api/v1/auth/refresh  →  extractor passa a aceitar cookie OU body
│           (mobile manda refreshToken no body; resposta mobile devolve tokens no BODY em vez de só cookie)
├── strategies/jwt-refresh.strategy.ts
│     ~ jwtFromRequest: adiciona extractor de `req.body.refreshToken`, mantendo o de cookie
└── auth.service.ts
      (sem mudança de regra de negócio — mobile-login/select-organization chamam os mesmos
       AuthService.login()/selectOrganization() já usados pelo fluxo web; só o controller
       decide se o resultado vai pro cookie ou pro corpo da resposta)
```

Notas:
- **Nenhuma rota de domínio muda** — já aceitam Bearer via `JwtStrategy`.
- Access/refresh token continuam com mesmo formato/segredo
  (`JWT_SECRET`/`JWT_REFRESH_SECRET`) e mesmo TTL do fluxo web — só muda o
  transporte (body vs. cookie).
- Reuso total de `AuthService` — sem duplicar validação de credenciais,
  multi-clínica ou revogação de refresh token (Redis).
- O `RefreshTokenDto` já existente (`backend/src/auth/dto/refresh-token.dto.ts`),
  hoje sem nenhum uso no código, passa a ser o DTO do body do refresh mobile.
- Erros seguem o `AllExceptionsFilter` padrão do resto do backend.

## 5. Backend — push notifications (novo)

**Modelo (Prisma):**
```prisma
model DeviceToken {
  id             String   @id @default(uuid())
  personId       String
  person         Person   @relation(fields: [personId], references: [id])
  expoPushToken  String   @unique
  platform       String   // "ios" | "android"
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```
O token pertence à pessoa, não à organização — o mesmo celular vale
independente de qual clínica está selecionada no momento.

**Endpoint (novo módulo `device`):**
- `POST /api/v1/devices` (JWT) — upsert por `expoPushToken`: registra/atualiza
  `{ expoPushToken, platform }` pro `personId` do usuário autenticado.
- `DELETE /api/v1/devices/:expoPushToken` (JWT) — remove no logout do app,
  pra parar de receber push depois de deslogar naquele aparelho.

**Fila de lembrete (`backend/src/queue`):**
- `ReminderJobData` (`reminder.job.ts`) ganha o campo `professionalId`.
- `AppointmentService.scheduleReminder` / `rescheduleReminder`
  (`appointment.service.ts`) passam a incluir `professionalId` ao enfileirar
  (já disponível no agendamento).
- `ReminderProcessor.process` (`reminder.processor.ts`) substitui o `TODO` de
  push: busca `DeviceToken`s pelo `personId` do profissional (via
  `OrganizationUser`/`Person`), monta a mensagem ("Consulta às HH:mm com
  <paciente>") e envia via **Expo Push API** usando o pacote `expo-server-sdk`.
  - Sem token cadastrado → no-op silencioso (fisio não instalou o app, ou
    fez logout em todos os dispositivos).
  - Falha no envio (erro da Expo API) → breadcrumb + `Sentry.captureException`,
    sem relançar — mesmo padrão fail-open já usado em cache/Redis no projeto;
    a fila continua para o próximo canal futuro (WhatsApp/e-mail).

## 6. Mobile — `pelvi-app`

```
pelvi-app/
├── app/                              # Expo Router (file-based routing)
│   ├── (auth)/login.tsx
│   ├── (auth)/select-clinic.tsx
│   └── (app)/
│       ├── agenda/index.tsx          # dia/semana
│       ├── patients/index.tsx        # lista + busca
│       ├── patients/[id].tsx         # ficha: dados, histórico, evoluções
│       └── settings/index.tsx        # logout, toggle de permissão de notificação
├── src/
│   ├── api/                          # client HTTP: fetch + Authorization Bearer
│   ├── auth/                         # AuthContext, expo-secure-store, refresh token
│   ├── notifications/                # registro do expo push token, permissão
│   ├── components/                   # cards, listas, empty/error states
│   └── theme/                        # Inter / Plus Jakarta Sans, alinhado à identidade pelvi-ui
```

Stack: Expo + TypeScript + Expo Router + TanStack React Query (mesmo padrão
de estado de servidor do frontend web) + `expo-secure-store` para persistir
tokens + `expo-notifications` para registro/recebimento de push. Sem Redux —
Query cobre estado de servidor, Context cobre auth/clínica selecionada,
espelhando a arquitetura de providers do web.

Camadas duplicadas (não compartilhadas via pacote) a partir de
`frontend/src/`, adaptadas para Bearer em vez de cookie:
- `types/clinic.ts` (subconjunto: `User`, `Clinic`, `Appointment`, `Patient`,
  `Professional`, `Evolution`, tipos de resposta de auth)
- `lib/api.ts` (fetch wrapper — trocando `credentials: 'include'` por
  `Authorization: Bearer` lido do secure storage)
- `lib/formatters.ts` (datas, telefone, CPF para exibição)

Decisão de não compartilhar pacote: ver conversa que originou esta spec — RN
não compartilha runtime com a SPA Vite (sem Tailwind/shadcn), a superfície
reaproveitável é pequena, e duplicar evita o overhead de versionar um pacote
privado só por isso. Reavaliar se esse código divergir/duplicar bugs com
frequência.

**Plataformas:** codebase único Expo, Android e iOS via EAS Build (free tier)
ou build local (Xcode/Android Studio) — sem custo no MVP. Distribuição via
APK direto no Android; TestFlight/Apple Developer Program (US$99/ano) fica
adiado até haver necessidade real de testar em iPhone físico além de um
device de desenvolvimento.

## 7. Fluxo de autenticação

1. Login (CPF + senha) → `POST /api/v1/auth/mobile-login` → recebe
   `accessToken` + `refreshToken` no corpo (single-clínica) ou lista de
   organizações (multi-clínica, sem tokens ainda).
2. Se multi-clínica → tela de seleção → `POST /api/v1/auth/mobile-select-organization`
   → recebe `accessToken` + `refreshToken` no corpo.
3. Tokens guardados em `expo-secure-store`. `organizationId` embutido no
   access token continua sendo a fronteira de isolamento de dados — igual ao
   web.
4. Requests subsequentes (agenda, pacientes, devices) usam os endpoints
   existentes com `Authorization: Bearer <accessToken>`.
5. 401 → tenta refresh via `POST /api/v1/auth/refresh` enviando
   `{ refreshToken }` no corpo; falhando, limpa o secure storage e volta pro
   login (mesmo padrão de interceptor do `api.ts` web, adaptado pra token em
   vez de cookie).

## 8. Fluxo de push notification

1. No primeiro login (ou ao ativar nas configurações), o app pede permissão
   de notificação (`expo-notifications`) e obtém o Expo push token do
   dispositivo.
2. App chama `POST /api/v1/devices` com `{ expoPushToken, platform }`.
3. Quando uma consulta é criada/reagendada, `AppointmentService` enfileira o
   lembrete (mecanismo já existente, sem mudança de timing — 1h antes).
4. `ReminderProcessor` roda 1h antes do horário, busca os `DeviceToken`s do
   profissional daquela consulta e dispara o push via Expo Push API.
5. No logout do app, chama `DELETE /api/v1/devices/:expoPushToken` pra parar
   de receber push naquele aparelho.

## 9. Testes

- **Backend**:
  - `.spec.ts` unitários para `mobile-login`, `mobile-select-organization` e
    o extractor de refresh atualizado, mockando `AuthService` já testado.
  - Novo `device.service.spec.ts` / controller spec (CRUD simples).
  - Estende `appointment.service.spec.ts` para cobrir `professionalId` no
    payload do job de lembrete.
  - Novo `reminder.processor.spec.ts` cobrindo: sem device token (no-op),
    envio com sucesso, falha da Expo API (não relança, captura no Sentry).
  - E2E (`test:e2e`): login mobile → chamar `/appointments`/`/patients` com o
    Bearer emitido → refresh, dentro da suíte existente.
- **Mobile**: Jest + React Native Testing Library cobrindo pelo menos: fluxo
  de login, estado vazio/erro de agenda sem rede, navegação lista → ficha de
  paciente, registro de device token após permissão concedida.

## 10. Fora de escopo / decisões adiadas

- Ações de escrita no app (confirmar/cancelar consulta) — avaliar em v2 se o
  uso validar a necessidade.
- Deep links, biometria — não avaliados nesta v1.
- Integração real com WhatsApp (bot) — descartada por ora; o app mobile
  nativo resolve o caso de uso de "consultar agenda estando no WhatsApp" sem
  precisar de Business API.
- App do paciente (portal) — mencionado como possível v2, fora desta spec.
- Cache offline persistente — adiado; se necessário, avaliar
  `MMKV`/`AsyncStorage` + estratégia de sincronização.
- BFF dedicado ou namespace `/mobile/*` duplicado para rotas de domínio —
  descartado: `JwtStrategy` já aceita Bearer nas rotas existentes.
- Canais adicionais de lembrete (WhatsApp, e-mail) no `ReminderProcessor` —
  o `TODO` original já previa múltiplos canais; só o push é implementado
  agora, os outros continuam como TODO.
