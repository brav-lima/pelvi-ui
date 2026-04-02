# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CareFlow (careflow-ui) is a **multi-tenant clinic management system** (Clinic Scheduler) — a monorepo with a React frontend and NestJS backend. The UI is in Brazilian Portuguese. Full product spec lives in `docs/project-overview.md`.

- **Frontend** (`/`) — React + TypeScript + Vite SPA (port 8080)
- **Backend** (`/server`) — NestJS + Prisma + PostgreSQL API (port 3000)
- **Database**: Neon (serverless PostgreSQL) with branch-based environments
- **Deployment**: Railway (two services: `careflow-api` + `careflow-web`)
- **Package manager**: Bun (both frontend and backend)

### Domain Context

The system targets small/medium clinics (physiotherapy, psychology, medical) with these core modules:

- **Authentication** — Login via CPF + password. One CPF can be linked to multiple clinics (multi-tenant). After login, user selects clinic context (or auto-enters if only one).
- **Agenda** — Clinic schedule with day/week/month views. Duration-proportional blocks, drag-and-drop rescheduling (@dnd-kit), per-professional filter. Statuses: SCHEDULED, CONFIRMED, CANCELED, DONE.
- **Patients** — Per-clinic patient registry with profile containing basic data, appointment history, anamnesis, and evolutions. Paginated listing with server-side search. Card/list toggle view.
- **Professionals** — Staff management with roles (ADMIN, PROFESSIONAL, RECEPTIONIST). Card/list toggle view.
- **Procedures** — Clinic services with name, durationMinutes, price, active/inactive toggle. Card/list toggle view.
- **Anamnesis** — Free-form JSON patient records (flexible structure per clinic).
- **Evolutions** — Continuous clinical evolution notes displayed as a timeline.
- **Financial** — Income/expense tracking linked to patients and appointments. Monthly summary with totals. "Dar baixa" (mark as paid) inline. Statuses: PENDING, PAID.

### Multi-Tenant Model

Data is isolated by `organization_id` (clinic). The conceptual domain model (see `docs/project-overview.md` section 5) uses:
- `Organization` (clinic) — the tenant
- `Person` (global, identified by CPF) — linked to clinics via `OrganizationUser` (role + permissions)
- All other entities (`Patient`, `Appointment`, `Procedure`, etc.) belong to an organization

### Design Principles

- Usability, domain clarity, and evolutionary architecture over premature complexity
- Backend-authoritative (frontend is a SPA consuming an API)
- SaaS-ready foundation

## Commands

### Frontend (from repo root)

```bash
bun run dev           # Start dev server on localhost:8080
bun run build         # Production build
bun run lint          # ESLint
bun run test          # Run tests once (vitest run)
bun run test:watch    # Run tests in watch mode (vitest)
```

Run a single test file:
```bash
bunx vitest run src/test/example.test.ts
```

### Backend (from repo root)

```bash
bun run server:dev    # Start dev server on localhost:3000 (watch mode)
bun run server:build  # Production build
bun run server:test   # Run tests
```

### Backend (from /server directory)

```bash
bun run start:dev         # NestJS watch mode
bun run build             # Compile to dist/
bun run start:prod        # Run compiled build
bun run test              # Run unit tests (jest)
bun run test:e2e          # Run e2e tests
bunx prisma validate      # Validate schema
bunx prisma migrate dev --name <name>   # Create/apply migrations (dev)
NODE_ENV=prod bunx prisma migrate deploy  # Apply migrations (prod)
bunx prisma generate      # Regenerate Prisma Client
bunx prisma db seed       # Seed database with fake data
```

---

## Frontend Architecture

### Integration Status

The frontend is **fully integrated** with the real backend API. There is no mock data — all pages fetch from the NestJS API via `src/lib/api.ts` using TanStack React Query.

### Provider Hierarchy (App.tsx)

```
QueryClientProvider (TanStack React Query)
  → ThemeProvider (dark/light mode, persisted to localStorage)
    → AuthProvider (real JWT auth + multi-tenant clinic selection)
      → TooltipProvider
        → BrowserRouter (React Router v6)
          → Suspense (lazy-loaded pages with PageLoader fallback)
```

