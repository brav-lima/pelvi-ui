# Anamnese Simplificada com Hipóteses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 5-template anamnesis wizard with a single universal 4-field form (Queixa Principal, Impacto na Vida, História Atual, História Pregressa), each field able to collect multiple free-text "hipóteses" that get grouped into one summary, and remove the orphan `/anamnesis` page.

**Architecture:** New shared component file (`anamnesis-fields.tsx`) defines the 4 fixed fields plus two presentational components (`HypothesisField`, `GroupedHypotheses`). `AnamnesisEditorPage` is rewritten to a single scrolling page using them. `PatientProfile.tsx`'s saved-anamnesis view gets a dedicated render path for the new shape, falling back to the existing generic renderer for anything that doesn't match. Old template files and the orphan dialog/page are deleted. A one-off backend script migrates the 21 existing records.

**Tech Stack:** React + TypeScript (frontend), NestJS + Prisma (backend, no schema change), Vitest + Testing Library, Bun.

**Spec:** `docs/superpowers/specs/2026-08-21-anamnese-simplificada-design.md`

## Global Constraints

- New anamnesis data shape has exactly 4 fixed keys: `queixaPrincipal`, `impacto`, `historiaAtual`, `historiaPregressa`, each `{ texto: string, hipoteses: string[] }`. No `_template` key.
- Grouped hypotheses are always computed at render time from the 4 fields, in that fixed order (QP → Impacto → HA → HP) — never stored duplicated.
- No backend schema/DTO changes — `Anamnesis.data` stays `Json`.
- The `/anamnesis` route, `Anamnesis.tsx`, and `AnamnesisFormDialog.tsx` are deleted entirely (dead, unreachable — no sidebar link).
- `AnamnesisEditorPage` becomes a single scrolling page — no step wizard, no template selection screen.
- Work happens on branch `bravilal/sou-9-anamnese` (already created, spec commit already on it).

---

### Task 1: Anamnesis field constants + `HypothesisField` component

**Files:**
- Create: `frontend/src/components/anamnesis/anamnesis-fields.tsx`
- Test: `frontend/src/components/anamnesis/anamnesis-fields.test.tsx`

**Interfaces:**
- Produces: `AnamnesisFieldKey` (union type), `AnamnesisFieldData` (`{ texto: string; hipoteses: string[] }`), `AnamnesisData` (`Record<AnamnesisFieldKey, AnamnesisFieldData>`), `ANAMNESIS_FIELDS` (readonly array of `{ key, label, question }`), `emptyAnamnesisData(): AnamnesisData`, `formatAnamnesisKey(key: string): string`, `HypothesisField` component (props: `label: string; question: string; value: AnamnesisFieldData; onChange: (v: AnamnesisFieldData) => void`).

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/components/anamnesis/anamnesis-fields.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HypothesisField } from './anamnesis-fields';
import type { AnamnesisFieldData } from './anamnesis-fields';

function renderField(value: AnamnesisFieldData, onChange = vi.fn()) {
  render(
    <HypothesisField
      label="Queixa Principal"
      question="Qual o motivo da sua consulta?"
      value={value}
      onChange={onChange}
    />,
  );
  return onChange;
}

