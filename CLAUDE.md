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
bunx prisma validate      # Validate schema
bunx prisma migrate dev --name <name>   # Create/apply migrations (dev)
NODE_ENV=prod bunx prisma migrate deploy  # Apply migrations (prod)
bunx prisma generate      # Regenerate Prisma Client
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

Each domain module follows the pattern `{name}.module.ts`, `{name}.controller.ts`, `{name}.service.ts`:

| Module | Route prefix | Purpose |
|--------|-------------|---------|
| `auth` | `/api/auth` | Authentication (JWT + passport) |
| `organization` | `/api/organizations` | Tenant/clinic management |
| `patient` | `/api/patients` | Patient registry |
| `professional` | `/api/professionals` | Staff management |
| `procedure` | `/api/procedures` | Clinic services/procedures |
| `appointment` | `/api/appointments` | Schedule/agenda |
| `anamnesis` | `/api/anamneses` | Patient anamnesis records |
| `evolution` | `/api/evolutions` | Clinical evolution notes |
| `financial` | `/api/financial` | Income/expense tracking |

### Key Directories (Backend)

| Path | Purpose |
|------|---------|
| `server/src/` | NestJS source code |
| `server/src/prisma/` | PrismaModule + PrismaService (global) |
| `server/src/{module}/` | Domain modules (controller, service, module) |
| `server/prisma/schema.prisma` | Database schema (all entities) |
| `server/prisma.config.ts` | Prisma config (loads `.env.{NODE_ENV}`, defaults to `.env.dev`) |
| `server/dist/` | Compiled output (gitignored) |

### Prisma

- Schema: `server/prisma/schema.prisma` — defines all models with `organizationId` for multi-tenant isolation
- Generator: `prisma-client-js` — generates to `node_modules/@prisma/client`
- Config: `server/prisma.config.ts` — loads `.env.{NODE_ENV}` (defaults to `.env.dev`)
- `PrismaModule` is global — inject `PrismaService` in any service without importing the module
- Database schema reference: `docs/schema.md`
- Prisma version: 7.x (connection URL configured in `prisma.config.ts`, NOT in `schema.prisma`)

### Key Config

- Global prefix: `/api`
- CORS: allows `http://localhost:8080` (frontend dev server)
- `ValidationPipe` enabled globally (class-validator, whitelist + transform)
- `ConfigModule` loaded globally (reads `.env`)

### Database (Neon)

- **Provider**: Neon (serverless PostgreSQL)
- **Branching**: Uses Neon branches to mirror environments (`dev`, `prod`)
- **Env files**: `server/.env.dev` and `server/.env.prod` (encrypted via dotenvx)
- `prisma.config.ts` loads `.env.{NODE_ENV}` — defaults to `.env.dev` when `NODE_ENV` is not set
- Migrations: run `bunx prisma migrate dev` for dev, `NODE_ENV=prod bunx prisma migrate deploy` for prod

### Environment Variables

Env files per environment (`server/.env.dev`, `server/.env.prod`):
- `DATABASE_URL` — Neon PostgreSQL connection string (use direct URL, not pooled, for migrations)
- `JWT_SECRET` — JWT signing secret
