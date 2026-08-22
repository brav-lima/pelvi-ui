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
