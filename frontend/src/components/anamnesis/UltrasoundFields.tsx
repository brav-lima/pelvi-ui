import { Input } from '@/components/ui/input';
import { SelectField } from './SelectField';
import { FETAL_PRESENTATION_LABELS, type FetalPresentation, type UltrasoundData } from './gestational-data';

const presentationOptions = Object.entries(FETAL_PRESENTATION_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function TextField({
  id, label, value, onChange, placeholder,
}: { id: string; label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[12.5px] font-medium text-muted-foreground">
        {label}
      </label>
      <Input id={id} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function parseOptionalInt(raw: string): number | undefined {
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
}

export function UltrasoundFields({
  value, onChange,
}: { value: UltrasoundData; onChange: (value: UltrasoundData) => void }) {
  const set = (patch: Partial<UltrasoundData>) => {
    const next = { ...value, ...patch };
    for (const key of Object.keys(next) as (keyof UltrasoundData)[]) {
      if (next[key] === undefined || next[key] === '') delete next[key];
    }
    onChange(next);
  };

  const setGa = (key: 'weeks' | 'days', raw: string) => {
    const gaAtExam = { ...value.gaAtExam, [key]: parseOptionalInt(raw) };
    if (gaAtExam.weeks === undefined) delete gaAtExam.weeks;
    if (gaAtExam.days === undefined) delete gaAtExam.days;
    set({ gaAtExam: Object.keys(gaAtExam).length ? gaAtExam : undefined });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="us-date" className="block text-[12.5px] font-medium text-muted-foreground">
            Data do exame
          </label>
          <Input id="us-date" type="date" value={value.date ?? ''} onChange={(e) => set({ date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <label htmlFor="us-weeks" className="block text-[12.5px] font-medium text-muted-foreground">
            IG no exame — semanas
          </label>
          <Input
            id="us-weeks"
            type="number"
            min={0}
            max={45}
            value={value.gaAtExam?.weeks ?? ''}
            onChange={(e) => setGa('weeks', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="us-days" className="block text-[12.5px] font-medium text-muted-foreground">
            IG no exame — dias
          </label>
          <Input
            id="us-days"
            type="number"
            min={0}
            max={6}
            value={value.gaAtExam?.days ?? ''}
            onChange={(e) => setGa('days', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="us-weight"
          label="Peso fetal estimado"
          value={value.estimatedFetalWeight}
          placeholder="ex.: 2.450 g"
          onChange={(v) => set({ estimatedFetalWeight: v })}
        />
        <TextField
          id="us-percentile"
          label="Percentil fetal"
          value={value.fetalPercentile}
          onChange={(v) => set({ fetalPercentile: v })}
        />
        <SelectField
          id="us-presentation"
          label="Apresentação fetal"
          value={value.fetalPresentation}
          onChange={(v) => set({ fetalPresentation: (v || undefined) as FetalPresentation | undefined })}
          options={presentationOptions}
        />
        {value.fetalPresentation === 'OUTRO' && (
          <TextField
            id="us-presentation-other"
            label="Descreva a apresentação"
            value={value.fetalPresentationOther}
            onChange={(v) => set({ fetalPresentationOther: v })}
          />
        )}
        <TextField
          id="us-placenta"
          label="Localização placentária"
          value={value.placentaLocation}
          onChange={(v) => set({ placentaLocation: v })}
        />
        <TextField
          id="us-cervix"
          label="Comprimento do colo uterino"
          value={value.cervicalLength}
          onChange={(v) => set({ cervicalLength: v })}
        />
        <TextField
          id="us-fluid"
          label="Líquido amniótico"
          value={value.amnioticFluid}
          onChange={(v) => set({ amnioticFluid: v })}
        />
      </div>
    </div>
  );
}
