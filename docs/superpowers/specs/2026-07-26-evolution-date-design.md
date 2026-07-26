# Evolução — Data Ajustável — Design Spec

**Data:** 2026-07-26
**Status:** Aprovado

---

## Visão Geral

Hoje toda evolução clínica é registrada com a data/hora atual (`createdAt`), sem possibilidade de escolher outra data. Na prática o profissional muitas vezes atende o paciente e só registra a evolução depois (no fim do dia, no dia seguinte etc.), e precisa que o registro reflita a data do atendimento, não a data em que digitou o texto.

Esta mudança adiciona um campo de **data da evolução** editável na criação, e um endpoint de edição para corrigir data e/ou descrição de uma evolução já salva.

---

## Modelo de Dados

### Alteração na entidade `Evolution`

```prisma
model Evolution {
  id             String              @id @default(uuid())
  organizationId String              @map("organization_id")
  patientId      String              @map("patient_id")
  professionalId String              @map("professional_id")
  appointmentId  String?             @map("appointment_id")
  description    String
  evolutionDate  DateTime            @default(now()) @map("evolution_date")
  legalBasis     SensitiveLegalBasis @default(HEALTH_PROTECTION) @map("legal_basis")
  consentId      String?             @map("consent_id")
  createdAt      DateTime            @default(now()) @map("created_at")
  updatedAt      DateTime            @updatedAt @map("updated_at")

  organization Organization     @relation(fields: [organizationId], references: [id])
  patient      Patient          @relation(fields: [patientId], references: [id])
  professional OrganizationUser @relation(fields: [professionalId], references: [id])
  appointment  Appointment?     @relation(fields: [appointmentId], references: [id])

  @@index([organizationId, patientId])
  @@index([organizationId, evolutionDate])
  @@map("evolutions")
}
```

- `createdAt` continua sendo o timestamp de auditoria (quando o registro foi de fato inserido no banco) — não é alterado por este trabalho.
- `evolutionDate` é a data clínica escolhida pelo profissional (quando o atendimento/evolução de fato ocorreu). Default `now()` para manter compatibilidade com o fluxo atual quando o campo não é enviado.
- Índice de timeline (`[organizationId, createdAt]`) é substituído por `[organizationId, evolutionDate]`, já que a listagem passa a ordenar por essa coluna.
- Migration: `bunx prisma migrate dev --name add_evolution_date`. Registros existentes recebem `evolutionDate = createdAt` (via `@default(now())` na migration mais um backfill `UPDATE evolutions SET evolution_date = created_at`).

### Regras de negócio

- `evolutionDate` não pode ser uma data futura (nem na criação, nem na edição) — validação no service.
- Isolamento multi-tenant mantido: toda query filtra por `organizationId` do JWT.
- Qualquer profissional ativo da clínica pode editar qualquer evolução da própria org (mesmo padrão de acesso já usado nos demais endpoints — sem restrição de autor).

---

## Backend

### DTOs

`CreateEvolutionDto` — adiciona campo opcional:

```ts
@IsOptional()
@IsDateString({}, { message: 'Data da evolução inválida' })
evolutionDate?: string;
```

Novo `UpdateEvolutionDto`:

```ts
export class UpdateEvolutionDto {
  @IsOptional()
  @IsString({ message: 'Descrição inválida' })
  @MinLength(1, { message: 'Descrição não pode ser vazia' })
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data da evolução inválida' })
  evolutionDate?: string;
}
```

### Validação de data futura

No `EvolutionService`, helper privado `assertNotFutureDate(date: string)` lançando `BadRequestException('Data da evolução não pode ser no futuro')`, chamado em `create` (quando `dto.evolutionDate` informado) e em `update` (quando `dto.evolutionDate` informado).

### `EvolutionService`

- `create`: usa `dto.evolutionDate ?? new Date()` ao gravar `evolutionDate`.
- `findByPatient`: `orderBy: { evolutionDate: 'desc' }` (era `createdAt`).
- Novo método `update(organizationId, id, dto)`:
  - `findFirst({ where: { id, organizationId } })` — 404 (`NotFoundException`) se não achar.
  - Valida data futura se `evolutionDate` presente.
  - `prisma.evolution.update({ where: { id }, data: { ...(dto.description && { description: dto.description }), ...(dto.evolutionDate && { evolutionDate: new Date(dto.evolutionDate) }) } })`.
  - Mesmo shape de `include` usado em `findById` (professional + person + appointment).

