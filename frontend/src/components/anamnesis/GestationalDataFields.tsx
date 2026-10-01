import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatGestationalAge, formatIsoDate } from '@/lib/gestational-age';
import { SelectField } from './SelectField';
import {
  CONCEPTION_LABELS,
  GA_SOURCE_LABELS,
  OBSTETRIC_RISK_LABELS,
  PREGNANCY_TYPE_LABELS,
  applyCalculatedDpp,
  calculatedDpp,
  changeGaSource,
  editDpp,
  recomputeGestational,
  setManualGa,
  type Conception,
  type GaSource,
  type GestationalData,
  type ObstetricRisk,
  type PregnancyType,
  type UltrasoundData,
} from './gestational-data';

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

function clampInt(raw: string, min: number, max: number): number {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function GestationalDataFields({
  value, onChange, assessmentDate, ultrasound,
}: {
  value: GestationalData;
  onChange: (value: GestationalData) => void;
  assessmentDate: string;
  ultrasound: UltrasoundData;
}) {
  const ctx = { assessmentDate, ultrasound };
  const source: GaSource = value.gaSource ?? 'DUM';
  const calculated = calculatedDpp(value, ctx);
  const showSuggestion = value.dppSource === 'MANUAL' && !!calculated && calculated !== value.dpp;
  const ga = value.gestationalAge;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="gd-dum" className="block text-[12.5px] font-medium text-muted-foreground">
            Data da última menstruação (DUM)
          </label>
          <Input
            id="gd-dum"
            type="date"
            value={value.dum ?? ''}
            onChange={(e) => onChange(recomputeGestational({ ...value, dum: e.target.value || undefined }, ctx))}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="gd-dpp" className="block text-[12.5px] font-medium text-muted-foreground">
            Data provável do parto (DPP)
          </label>
          <Input
            id="gd-dpp"
            type="date"
            value={value.dpp ?? ''}
            onChange={(e) => onChange(editDpp(value, e.target.value, ctx))}
          />
          {showSuggestion && (
            <p className="text-[12px] text-muted-foreground">
              DPP calculada: {formatIsoDate(calculated as string)}{' '}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-[12px]"
                onClick={() => onChange(applyCalculatedDpp(value, ctx))}
              >
                Aplicar DPP calculada
              </Button>
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="gd-source"
          label="Fonte da idade gestacional"
          allowEmpty={false}
          value={source}
          onChange={(v) => onChange(changeGaSource(value, v as GaSource, ctx))}
          options={toOptions(GA_SOURCE_LABELS)}
        />
        <div className="space-y-2">
          <span className="block text-[12.5px] font-medium text-muted-foreground">
            Idade gestacional na avaliação
          </span>
          <p data-testid="gd-ga" className="h-10 flex items-center text-[14px] font-medium">
            {ga ? formatGestationalAge(ga) : '—'}
            {ga?.manualOverride && (
              <span className="ml-2 text-[11px] font-normal text-muted-foreground">informada manualmente</span>
            )}
          </p>
        </div>
      </div>

      {source === 'MANUAL' && (
        <div className="grid grid-cols-2 gap-4 sm:max-w-xs">
          <div className="space-y-2">
            <label htmlFor="gd-weeks" className="block text-[12.5px] font-medium text-muted-foreground">
              Semanas
            </label>
            <Input
              id="gd-weeks"
              type="number"
              min={0}
              max={45}
              value={ga?.weeks ?? ''}
              onChange={(e) => onChange(setManualGa(value, clampInt(e.target.value, 0, 45), ga?.days ?? 0))}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="gd-days" className="block text-[12.5px] font-medium text-muted-foreground">
              Dias
            </label>
            <Input
              id="gd-days"
              type="number"
              min={0}
              max={6}
              value={ga?.days ?? ''}
              onChange={(e) => onChange(setManualGa(value, ga?.weeks ?? 0, clampInt(e.target.value, 0, 6)))}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          id="gd-type"
          label="Tipo de gestação"
          value={value.pregnancyType}
          onChange={(v) => onChange({ ...value, pregnancyType: (v || undefined) as PregnancyType | undefined })}
          options={toOptions(PREGNANCY_TYPE_LABELS)}
        />
        <SelectField
          id="gd-conception"
          label="Concepção"
          value={value.conception}
          onChange={(v) => onChange({ ...value, conception: (v || undefined) as Conception | undefined })}
          options={toOptions(CONCEPTION_LABELS)}
        />
        <SelectField
          id="gd-risk"
          label="Risco obstétrico"
          value={value.obstetricRisk}
          onChange={(v) => onChange({ ...value, obstetricRisk: (v || undefined) as ObstetricRisk | undefined })}
          options={toOptions(OBSTETRIC_RISK_LABELS)}
        />
      </div>
    </div>
  );
}
