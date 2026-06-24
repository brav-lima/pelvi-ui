# Tasks — Design Spec

**Data:** 2026-06-23  
**Status:** Aprovado

---

## Visão Geral

Módulo de tarefas para clínicas. Qualquer profissional pode criar tarefas para si mesmo ou para outros membros da clínica. O responsável recebe notificação in-app (bell no TopBar) e pode atualizar o status da tarefa.

---

## Modelo de Dados

### Entidade `Task`

```prisma
model Task {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  title          String
  description    String?
  status         TaskStatus   @default(PENDING)
  priority       TaskPriority @default(MEDIUM)
  dueDate        DateTime?    @map("due_date")
  createdById    String       @map("created_by_id")
  assignedToId   String       @map("assigned_to_id")
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  organization Organization     @relation(fields: [organizationId], references: [id])
  createdBy    OrganizationUser @relation("TaskCreatedBy", fields: [createdById], references: [id])
  assignedTo   OrganizationUser @relation("TaskAssignedTo", fields: [assignedToId], references: [id])

  @@map("tasks")
}

enum TaskStatus {
  PENDING
  IN_PROGRESS
  DONE
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
}
```

### Regras de negócio

- `assignedToId` obrigatório — toda tarefa tem um responsável (pode ser o próprio criador).
- Apenas o criador (`createdById === userId do token`) pode **deletar** a tarefa.
- Qualquer membro da org pode atualizar o **status** de qualquer tarefa da org.
- Apenas o criador pode editar título, descrição, prazo, prioridade e responsável.
- Isolamento multi-tenant: todas as queries filtram por `organizationId` extraído do JWT.

---

## Backend

### Módulo: `task`

Rota base: `/api/tasks`

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| `POST` | `/api/tasks` | Todos os roles | Cria tarefa |
| `GET` | `/api/tasks` | Todos os roles | Lista tarefas da org com filtros |
| `GET` | `/api/tasks/my` | Todos os roles | Tarefas atribuídas ao usuário logado |
| `PATCH` | `/api/tasks/:id` | Todos os roles | Atualiza campos permitidos |
| `DELETE` | `/api/tasks/:id` | Apenas criador | Deleta tarefa |

### Filtros em `GET /api/tasks`

Query params opcionais:
- `status` — `PENDING | IN_PROGRESS | DONE` (aceita múltiplos separados por vírgula)
- `priority` — `LOW | MEDIUM | HIGH`
- `assignedToId` — UUID do OrganizationUser responsável

### Filtros em `GET /api/tasks/my`

- `status` — padrão `PENDING,IN_PROGRESS` (usado pelo bell de notificações)

### DTOs

**CreateTaskDto:**
```ts
title: string          // obrigatório
description?: string
priority?: TaskPriority  // default MEDIUM
dueDate?: string       // ISO date opcional
assignedToId: string   // obrigatório — OrganizationUser ID
```

**UpdateTaskDto** (todos opcionais, Partial de CreateTaskDto + status):
```ts
title?: string
description?: string
priority?: TaskPriority
dueDate?: string | null
assignedToId?: string
status?: TaskStatus
```

### Lógica de autorização no serviço

- `DELETE`: verifica `task.createdById === currentUserId`; 403 se não for o criador.
- `PATCH` de campos de edição (title, description, priority, dueDate, assignedToId): verifica `task.createdById === currentUserId`; 403 se não for o criador.
- `PATCH` de `status` apenas: qualquer membro da org pode alterar.
- Toda query inclui cláusula `organizationId` — nunca confia em dados enviados pelo cliente.

---

## Frontend

### Rota

`/tarefas` — lazy-loaded, autenticada, sem restrição de role.

### Sidebar

Item "Tarefas" adicionado na seção "Principal", ícone `CheckSquare` (lucide-react), visível para todos os roles.

### Página `Tasks.tsx`

**Layout:**
- Page header com título "Tarefas" + botão "Nova Tarefa" (abre `TaskFormDialog`).
- Barra de filtros: dropdown de status (multi-select), dropdown de prioridade (multi-select), dropdown de responsável (lista profissionais ativos da org).
- Lista/tabela com colunas:

| Coluna | Detalhe |
|--------|---------|
| Título | Texto + descrição truncada abaixo |
| Responsável | Avatar + nome |
| Prioridade | Badge colorido: vermelho (Alta), amarelo (Média), cinza (Baixa) |
| Prazo | Data formatada; texto vermelho se `dueDate < hoje` e status ≠ DONE |
| Status | Badge clicável para toggle inline: PENDENTE → EM ANDAMENTO → CONCLUÍDA |
| Ações | Ícone editar (apenas criador) + ícone deletar com confirmação (apenas criador) |

- Estado vazio: `<EmptyState>` com mensagem "Nenhuma tarefa encontrada".

### `TaskFormDialog`

Modal de criação e edição (mesmo componente, prop `task?` para edição).

Campos:
- **Título** — input text, obrigatório
- **Descrição** — textarea, opcional
- **Responsável** — select com profissionais ativos da org (nome + role)
- **Prioridade** — select: Baixa / Média / Alta (default Média)
- **Prazo** — date picker, opcional; botão para limpar

### Bell de notificações (TopBar)

- Nova seção "Tarefas" adicionada ao popover existente.
- Query: `GET /api/tasks/my?status=PENDING,IN_PROGRESS`, `refetchInterval: 5 * 60 * 1000`.
- Badge do bell soma tarefas pendentes + appointments + pagamentos pendentes.
- Cada item exibe: título da tarefa + prioridade + prazo (se houver).
- Click no item navega para `/tarefas`.
- Tarefas não são dismissíveis no bell (diferente de appointments) — somem quando status vira DONE.

### API client (`frontend/src/lib/api.ts`)

Novo objeto `tasksApi` com métodos:
```ts
tasksApi.list(filters)
tasksApi.my(filters)
tasksApi.create(data)
tasksApi.update(id, data)
tasksApi.remove(id)
```

### React Query — cache keys

```ts
['tasks', organizationId, filters]   // lista geral
['tasks', 'my', userId, filters]     // tarefas do usuário (bell)
```

Invalidação: após create/update/delete, invalida ambas as chaves.

---

## Tipos (`frontend/src/types/clinic.ts`)

```ts
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

interface Task {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  createdById: string;
  assignedToId: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; person: { name: string } };
  assignedTo?: { id: string; person: { name: string } };
}
```

---

## Fora do escopo (v1)

- Notificações por email ao atribuir tarefa.
- Comentários em tarefas.
- Histórico de alterações de status.
- Tarefas vinculadas a pacientes ou consultas.
- Kanban / arrastar e soltar.
