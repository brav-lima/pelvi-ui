# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClinicFlow (careflow-ui) is a **multi-tenant clinic management system** (Clinic Scheduler) — a monorepo with a React frontend and NestJS backend. The UI is in Brazilian Portuguese. Full product spec lives in `docs/project-overview.md`.

- **Frontend** (`/`) — React + TypeScript + Vite SPA (port 8080)
- **Backend** (`/server`) — NestJS + Prisma + PostgreSQL API (port 3000)
- **Database**: Neon (serverless PostgreSQL) with branch-based environments
- **Package manager**: Bun (both frontend and backend)

### Domain Context

The system targets small/medium clinics (physiotherapy, psychology, medical) with these core modules:

- **Authentication** — Login via CPF + password. One CPF can be linked to multiple clinics (multi-tenant). After login, user selects clinic context (or auto-enters if only one).
- **Agenda** — Clinic schedule with day/week/month views, per-professional. Statuses: Agendado, Confirmado, Cancelado, Realizado.
- **Patients** — Per-clinic patient registry with profile containing basic data, appointment history, anamnesis, and evolutions.
- **Professionals** — Staff management with roles (Admin, Profissional, Recepção) and working hours.
- **Procedures** — Clinic services with name, duration, price, active/inactive status.
- **Anamnesis** — Structured initial/periodic patient records.
- **Evolutions** — Continuous clinical evolution notes displayed as a timeline.
- **Financial** — Simple income/expense tracking linked to patients and appointments. Statuses: Pendente, Pago.

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

### Provider Hierarchy (App.tsx)

```
QueryClientProvider (TanStack React Query)
  → ThemeProvider (dark/light mode, persisted to localStorage)
    → AuthProvider (user + clinic selection, mock auth)
      → TooltipProvider
        → BrowserRouter (React Router v6)
```

### Routing

Routes are defined in `src/App.tsx`. Two route groups:

- **Unauthenticated**: `/login`, `/select-clinic` — no layout wrapper
- **Authenticated**: All other pages wrapped in `MainLayout` — redirects to `/login` if not authenticated, to `/select-clinic` if no clinic selected

### Layout System

`MainLayout` (`src/components/layout/MainLayout.tsx`) provides the authenticated shell:
- `Sidebar` — collapsible left nav
- `TopBar` — clinic info, notifications, theme toggle, user menu
- `<Outlet />` — renders the matched child route

### State Management

- **Auth state**: React Context (`src/contexts/AuthContext.tsx`) — `useAuth()` hook
- **Theme state**: React Context (`src/contexts/ThemeContext.tsx`) — light/dark toggle
- **Server state**: TanStack React Query (configured but not heavily used yet — mock data in place)
- **Component state**: local `useState`

### Key Directories

| Path | Purpose |
|------|---------|
| `src/pages/` | Route page components (one per route) |
| `src/components/ui/` | shadcn/ui components + custom UI primitives |
| `src/components/layout/` | MainLayout, Sidebar, TopBar |
| `src/contexts/` | AuthContext, ThemeContext |
| `src/types/clinic.ts` | All domain type definitions |
| `src/data/mockData.ts` | Mock data used across pages |
| `src/hooks/` | Custom hooks (use-mobile, use-toast) |
| `src/lib/utils.ts` | `cn()` utility for Tailwind class merging |

### UI Components

Uses [shadcn/ui](https://ui.shadcn.com) (default style, CSS variables, slate base color). Config in `components.json`. Add new components via:

```bash
bunx shadcn-ui@latest add <component-name>
```

Custom UI components beyond shadcn: `page-header`, `stat-card`, `status-badge`, `empty-state`.

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

Types in `src/types/clinic.ts`: User, Clinic, Professional, Patient, Procedure, Appointment, Anamnesis (with sections/fields), Evolution, FinancialRecord. All IDs are strings. Dates stored as strings (`yyyy-MM-dd` for dates, `HH:mm` for times).

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
- CORS: allows `http://localhost:8080` (frontend dev server)
- `ValidationPipe` enabled globally (class-validator, whitelist + transform)
- `AllExceptionsFilter` enabled globally — standardized error responses: `{ statusCode, message, timestamp, path }`
- `JwtAuthGuard` + `RolesGuard` enabled globally via `APP_GUARD`
- `ConfigModule` loaded globally (reads `.env`)
- Swagger docs at `/docs` with Bearer auth support
- NestJS Swagger CLI plugin enabled (auto-generates `@ApiProperty` from DTOs)

### Testing (Backend)

- Jest + ts-jest, test files: `server/src/**/*.spec.ts`
- Unit tests mock PrismaService and test service logic
- Current test suites:
  - `auth.service.spec.ts` — login flow, multi-clinic, credential validation
  - `patient.service.spec.ts` — org isolation, search, pagination
  - `appointment.service.spec.ts` — conflict detection, endAt calculation, status changes
- Run: `bun run test` (from /server) or `bun run server:test` (from root)

### Database (Neon)

- **Provider**: Neon (serverless PostgreSQL)
- **Branching**: Uses Neon branches to mirror environments (`dev`, `prod`)
- **Env files**: `server/.env.dev` and `server/.env.prod` (encrypted via dotenvx)
- `prisma.config.ts` loads `.env.{NODE_ENV}` — defaults to `.env.dev` when `NODE_ENV` is not set
- Migrations: run `bunx prisma migrate dev` for dev, `NODE_ENV=prod bunx prisma migrate deploy` for prod

### Seed Data

Run `bunx prisma db seed` from `/server` to populate with test data:
- 2 clinics (Clínica Bem Estar, Centro de Fisioterapia Saúde)
- 4 users: Admin (multi-clinic), Fisioterapeuta, Psicólogo, Recepcionista
- 3 procedures, 5 patients, 7 appointments, 5 financial records, 2 anamneses, 2 evolutions

Test credentials (all use password `123456`):
- `11111111111` — Admin (linked to both clinics — triggers multi-clinic flow)
- `22222222222` — Fisioterapeuta
- `33333333333` — Psicólogo
- `44444444444` — Recepcionista

### Environment Variables

Env files per environment (`server/.env.dev`, `server/.env.prod`):
- `DATABASE_URL` — Neon PostgreSQL connection string (use direct URL, not pooled, for migrations)
- `JWT_SECRET` — JWT signing secret