### Routing & Code Splitting

Routes are defined in `src/App.tsx`. All pages are lazy-loaded via `React.lazy()` + `Suspense` for code splitting (main bundle ~397KB, pages loaded on demand). Two route groups:

- **Unauthenticated**: `/login`, `/select-clinic` — no layout wrapper
- **Authenticated**: All other pages wrapped in `MainLayout` — redirects to `/login` if not authenticated, to `/select-clinic` if no clinic selected

### Layout System

`MainLayout` (`src/components/layout/MainLayout.tsx`) provides the authenticated shell:
- `Sidebar` — collapsible left nav (desktop), Sheet overlay (mobile < 768px)
- `TopBar` — clinic info (CNPJ formatted), notifications, theme toggle, user menu (Trocar Clinica, Sair), hamburger menu (mobile)
- `<Outlet />` — renders the matched child route
- Responsive: sidebar hidden on mobile, hamburger button in TopBar opens Sheet

### State Management

- **Auth state**: React Context (`src/contexts/AuthContext.tsx`) — `useAuth()` hook. Real JWT auth via `src/lib/api.ts`. Token persisted in `localStorage`. Session restoration on mount via `GET /api/auth/me`. `logout()` clears token + state. "Trocar Clinica" calls logout + navigates to `/login`.
- **Theme state**: React Context (`src/contexts/ThemeContext.tsx`) — light/dark toggle
- **Server state**: TanStack React Query — all API data fetched, cached, and invalidated via React Query. Module-specific API clients in `src/lib/api.ts`.
- **Component state**: local `useState`
- **View preferences**: Card/list toggle persisted in `localStorage` (`patients-view`, `procedures-view`, `professionals-view`)

### API Client (`src/lib/api.ts`)

Centralized HTTP client with:
- `getToken()` / `setToken()` / `removeToken()` — JWT persistence in localStorage
- Generic `request<T>()` — auto-injects Bearer token, handles errors
- `ApiError` class with status code
- `api` object with `get`, `post`, `patch`, `delete` methods
- `queryString()` helper for URL params
- Module-specific API objects: `authApi`, `patientsApi`, `proceduresApi`, `professionalsApi`, `appointmentsApi`, `anamnesisApi`, `evolutionsApi`, `financialApi`

### Key Directories

| Path | Purpose |
|------|---------|
| `src/pages/` | Route page components (one per route, lazy-loaded) |
| `src/components/ui/` | shadcn/ui components + custom UI primitives |
| `src/components/layout/` | MainLayout, Sidebar, TopBar |
| `src/components/patients/` | PatientFormDialog (create/edit patient) |
| `src/components/appointments/` | AppointmentFormDialog |
| `src/components/procedures/` | ProcedureFormDialog |
| `src/components/financial/` | FinancialFormDialog |
| `src/components/anamnesis/` | AnamnesisFormDialog |
| `src/components/evolutions/` | EvolutionFormDialog |
| `src/components/auth/` | RoleGuard, ProtectedRoute, useHasRole |
| `src/contexts/` | AuthContext, ThemeContext |
| `src/types/clinic.ts` | All domain type definitions (aligned with backend models) |
| `src/lib/api.ts` | API client (fetch wrapper + module APIs) |
| `src/lib/formatters.ts` | Input masks (CPF, phone, currency) + display formatters |
| `src/hooks/` | Custom hooks (use-mobile, use-toast) |
| `src/lib/utils.ts` | `cn()` utility for Tailwind class merging |

### Pages Overview

