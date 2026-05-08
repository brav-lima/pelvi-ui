import type { UseFormReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SegmentedRadio } from '../fields/SegmentedRadio';
import { CheckboxGroup } from '../fields/CheckboxGroup';
import { escala3Options } from '../options';
import type { PerinealAssessmentFormData } from '../schema';

interface Props {
  form: UseFormReturn<PerinealAssessmentFormData>;
}

const superficiais: Array<{
  key: 'bc' | 'ic' | 'tp' | 'eas' | 'rbd';
  label: string;
}> = [
  { key: 'bc', label: 'BC' },
  { key: 'ic', label: 'IC' },
  { key: 'tp', label: 'TP' },
  { key: 'eas', label: 'EAS' },
  { key: 'rbd', label: 'RBD' },
];

const levantadores: Array<{
  key: 'pv' | 'pp' | 'pa' | 'pr' | 'ic';
  label: string;
}> = [
  { key: 'pv', label: 'PV' },
  { key: 'pp', label: 'PP' },
  { key: 'pa', label: 'PA' },
  { key: 'pr', label: 'PR' },
  { key: 'ic', label: 'IC' },
];

export function Step6Diagnostico({ form }: Props) {
  return (
    <div className="space-y-6">
      <CheckboxGroup
        control={form.control}
        name="diagnostico.classificacoes"
        label="Classificação geral"
        hint="múltipla escolha"
        options={[
          { value: 'IMPERCEBIDO', label: 'Imperceptível' },
          { value: 'HIPERTONICO', label: 'Hipertônico' },
          { value: 'HIPERATIVO', label: 'Hiperativo' },
          { value: 'HIPOTROFICO', label: 'Hipotrófico' },
          { value: 'HIPOTONICO', label: 'Hipotônico' },
          { value: 'INCOORDENADO', label: 'Incoordenado' },
          { value: 'DESPROGRAMADO', label: 'Desprogramado' },
        ]}
      />

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Detalhamento — superficiais</h5>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {superficiais.map((m) => (
            <SegmentedRadio
              key={m.key}
              control={form.control}
              name={`diagnostico.superficiaisDetalhe.${m.key}` as const}
              label={m.label}
              options={escala3Options}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Detalhamento — levantadores</h5>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {levantadores.map((m) => (
            <SegmentedRadio
              key={m.key}
              control={form.control}
              name={`diagnostico.levantadoresDetalhe.${m.key}` as const}
              label={m.label}
              options={escala3Options}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Detalhamento — rotadores</h5>
        <div className="grid grid-cols-2 gap-3">
          <SegmentedRadio
            control={form.control}
            name="diagnostico.rotadoresDetalhe.piriformes"
            label="Piriformes"
            options={escala3Options}
          />
          <SegmentedRadio
            control={form.control}
            name="diagnostico.rotadoresDetalhe.obturadores"
            label="Obturadores"
            options={escala3Options}
          />
        </div>
      </section>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          rows={4}
          placeholder="Notas clínicas, conduta sugerida..."
          {...form.register('diagnostico.observacoes')}
        />
      </div>
    </div>
  );
}
