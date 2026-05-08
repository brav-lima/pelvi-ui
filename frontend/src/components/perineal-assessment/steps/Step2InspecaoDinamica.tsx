import { Controller, type UseFormReturn } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SegmentedRadio } from '../fields/SegmentedRadio';
import { CheckboxGroup } from '../fields/CheckboxGroup';
import {
  movDirecaoOptions,
  presencaOptions,
  sinalOptions,
  tempoTripleOptions,
} from '../options';
import type { PerinealAssessmentFormData } from '../schema';

interface Props {
  form: UseFormReturn<PerinealAssessmentFormData>;
}

const superficiaisLista = [
  { key: 'isquiocavernosos', label: 'Isquiocavernosos' },
  { key: 'bulbocavernosos', label: 'Bulbocavernosos' },
  { key: 'transversosPerineais', label: 'Transversos perineais' },
  { key: 'esfincterAnalExterno', label: 'Esfíncter anal externo' },
] as const;

const escapeLista: Array<{
  key:
    | 'aberturaUretral'
    | 'aberturaAnal'
    | 'tosseUretral'
    | 'tosseAnal'
    | 'valsalvaUretral'
    | 'valsalvaAnal';
  label: string;
}> = [
  { key: 'aberturaUretral', label: 'Abertura — uretral' },
  { key: 'aberturaAnal', label: 'Abertura — anal' },
  { key: 'tosseUretral', label: 'Tosse — uretral' },
  { key: 'tosseAnal', label: 'Tosse — anal' },
  { key: 'valsalvaUretral', label: 'Valsalva — uretral' },
  { key: 'valsalvaAnal', label: 'Valsalva — anal' },
];

export function Step2InspecaoDinamica({ form }: Props) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Músculos superficiais</h5>
        <div className="grid gap-4">
          {superficiaisLista.map((m) => (
            <div key={m.key} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-md p-3">
              <SegmentedRadio
                control={form.control}
                name={`inspecaoDinamica.superficiais.${m.key}.atividade` as const}
                label={`${m.label} — atividade`}
                options={presencaOptions}
              />
              <SegmentedRadio
                control={form.control}
                name={`inspecaoDinamica.superficiais.${m.key}.assimetria` as const}
                label="Assimetria"
                options={sinalOptions}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Levantadores — atividade voluntária</h5>
        <SegmentedRadio
          control={form.control}
          name="inspecaoDinamica.levantadores.contracaoMovCranial"
          label="Contração — movimento cranial"
          options={movDirecaoOptions}
        />
        <CheckboxGroup
          control={form.control}
          name="inspecaoDinamica.levantadores.coContracoes"
          label="Co-contrações"
          hint="múltipla escolha"
          options={[
            { value: 'RESPIRATORIOS', label: 'Respiratórios' },
            { value: 'ABDOMINAIS', label: 'Abdominais' },
            { value: 'ADUTORES', label: 'Adutores' },
            { value: 'GLUTEOS', label: 'Glúteos' },
            { value: 'AUSENTE', label: 'Ausente' },
          ]}
        />
        <SegmentedRadio
          control={form.control}
          name="inspecaoDinamica.levantadores.relaxamentoMovCaudal"
          label="Relaxamento — movimento caudal"
          options={movDirecaoOptions}
        />
        <SegmentedRadio
          control={form.control}
          name="inspecaoDinamica.levantadores.relaxamentoAtraso"
          label="Relaxamento — atraso"
          options={sinalOptions}
        />
        <SegmentedRadio
          control={form.control}
          name="inspecaoDinamica.levantadores.abertura"
          label="Abertura"
          options={[
            { value: 'CAUDAL', label: 'Caudal' },
            { value: 'PRESENTE', label: 'Presente' },
            { value: 'AUSENTE', label: 'Ausente' },
            { value: 'CRANIAL', label: 'Cranial' },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Pré-contração — Tosse</h5>
        <div className="grid sm:grid-cols-3 gap-3">
          <SegmentedRadio
            control={form.control}
            name="inspecaoDinamica.levantadores.preContracaoTosse.antes"
            label="Antes"
            options={tempoTripleOptions}
          />
          <SegmentedRadio
            control={form.control}
            name="inspecaoDinamica.levantadores.preContracaoTosse.durante"
            label="Durante"
            options={tempoTripleOptions}
          />
          <SegmentedRadio
            control={form.control}
            name="inspecaoDinamica.levantadores.preContracaoTosse.depois"
            label="Depois"
            options={tempoTripleOptions}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Pré-contração — Valsalva</h5>
        <div className="grid sm:grid-cols-3 gap-3">
          <SegmentedRadio
            control={form.control}
            name="inspecaoDinamica.levantadores.preContracaoValsalva.antes"
            label="Antes"
            options={tempoTripleOptions}
          />
          <SegmentedRadio
            control={form.control}
            name="inspecaoDinamica.levantadores.preContracaoValsalva.durante"
            label="Durante"
            options={tempoTripleOptions}
          />
          <SegmentedRadio
            control={form.control}
            name="inspecaoDinamica.levantadores.preContracaoValsalva.depois"
            label="Depois"
            options={tempoTripleOptions}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Escape intra-teste</h5>
        <p className="text-xs text-muted-foreground">Marque os escapes observados.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {escapeLista.map((e) => (
            <Controller
              key={e.key}
              control={form.control}
              name={`inspecaoDinamica.escapeIntraTeste.${e.key}` as const}
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={!!field.value}
                    onCheckedChange={(c) => field.onChange(c === true ? true : undefined)}
                  />
                  <span>{e.label}</span>
                </label>
              )}
            />
          ))}
        </div>
        <Label className="text-xs text-muted-foreground italic">
          Suspender se houver dor.
        </Label>
      </section>
    </div>
  );
}