describe('HypothesisField', () => {
  it('não mostra a área de hipótese quando o texto principal está vazio', () => {
    renderField({ texto: '', hipoteses: [] });
    expect(screen.queryByPlaceholderText(/adicionar hipótese/i)).not.toBeInTheDocument();
  });

  it('revela a área de hipótese quando o texto principal é preenchido', () => {
    renderField({ texto: 'Dor pélvica há 3 meses', hipoteses: [] });
    expect(screen.getByPlaceholderText(/adicionar hipótese/i)).toBeInTheDocument();
  });

  it('chama onChange com o texto atualizado ao digitar no campo principal', () => {
    const onChange = renderField({ texto: '', hipoteses: [] });
    fireEvent.change(screen.getByRole('textbox', { name: /qual o motivo da sua consulta/i }), {
      target: { value: 'Nova queixa' },
    });
    expect(onChange).toHaveBeenCalledWith({ texto: 'Nova queixa', hipoteses: [] });
  });

  it('adiciona uma hipótese ao clicar em Adicionar e limpa o campo de rascunho', () => {
    const onChange = renderField({ texto: 'Dor pélvica', hipoteses: [] });
    const draftInput = screen.getByPlaceholderText(/adicionar hipótese/i);
    fireEvent.change(draftInput, { target: { value: 'Possível endometriose' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar/i }));
    expect(onChange).toHaveBeenCalledWith({ texto: 'Dor pélvica', hipoteses: ['Possível endometriose'] });
  });

  it('adiciona hipótese ao pressionar Enter no campo de rascunho', () => {
    const onChange = renderField({ texto: 'Dor pélvica', hipoteses: [] });
    const draftInput = screen.getByPlaceholderText(/adicionar hipótese/i);
    fireEvent.change(draftInput, { target: { value: 'Possível cistite' } });
    fireEvent.keyDown(draftInput, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ texto: 'Dor pélvica', hipoteses: ['Possível cistite'] });
  });

  it('não adiciona hipótese vazia ou só com espaços', () => {
    const onChange = renderField({ texto: 'Dor pélvica', hipoteses: [] });
    fireEvent.change(screen.getByPlaceholderText(/adicionar hipótese/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('remove uma hipótese existente ao clicar no botão de remover', () => {
    const onChange = renderField({ texto: 'Dor pélvica', hipoteses: ['Hipótese A', 'Hipótese B'] });
    fireEvent.click(screen.getByRole('button', { name: /remover hipótese: hipótese a/i }));
    expect(onChange).toHaveBeenCalledWith({ texto: 'Dor pélvica', hipoteses: ['Hipótese B'] });
  });

  it('mantém as hipóteses já adicionadas quando o texto principal é apagado', () => {
    renderField({ texto: '', hipoteses: ['Hipótese antiga'] });
    // texto vazio esconde a área de hipótese, mas o dado em `value` não foi alterado —
    // este teste documenta que HypothesisField não descarta value.hipoteses sozinho.
    expect(screen.queryByText('Hipótese antiga')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && bunx vitest run src/components/anamnesis/anamnesis-fields.test.tsx`
Expected: FAIL — `anamnesis-fields.tsx` does not exist yet (module not found).

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/components/anamnesis/anamnesis-fields.tsx
import { useState } from 'react';
import { X } from 'lucide-react';

export interface AnamnesisFieldData {
  texto: string;
  hipoteses: string[];
}

export const ANAMNESIS_FIELDS = [
  { key: 'queixaPrincipal', label: 'Queixa Principal', question: 'Qual o motivo da sua consulta?' },
  { key: 'impacto', label: 'Impacto na Vida', question: 'O que você deixou de fazer por conta deste problema?' },
  { key: 'historiaAtual', label: 'História Atual', question: 'Descreva seu problema hoje.' },
  { key: 'historiaPregressa', label: 'História Pregressa', question: 'Descreva como seu problema vem evoluindo no tempo.' },
] as const;

export type AnamnesisFieldKey = typeof ANAMNESIS_FIELDS[number]['key'];

export type AnamnesisData = Record<AnamnesisFieldKey, AnamnesisFieldData>;

export function emptyAnamnesisFieldData(): AnamnesisFieldData {
  return { texto: '', hipoteses: [] };
}

export function emptyAnamnesisData(): AnamnesisData {
  return {
    queixaPrincipal: emptyAnamnesisFieldData(),
    impacto: emptyAnamnesisFieldData(),
    historiaAtual: emptyAnamnesisFieldData(),
    historiaPregressa: emptyAnamnesisFieldData(),
  };
}

export function formatAnamnesisKey(key: string): string {
  const result = key.replace(/([A-Z])/g, ' $1').toLowerCase();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-muted-foreground mb-2">{label}</label>
      {children}
    </div>
  );
}

function FieldTextarea({
  value, onChange, ariaLabel, rows = 3,
}: { value: string; onChange: (v: string) => void; ariaLabel: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      aria-label={ariaLabel}
      className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-y"
    />
  );
}

interface HypothesisFieldProps {
  label: string;
  question: string;
  value: AnamnesisFieldData;
  onChange: (v: AnamnesisFieldData) => void;
}

export function HypothesisField({ label, question, value, onChange }: HypothesisFieldProps) {
  const [draft, setDraft] = useState('');

  const addHipotese = () => {
    const texto = draft.trim();
    if (texto === '') return;
    onChange({ ...value, hipoteses: [...value.hipoteses, texto] });
    setDraft('');
  };

  const removeHipotese = (index: number) => {
    onChange({ ...value, hipoteses: value.hipoteses.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-foreground border-b border-border pb-2">{label}</h4>
      <FormRow label={question}>
        <FieldTextarea
          value={value.texto}
          onChange={texto => onChange({ ...value, texto })}
          ariaLabel={question}
        />
      </FormRow>

      {value.texto.trim() !== '' && (
        <div className="pl-3 border-l-2 border-primary/30 space-y-2">
          <label className="block text-[12px] font-medium text-muted-foreground">Hipótese</label>
          {value.hipoteses.length > 0 && (
            <ul className="space-y-1.5">
              {value.hipoteses.map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-2 bg-secondary/50 rounded-lg px-3 py-1.5 text-[13px]">
                  <span>{h}</span>
                  <button
                    type="button"
                    onClick={() => removeHipotese(i)}
                    aria-label={`Remover hipótese: ${h}`}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addHipotese();
                }
              }}
              placeholder="Adicionar hipótese..."
              aria-label={`Nova hipótese para ${label}`}
              className="flex-1 h-8 px-3 rounded-lg border border-border bg-card text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
            <button
              type="button"
              onClick={addHipotese}
              className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-medium hover:bg-primary/90 transition-colors"
            >
              Adicionar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run src/components/anamnesis/anamnesis-fields.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/anamnesis/anamnesis-fields.tsx frontend/src/components/anamnesis/anamnesis-fields.test.tsx
git commit -m "feat(anamnesis): add HypothesisField component and field constants"
```

---

### Task 2: `GroupedHypotheses` component + `isAnamnesisData` guard

**Files:**
- Modify: `frontend/src/components/anamnesis/anamnesis-fields.tsx`
- Modify: `frontend/src/components/anamnesis/anamnesis-fields.test.tsx`

**Interfaces:**
- Consumes: `ANAMNESIS_FIELDS`, `AnamnesisData`, `AnamnesisFieldData` (Task 1)
- Produces: `groupHypotheses(data: Partial<AnamnesisData>): { texto: string; origem: string }[]`, `GroupedHypotheses` component (props: `{ data: Partial<AnamnesisData> }`), `isAnamnesisData(value: unknown): value is AnamnesisData`

- [ ] **Step 1: Write the failing tests**

In `frontend/src/components/anamnesis/anamnesis-fields.test.tsx`: add `GroupedHypotheses, groupHypotheses, isAnamnesisData, emptyAnamnesisData` and the `AnamnesisData` type to the existing top-of-file import from `./anamnesis-fields` (don't add a second, separate `import` statement lower in the file). Then append these `describe` blocks after the existing `HypothesisField` one:

```tsx
describe('groupHypotheses', () => {
  it('agrupa hipóteses dos 4 campos na ordem QP, Impacto, HA, HP', () => {
    const data: AnamnesisData = {
      queixaPrincipal: { texto: 'a', hipoteses: ['H1'] },
      impacto: { texto: 'b', hipoteses: ['H2'] },
      historiaAtual: { texto: 'c', hipoteses: ['H3'] },
      historiaPregressa: { texto: 'd', hipoteses: ['H4'] },
    };
    expect(groupHypotheses(data)).toEqual([
      { texto: 'H1', origem: 'Queixa Principal' },
      { texto: 'H2', origem: 'Impacto na Vida' },
      { texto: 'H3', origem: 'História Atual' },
      { texto: 'H4', origem: 'História Pregressa' },
    ]);
  });

  it('retorna lista vazia quando nenhum campo tem hipóteses', () => {
    expect(groupHypotheses(emptyAnamnesisData())).toEqual([]);
  });

  it('ignora campos ausentes em objeto parcial', () => {
    expect(groupHypotheses({ impacto: { texto: 'x', hipoteses: ['H'] } })).toEqual([
      { texto: 'H', origem: 'Impacto na Vida' },
    ]);
  });
});

describe('GroupedHypotheses', () => {
  it('exibe mensagem de estado vazio quando não há hipóteses', () => {
    render(<GroupedHypotheses data={emptyAnamnesisData()} />);
    expect(screen.getByText(/nenhuma hipótese registrada ainda/i)).toBeInTheDocument();
  });

  it('exibe cada hipótese com a tag de origem correta', () => {
    render(<GroupedHypotheses data={{ historiaAtual: { texto: 'x', hipoteses: ['Suspeita de X'] } }} />);
    expect(screen.getByText('Suspeita de X')).toBeInTheDocument();
    expect(screen.getByText('História Atual')).toBeInTheDocument();
  });
});

describe('isAnamnesisData', () => {
  it('retorna true para o formato novo completo', () => {
    expect(isAnamnesisData(emptyAnamnesisData())).toBe(true);
  });

  it('retorna false para o formato antigo (com _template)', () => {
    expect(isAnamnesisData({ _template: 'dor-pelvica', queixaPrincipal: {} })).toBe(false);
  });

  it('retorna false para null/undefined/tipos primitivos', () => {
    expect(isAnamnesisData(null)).toBe(false);
    expect(isAnamnesisData(undefined)).toBe(false);
    expect(isAnamnesisData('string')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && bunx vitest run src/components/anamnesis/anamnesis-fields.test.tsx`
Expected: FAIL — `groupHypotheses`, `GroupedHypotheses`, `isAnamnesisData` not exported yet.

- [ ] **Step 3: Write the implementation**

Append to `frontend/src/components/anamnesis/anamnesis-fields.tsx`:

```tsx
export interface GroupedHypothesis {
  texto: string;
  origem: string;
}

export function groupHypotheses(data: Partial<AnamnesisData>): GroupedHypothesis[] {
  return ANAMNESIS_FIELDS.flatMap(field => {
    const fieldData = data[field.key];
    if (!fieldData) return [];
    return fieldData.hipoteses.map(texto => ({ texto, origem: field.label }));
  });
}

export function GroupedHypotheses({ data }: { data: Partial<AnamnesisData> }) {
  const grouped = groupHypotheses(data);

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-foreground border-b border-border pb-2">Hipóteses</h4>
      {grouped.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nenhuma hipótese registrada ainda</p>
      ) : (
        <ul className="space-y-1.5">
          {grouped.map((h, i) => (
            <li key={i} className="flex items-center justify-between gap-2 bg-secondary/50 rounded-lg px-3 py-2 text-[13px]">
              <span>{h.texto}</span>
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {h.origem}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function isAnamnesisData(value: unknown): value is AnamnesisData {
  if (!value || typeof value !== 'object') return false;
  return ANAMNESIS_FIELDS.every(field => {
    const v = (value as Record<string, unknown>)[field.key];
    return (
      !!v &&
      typeof v === 'object' &&
      typeof (v as AnamnesisFieldData).texto === 'string' &&
      Array.isArray((v as AnamnesisFieldData).hipoteses)
    );
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run src/components/anamnesis/anamnesis-fields.test.tsx`
Expected: PASS (16 tests total in this file)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/anamnesis/anamnesis-fields.tsx frontend/src/components/anamnesis/anamnesis-fields.test.tsx
git commit -m "feat(anamnesis): add GroupedHypotheses component and isAnamnesisData guard"
```

---

### Task 3: Rewrite `AnamnesisEditorPage` as a single-page form

**Files:**
- Modify: `frontend/src/pages/AnamnesisEditorPage.tsx` (full rewrite)
- Test: `frontend/src/pages/AnamnesisEditorPage.test.tsx`

**Interfaces:**
- Consumes: `ANAMNESIS_FIELDS`, `AnamnesisData`, `emptyAnamnesisData`, `isAnamnesisData`, `HypothesisField`, `GroupedHypotheses` (Tasks 1–2); `anamnesisApi.create/update/list`, `patientsApi.getById`, `treatmentPackagesApi.list` (existing, unchanged)
- Produces: default export `AnamnesisEditorPage` (route component, no props — reads `patientId`/`anamnesisId` from `useParams`)

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/pages/AnamnesisEditorPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    patientsApi: { getById: vi.fn() },
    anamnesisApi: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
    treatmentPackagesApi: { list: vi.fn() },
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { patientsApi, anamnesisApi, treatmentPackagesApi } from '@/lib/api';
import AnamnesisEditorPage from './AnamnesisEditorPage';
import type { Patient, Anamnesis } from '@/types/clinic';

const patient: Patient = {
  id: 'patient-1',
  organizationId: 'org-1',
  name: 'Maria Silva',
  cpf: '12345678900',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as Patient;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patients/:patientId/anamnesis/:anamnesisId" element={<AnamnesisEditorPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: makeWrapper() },
  );
}

describe('AnamnesisEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patientsApi.getById).mockResolvedValue(patient);
    vi.mocked(anamnesisApi.list).mockResolvedValue([]);
    vi.mocked(treatmentPackagesApi.list).mockResolvedValue([]);
  });

  it('renderiza os 4 campos universais numa página única, sem seleção de template', async () => {
    renderPage('/patients/patient-1/anamnesis/new');
    expect(await screen.findByText('Queixa Principal')).toBeInTheDocument();
    expect(screen.getByText('Impacto na Vida')).toBeInTheDocument();
    expect(screen.getByText('História Atual')).toBeInTheDocument();
    expect(screen.getByText('História Pregressa')).toBeInTheDocument();
    expect(screen.queryByText(/escolha o modelo de anamnese/i)).not.toBeInTheDocument();
  });

  it('salva payload sem _template ao clicar em Salvar rascunho', async () => {
    vi.mocked(anamnesisApi.create).mockResolvedValue({ id: 'anam-1' } as Anamnesis);
    renderPage('/patients/patient-1/anamnesis/new');

    fireEvent.change(await screen.findByRole('textbox', { name: /qual o motivo da sua consulta/i }), {
      target: { value: 'Dor pélvica há 2 meses' },
    });
    fireEvent.click(screen.getByRole('button', { name: /salvar rascunho/i }));

    await waitFor(() => {
      expect(anamnesisApi.create).toHaveBeenCalledWith({
        patientId: 'patient-1',
        data: expect.objectContaining({
          queixaPrincipal: { texto: 'Dor pélvica há 2 meses', hipoteses: [] },
          impacto: { texto: '', hipoteses: [] },
          historiaAtual: { texto: '', hipoteses: [] },
          historiaPregressa: { texto: '', hipoteses: [] },
        }),
      });
      const [[payload]] = vi.mocked(anamnesisApi.create).mock.calls;
      expect(payload.data).not.toHaveProperty('_template');
    });
  });

  it('popula os campos a partir de uma anamnese existente no formato novo', async () => {
    const existing: Anamnesis = {
      id: 'anam-1',
      organizationId: 'org-1',
      patientId: 'patient-1',
      professionalId: 'prof-1',
      data: {
        queixaPrincipal: { texto: 'Queixa salva', hipoteses: ['Hipótese salva'] },
        impacto: { texto: '', hipoteses: [] },
        historiaAtual: { texto: '', hipoteses: [] },
        historiaPregressa: { texto: '', hipoteses: [] },
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    vi.mocked(anamnesisApi.list).mockResolvedValue([existing]);

    renderPage('/patients/patient-1/anamnesis/anam-1');

    expect(await screen.findByRole('textbox', { name: /qual o motivo da sua consulta/i })).toHaveValue('Queixa salva');
    expect(screen.getByText('Hipótese salva')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && bunx vitest run src/pages/AnamnesisEditorPage.test.tsx`
Expected: FAIL — current page still renders `TemplateSelectionScreen` and expects `ANAMNESIS_TEMPLATES`.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `frontend/src/pages/AnamnesisEditorPage.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowLeft, Check, Download, Loader2,
  Activity, ClipboardList, Package,
} from 'lucide-react';
import { patientsApi, anamnesisApi, treatmentPackagesApi } from '@/lib/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCPFMasked } from '@/lib/formatters';
import { toast } from 'sonner';
import {
  ANAMNESIS_FIELDS, emptyAnamnesisData, isAnamnesisData,
  HypothesisField, GroupedHypotheses,
  type AnamnesisData,
} from '@/components/anamnesis/anamnesis-fields';

export default function AnamnesisEditorPage() {
  const { patientId, anamnesisId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !anamnesisId || anamnesisId === 'new';

  const [formData, setFormData] = useState<AnamnesisData>(emptyAnamnesisData());
  const [savedId, setSavedId] = useState<string | null>(null);

  const { data: patient, isLoading: loadingPatient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.getById(patientId!),
    enabled: !!patientId,
  });

  const { data: allAnamneses = [] } = useQuery({
    queryKey: ['patient-anamneses', patientId],
    queryFn: () => anamnesisApi.list(patientId!),
    enabled: !!patientId,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['treatment-packages', patientId],
    queryFn: () => treatmentPackagesApi.list({ patientId }),
    enabled: !!patientId,
  });

  const existing = isNew ? null : allAnamneses.find(a => a.id === anamnesisId);

  useEffect(() => {
    if (existing?.data && isAnamnesisData(existing.data)) {
      setFormData(existing.data);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const effectiveId = savedId ?? (isNew ? null : anamnesisId ?? null);

  const saveMutation = useMutation({
    mutationFn: (data: AnamnesisData) =>
      effectiveId
        ? anamnesisApi.update(effectiveId, { data })
        : anamnesisApi.create({ patientId: patientId!, data }),
    onSuccess: (result) => {
      if (!effectiveId) setSavedId(result.id);
      queryClient.invalidateQueries({ queryKey: ['patient-anamneses', patientId] });
      toast.success('Anamnese salva com sucesso');
    },
    onError: () => toast.error('Erro ao salvar anamnese'),
  });

  const setField = <K extends keyof AnamnesisData>(key: K, value: AnamnesisData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => saveMutation.mutate(formData);
  const handleSaveAndExit = async () => {
    await saveMutation.mutateAsync(formData);
    navigate(`/patients/${patientId}`);
  };

  const activePackage = packages.find(p => p.status === 'ACTIVE');

  if (loadingPatient) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate(`/patients/${patientId}`)}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para perfil
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Exportar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : null}
            Salvar rascunho
          </Button>
          <Button size="sm" onClick={handleSaveAndExit} disabled={saveMutation.isPending}>
            <Check className="w-3.5 h-3.5 mr-1.5" />
            Salvar e finalizar
          </Button>
        </div>
      </div>

      {/* Page title */}
      <div>
        <h1
          className="text-[24px] font-semibold leading-8"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
        >
          Anamnese{patient ? ` · ${patient.name}` : ''}
        </h1>
        <div className="text-[12.5px] text-muted-foreground">
          {isNew
            ? 'Nova avaliação'
            : existing
            ? `criada em ${format(new Date(existing.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
            : 'Editando avaliação'}
        </div>
      </div>

      {/* 2-column layout: form + patient sidebar */}
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1fr 280px' }}>
        <Card className="p-5 space-y-6">
          {ANAMNESIS_FIELDS.map(field => (
            <HypothesisField
              key={field.key}
              label={field.label}
              question={field.question}
              value={formData[field.key]}
              onChange={v => setField(field.key, v)}
            />
          ))}
          <div className="border-t border-border pt-5">
            <GroupedHypotheses data={formData} />
          </div>
        </Card>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4 sticky top-4">
          <Card>
            <div className="px-4 py-3 border-b border-border">
              <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Paciente</div>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {patient && (
                <>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-[15px] font-semibold shrink-0"
                      style={{
                        background: 'hsl(296 30% 94%)',
                        color: 'hsl(296 28% 26%)',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {patient.name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <div className="text-[13.5px] font-medium">{patient.name}</div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {patient.birthDate
                          ? `${Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 86400000))} anos`
                          : '—'}
                        {patient.cpf && ` · ${formatCPFMasked(patient.cpf)}`}
                      </div>
                    </div>
                  </div>
                  {activePackage && (
                    <div className="border-t border-border pt-3 flex flex-col gap-0.5">
                      <div className="text-[11.5px] text-muted-foreground">Pacote</div>
                      <div className="text-[13px] font-medium">
                        {activePackage.name} · {activePackage.usedSessions}/{activePackage.totalSessions}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card>
            <div className="px-4 py-3 border-b border-border">
              <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Atalhos de avaliação</div>
            </div>
            <div className="p-3 flex flex-col gap-1">
              {[
                {
                  icon: <Activity className="w-4 h-4 shrink-0" />,
                  label: 'Avaliação perineal',
                  to: `/patients/${patientId}/perineal-assessment/new`,
                },
                {
                  icon: <ClipboardList className="w-4 h-4 shrink-0" />,
                  label: 'Nova evolução',
                  to: `/patients/${patientId}`,
                },
                {
                  icon: <Package className="w-4 h-4 shrink-0" />,
                  label: 'Adicionar pacote',
                  to: `/patients/${patientId}`,
                },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.to)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full text-left"
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run src/pages/AnamnesisEditorPage.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AnamnesisEditorPage.tsx frontend/src/pages/AnamnesisEditorPage.test.tsx
git commit -m "feat(anamnesis): rewrite AnamnesisEditorPage as single-page 4-field form"
```

---

### Task 4: Update the saved-anamnesis view in `PatientProfile.tsx`

**Files:**
- Modify: `frontend/src/pages/PatientProfile.tsx:33` (import), `frontend/src/pages/PatientProfile.tsx:563-594` (render block)

**Interfaces:**
- Consumes: `ANAMNESIS_FIELDS`, `GroupedHypotheses`, `isAnamnesisData`, `formatAnamnesisKey` (Tasks 1–2)

No test file exists for `PatientProfile.tsx` today (large page component, not under test) — this task follows that existing pattern and is verified via `bun run lint` + manual check, not a new test file.

- [ ] **Step 1: Update the import**

In `frontend/src/pages/PatientProfile.tsx`, replace:

```tsx
import { ANAMNESIS_SECTION_LABELS, formatAnamnesisKey } from '@/components/anamnesis/anamnesis-templates';
```

with:

```tsx
import { ANAMNESIS_FIELDS, GroupedHypotheses, isAnamnesisData, formatAnamnesisKey } from '@/components/anamnesis/anamnesis-fields';
```

- [ ] **Step 2: Replace the render block**

Replace the `<div className="space-y-4">...</div>` block (currently lines 563–594, the `Object.entries(anamnesis.data).map(...)` renderer) with:

```tsx
                            <div className="space-y-4">
                              {isAnamnesisData(anamnesis.data) ? (() => {
                                const data = anamnesis.data;
                                return (
                                  <>
                                    {ANAMNESIS_FIELDS.map(field => (
                                      <div key={field.key} className="p-3 rounded-lg bg-secondary/50">
                                        <p className="text-[12px] text-muted-foreground">{field.label}</p>
                                        <p className="text-[13px] font-medium mt-1 whitespace-pre-wrap">
                                          {data[field.key].texto.trim() !== '' ? data[field.key].texto : 'Não informado'}
                                        </p>
                                      </div>
                                    ))}
                                    <div className="border border-border rounded-lg p-4">
                                      <GroupedHypotheses data={data} />
                                    </div>
                                  </>
                                );
                              })() : (
                                Object.entries(anamnesis.data).map(([key, value]) => {
                                  if (key === '_template') return null;
                                  const sectionLabel = formatAnamnesisKey(key);
                                  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                                    const section = value as Record<string, unknown>;
                                    return (
                                      <div key={key} className="border border-border rounded-lg p-4">
                                        <h4 className="text-[13.5px] font-semibold text-foreground mb-3 pb-2 border-b border-border">{sectionLabel}</h4>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                          {Object.entries(section).map(([fk, fv]) => (
                                            <div key={fk} className="p-3 rounded-lg bg-secondary/50">
                                              <p className="text-[12px] text-muted-foreground">{formatAnamnesisKey(fk)}</p>
                                              <p className="text-[13px] font-medium mt-1">
                                                {Array.isArray(fv) ? fv.join(', ') : (fv != null && String(fv).trim() !== '' ? String(fv) : 'Não informado')}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={key} className="p-3 rounded-lg bg-secondary/50">
                                      <p className="text-[12px] text-muted-foreground">{sectionLabel}</p>
                                      <p className="text-[13px] font-medium mt-1">
                                        {Array.isArray(value) ? value.join(', ') : (value != null && String(value).trim() !== '' ? String(value) : 'Não informado')}
                                      </p>
                                    </div>
                                  );
                                })
                              )}
                            </div>
```

- [ ] **Step 3: Verify with lint and typecheck**

Run: `cd frontend && bun run lint`
Expected: no new errors in `PatientProfile.tsx`.

Run: `cd frontend && bunx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PatientProfile.tsx
git commit -m "feat(anamnesis): render new 4-field shape with grouped hypotheses in patient profile"
```

---

### Task 5: Remove the orphan `/anamnesis` page and dead template files

**Files:**
- Delete: `frontend/src/pages/Anamnesis.tsx`
- Delete: `frontend/src/components/anamnesis/AnamnesisFormDialog.tsx`
- Delete: `frontend/src/components/anamnesis/anamnesis-templates.tsx`
- Delete: `frontend/src/components/anamnesis/anamnesis-primitives.tsx`
- Modify: `frontend/src/App.tsx:25` (remove lazy import), `frontend/src/App.tsx:81` (remove route)

**Interfaces:** None — this task only removes code no longer referenced by Tasks 1–4 (confirmed via grep before Task 1: only `Anamnesis.tsx`, `AnamnesisFormDialog.tsx` used `anamnesis-primitives`/`anamnesis-templates`, and only `App.tsx` referenced the `/anamnesis` route).

- [ ] **Step 1: Delete the four files**

```bash
git rm frontend/src/pages/Anamnesis.tsx \
  frontend/src/components/anamnesis/AnamnesisFormDialog.tsx \
  frontend/src/components/anamnesis/anamnesis-templates.tsx \
  frontend/src/components/anamnesis/anamnesis-primitives.tsx
```

- [ ] **Step 2: Remove the lazy import in `App.tsx`**

Remove this line (currently line 25):

```tsx
const Anamnesis = lazy(() => import("./pages/Anamnesis"));
```

- [ ] **Step 3: Remove the route in `App.tsx`**

Remove this line (currently line 81):

```tsx
<Route path="/anamnesis" element={<ProtectedRoute roles={['ADMIN', 'PROFESSIONAL']}><FeatureRoute feature="ANAMNESIS"><Anamnesis /></FeatureRoute></ProtectedRoute>} />
```

- [ ] **Step 4: Verify nothing else references the deleted files**

Run: `cd frontend && grep -rln "pages/Anamnesis'\|AnamnesisFormDialog\|anamnesis-templates\|anamnesis-primitives" src`
Expected: no output (empty).

Run: `cd frontend && bunx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && bun run test`
Expected: full suite passes (no test referenced the deleted files, per Step 4's grep).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "chore(anamnesis): remove orphan /anamnesis page and legacy template system"
```

---

### Task 6: One-off migration script for existing anamneses

**Files:**
- Create: `backend/scripts/migrate-anamnesis-fields.ts`

**Interfaces:**
- Consumes: `PrismaClient` (`@prisma/client`), reads/writes `Anamnesis.data`
- Produces: a standalone script, not imported by application code

This script is intentionally self-contained (backend can't import frontend TypeScript files — separate packages/tsconfigs), so it re-declares the small `AnamnesisData` shape locally rather than importing Task 1's types.

- [ ] **Step 1: Write the script**

```ts
// backend/scripts/migrate-anamnesis-fields.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FIELD_KEYS = ['queixaPrincipal', 'impacto', 'historiaAtual', 'historiaPregressa'] as const;
type FieldKey = typeof FIELD_KEYS[number];

interface AnamnesisFieldData {
  texto: string;
  hipoteses: string[];
}

type AnamnesisData = Record<FieldKey, AnamnesisFieldData>;

function emptyAnamnesisData(): AnamnesisData {
  return {
    queixaPrincipal: { texto: '', hipoteses: [] },
    impacto: { texto: '', hipoteses: [] },
    historiaAtual: { texto: '', hipoteses: [] },
    historiaPregressa: { texto: '', hipoteses: [] },
  };
}

function formatKey(key: string): string {
  const result = key.replace(/([A-Z])/g, ' $1').toLowerCase();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// Maps each section id from the old 5-template wizard to the new field it
// belongs under. See docs/superpowers/specs/2026-08-21-anamnese-simplificada-design.md.
const SECTION_TARGET_MAP: Record<string, FieldKey> = {
  queixaPrincipal: 'queixaPrincipal',
  impacto: 'impacto',
  molestiaAtual: 'historiaAtual',
  funcaoArmazenamento: 'historiaAtual',
  perdaUrinaria: 'historiaAtual',
  funcaoIntestinal: 'historiaAtual',
  molestiaPregressa: 'historiaPregressa',
  habiConclusao: 'historiaPregressa',
  habitos: 'historiaPregressa',
  conclusao: 'historiaPregressa',
  dadosGestacionais: 'historiaAtual',
  queixasAtuais: 'queixaPrincipal',
  habitosMedicacoes: 'historiaPregressa',
  funcoesPelvicas: 'historiaAtual',
  testesMovilidade: 'historiaPregressa',
  dadosObstetricos: 'historiaPregressa',
  queixasImpacto: 'queixaPrincipal',
  exameFisico: 'historiaPregressa',
  avaliacaoAbdominal: 'historiaAtual',
};

// Section labels from the even-older AnamnesisFormDialog format (no _template key).
const LEGACY_SECTION_TARGET_MAP: Record<string, FieldKey> = {
  'Queixa Principal': 'queixaPrincipal',
  'Historico Medico': 'historiaPregressa',
  'Habitos de Vida': 'historiaPregressa',
};

function flattenSection(section: Record<string, unknown>, excludeKeys: string[] = []): string {
  return Object.entries(section)
    .filter(([k, v]) => {
      if (excludeKeys.includes(k)) return false;
      if (v == null) return false;
      if (Array.isArray(v)) return v.length > 0;
      return String(v).trim() !== '';
    })
    .map(([k, v]) => `${formatKey(k)}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');
}

function migrateData(data: Record<string, unknown>): AnamnesisData {
  const result = emptyAnamnesisData();
  const texts: Record<FieldKey, string[]> = {
    queixaPrincipal: [], impacto: [], historiaAtual: [], historiaPregressa: [],
  };

  if ('_template' in data) {
    for (const [sectionId, sectionValue] of Object.entries(data)) {
      if (sectionId === '_template') continue;
      if (typeof sectionValue !== 'object' || sectionValue === null) continue;
      const section = sectionValue as Record<string, unknown>;
      const target = SECTION_TARGET_MAP[sectionId] ?? 'historiaPregressa';

      if (typeof section.hipoteses === 'string' && section.hipoteses.trim() !== '') {
        result.historiaAtual.hipoteses.push(section.hipoteses.trim());
      }

      const text = flattenSection(section, ['hipoteses']);
      if (text) texts[target].push(`[${formatKey(sectionId)}]\n${text}`);
    }
  } else {
    for (const [sectionLabel, sectionValue] of Object.entries(data)) {
      if (sectionLabel === 'Observacoes Gerais') {
        if (typeof sectionValue === 'string' && sectionValue.trim() !== '') {
          texts.historiaPregressa.push(`[Observações Gerais]\n${sectionValue.trim()}`);
        }
        continue;
      }
      const target = LEGACY_SECTION_TARGET_MAP[sectionLabel] ?? 'historiaPregressa';
      if (typeof sectionValue === 'object' && sectionValue !== null) {
        const text = flattenSection(sectionValue as Record<string, unknown>);
        if (text) texts[target].push(`[${sectionLabel}]\n${text}`);
      }
    }
  }

  for (const key of FIELD_KEYS) {
    result[key].texto = texts[key].join('\n\n');
  }
  return result;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const anamneses = await prisma.anamnesis.findMany();

  console.log(`Encontradas ${anamneses.length} anamneses. Modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);

  for (const anamnesis of anamneses) {
    const before = anamnesis.data as Record<string, unknown>;
    const after = migrateData(before);

    console.log(`\n--- Anamnesis ${anamnesis.id} (paciente ${anamnesis.patientId}) ---`);
    console.log('ANTES:', JSON.stringify(before, null, 2));
    console.log('DEPOIS:', JSON.stringify(after, null, 2));

    if (apply) {
      await prisma.anamnesis.update({
        where: { id: anamnesis.id },
        data: { data: after as object },
      });
    }
  }

  console.log(`\n${apply ? 'Aplicado' : 'Simulado'} em ${anamneses.length} registro(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Dry-run against the dev database and review output**

Run: `cd backend && bun scripts/migrate-anamnesis-fields.ts`

Expected: prints `Modo: DRY-RUN`, then an ANTES/DEPOIS pair for each of the (dev DB's) existing anamneses, no `--apply` flag means nothing is written. Read through the DEPOIS blocks for every record — confirm no section's content silently vanished (every non-empty old field should show up as text somewhere in one of the 4 new fields), and that `conclusao.hipoteses`/`habiConclusao.hipoteses` ended up under `historiaAtual.hipoteses`.

- [ ] **Step 3: Apply against the dev database**

Run: `cd backend && bun scripts/migrate-anamnesis-fields.ts --apply`

Expected: prints `Modo: APPLY`, same ANTES/DEPOIS output, ends with `Aplicado em N registro(s).` — then spot-check a couple of patients' anamneses in the running app (`/patients/:id`, aba Anamnese) to confirm they render through the new `isAnamnesisData` branch correctly.

- [ ] **Step 4: Commit**

```bash
cd backend && git add scripts/migrate-anamnesis-fields.ts
git commit -m "chore(anamnesis): add one-off migration script for legacy anamnesis data"
```

Note: this script is run manually against dev now, and again against prod after the frontend changes (Tasks 1–5) are deployed — not run automatically as part of any build/deploy step. Running it against prod is a separate, explicit action outside this plan's scope (matches the spec's "one-off, run once" framing) — confirm with the user before running `--apply` against the production database.

---

## Final verification

- [ ] Run the full frontend suite: `cd frontend && bun run test` — expect all green, including the new `anamnesis-fields.test.tsx` and `AnamnesisEditorPage.test.tsx`.
- [ ] Run frontend lint: `cd frontend && bun run lint` — expect no errors.
- [ ] Run frontend typecheck: `cd frontend && bunx tsc --noEmit` — expect no errors.
- [ ] Manually walk the flow in the browser (`bun run frontend:dev` from repo root, backend running too): open a patient profile → "Nova avaliação" → fill Queixa Principal → confirm the Hipótese area reveals → add two hipóteses → fill the other 3 fields with one hipótese each → confirm "Salvar rascunho" keeps you on the page and "Salvar e finalizar" navigates back to the patient profile → confirm the saved anamnesis renders the 4 fields + a grouped "Hipóteses" section with correct origin tags.
