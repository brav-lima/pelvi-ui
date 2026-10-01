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

export function formatAnamnesisKey(key: string): string {
  const result = key.replace(/([A-Z])/g, ' $1').toLowerCase();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

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
  if ('_template' in value) return false;
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
