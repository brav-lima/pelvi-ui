# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pelvi (pelvi-ui) is a **multi-tenant clinic management system** — a monorepo with a React frontend and NestJS backend. The UI is in Brazilian Portuguese. Full product spec lives in `docs/project-overview.md`.

- **Frontend** (`frontend/`) — React + TypeScript + Vite SPA (port 8080)
- **Backend** (`backend/`) — NestJS + Prisma + PostgreSQL API (port 3000)
- **Database**: Neon (serverless PostgreSQL) with branch-based environments
- **Deployment**: Railway (two services: `pelvi-api` + `pelvi-web`)
- **Package manager**: Bun (both frontend and backend)

### Domain Context

Targets small/medium clinics (physiotherapy, psychology, medical) with these modules:

- **Authentication** — Login via CPF + password. One CPF can be linked to multiple clinics (multi-tenant). After login, user selects clinic context (or auto-enters if only one).
- **Agenda** — Clinic schedule with day/week/month views. Duration-proportional blocks, drag-and-drop rescheduling (@dnd-kit), per-professional filter. Statuses: SCHEDULED, CONFIRMED, CANCELED, DONE.
- **Patients** — Per-clinic patient registry with profile containing basic data, appointment history, anamnesis, evolutions, perineal assessments, and treatment packages. Paginated listing with server-side search. Card/list toggle view.
- **Professionals** — Staff management with roles (ADMIN, PROFESSIONAL, RECEPTIONIST). Card/list toggle view.
- **Procedures** — Clinic services with name, durationMinutes, price, active/inactive toggle. Card/list toggle view.
- **Anamnesis** — Free-form JSON patient records (flexible structure per clinic).
- **Evolutions** — Continuous clinical evolution notes displayed as a timeline.
- **Perineal Assessment** — Multi-step wizard (6 steps) for perineal/pelvic floor clinical evaluation. Flexible JSON data stored per assessment.
- **Treatment Packages** — Named packages of procedures with session tracking (totalSessions / usedSessions). Statuses: ACTIVE, COMPLETED, CANCELED.
- **Financial** — Income/expense tracking linked to patients and appointments. Monthly summary with totals. "Dar baixa" (mark as paid) inline. Statuses: PENDING, PAID.

### Multi-Tenant Model

Data is isolated by `organization_id` (clinic). The conceptual domain model uses:
- `Organization` (clinic) — the tenant
- `Person` (global, identified by CPF) — linked to clinics via `OrganizationUser` (role + permissions)
- All other entities (`Patient`, `Appointment`, `Procedure`, etc.) belong to an organization

---

## Commands

### From repo root

```bash
bun run frontend:dev    # Start frontend dev server on localhost:8080
bun run frontend:build  # Frontend production build
bun run frontend:test   # Frontend tests (vitest run)
bun run backend:dev     # Start backend on localhost:3000 (watch mode)
bun run backend:build   # Backend production build
bun run backend:test    # Backend tests (jest)
```

### Frontend (from `frontend/`)

```bash
bun run dev             # Start dev server
bun run lint            # ESLint
bun run test            # Run tests once (vitest run)
bun run test:watch      # Watch mode
bun run storybook       # Storybook dev server on port 6006
bun run build-storybook # Build Storybook
```

Run a single test file:
```bash
bunx vitest run src/pages/Login.test.tsx
```

### Backend (from `backend/`)

```bash
bun run start:dev                                    # NestJS watch mode
bun run test                                         # Unit tests (jest)
bun run test:cov                                     # Coverage report
bun run test:e2e                                     # E2E integration tests (requires real DB)
bun run seed                                         # Seed database
bunx prisma validate                                 # Validate schema
bunx prisma migrate dev --name <name>                # Create/apply migration (dev)
NODE_ENV=prod bunx prisma migrate deploy             # Apply migrations (prod)
bunx prisma generate                                 # Regenerate Prisma Client
```

### Local dev with Docker Compose

```bash
docker compose up       # Starts postgres + backend + frontend (full stack)
```

