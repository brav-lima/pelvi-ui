# Botões e Funções sem Implementação

Mapeamento de elementos interativos no frontend que existem visualmente mas não possuem lógica real. Levantado em 2026-06-16.

> **Atualizado em 2026-06-16:** Itens 2 e 3 implementados. Itens 1 e 4 ocultados (comentados no código) para implementação futura.

---

## 1. Exportar Pacientes

**Arquivo:** `frontend/src/pages/Patients.tsx:129`

```tsx
<Button variant="outline" size="sm">
  <Download className="w-3.5 h-3.5 mr-1.5" />
  Exportar
</Button>
```

**Problema:** Sem `onClick`. Botão decorativo.

**O que falta:** Definir formato de exportação (CSV/Excel/PDF) e implementar geração do arquivo com os dados da listagem atual (respeitando filtros e busca ativa).

---

## 2. Filtros rápidos de pacientes ("Com pacote" / "Sem agendamento")

**Arquivo:** `frontend/src/pages/Patients.tsx:158–170`

```tsx
{ label: 'Com pacote', count: activePackages.length },
{ label: 'Sem agendamento', count: null },
```

**Problema:** Renderizados com `cursor-default`, sem handler de clique. São chips decorativos — o clique não filtra nada.

**O que falta:**
- Adicionar estado de filtro ativo (`activeFilter: string | null`)
- Ao clicar em "Com pacote": filtrar pacientes que possuem pacote ativo (`ACTIVE`)
- Ao clicar em "Sem agendamento": filtrar pacientes sem agendamento futuro
- Ambos os filtros provavelmente precisam de endpoint ou parâmetro de query no backend (`hasActivePackage=true`, `hasUpcomingAppointment=false`)

---

## 3. Dropdown de ordenação de pacientes

**Arquivo:** `frontend/src/pages/Patients.tsx:173–176`

```tsx
<div className="... cursor-default select-none">
  Ordenar: Último atendimento
  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
</div>
```

**Problema:** Parece um dropdown mas é uma `div` estática com `cursor-default`. Nenhuma ordenação ocorre.

**O que falta:**
- Transformar em `DropdownMenu` (shadcn) com opções de ordenação: Nome (A-Z), Cadastro (mais recente), Último atendimento
- Passar parâmetro `orderBy` para o endpoint `GET /api/patients` (requer suporte no backend também)

---

## 4. Botão de filtro avançado de pacientes (ícone SlidersHorizontal)

**Arquivo:** `frontend/src/pages/Patients.tsx:177–179`

```tsx
<button className="...">
  <SlidersHorizontal className="w-4 h-4" />
</button>
```

**Problema:** Sem `onClick`. Ícone de filtro avançado sem ação.

**O que falta:** Definir o que o filtro avançado deve oferecer (ex.: gênero, faixa etária, cidade, status de pacote) e implementar um painel lateral ou popover com os controles.

---

## 5. Exportar Procedimentos

**Arquivo:** `frontend/src/pages/Procedures.tsx:103–106`

```tsx
<Button variant="outline" size="sm">
  <Download className="w-3.5 h-3.5 mr-1.5" />
  Exportar
</Button>
```

**Problema:** Sem `onClick`. Botão decorativo.

**O que falta:** Exportação da tabela de procedimentos (nome, duração, preço, status ativo/inativo) em CSV ou Excel.

---

## 6. Exportar PDF na Anamnese

**Arquivo:** `frontend/src/pages/AnamnesisEditorPage.tsx:212–215`

```tsx
<Button variant="outline" size="sm">
  <Download className="w-3.5 h-3.5 mr-1.5" />
  Exportar PDF
</Button>
```

**Problema:** Sem `onClick`. Botão decorativo.

**O que falta:** Gerar PDF da anamnese do paciente. Opções: `window.print()` com CSS de impressão, ou biblioteca como `@react-pdf/renderer` / `jsPDF`. Deve incluir cabeçalho com nome do paciente, data e nome da clínica.

---

## 7. Horário de funcionamento não controlado (Configurações)

**Arquivo:** `frontend/src/pages/Settings.tsx:479–488`

```tsx
<input
  defaultValue={h.from}   // ← defaultValue, não value
  disabled={!h.on}
  // sem onChange
/>
<input
  defaultValue={h.to}
  disabled={!h.on}
/>
```

**Problema:** Os inputs de hora (de/até) usam `defaultValue` sem `onChange`. O usuário consegue digitar, mas o estado `hours` nunca é atualizado. Ao salvar (`saveMutation`), os valores enviados são sempre os padrões iniciais — nunca o que o usuário digitou.

**O que falta:** Converter para inputs controlados:

```tsx
value={h.from}
onChange={(e) => setHours(prev =>
  prev.map((d, j) => j === i ? { ...d, from: e.target.value } : d)
)}
```

---

## Resumo

| # | Tela | Elemento | Tipo de gap | **Status** |
|---|------|----------|-------------|------------|
| 1 | Pacientes | Botão "Exportar" | Sem onClick | **Oculto (comentado)** |
| 2 | Pacientes | Chips "Com pacote" / "Sem agendamento" | Sem handler + sem lógica de filtro | **Implementado** |
| 3 | Pacientes | Dropdown "Ordenar" | Decorativo, sem lógica de sort | **Implementado** |
| 4 | Pacientes | Botão filtro avançado (sliders) | Sem onClick | **Oculto (comentado)** |
| 5 | Procedimentos | Botão "Exportar" | Sem onClick | — |
| 6 | Anamnese Editor | Botão "Exportar PDF" | Sem onClick | — |
| 7 | Configurações | Inputs de horário de funcionamento | Inputs não controlados, estado nunca atualiza | — |