| Page | File | Data Source | Features |
|------|------|-------------|----------|
| Dashboard | `Dashboard.tsx` | `appointmentsApi`, `patientsApi`, `financialApi` | Stats cards (formatted currency), today's schedule, upcoming appointments |
| Agenda | `Agenda.tsx` | `appointmentsApi`, `professionalsApi` | Day/week/month views, duration-proportional blocks, drag-and-drop (@dnd-kit), professional filter, status actions, detail modal |
| Pacientes | `Patients.tsx` | `patientsApi` | Paginated list, server-side search (debounced), card/list toggle (localStorage), CPF/phone formatted, create dialog |
| Perfil Paciente | `PatientProfile.tsx` | `patientsApi`, `appointmentsApi`, `anamnesisApi`, `evolutionsApi` | Patient info card (formatted CPF/phone), tabs (Consultas, Anamnese, Evolucoes), inline status actions, all create/edit dialogs |
| Profissionais | `Professionals.tsx` | `professionalsApi` | Card/list toggle (localStorage), avatar, role badge, formatted phone |
| Procedimentos | `Procedures.tsx` | `proceduresApi` | Card/list toggle (localStorage), active toggle, formatted currency, delete with confirmation |
| Anamnese | `Anamnesis.tsx` | `patientsApi`, `anamnesisApi` | Patient list (formatted CPF) + anamnesis viewer (flexible JSON rendering), create/edit dialog |
| Evolucoes | `Evolutions.tsx` | `patientsApi`, `evolutionsApi` | Patient list + evolution timeline, create dialog |
| Financeiro | `Financial.tsx` | `financialApi` | Stats cards (formatted currency), records table, "dar baixa" (mark as paid) with confirmation, delete with confirmation |
| Login | `Login.tsx` | `authApi` | CPF with mask (XXX.XXX.XXX-XX), password, handles single/multi-clinic responses |
| Selecionar Clinica | `SelectClinic.tsx` | `authApi` | Clinic selection for multi-tenant users, formatted CNPJ |

### UI Components