### `EvolutionController`

Novo endpoint:

```ts
@Patch(':id')
update(
  @OrgId() orgId: string,
  @Param('id') id: string,
  @Body() dto: UpdateEvolutionDto,
) {
  return this.evolutionService.update(orgId, id, dto);
}
```

Rota final: `PATCH /api/v1/evolutions/:id`. Mesmo guard set do módulo (`@RequireFeature('EVOLUTIONS')`, JWT global).

---

## Frontend

### Tipos (`frontend/src/types/clinic.ts`)

`Evolution` ganha `evolutionDate: string` (ISO datetime).

### API (`frontend/src/lib/api.ts`)

```ts
update: (id: string, data: { description?: string; evolutionDate?: string }) =>
  api.patch<Evolution>(`/evolutions/${id}`, data),
```

### `EvolutionFormDialog`

Vira dual-mode (criar/editar):

- Nova prop opcional `evolution?: Evolution` — presente = modo edição (título "Editar Evolução", botão "Salvar"), ausente = modo criação (comportamento atual, botão "Registrar").
- Schema zod ganha `evolutionDate: z.string().min(1, 'Data é obrigatória')`.
- Campo novo no form, acima da descrição:
  ```tsx
  <Label htmlFor="evolutionDate">Data da evolução *</Label>
  <Input
    id="evolutionDate"
    type="date"
    max={format(new Date(), 'yyyy-MM-dd')}
    {...form.register('evolutionDate')}
  />
  ```
  (mesmo padrão de `type="date"` já usado em `FinancialFormDialog`/`TaskFormDialog`).
- `defaultValues.evolutionDate`: `format(new Date(), 'yyyy-MM-dd')` na criação; em modo edição, populado via `useEffect`/`form.reset` a partir de `evolution.evolutionDate` quando o dialog abre.
- `onSubmit`: em modo criação chama `evolutionsApi.create({ patientId, description, evolutionDate })`; em modo edição chama `evolutionsApi.update(evolution.id, { description, evolutionDate })`.
- Erro de data futura vindo do backend (400) exibido no mesmo bloco de erro genérico já existente.

### `Evolutions.tsx`

- Timeline usa `evolution.evolutionDate` (não `createdAt`) para exibir a data de cada card.
- Cada item ganha um botão de editar (ícone `Pencil`, canto do card) que abre `EvolutionFormDialog` com `evolution={item}`.
- Estado novo: `editingEvolution: Evolution | null`; dialog controlado por `open={dialogOpen}` com `evolution={editingEvolution ?? undefined}`; ao fechar, limpar `editingEvolution`.
- `onSuccess` continua invalidando `['evolutions', selectedPatient]`.

### `PatientProfile.tsx`

- Fluxo de "evolução rápida" (textarea inline na aba Consultas/Evoluções) **não muda** — continua criando com data de hoje (sem campo de data), já que é o atalho para registro no momento do atendimento.
- Edição completa (data + descrição) fica disponível apenas via `EvolutionFormDialog` na aba de evoluções, reaproveitando o mesmo componente do `Evolutions.tsx`.

---

## Testes

### Backend (`evolution.service.spec.ts`)

- `create`: usa `evolutionDate` informado quando presente; usa `now()` quando ausente; rejeita data futura.
- `findByPatient`: ordena por `evolutionDate desc`.
- `update`: aplica apenas campos informados; 404 quando evolução não existe na org; rejeita data futura; isolamento por org (não atualiza registro de outra org).

### Frontend

- `EvolutionFormDialog`: renderiza em modo criação vs edição; submete payload correto em cada modo; valida campo de data obrigatório.

---

## Fora de Escopo

- Edição/exclusão restrita por autor (mantém acesso igual aos demais endpoints do módulo — qualquer profissional da org).
- Alterar `createdAt` (permanece imutável, é auditoria).
- Campo de data no fluxo de evolução rápida do `PatientProfile.tsx`.
