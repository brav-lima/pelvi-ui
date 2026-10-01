# Anamnese Pélvica Geral e Gestacional — Design Spec

**Data:** 2026-09-30
**Status:** Aguardando revisão
**Linear:** [SOU-66](https://linear.app/blvckship/issue/SOU-66/anamnese)
**Substitui (parcialmente):** `2026-08-21-anamnese-simplificada-design.md` (SOU-9)

---

## Objetivo

Substituir a anamnese simplificada atual (4 campos + hipóteses) por duas fichas independentes — **Anamnese Pélvica Geral** (`PELVIC_GENERAL`) e **Anamnese Gestacional** (`PREGNANCY`) — com seções narrativas opcionais, orientação "Investigar:" exibida fora do conteúdo clínico, estado rascunho/finalizada e preservação de histórico.

Princípio: *o SOUPELVI organiza o prontuário; a metodologia pertence à profissional.* Sem checklists obrigatórios, sem metodologia proprietária, sem preenchimento automático de conteúdo clínico.

### Decisões já tomadas

| Tema | Decisão |
|------|---------|
| Anamnese simplificada atual | Substituída para novos registros. Registros existentes permanecem no banco **sem migração** e são exibidos somente-leitura como "Formato anterior". |
| Versionamento | Snapshot (`data` + `assessmentDate` anteriores) em `anamnesis_revisions` a cada edição de anamnese já finalizada. Rascunhos não geram revisão. Sem UI de versões no MVP. |
| Definição dos formulários | Config versionada no código (não em tabela). |
| Profissão e estado civil | Passam a fazer parte do **cadastro do paciente** (`Patient.occupation`, `Patient.maritalStatus`), reutilizados pela anamnese. |
| Exclusão | Anamnese `DRAFT` pode ser excluída; `COMPLETED` **não** (somente edição, com revisão). |
| Risco obstétrico | Select estruturado. |
| Idade gestacional | DUM informada manualmente → DPP calculada automaticamente; ultrassonografia também informada manualmente. |

### Fora de escopo

Exame físico, diagnóstico cinesiológico-funcional, plano de tratamento, reavaliações, UI de histórico/comparação de versões, anexos, escalas, diários, modelos personalizados, exportação de PDF (o botão atual não tem função e não é tratado aqui). A arquitetura não deve impedi-los.

---

## Modelo de Dados

Migration **aditiva** (roda automaticamente em prod no deploy; sem staging). Revisar o SQL gerado antes de aplicar, pois `migrate dev` local também atinge o banco de prod.

```prisma
enum AnamnesisType   { PELVIC_GENERAL PREGNANCY }
enum AnamnesisStatus { DRAFT COMPLETED }

model Patient {
  // campos existentes inalterados
  occupation    String? // profissão
  maritalStatus String? @map("marital_status") // valores sugeridos: solteira, casada, união estável, divorciada, viúva, outro
}

model Anamnesis {
  // campos existentes inalterados
  type           AnamnesisType?   // null = registro legado (formato de 4 campos)
  status         AnamnesisStatus  @default(DRAFT)
  assessmentDate DateTime?        @map("assessment_date")
  completedAt    DateTime?        @map("completed_at")
  revisions      AnamnesisRevision[]
}

model AnamnesisRevision {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  anamnesisId    String   @map("anamnesis_id")
  professionalId String   @map("professional_id") // quem fez a edição
  data           Json
  assessmentDate DateTime? @map("assessment_date") // data da avaliação antes da edição
  createdAt      DateTime @default(now()) @map("created_at")

  anamnesis Anamnesis @relation(fields: [anamnesisId], references: [id])

  @@index([organizationId, anamnesisId])
  @@map("anamnesis_revisions")
}
```

**Atenção — backfill do `status`:** colunas novas com `@default(DRAFT)` marcariam todos os registros legados como rascunho. A migration deve fazer `UPDATE anamneses SET status = 'COMPLETED', completed_at = updated_at WHERE type IS NULL`, para que o legado não apareça como rascunho pendente.

**Cadastro do paciente:** `occupation` e `maritalStatus` são colunas nullable (aditivas, sem backfill). Para manter a coluna `marital_status` livre de validação rígida no banco, o conjunto de valores é validado no DTO (`@IsIn`), não por enum Prisma — evita migration a cada novo valor. Afeta: `schema.prisma`, `create-patient.dto.ts`, `update-patient.dto.ts`, `patient.service.ts` (select/shape de retorno), `types/clinic.ts` (`Patient`), `PatientFormDialog.tsx` (novos campos) e exibição em `PatientProfile.tsx`.

**Remoção de anamnese:** `DELETE /anamneses/:id` só é permitido para `status = DRAFT` com `type` não nulo (registros legados, `type = null`, nunca são excluíveis e aparecem como "Finalizada" na UI, mesmo que gravados depois do backfill com `status = DRAFT` por default); a exclusão é `deleteMany` condicional (DRAFT, type não nulo) para não apagar um registro finalizado concorrentemente. Em `COMPLETED`/legado retorna `409 Conflict` ("anamnese finalizada não pode ser excluída; edite o registro"). Como rascunhos não geram revisões, não há revisões a apagar. O botão de excluir na UI fica oculto para `COMPLETED`.

### Forma do `data` (tipos novos)

```ts
type AnamnesisData = {
  sections: Record<string, unknown>; // sectionId -> valor (string para narrativo; objeto para estruturado)
};
```

- `guidance` e `placeholder` **não** são armazenados — pertencem à definição do formulário.
- Identificação: nome, data de nascimento, telefone, **profissão e estado civil** vêm de `Patient` (somente exibição na ficha, com atalho para editar o cadastro; nunca copiados para o `data`). Somente "encaminhamento / profissional solicitante" é dado da avaliação, em `sections.identification.referral`. Se profissão/estado civil estiverem vazios no cadastro, a ficha mostra "Não informado" com o link de edição.
- Gestacional estruturado (exemplos): `sections.gestationalData = { dum, dpp, dppSource, gaSource (top-level), gestationalAge: { weeks, days, manualOverride }, pregnancyType, conception, obstetricRisk }`; `sections.ultrasound = { date, gaAtExam: { weeks, days }, estimatedFetalWeight, fetalPercentile, fetalPresentation, placentaLocation, cervicalLength, amnioticFluid }`.
- `obstetricRisk`: `HABITUAL | ALTO_RISCO | NAO_INFORMADO` (select).
- `gaSource` (IG) / `dppSource`: `DUM | ULTRASSONOGRAFIA | MANUAL`.

---

## Definições de Formulário

Arquivo `anamnesis-forms` (frontend) com, por tipo, a lista ordenada de seções:

```ts
type SectionDef = {
  id: string;
  title: string;
  kind: 'narrative' | 'structured';
  placeholder?: string;
  guidance?: string;       // texto após "Investigar:" — apenas exibição
  component?: 'identification' | 'gestationalData' | 'ultrasound';
};
```

O conteúdo (títulos, placeholders, orientações) segue literalmente as seções 4.2–4.11 (pélvica geral) e 5.2–5.13 (gestacional) da SOU-66. A ficha gestacional é **independente** — não reaproveita a lista da ficha geral.

O backend mantém apenas a lista de `sectionId`s válidos por tipo (para validar), sem textos de orientação.

---

## Backend (`backend/src/anamnesis/`)

- **`CreateAnamnesisDto`**: `patientId`, `type` (enum, obrigatório), `assessmentDate?`, `data?` (opcional — rascunho pode nascer vazio). Mantém `legalBasis`/`consentId`/`legalBasisNotes`.
- **`UpdateAnamnesisDto`**: `data?`, `assessmentDate?`, `status?`.
- **Merge por seção**: `data.sections` faz merge por `sectionId`; seções não enviadas são preservadas (autosave parcial não apaga conteúdo). Seção enviada substitui o valor da seção inteira.
- **Validação**: `type` existente; `sectionId`s conhecidos para o tipo (desconhecidos → 400, compatível com `forbidNonWhitelisted`); datas válidas. Nenhum campo clínico é obrigatório.
- **Finalizar**: `status: COMPLETED` define `completedAt`. Editar uma anamnese `COMPLETED` mantém o status, atualiza `updatedAt` e grava uma `AnamnesisRevision` (snapshot do `data` **anterior** à edição + autor da edição) na mesma `$transaction`. Reabrir como rascunho não é suportado no MVP.
- **Legado**: `PATCH` em registro com `type = null` → `409 Conflict` ("formato anterior, somente leitura").
- **Isolamento**: todas as queries por `organizationId` via `@OrgId()`; revisões também filtradas por org. Autor da edição resolvido via `resolveOrgUser`.
- **Sem cálculo de IG no backend.** A IG é calculada no frontend e persistida apenas como valor confirmado, com `gaSource` e `manualOverride`.
- `POST` também valida que o paciente pertence à organização (antes não havia checagem).
- `@RequireFeature('ANAMNESIS')` e auditoria inalterados.

---

## Frontend

### Componentes novos (`frontend/src/components/anamnesis/`)

- **`ClinicalNarrativeField`** — props `id, title, placeholder, guidance, value, onChange, optional, maxLength?`. Renderiza título, textarea e, abaixo, `Investigar: {guidance}` em `text-muted-foreground` menor. O `guidance` nunca entra em `value`/payload. Reutilizável em outros formulários clínicos.
- **`GestationalAgeField`** — lógica em funções puras (`gestational-age.ts`), no padrão das calculadoras obstétricas (ex.: fetalmed.net):
  - **DUM** (informada manualmente) → **DPP = DUM + 280 dias** (regra de Naegele), preenchida automaticamente; IG = (data de referência − DUM), em "N semanas + D dias".
  - **Ultrassonografia** (data do exame e IG no exame, informadas manualmente) → DPP = data do exame + (280 − IG no exame em dias); IG atual derivada da mesma âncora. Usada como fonte quando a profissional seleciona `ULTRASSONOGRAFIA`.
  - A fonte usada é sempre exibida e escolhida pela profissional (padrão: `DUM` se houver DUM; senão `ULTRASSONOGRAFIA`).
  - Correção manual de DPP ou IG → `gaSource = MANUAL`, `manualOverride = true`; valores manuais **nunca** são sobrescritos por recálculo (alterar DUM depois apenas sugere o novo valor, sem aplicar).
  - A DPP calculada é sugestão confirmada ao salvar, não conteúdo clínico escrito pelo sistema sem a profissional ver (aparece preenchida e editável).
- **`ObstetricSummary`** — topo da ficha gestacional: IG atual (recalculada), DPP, apresentação fetal (da ultrassonografia mais recente registrada, com data), risco obstétrico (select `obstetricRisk`; "—" se não informado).
- **`UltrasoundFields`** — todos os campos informados manualmente (sem integração com exames); apresentação fetal como select (cefálica, pélvica, transversa, oblíqua, não informado, outro) com entrada manual permitida.
- Navegação por seções expansíveis/recolhíveis (`CollapsibleSection`), sem `SectionNav` (breakpoints CSS, sem `useIsMobile`).

### Páginas

- **`AnamnesisEditorPage`** vira shell: lê `type` (de `?type=` na criação, do registro na edição), carrega a definição e renderiza seções. Remove `HypothesisField`/`GroupedHypotheses` do fluxo novo (mantidos apenas para exibir legado).
- **Criação**: o botão "Nova anamnese" na aba do paciente oferece escolha de tipo (Pélvica Geral / Gestacional). Seleção de tipo na aba do paciente são dois botões (Pélvica geral / Gestacional), não um menu.
- **Salvamento**: "Salvar rascunho" manual; indicador "Salvo às HH:mm"; autosave a cada 30 s **somente em rascunho** e somente se houver alterações; `beforeunload` + interceptação de cliques em links internos (`useUnsavedChangesGuard`) avisam ao sair com alterações não salvas — `useBlocker` exige data router e o app usa `BrowserRouter`; o botão Voltar do navegador não é interceptado; "Finalizar" muda o status. Cabeçalho mostra criada em / última atualização / profissional.
- **`PatientFormDialog` / `PatientProfile`**: novos campos *Profissão* (texto) e *Estado civil* (select) no cadastro; exibidos no perfil.
- **`PatientProfile` (aba Anamnese)**: lista com tipo, status (badge), data e profissional. Registros legados exibidos com a visualização atual de hipóteses, etiquetados "Formato anterior", sem botão de editar.
- **`api.ts` / `types/clinic.ts`**: `Anamnesis` ganha `type`, `status`, `assessmentDate`, `completedAt`.

---

## Testes

**Backend (jest, Prisma mockado — `anamnesis.service.spec.ts`):**
- criação por tipo; rascunho vazio permitido;
- merge por seção preserva seções não enviadas;
- finalizar define `completedAt`; edição de `COMPLETED` cria revisão na transação; edição de `DRAFT` não cria;
- `sectionId` desconhecido → 400; legado → 409;
- isolamento por organização (incluindo revisões);
- `DELETE` permitido em `DRAFT`, `409` em `COMPLETED`;
- `Patient`: criação/atualização com `occupation` e `maritalStatus` válidos; valor de estado civil inválido → 400 (`patient.service.spec.ts`).

**Frontend (vitest):**
- "Investigar:" aparece na tela e **não** está no payload salvo;
- seções vazias salvam;
- cálculo de IG (semanas + dias), fonte, e override manual não sobrescrito;
- aviso ao sair com alterações pendentes; autosave só em rascunho;
- legado renderiza somente-leitura sem botão de editar; botão excluir oculto em `COMPLETED`;
- `gestational-age.ts`: DUM → DPP (+280 d), IG em semanas+dias, derivação por ultrassonografia, override manual preservado;
- identificação exibe profissão/estado civil do cadastro e "Não informado" quando vazios.

---

## Critérios de Aceite (SOU-66 §14)

Mapeados 1:1 para o design acima: duas fichas independentes; placeholders; "Investigar:" fora do registro; campos vazios permitidos; rascunho e retomada; reaproveitamento do cadastro; campos obstétricos estruturados; cálculo/registro de IG; registros anteriores preservados (legado intocado + revisões); data/hora e profissional; distinção visual conteúdo × orientação; nenhuma metodologia obrigatória.

---

## Questões em aberto

Nenhuma no momento. Decisões de 2026-09-30: exclusão bloqueada para `COMPLETED`; risco obstétrico como select; fontes da IG = DUM / Ultrassonografia / Manual (DUM e ultrassonografia informadas manualmente, DPP calculada); profissão e estado civil movidos para o cadastro do paciente.