Uses `docker-compose.yml` at repo root. Requires env vars: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_API_KEY` (defaults provided for dev).

---

## Frontend Architecture (`frontend/`)

### Typography System

Shared across all Pelvi products (pelvi-ui, pelvi-admin, pelvi-landing-page):

- **Body / `font-sans`** → `Inter` — loaded from Google Fonts (400–700)
- **Headings / `font-display`** → `Plus Jakarta Sans` — loaded from Google Fonts (500–800)
- CSS vars defined in `frontend/src/index.css` `:root`: `--font-sans`, `--font-display`
- Tailwind fontFamily uses `var(--font-sans)` and `var(--font-display)`
- `h1–h3` automatically use `--font-display` with `letter-spacing: -0.01em`

### Provider Hierarchy (`frontend/src/App.tsx`)

```
QueryClientProvider (TanStack React Query)
  → ThemeProvider (dark/light mode, persisted to localStorage)
    → AuthProvider (real JWT auth + multi-tenant clinic selection)
      → SubscriptionProvider (plan features, fetched after auth)
        → TooltipProvider
          → BrowserRouter (React Router v6)
            → Suspense (lazy-loaded pages with PageLoader fallback)
```

All pages are lazy-loaded via `React.lazy()` + `Suspense`. Two route groups:

- **Unauthenticated**: `/login`, `/select-clinic` — no layout wrapper
- **Authenticated**: All other pages wrapped in `MainLayout` — redirects to `/login` if not authenticated, to `/select-clinic` if no clinic selected

### Layout System

`MainLayout` (`frontend/src/components/layout/MainLayout.tsx`):
- `Sidebar` — collapsible left nav (desktop, `w-60` = 240px expanded / `w-16` collapsed), Sheet overlay (mobile < 768px, `w-60`)
- `TopBar` — height `h-14` (56px), clinic name + CNPJ, notifications popover, theme toggle, user dropdown

`Sidebar` details:
- Section label "Principal" above main nav items
- Section label "Opções" above settings (ADMIN only)
- User footer at bottom: hash-color avatar (seeded from name) + name + role label
- Collapsed state: avatar only with tooltip showing name + role
- Version string shown as `title` tooltip on the user footer
- Role labels: ADMIN → "Administrador", PROFESSIONAL → "Profissional", RECEPTIONIST → "Recepcionista"

`TopBar` details:
- Left: hamburger (mobile) + clinic name + CNPJ
- Right: notifications bell (today's appointments + pending payments, dismissible per day), theme toggle, user dropdown (Perfil, Trocar Clínica, Sair)

### State Management

- **Auth state**: React Context (`frontend/src/contexts/AuthContext.tsx`) — `useAuth()` hook. Auth via httpOnly cookies (JWT access token + refresh token). Session restoration on mount via `GET /api/auth/me`. `logout()` calls `POST /api/auth/logout` (clears cookies server-side) + clears React state.
- **Subscription state**: React Context (`frontend/src/contexts/SubscriptionContext.tsx`) — `useSubscription()` / `useFeature(feature)` hooks. Fetches from `GET /api/subscription/status`. Fail-open during loading (returns `true` for all features while query is in flight). Cache key: `['subscription', 'status']`.
- **Theme state**: React Context (`frontend/src/contexts/ThemeContext.tsx`) — light/dark toggle
- **Server state**: TanStack React Query — all API data fetched, cached, and invalidated via React Query.
- **View preferences**: Card/list toggle persisted in `localStorage` (`patients-view`, `procedures-view`, `professionals-view`)

### API Client (`frontend/src/lib/api.ts`)

- `request<T>()` — sends `credentials: 'include'` on every request (cookies travel automatically), no manual token injection
- 401 interceptor: calls `tryRefreshToken()` (deduped via `refreshInFlight` promise) then retries once; if refresh fails, dispatches `auth:logout` event and throws
- `tryRefreshToken()` — `POST /api/auth/refresh`; skipped for login/refresh/logout/select-organization routes
- Module-specific API objects: `authApi`, `patientsApi`, `proceduresApi`, `personsApi`, `professionalsApi`, `appointmentsApi`, `anamnesisApi`, `perinealAssessmentsApi`, `evolutionsApi`, `treatmentPackagesApi`, `financialApi`, `organizationApi`

### Key Directories

| Path | Purpose |
|------|---------|
| `frontend/src/pages/` | Route page components (one per route, lazy-loaded) |
| `frontend/src/components/ui/` | shadcn/ui components + custom UI primitives |
| `frontend/src/components/layout/` | MainLayout, Sidebar, TopBar |
| `frontend/src/components/perineal-assessment/` | PerinealAssessmentWizard (6-step form), schema, options |
| `frontend/src/components/treatment-packages/` | TreatmentPackageFormDialog |
| `frontend/src/components/auth/` | ProtectedRoute (role guard), FeatureGate (inline feature guard), useHasRole |
| `frontend/src/contexts/` | AuthContext, ThemeContext, SubscriptionContext |
| `frontend/src/types/clinic.ts` | All domain type definitions (aligned with backend models) |
| `frontend/src/lib/api.ts` | API client (fetch wrapper + module APIs) |
| `frontend/src/lib/formatters.ts` | Input masks (CPF, phone, currency) + display formatters |

### Pages Overview

| Page | File | Notes |
|------|------|-------|
| Dashboard | `Dashboard.tsx` | Stats cards, today's schedule, upcoming appointments |
| Agenda | `Agenda.tsx` | Day/week/month views, drag-and-drop (@dnd-kit), professional filter |
| Pacientes | `Patients.tsx` | Paginated list, server-side search (debounced), card/list toggle |
| Perfil Paciente | `PatientProfile.tsx` | Tabs: Consultas, Anamnese, Evolucoes, Avaliação Perineal, Pacotes |
| Profissionais | `Professionals.tsx` | Card/list toggle, avatar, role badge |
| Procedimentos | `Procedures.tsx` | Active toggle, formatted currency, delete confirmation |
| Anamnese | `Anamnesis.tsx` | Patient list + anamnesis viewer (flexible JSON rendering) |
| Evolucoes | `Evolutions.tsx` | Patient list + evolution timeline |
| Financeiro | `Financial.tsx` | Stats cards, records table, "dar baixa" inline |
| Configurações | `Settings.tsx` | Clinic settings (ADMIN only) |
| Login | `Login.tsx` | CPF mask, handles single/multi-clinic responses |
| Selecionar Clinica | `SelectClinic.tsx` | Clinic selection for multi-tenant users |

### UI Components

Uses [shadcn/ui](https://ui.shadcn.com) (default style, CSS variables, slate base color). Config in `frontend/components.json`.

```bash
cd frontend && bunx shadcn-ui@latest add <component-name>
```

Custom UI components beyond shadcn: `page-header`, `stat-card`, `status-badge`, `empty-state`.

### Formatting & Masks (`frontend/src/lib/formatters.ts`)

- **Input masks**: `maskCPF()`, `maskPhone()`, `maskCurrency()` — for controlled inputs
- **Display formatters**: `formatCPF()`, `formatCNPJ()`, `formatPhone()`, `formatCurrency()` — for rendering
- **Parse**: `parseCurrency("1.234,56")` → `1234.56` — convert masked values back to numbers before API calls

### Role-Based Access & Feature Gating (`frontend/src/components/auth/`)

**Roles:**
- `useHasRole(...roles)` — boolean hook for inline checks
- `<ProtectedRoute roles={[...]}> ` — wraps route, redirects to `/dashboard` if unauthorized
- Rules: ADMIN (full access), PROFESSIONAL (clinical pages), RECEPTIONIST (dashboard, agenda, patients)

**Feature gating:**
- `useFeature(feature)` / `useSubscription()` — from `SubscriptionContext`
- `<FeatureRoute feature="X">` — route-level redirect to `/dashboard` if feature inactive
- `<FeatureGate feature="X" fallback={...}>` — inline hide/show without redirect
- Route guards compose: `<ProtectedRoute roles={['ADMIN']}><FeatureRoute feature="FINANCIAL_BASIC">...</FeatureRoute></ProtectedRoute>`

### Import Alias

All imports from `frontend/src/` use the `@/` path alias.

### TypeScript Config

Loose mode: `noImplicitAny: false`, `strictNullChecks: false`. See `frontend/tsconfig.json`.

### Testing (Frontend)

- Vitest + jsdom + @testing-library/react
- Setup file: `frontend/src/test/setup.ts`
- Test globals enabled (no need to import `describe`, `it`, `expect`)
- Test files: `frontend/src/**/*.{test,spec}.{ts,tsx}`

### Domain Model (Frontend)

Types in `frontend/src/types/clinic.ts`:

- **Auth types**: `LoginResponseSingle`, `LoginResponseMulti`, `SelectOrgResponse`, `ProfileResponse`
- **User** — `{ id, name, email, cpf, role }` (roles: ADMIN, PROFESSIONAL, RECEPTIONIST)
- **Clinic** — `{ id, name, cnpj?, settings? }`
- **Professional** — `{ id, organizationId, personId, role, active, person: { id, name, email, phone, cpf } }`
- **Patient** — `{ id, name, cpf?, birthDate?, email?, phone?, gender?, address?, notes?, createdAt, updatedAt }`
- **PaginatedResponse<T>** — `{ data: T[], meta: { total, page, limit, totalPages } }`
- **Procedure** — `{ id, name, durationMinutes, price, active, createdAt, updatedAt }`
- **Appointment** — `{ id, patientId, professionalId, procedureId, startAt, endAt, status, notes?, patient?, professional?, procedure? }`
- **AppointmentStatus** — `'SCHEDULED' | 'CONFIRMED' | 'CANCELED' | 'DONE'`
- **PerinealAssessment** — `{ id, patientId, professionalId, data: Record<string, unknown>, createdAt, updatedAt }`
- **TreatmentPackage** — `{ id, patientId, name, totalSessions, usedSessions, totalPrice, status, notes?, procedures?, createdAt, updatedAt }`
- **TreatmentPackageStatus** — `'ACTIVE' | 'COMPLETED' | 'CANCELED'`
- **FinancialRecord** — `{ id, patientId, appointmentId?, amount, type, status, paymentMethod?, description?, createdAt, updatedAt, patient? }`
- **FinancialType** — `'INCOME' | 'EXPENSE'`; **FinancialStatus** — `'PENDING' | 'PAID'`

All IDs are strings. Dates are ISO datetime strings from the backend.

---

## Backend Architecture (`backend/`)

NestJS + Prisma + PostgreSQL. Strict TypeScript (`noImplicitAny: true`, `strictNullChecks: true`).

### Module Structure

Each domain module follows `{name}.module.ts`, `{name}.controller.ts`, `{name}.service.ts`, `dto/*.dto.ts`:

| Module | Route prefix | Purpose |
|--------|-------------|---------|
| `auth` | `/api/auth` | Login (CPF+password), select-organization, JWT, profile, refresh token rotation |
| `organization` | `/api/organizations` | Tenant/clinic CRUD + user linking (OrganizationUser) |
| `person` | `/api/persons` | Global user CRUD (CPF-identified) |
| `patient` | `/api/patients` | Per-clinic patient CRUD (paginated, searchable) |
| `professional` | `/api/professionals` | Staff listing/management (based on OrganizationUser) |
| `procedure` | `/api/procedures` | Clinic services CRUD (name, duration, price) |
| `appointment` | `/api/appointments` | Schedule CRUD, conflict detection, status changes |
| `anamnesis` | `/api/anamneses` | Patient anamnesis (flexible JSON structure) |
| `perineal-assessment` | `/api/perineal-assessments` | Pelvic floor clinical evaluation (flexible JSON data) |
| `evolution` | `/api/evolutions` | Clinical evolution notes (timeline) |
| `treatment-package` | `/api/treatment-packages` | Session packages with procedure links |
| `financial` | `/api/financial` | Income/expense CRUD + monthly summary |
| `internal` | `/api/internal` | Internal ops (clinic/user management via `x-internal-api-key` header guard) |
| `subscription` | `/api/subscription` | Feature gating: `GET /status` (snapshot with features), `PATCH /plan` (change plan + invalidate cache), `POST /cancel` (cancel + invalidate cache) |
| `admin-api` | `/api/subscription` | Clinic→admin proxy: `GET /` (raw subscription data), `GET /plans` (available plans) — write ops moved to `subscription` module |
| `audit` | — | AuditLog persistence (called internally by other services) |
| `health` | `/api/health` | Health check endpoint |
| `version` | `/api/version` | Version endpoint |

### Key Directories (Backend)

| Path | Purpose |
|------|---------|
| `backend/src/` | NestJS source code |
| `backend/src/prisma/` | PrismaModule + PrismaService (global) |
| `backend/src/auth/` | Auth module (login, JWT, guards, decorators, refresh token rotation) |
| `backend/src/auth/guards/` | JwtAuthGuard (global), RolesGuard (global) |
| `backend/src/auth/decorators/` | @Public, @Roles, @CurrentUser, @OrgId |
| `backend/src/auth/strategies/` | JwtStrategy (reads from `pelvi_access_token` cookie or Bearer header) |
| `backend/src/common/filters/` | AllExceptionsFilter (global error handling) |
| `backend/src/internal/guards/` | InternalApiKeyGuard (`x-internal-api-key` header) |
| `backend/src/{module}/` | Domain modules (controller, service, module) |
| `backend/src/{module}/dto/` | Request validation DTOs (class-validator) |
| `backend/prisma/schema.prisma` | Database schema (all entities) |
| `backend/prisma/seed.ts` | Database seed with fake data |
| `backend/prisma.config.ts` | Prisma config (loads `.env.{NODE_ENV}`, defaults to `.env.dev`) |

### Authentication & Authorization

- **Login flow**: POST `/api/auth/login` { cpf, password } → if 1 clinic: sets cookies + returns user; if N clinics: returns list, then POST `/api/auth/select-organization`
- **JWT payload**: `{ sub: personId, organizationId, role }`
- **Cookies**: `pelvi_access_token` (access JWT, httpOnly) + `pelvi_refresh_token` (httpOnly, rotated on use)
- **Refresh token rotation**: `RefreshToken` model stores hashed tokens; old token invalidated on each refresh
- **Global guards** (registered via `APP_GUARD`, execution order matters):
  1. `ThrottlerGuard` (AuthModule) — rate limiting
  2. `JwtAuthGuard` (AuthModule) — validates JWT; skip with `@Public()`
  3. `RolesGuard` (AuthModule) — checks `@Roles(...)` metadata
  4. `PlanGuard` (SubscriptionModule) — checks `@RequireFeature(...)` metadata against org subscription
- **Decorators**:
  - `@Public()` — marks endpoint as unauthenticated (skips JwtAuthGuard and PlanGuard)
  - `@Roles(Role.ADMIN)` — restricts by role
  - `@RequireFeature('FEATURE_KEY')` — restricts by plan feature
  - `@CurrentUser()` — extracts full `JwtPayload` from request
  - `@OrgId()` — extracts `organizationId` string from JWT (convenience)
- All domain controllers use `@OrgId()` to scope queries by organization — **never trust client-sent organizationId**

### Feature Gating (Subscription)

Features are defined in `backend/src/subscription/plan-features.ts` as `PlanFeature` type. The allowed feature list per plan lives in **pelvi-admin's database** and is fetched at runtime — pelvi-ui never stores features locally. To add/remove features from a plan, edit pelvi-admin directly; cache expires in 5 min automatically.

**Backend:**
- `@RequireFeature('FEATURE_KEY')` class decorator on a controller → `PlanGuard` blocks all endpoints with 403 if org doesn't have the feature
- Applied on: `AppointmentController` (AGENDA), `PatientController` (PATIENTS), `FinancialController` (FINANCIAL_BASIC), `AnamnesisController` (ANAMNESIS), `EvolutionController` (EVOLUTIONS), `PerinealAssessmentController` (PERINEAL_ASSESSMENT), `TreatmentPackageController` (TREATMENT_PACKAGES), `ProfessionalController` (MULTI_PROFESSIONAL)
- `SubscriptionService` caches snapshots in Redis (TTL 5 min). Cache is invalidated immediately on plan change or cancellation via `SubscriptionController.changePlan` / `cancelSubscription`
- `ALL_PLAN_FEATURES` constant exported from `plan-features.ts` (used in e2e mock)

**Frontend:**
- `SubscriptionContext` — `useSubscription()` / `useFeature(feature)` hooks. `hasFeature()` returns `true` while loading (fail-open — avoids flash of hidden content)
- `<FeatureRoute feature="X">` — route-level guard; redirects to `/dashboard` if feature inactive
- `<FeatureGate feature="X" fallback={...}>` — inline component for hiding UI elements
- `Sidebar` — nav items with `feature` field are filtered by `hasFeature()`
- `PatientProfile` — tabs and queries conditionally enabled per feature; timeline filters evolutions/perineal entries when those features are inactive
- `Settings.tsx` — `FEATURE_LABELS` map renders friendly Portuguese names for plan features

### API Routes Reference

**Auth** (public unless noted):
- `POST /api/auth/login` — login via CPF + password
- `POST /api/auth/select-organization` — choose clinic (multi-tenant)
- `POST /api/auth/refresh` — rotate refresh token, issue new access token
- `POST /api/auth/logout` — clear cookies + invalidate refresh token
- `GET /api/auth/me` — authenticated user profile

**Patients** (JWT required):
- `POST /api/patients` — create patient
- `GET /api/patients?search=&page=&limit=` — paginated list with search
- `GET /api/patients/:id` — get by ID
- `PATCH /api/patients/:id` — update
- `DELETE /api/patients/:id` — remove

**Professionals** (JWT required):
- `GET /api/professionals` — list org users with person data
- `GET /api/professionals/:id` — get by ID
- `PATCH /api/professionals/:id` — update role/active

**Procedures** (JWT required):
- `POST /api/procedures` — create
- `GET /api/procedures` — list all
- `GET /api/procedures/:id` — get by ID
- `PATCH /api/procedures/:id` — update
- `DELETE /api/procedures/:id` — remove

**Appointments** (JWT required):
- `POST /api/appointments` — create (auto-calculates endAt, validates conflicts)
- `GET /api/appointments?startDate=&endDate=&professionalId=` — list by date range
- `GET /api/appointments/:id` — get by ID
- `PATCH /api/appointments/:id` — update
- `PATCH /api/appointments/:id/status` — change status
- `DELETE /api/appointments/:id` — remove

**Anamneses** (JWT required):
- `POST /api/anamneses` — create (flexible JSON data)
- `GET /api/anamneses?patientId=` — list by patient
- `GET /api/anamneses/:id` — get by ID
- `PATCH /api/anamneses/:id` — update

**Perineal Assessments** (JWT required):
- `POST /api/perineal-assessments` — create
- `GET /api/perineal-assessments?patientId=` — list by patient
- `GET /api/perineal-assessments/:id` — get by ID
- `PATCH /api/perineal-assessments/:id` — update

**Evolutions** (JWT required):
- `POST /api/evolutions` — create (optional appointment link)
- `GET /api/evolutions?patientId=` — list by patient (timeline, desc)
- `GET /api/evolutions/:id` — get by ID

**Treatment Packages** (JWT required):
- `POST /api/treatment-packages` — create package with procedures (transactional)
- `GET /api/treatment-packages?patientId=` — list by patient
- `GET /api/treatment-packages/:id` — get by ID
- `PATCH /api/treatment-packages/:id` — update
- `DELETE /api/treatment-packages/:id` — remove (cascades procedures)

**Financial** (JWT required):
- `POST /api/financial` — create record (INCOME/EXPENSE, supports installments)
- `GET /api/financial?month=&year=` — list by month
- `GET /api/financial/summary?month=&year=` — monthly summary (totalReceived, totalPending, totalExpenses, balance)
- `GET /api/financial/:id` — get by ID
- `PATCH /api/financial/:id` — update
- `DELETE /api/financial/:id` — remove

**Internal** (`x-internal-api-key` header required):
- `GET /api/internal/clinics` — list clinics
- `POST /api/internal/clinics` — create clinic
- `PATCH /api/internal/clinics/:clinicId/access` — update clinic access status
- `POST /api/internal/persons` — create person
- `POST /api/internal/clinics/:clinicId/users` — link user to clinic
- `GET /api/internal/clinics/:clinicId/users` — list clinic users
- `PATCH /api/internal/clinics/:clinicId/users/:organizationUserId` — update user
- `POST /api/internal/clinics/:clinicId/users/:organizationUserId/reset-password` — reset password

### Prisma

- Schema: `backend/prisma/schema.prisma`
- Models: Organization, Person, OrganizationUser, Patient, Procedure, Appointment, Anamnesis, PerinealAssessment, Evolution, TreatmentPackage, TreatmentPackageProcedure, FinancialRecord, RefreshToken, AuditLog
- Enums: Role (ADMIN, PROFESSIONAL, RECEPTIONIST), AppointmentStatus, FinancialType, FinancialStatus, TreatmentPackageStatus (ACTIVE, COMPLETED, CANCELED), ClinicAccessStatus
- Config: `backend/prisma.config.ts` — loads `.env.{NODE_ENV}` (defaults to `.env.dev`)
- `PrismaModule` is global — inject `PrismaService` in any service without importing the module
- Prisma version: 7.x (connection URL in `prisma.config.ts`, NOT in `schema.prisma`)
- Seed: `bun run seed` from `backend/`

### Key Config

- Global prefix: `/api`
- CORS: `CORS_ORIGIN` env var (comma-separated origins), defaults to `http://localhost:8080`
- `ValidationPipe` enabled globally (class-validator, whitelist + transform)
- `AllExceptionsFilter` enabled globally — standardized error responses: `{ statusCode, message, timestamp, path }`
- `JwtAuthGuard` + `RolesGuard` enabled globally via `APP_GUARD`
- Swagger docs at `/docs`

### Testing (Backend)

#### Unit Tests

- Jest + ts-jest, test files: `backend/src/**/*.spec.ts`
- Unit tests mock `PrismaService` — no real DB connection required
- Coverage collected from `**/*.service.ts` only
- Coverage threshold enforced: **80% statements/functions/lines, 75% branches**

**Test suites:**

| Spec file | O que cobre |
|-----------|-------------|
| `auth.service.spec.ts` | Login, multi-clínica, selectOrganization, getProfile, updateProfile, changePassword, refreshToken |
| `patient.service.spec.ts` | Isolamento por org, busca/paginação |
| `appointment.service.spec.ts` | Cálculo de endAt, conflito de horário, validação de pacote, status com sessões |
| `procedure.service.spec.ts` | CRUD completo com isolamento por org |
| `professional.service.spec.ts` | CRUD + shape de retorno sem campos internos |
| `anamnesis.service.spec.ts` | resolveOrgUser, merge de JSON, isolamento por org |
| `evolution.service.spec.ts` | resolveOrgUser, vínculo com agendamento, isolamento por org |
| `financial.service.spec.ts` | Registro único, parcelamento (valor/datas/descrição), filtros, summary |
| `treatment-package.service.spec.ts` | Criação com transação, parcelamento, increment/decrementUsedSessions, remove com cascade |
| `organization.service.spec.ts` | CRUD de org, addUser (limites de plano, conflitos), getPlanUsage, removeUser (soft delete) |
| `person.service.spec.ts` | Criação com hash bcrypt, conflitos CPF/email, update, soft delete, findOrganizations |
| `audit.service.spec.ts` | Persistência de log com e sem campos opcionais |
| `internal.service.spec.ts` | createClinic, listClinics, updateClinicAccess |

**Mock pattern:**
```ts
prisma = { <model>: { create: jest.fn(), findMany: jest.fn(), ... } };
// Interactive transactions:
$transaction: jest.fn((fn) => fn(txMock))
// Batch transactions:
$transaction: jest.fn((ops) => Promise.all(ops))
```

#### E2E Tests

- Located in `backend/test/`
- Require a real PostgreSQL database — use `backend/.env.test.example` as template for `backend/.env.test`
- `auth.e2e-spec.ts` — full auth flow (login, refresh, logout, cookie behavior)
- `tenant.e2e-spec.ts` — tenant isolation: data from one org not accessible from another
- Uses `PrismaTestService` (wraps real Prisma with test helpers) and `db.helper.ts` / `app.helper.ts`
- Run: `bun run test:e2e` from `backend/`

---

## Git Workflow

| Branch | Environment | Purpose |
|--------|-------------|---------|
| `main` | Production | Stable prod — deploy via Railway automatically |
| `staging` | Homologação | Pre-prod validation — created from `main` |

**PR flow**: all PRs target `staging` first. After validation, `staging` → `main` for prod deploy.

Never open PRs directly to `main`.

---

## Deployment (Railway)

Two services deployed from the same monorepo on Railway. Each environment (`staging`, `prod`) has its own Railway services and Neon DB branch.

### Backend (`pelvi-api`)
- **Root directory**: `backend`
- **Builder**: Dockerfile (`backend/Dockerfile`)
- **Config**: `backend/railway.toml`
- **Env vars**: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_API_KEY`, `CORS_ORIGIN`, `PORT`

### Frontend (`pelvi-web`)
- **Root directory**: `frontend`
- **Builder**: Dockerfile (`frontend/Dockerfile`)
- **Stack**: Multi-stage build → Nginx serving static SPA
- **Config**: `frontend/railway.toml` + `frontend/Dockerfile` + `frontend/nginx.conf`
- **Build arg**: `VITE_API_URL` — backend API URL injected at build time
- **Nginx**: SPA routing (`try_files $uri $uri/ /index.html`), gzip, cache headers for static assets

### Nginx log severity note
Nginx writes startup notices to stderr. Railway tags stderr as `error` — this is cosmetic and not a real error. Migrations logging similarly from Prisma.

---

## Database (Neon)

- **Provider**: Neon (serverless PostgreSQL)
- **Branching**: Uses Neon branches to mirror environments (`dev`, `staging`, `prod`)
- **Env files**: `backend/.env.dev` (local dev, not committed). Use `backend/.env.test.example` as template for test env. Production env vars are injected by Railway — no `.env.prod` file needed.
- Migrations: `bunx prisma migrate dev` for dev, `NODE_ENV=prod bunx prisma migrate deploy` for prod (from `backend/`)

### Seed Data

Run `bun run seed` from `backend/`:
- 2 clinics (Clinica Bem Estar, Centro de Fisioterapia Saude)
- 4 users: Admin (multi-clinic), Fisioterapeuta, Psicologo, Recepcionista
- 3 procedures, 5 patients, 7 appointments, 5 financial records, 2 anamneses, 2 evolutions

Test credentials (all use password `123456`):
- `11111111111` — Admin (linked to both clinics — triggers multi-clinic flow)
- `22222222222` — Fisioterapeuta
- `33333333333` — Psicologo
- `44444444444` — Recepcionista

### Environment Variables

Backend (`backend/.env.dev`, Railway):
- `DATABASE_URL` — Neon PostgreSQL connection string (use direct URL, not pooled, for migrations)
- `JWT_SECRET` — JWT signing secret
- `JWT_REFRESH_SECRET` — Refresh token signing secret (separate from access token secret)
- `INTERNAL_API_KEY` — API key for internal routes (min 32 chars); must match `CLINIC_INTERNAL_API_KEY` in pelvi-admin
- `ADMIN_API_URL` — pelvi-admin base URL (no trailing slash); e.g. `http://localhost:3001`
- `ADMIN_EXTERNAL_API_KEY` — key sent as `x-clinic-api-key` to pelvi-admin; must match `CLINIC_EXTERNAL_API_KEY` in pelvi-admin
- `CORS_ORIGIN` — Comma-separated allowed origins
- `PORT` — Server port (Railway sets automatically)

Frontend (build-time only):
- `VITE_API_URL` — Backend API base URL. Defaults to `http://localhost:3000`.
