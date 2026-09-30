import {
  ANAMNESIS_FIELDS,
  GroupedHypotheses,
  formatAnamnesisKey,
  isAnamnesisData,
} from './anamnesis-fields';

export function LegacyAnamnesisView({ data }: { data: Record<string, unknown> }) {
  if (isAnamnesisData(data)) {
    return (
      <div className="space-y-4">
        {ANAMNESIS_FIELDS.map((field) => (
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(data).map(([key, value]) => {
        if (key === '_template') return null;
        const sectionLabel = formatAnamnesisKey(key);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const section = value as Record<string, unknown>;
          return (
            <div key={key} className="border border-border rounded-lg p-4">
              <h4 className="text-[13.5px] font-semibold text-foreground mb-3 pb-2 border-b border-border">
                {sectionLabel}
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(section).map(([fk, fv]) => (
                  <div key={fk} className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-[12px] text-muted-foreground">{formatAnamnesisKey(fk)}</p>
                    <p className="text-[13px] font-medium mt-1">
                      {Array.isArray(fv)
                        ? fv.join(', ')
                        : fv != null && String(fv).trim() !== ''
                          ? String(fv)
                          : 'Não informado'}
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
              {Array.isArray(value)
                ? value.join(', ')
                : value != null && String(value).trim() !== ''
                  ? String(value)
                  : 'Não informado'}
            </p>
          </div>
        );
      })}
    </div>
  );
}
