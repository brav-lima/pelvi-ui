# CareFlow

Sistema de gestao para clinicas de saude (fisioterapia, psicologia, medicina). Multi-tenant, com agenda, prontuario, financeiro e controle de acesso por perfil.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Backend | NestJS + Prisma + PostgreSQL |
| Banco | Neon (serverless PostgreSQL) |
| Deploy | Railway (2 servicos: API + Web) |
| Package Manager | Bun |

## Modulos

- **Agenda** — Dia/semana/mes, drag-and-drop, blocos proporcionais a duracao, filtro por profissional
- **Pacientes** — Cadastro, perfil com historico de consultas, anamnese e evolucoes
- **Profissionais** — Gestao de equipe com roles (Admin, Profissional, Recepcao)
- **Procedimentos** — Servicos da clinica com duracao, preco e status ativo/inativo
- **Anamnese** — Formulario JSON flexivel por paciente
- **Evolucoes** — Timeline de evolucao clinica
- **Financeiro** — Receitas/despesas com resumo mensal, baixa de pagamento

## Requisitos

- [Bun](https://bun.sh/) >= 1.0
- PostgreSQL (ou conta no [Neon](https://neon.tech/))

## Setup Local

```bash
# Clonar o repositorio
git clone https://github.com/brav999/careflow-ui.git
cd careflow-ui

# Instalar dependencias (frontend + backend)
bun install
cd server && bun install && cd ..

# Configurar variaveis de ambiente
# server/.env.dev precisa de: DATABASE_URL, JWT_SECRET, CORS_ORIGIN
# .env (raiz) opcional: VITE_API_URL (default: http://localhost:3000)

# Gerar Prisma Client e rodar migrations
cd server
bunx prisma generate
bunx prisma migrate dev
bunx prisma db seed   # dados de teste
cd ..
```

## Executando

```bash
# Terminal 1 — Backend (porta 3000)
bun run server:dev

# Terminal 2 — Frontend (porta 8080)
bun run dev
```

## Comandos

### Frontend (raiz do projeto)

| Comando | Descricao |
|---------|-----------|
| `bun run dev` | Servidor de desenvolvimento |
| `bun run build` | Build de producao |
| `bun run lint` | ESLint |
| `bun run test` | Testes (Vitest) |

### Backend (raiz do projeto ou /server)

| Comando | Descricao |
|---------|-----------|
| `bun run server:dev` | NestJS em watch mode |
| `bun run server:build` | Build de producao |
| `bun run server:test` | Testes (Jest) |
| `bunx prisma migrate dev --name <name>` | Criar migration |
| `bunx prisma db seed` | Popular banco com dados de teste |

## Credenciais de Teste

Todas usam senha `123456`:

| CPF | Role | Nota |
|-----|------|------|
| 11111111111 | Admin | Multi-clinica (2 clinicas) |
| 22222222222 | Profissional | Fisioterapeuta |
| 33333333333 | Profissional | Psicologo |
| 44444444444 | Recepcionista | — |

## Seguranca

- JWT com refresh token (access 15min + refresh 7d)
- RBAC no backend (@Roles) e frontend (RoleGuard)
- Rate limiting (60 req/min geral, 5 req/min login)
- CSP e referrer policy
- Isolamento multi-tenant por organizationId
- Logs de auditoria (AuditLog)
- CPF mascarado nas listagens (LGPD)
- Envs criptografados via dotenvx

## Deploy

Dois servicos no Railway a partir do mesmo monorepo:

- **careflow-api** — NestJS, builder Railpack, root `/server`
- **careflow-web** — Nginx servindo SPA, builder Dockerfile, root `/`

## Documentacao

- `docs/steps.txt` — Roadmap completo com status de cada etapa
- `docs/project-overview.md` — Especificacao do produto
- `docs/schema.md` — Modelo de dados
- Swagger disponivel em `/docs` (backend)