Uses [shadcn/ui](https://ui.shadcn.com) (default style, CSS variables, slate base color). Config in `components.json`. Add new components via:

```bash
bunx shadcn-ui@latest add <component-name>
```

Custom UI components beyond shadcn: `page-header`, `stat-card`, `status-badge`, `empty-state`.

### Formatting & Masks (`src/lib/formatters.ts`)

Centralized formatting utilities used across forms and display:
- **Input masks**: `maskCPF()`, `maskPhone()`, `maskCurrency()` — for controlled inputs
- **Display formatters**: `formatCPF()`, `formatCNPJ()`, `formatPhone()`, `formatCurrency()` — for rendering
- **Parse**: `parseCurrency("1.234,56")` → `1234.56` — for converting masked values back to numbers before API calls

### Role-Based Access (`src/components/auth/`)

- `<RoleGuard roles={[...]}> ` — renders children only if user has allowed role
- `useHasRole(...roles)` — boolean hook for inline checks
- `<ProtectedRoute roles={[...]}> ` — wraps route, redirects to `/dashboard` if unauthorized
- Rules: ADMIN (full access), PROFESSIONAL (clinical pages), RECEPTIONIST (dashboard, agenda, patients)

### Drag and Drop

`@dnd-kit/core` + `@dnd-kit/utilities` for agenda rescheduling. `DndContext` wraps day/week grid. Draggable appointment cards, droppable time slots. Disabled for CANCELED/DONE appointments.

### Import Alias

All imports from `src/` use the `@/` path alias (e.g., `import { Button } from '@/components/ui/button'`).

### Styling

- Tailwind CSS with CSS custom properties for theming (defined in `src/index.css`)
- Dark mode via class strategy (`.dark` on `<html>`)
- Use `cn()` from `@/lib/utils` for conditional class merging

### TypeScript Config

Loose mode: `noImplicitAny: false`, `strictNullChecks: false`. See `tsconfig.json`.

### Testing

- Vitest + jsdom + @testing-library/react
- Setup file: `src/test/setup.ts` (imports jest-dom matchers, polyfills `matchMedia`)
- Test globals enabled (no need to import `describe`, `it`, `expect`)
- Test files: `src/**/*.{test,spec}.{ts,tsx}`

### Domain Model (Frontend)

Types in `src/types/clinic.ts`, aligned with backend Prisma models:

- **Auth types**: `LoginResponseSingle`, `LoginResponseMulti`, `SelectOrgResponse`, `ProfileResponse`
- **User** — `{ id, name, email, cpf, role }` (roles: ADMIN, PROFESSIONAL, RECEPTIONIST)
- **Clinic** — `{ id, name, cnpj?, settings? }`
- **Professional** — `{ id, organizationId, personId, role, active, person: { id, name, email, phone, cpf } }` (OrganizationUser + Person join)
- **Patient** — `{ id, name, cpf?, birthDate?, email?, phone?, gender?, address?, notes?, createdAt, updatedAt }`
- **PaginatedResponse<T>** — `{ data: T[], meta: { total, page, limit, totalPages } }`
- **Procedure** — `{ id, name, durationMinutes, price, active, createdAt, updatedAt }`
- **Appointment** — `{ id, patientId, professionalId, procedureId, startAt, endAt, status, notes?, patient?, professional?, procedure? }`
- **AppointmentStatus** — `'SCHEDULED' | 'CONFIRMED' | 'CANCELED' | 'DONE'`
- **Anamnesis** — `{ id, patientId, professionalId, data: Record<string, unknown>, createdAt, updatedAt, patient?, professional? }`
- **Evolution** — `{ id, patientId, professionalId, appointmentId?, description, createdAt, updatedAt, patient?, professional? }`
- **FinancialRecord** — `{ id, patientId, appointmentId?, amount, type, status, paymentMethod?, description?, createdAt, updatedAt, patient? }`
- **FinancialType** — `'INCOME' | 'EXPENSE'`; **FinancialStatus** — `'PENDING' | 'PAID'`

All IDs are strings. Dates are ISO datetime strings from the backend.

---

## Backend Architecture (`/server`)

NestJS + Prisma + PostgreSQL. Strict TypeScript (`noImplicitAny: true`, `strictNullChecks: true`).

### Module Structure

Each domain module follows the pattern `{name}.module.ts`, `{name}.controller.ts`, `{name}.service.ts`, `dto/*.dto.ts`:

| Module | Route prefix | Purpose |
|--------|-------------|---------|
| `auth` | `/api/auth` | Login (CPF+password), select-organization, JWT, profile |
| `organization` | `/api/organizations` | Tenant/clinic CRUD + user linking (OrganizationUser) |
| `person` | `/api/persons` | Global user CRUD (CPF-identified) |
| `patient` | `/api/patients` | Per-clinic patient CRUD (paginated, searchable) |
| `professional` | `/api/professionals` | Staff listing/management (based on OrganizationUser) |
| `procedure` | `/api/procedures` | Clinic services CRUD (name, duration, price) |
| `appointment` | `/api/appointments` | Schedule CRUD, conflict detection, status changes |
| `anamnesis` | `/api/anamneses` | Patient anamnesis (flexible JSON structure) |
| `evolution` | `/api/evolutions` | Clinical evolution notes (timeline) |
| `financial` | `/api/financial` | Income/expense CRUD + monthly summary |

### Key Directories (Backend)

| Path | Purpose |
|------|---------|
| `server/src/` | NestJS source code |
| `server/src/prisma/` | PrismaModule + PrismaService (global) |
| `server/src/auth/` | Auth module (login, JWT, guards, decorators) |
| `server/src/auth/guards/` | JwtAuthGuard (global), RolesGuard (global) |
| `server/src/auth/decorators/` | @Public, @Roles, @CurrentUser, @OrgId |
| `server/src/auth/strategies/` | JwtStrategy (passport) |
| `server/src/common/filters/` | AllExceptionsFilter (global error handling) |
| `server/src/{module}/` | Domain modules (controller, service, module) |
| `server/src/{module}/dto/` | Request validation DTOs (class-validator) |
| `server/prisma/schema.prisma` | Database schema (all entities) |
| `server/prisma/seed.ts` | Database seed with fake data |
| `server/prisma.config.ts` | Prisma config (loads `.env.{NODE_ENV}`, defaults to `.env.dev`) |
| `server/dist/` | Compiled output (gitignored) |

### Authentication & Authorization

- **Login flow**: POST `/api/auth/login` { cpf, password } → if 1 clinic: returns JWT; if N clinics: returns list, then POST `/api/auth/select-organization` to choose
- **JWT payload**: `{ sub: personId, organizationId, role }`
- **Global guards** (registered via `APP_GUARD` in AuthModule):
  - `JwtAuthGuard` — validates JWT on every request; skip with `@Public()` decorator
  - `RolesGuard` — checks `@Roles(Role.ADMIN, ...)` metadata; allows all if no roles specified
- **Decorators** (in `server/src/auth/decorators/`):
  - `@Public()` — marks endpoint as unauthenticated (login, select-org)
  - `@Roles(Role.ADMIN)` — restricts by role
  - `@CurrentUser()` — extracts full `JwtPayload` from request
  - `@OrgId()` — extracts `organizationId` string from JWT (convenience)
- All domain controllers use `@OrgId()` to scope queries by organization — **never trust client-sent organizationId**

### API Routes Reference

**Auth** (public):
- `POST /api/auth/login` — login via CPF + password
- `POST /api/auth/select-organization` — choose clinic (multi-tenant)
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
- `PATCH /api/appointments/:id/status` — change status (SCHEDULED/CONFIRMED/CANCELED/DONE)
- `DELETE /api/appointments/:id` — remove

**Anamneses** (JWT required):
- `POST /api/anamneses` — create (flexible JSON data)
- `GET /api/anamneses?patientId=` — list by patient
- `GET /api/anamneses/:id` — get by ID
- `PATCH /api/anamneses/:id` — update

**Evolutions** (JWT required):
- `POST /api/evolutions` — create (optional appointment link)
- `GET /api/evolutions?patientId=` — list by patient (timeline, desc)
- `GET /api/evolutions/:id` — get by ID

**Financial** (JWT required):
- `POST /api/financial` — create record (INCOME/EXPENSE)
- `GET /api/financial?month=&year=` — list by month
- `GET /api/financial/summary?month=&year=` — monthly summary (totalReceived, totalPending, totalExpenses, balance)
- `GET /api/financial/:id` — get by ID
- `PATCH /api/financial/:id` — update (amount, status, etc.)
- `DELETE /api/financial/:id` — remove

### Prisma

- Schema: `server/prisma/schema.prisma` — defines all models with `organizationId` for multi-tenant isolation
- Models: Organization, Person, OrganizationUser, Patient, Procedure, Appointment, Anamnesis, Evolution, FinancialRecord
- Enums: Role (ADMIN, PROFESSIONAL, RECEPTIONIST), AppointmentStatus (SCHEDULED, CONFIRMED, CANCELED, DONE), FinancialType (INCOME, EXPENSE), FinancialStatus (PENDING, PAID)
- Generator: `prisma-client-js` — generates to `node_modules/@prisma/client`
- Config: `server/prisma.config.ts` — loads `.env.{NODE_ENV}` (defaults to `.env.dev`)
- `PrismaModule` is global — inject `PrismaService` in any service without importing the module
- Database schema reference: `docs/schema.md`
- Prisma version: 7.x (connection URL configured in `prisma.config.ts`, NOT in `schema.prisma`)
- Seed: `server/prisma/seed.ts` — run with `bunx prisma db seed`

### Key Config

- Global prefix: `/api`
- CORS: configurable via `CORS_ORIGIN` env var (comma-separated origins), defaults to `http://localhost:8080`
- `ValidationPipe` enabled globally (class-validator, whitelist + transform)
- `AllExceptionsFilter` enabled globally — standardized error responses: `{ statusCode, message, timestamp, path }`
- `JwtAuthGuard` + `RolesGuard` enabled globally via `APP_GUARD`
- `ConfigModule` loaded globally (reads `.env`)
- Swagger docs at `/docs` with Bearer auth support
- NestJS Swagger CLI plugin enabled (auto-generates `@ApiProperty` from DTOs)

### Testing (Backend)

- Jest + ts-jest, test files: `server/src/**/*.spec.ts`
- Unit tests mock `PrismaService` — no real DB connection required
- Coverage collected from `**/*.service.ts` only (controllers, modules, guards excluded)
- Coverage threshold enforced: **80% statements/functions/lines, 75% branches**
- Current coverage: ~88% statements, ~88% lines, ~89% functions, ~76% branches

**Test suites (13 spec files, ~157 tests):**

| Spec file | O que cobre |
|-----------|-------------|
| `auth.service.spec.ts` | Login, multi-clínica, selectOrganization, getProfile, updateProfile, changePassword, refreshToken |
| `patient.service.spec.ts` | Isolamento por org, busca/paginação |
| `appointment.service.spec.ts` | Cálculo de endAt, conflito de horário, validação de pacote, findById, update, remove, status com sessões |
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

**Padrão de mock:**
```ts
prisma = { <model>: { create: jest.fn(), findMany: jest.fn(), ... } };
// Para transações interativas:
$transaction: jest.fn((fn) => fn(txMock))
// Para transações batch:
$transaction: jest.fn((ops) => Promise.all(ops))
```

- Run: `bun run test` (from /server) or `bun run server:test` (from root)
- Coverage: `bun run test:cov` (from /server)

---

## Deployment (Railway)

Two services deployed from the same monorepo on Railway:

### Backend (`careflow-api`)
- **Root directory**: `server`
- **Builder**: Railpack (auto-detects NestJS)
- **Config**: `server/railway.toml` — build command: `bun install && bunx prisma generate && bun run build`, start: `node dist/main`
- **Env vars**: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT`

### Frontend (`careflow-web`)
- **Root directory**: `/` (repo root)
- **Builder**: Dockerfile (`Dockerfile` at root)
- **Stack**: Multi-stage build → Nginx serving static SPA
- **Config**: `railway.toml` + `Dockerfile` + `nginx.conf`
- **Build arg**: `VITE_API_URL` — backend API URL injected at build time
- **Nginx**: SPA routing (`try_files $uri $uri/ /index.html`), gzip, cache headers for static assets

### Key Deployment Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Frontend multi-stage (bun build → nginx) |
| `nginx.conf` | Nginx config for SPA routing + caching |
| `railway.toml` | Frontend Railway config (Dockerfile builder) |
| `server/Dockerfile` | Backend multi-stage (bun build → node dist/main) |
| `server/railway.toml` | Backend Railway config (Railpack builder) |
| `.dockerignore` | Root Docker ignore |
| `server/.dockerignore` | Backend Docker ignore |

---

## Database (Neon)

- **Provider**: Neon (serverless PostgreSQL)
- **Branching**: Uses Neon branches to mirror environments (`dev`, `prod`)
- **Env files**: `server/.env.dev` and `server/.env.prod` (encrypted via dotenvx)
- `prisma.config.ts` loads `.env.{NODE_ENV}` — defaults to `.env.dev` when `NODE_ENV` is not set
- Migrations: run `bunx prisma migrate dev` for dev, `NODE_ENV=prod bunx prisma migrate deploy` for prod

### Seed Data

Run `bunx prisma db seed` from `/server` to populate with test data:
- 2 clinics (Clinica Bem Estar, Centro de Fisioterapia Saude)
- 4 users: Admin (multi-clinic), Fisioterapeuta, Psicologo, Recepcionista
- 3 procedures, 5 patients, 7 appointments, 5 financial records, 2 anamneses, 2 evolutions

Test credentials (all use password `123456`):
- `11111111111` — Admin (linked to both clinics — triggers multi-clinic flow)
- `22222222222` — Fisioterapeuta
- `33333333333` — Psicologo
- `44444444444` — Recepcionista

### Environment Variables

Backend env vars (`server/.env.dev`, `server/.env.prod`, Railway):
- `DATABASE_URL` — Neon PostgreSQL connection string (use direct URL, not pooled, for migrations)
- `JWT_SECRET` — JWT signing secret
- `CORS_ORIGIN` — Comma-separated allowed origins (e.g., `https://careflow-web.up.railway.app,http://localhost:8080`)
- `PORT` — Server port (Railway sets this automatically)

Frontend env vars (build-time only):
- `VITE_API_URL` — Backend API base URL (e.g., `https://careflow-api.up.railway.app`). Defaults to `http://localhost:3000`.
