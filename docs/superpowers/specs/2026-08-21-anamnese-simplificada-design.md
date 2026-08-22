# Anamnese Simplificada com Hipóteses — Design Spec

**Data:** 2026-08-21
**Status:** Aprovado
**Linear:** [SOU-9](https://linear.app/soupelvi/issue/SOU-9/anamnese)

---

## Visão Geral

Hoje a anamnese tem dois pontos de entrada divergentes:

1. **`AnamnesisEditorPage`** (`/patients/:patientId/anamnesis/new`) — o fluxo real, usado a partir da ficha do paciente. Wizard multi-passo com **5 templates clínicos** (Dor Pélvica, Função Urinária, Função Evacuatória, Gestação, Pós-Parto), cada um com várias seções específicas.
2. **`Anamnesis.tsx` + `AnamnesisFormDialog`** (rota `/anamnesis`) — tela órfã, sem link no sidebar, inacessível na prática.

A usuária pediu para simplificar: eliminar os templates e ficar só com um formulário universal de 4 campos —  **Queixa Principal (QP)**, **Impacto na Vida**, **História Atual (HA)**, **História Pregressa (HP)** — porque durante a conversa com a paciente as hipóteses clínicas já vão surgindo pergunta a pergunta, e hoje não há onde registrá-las no momento em que aparecem.

Esta mudança:

- Remove os 5 templates clínicos e a tela de seleção de template.
- Remove a tela órfã `/anamnesis` (`Anamnesis.tsx` + `AnamnesisFormDialog`).
- Substitui o wizard multi-passo por uma página única com scroll (os 4 campos sempre visíveis).
- Adiciona, em cada campo, uma área de **hipóteses** que aparece assim que o profissional começa a preencher o campo — permitindo múltiplas hipóteses por campo, adicionadas conforme a conversa avança.
- Agrupa todas as hipóteses (das 4 seções) em um resumo único, com a origem de cada uma, tanto dentro do formulário (antes de salvar) quanto na visualização salva (aba Anamnese do perfil do paciente).
- Migra as 21 anamneses existentes no banco para o novo formato (script one-off).

---

## Modelo de Dados

Nenhuma mudança de schema — `Anamnesis.data` continua `Json` flexível (`backend/prisma/schema.prisma`, sem alteração). Muda apenas o *shape* que o frontend grava:

```ts
type AnamnesisFieldData = {
  texto: string;
  hipoteses: string[];
};

type AnamnesisData = {
  queixaPrincipal: AnamnesisFieldData;
  impacto: AnamnesisFieldData;
  historiaAtual: AnamnesisFieldData;
  historiaPregressa: AnamnesisFieldData;
};
```

- Sem chave `_template` — um único formato universal, não há mais seleção de modelo.
- A visão "hipóteses agrupadas" **não é armazenada** — é calculada em tempo de render, iterando os 4 campos nesta ordem fixa (QP → Impacto → HA → HP) e concatenando `hipoteses`, cada item com um marcador de origem (a label do campo).

---

## Frontend

### Novo arquivo: `frontend/src/components/anamnesis/anamnesis-fields.tsx`

Substitui `anamnesis-templates.tsx` e `anamnesis-primitives.tsx` (nenhum outro arquivo os importa — confirmado por grep).

```ts
export const ANAMNESIS_FIELDS = [
  { key: 'queixaPrincipal', label: 'Queixa Principal', question: 'Qual o motivo da sua consulta?' },
  { key: 'impacto', label: 'Impacto na Vida', question: 'O que você deixou de fazer por conta deste problema?' },
  { key: 'historiaAtual', label: 'História Atual', question: 'Descreva seu problema hoje.' },
  { key: 'historiaPregressa', label: 'História Pregressa', question: 'Descreva como seu problema vem evoluindo no tempo.' },
] as const;

export type AnamnesisFieldKey = typeof ANAMNESIS_FIELDS[number]['key'];
```

Componentes exportados (reaproveitam o visual de `FormRow`/`FieldTextarea` do antigo `anamnesis-primitives.tsx`, dobrados neste arquivo):

**`HypothesisField`**
```ts
{
  fieldKey: AnamnesisFieldKey;
  label: string;
  question: string;
  value: AnamnesisFieldData;
  onChange: (v: AnamnesisFieldData) => void;
}
```
- `FormRow(question)` + `FieldTextarea` ligado a `value.texto`.
- Quando `value.texto.trim() !== ''`: revela sub-bloco "Hipótese" — input de texto + botão "Adicionar" (`Enter` também adiciona), lista de `value.hipoteses` como chips/linhas removíveis (botão `x`).
- Hipóteses já adicionadas **não somem** se o texto principal for apagado depois — o reveal é só de exibição, não afeta os dados já salvos no estado.
- Campo hipótese vazio não adiciona (validação simples: `trim() !== ''`).

**`GroupedHypotheses`**
```ts
{ data: Partial<Record<AnamnesisFieldKey, AnamnesisFieldData>> }
```
- Itera `ANAMNESIS_FIELDS` na ordem fixa, achata `hipoteses` de cada campo em `{ texto, origem: label }[]`.
- Lista vazia → texto "Nenhuma hipótese registrada ainda".
- Cada item: texto da hipótese + tag pequena com a label de origem (ex: "Queixa Principal").
- Usado em dois lugares: dentro do formulário (`AnamnesisEditorPage`, antes dos botões salvar) e na visualização salva (`PatientProfile.tsx`, aba Anamnese).

### Reescrita: `frontend/src/pages/AnamnesisEditorPage.tsx`

- Remove `TemplateSelectionScreen`, `ANAMNESIS_TEMPLATES`, `SECTIONS`, `activeSection`, coluna de navegação por passos, barra de progresso, `isSectionDone`, `_template`.
- Estado: `formData: Record<AnamnesisFieldKey, AnamnesisFieldData>`, inicializado com `{ texto: '', hipoteses: [] }` para os 4 campos (ou populado de `existing.data` quando `anamnesisId` presente).
- Layout vira 2 colunas (`220px 1fr 280px` → `1fr 280px`): Card único com os 4 `HypothesisField` em sequência + `GroupedHypotheses` no final, mais a sidebar direita (card do paciente + atalhos) que **não muda**.
- `buildPayload()` retorna `formData` diretamente (sem `_template`).
- Botões "Salvar rascunho" / "Salvar e finalizar" mantêm o mesmo mutation/fluxo atual (`anamnesisApi.create`/`update`).
- Botão "Exportar PDF" já existia sem `onClick` funcional — permanece assim, fora de escopo.

### Atualização: `frontend/src/pages/PatientProfile.tsx` (aba Anamnese)

- Import troca de `anamnesis-templates` para `anamnesis-fields`.
- Renderização de cada `anamnesis.data`: se o objeto tiver as 4 chaves esperadas (`queixaPrincipal`, `impacto`, `historiaAtual`, `historiaPregressa`), usa o novo layout — cada campo mostra sua label + `texto`, seguido por um card `GroupedHypotheses` com as hipóteses daquela anamnese.
- Caso a chave não bata com o formato novo (não deve ocorrer após a migração, mas é um fallback barato), cai no renderer genérico atual (`Object.entries(anamnesis.data).map(...)`) — sem alteração nesse código existente.

### Remoção

- `frontend/src/pages/Anamnesis.tsx`
- `frontend/src/components/anamnesis/AnamnesisFormDialog.tsx`
- `frontend/src/components/anamnesis/anamnesis-templates.tsx`
- `frontend/src/components/anamnesis/anamnesis-primitives.tsx`
- Rota `/anamnesis` em `App.tsx` (linha 81) e o `lazy(() => import("./pages/Anamnesis"))` correspondente.

---

## Migração dos dados existentes

Script one-off em `backend/scripts/migrate-anamnesis-fields.ts` (não é migration do Prisma — schema não muda), rodado manualmente uma vez contra as 21 anamneses atuais:

- Para cada `Anamnesis` cujo `data` tenha `_template`:
  - `queixaPrincipal.texto` ← concatenação dos campos da seção `queixaPrincipal` do template antigo (`motivoConsulta`, `queixaPrincipal`, `tempoSintomas`, `formaInicio`, `evolucaoSintomas`).
  - `impacto.texto` ← concatenação da seção `impacto` (varia por template: `deixouFazer`, `impactoRotina`, `interferencia`, etc.).
  - `historiaAtual.texto` ← concatenação da seção equivalente a HMA no template (`molestiaAtual` em Dor Pélvica, `funcaoArmazenamento`+`perdaUrinaria` em Função Urinária, `funcaoIntestinal` em Função Evacuatória; templates de Gestação/Pós-Parto sem uma seção HMA clara usam `queixasAtuais`/`queixasImpacto`).
  - `historiaPregressa.texto` ← concatenação da seção `molestiaPregressa` (HMP) quando existir.
  - Seções sem mapeamento direto (`habitos`, `testesMovilidade`, `exameFisico`, `avaliacaoAbdominal`, `dadosGestacionais`, `dadosObstetricos` etc.) são anexadas como texto rotulado (`"[Hábitos] ..."`) ao final de `historiaPregressa.texto`, para não perder informação.
  - `conclusao.hipoteses` (string livre antiga) vira um único item em `historiaAtual.hipoteses`.
- Para `Anamnesis` sem `_template` (formato ainda mais antigo, do `AnamnesisFormDialog` — `Queixa Principal`/`Historico Medico`/`Habitos de Vida`/`Observacoes Gerais`): mapeamento equivalente por nome de seção, com `Historico Medico` e `Habitos de Vida` também caindo em `historiaPregressa.texto` rotulados.
- Script imprime um resumo antes/depois por registro (dry-run por padrão, flag `--apply` para gravar).
- Roda uma vez, 21 registros, conferência manual do output antes de aplicar.

---

## Testes

### Frontend

- `HypothesisField`: não revela a área de hipótese com `texto` vazio; revela ao digitar; adiciona hipótese via botão e via Enter; remove hipótese; hipóteses não somem ao limpar `texto`.
- `GroupedHypotheses`: agrupa e ordena pelos 4 campos na ordem correta; tag de origem correta; estado vazio quando nenhuma hipótese existe.
- `AnamnesisEditorPage`: payload salvo não contém `_template`; popula `formData` corretamente a partir de uma anamnese existente no novo formato.

### Backend

- Nenhum teste novo de service/controller — `data` continua `Json` livre, sem validação de schema no backend.
- Script de migração: validado manualmente (dry-run) contra os 21 registros reais antes de aplicar; não faz parte da suíte automatizada (execução única).

---

## Fora de Escopo

- Exportar PDF (botão já existe sem função, continua assim).
- Restringir edição de anamneses antigas (não se aplica — após a migração, todas passam a ter o formato novo).
- Qualquer alteração no módulo backend de anamnese (`backend/src/anamnesis/`) — CRUD e DTOs permanecem iguais, o campo `data` já é `Json` livre.
- Reaproveitamento dos 5 templates clínicos em qualquer forma (removidos por completo, não ficam como opção).
