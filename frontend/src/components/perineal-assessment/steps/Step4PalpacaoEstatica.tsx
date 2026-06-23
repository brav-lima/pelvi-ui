import type { UseFormReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SegmentedRadio } from '../fields/SegmentedRadio';
import type { PerinealAssessmentFormData } from '../schema';

interface Props {
  form: UseFormReturn<PerinealAssessmentFormData>;
}

const tinelOptions = [
  { value: 'I', label: 'I' },
  { value: 'II', label: 'II' },
  { value: 'III', label: 'III' },
  { value: 'IV', label: 'IV' },
];

const sacroOptions = [
  { value: 'S2', label: 'S2' },
  { value: 'S3', label: 'S3' },
  { value: 'S4', label: 'S4' },
];

const textFields: Array<{
  key: 'musculaturaSuperficial' | 'rabdosfincter' | 'musculaturaProfunda' | 'rotadoresQuadril' | 'tecidosConectivosSuperficiais' | 'tecidosConnectivosProfundos';
  label: string;
}> = [
  { key: 'musculaturaSuperficial', label: 'Musculatura superficial' },
  { key: 'rabdosfincter', label: 'Rabdosfincter' },
  { key: 'musculaturaProfunda', label: 'Musculatura profunda' },
  { key: 'rotadoresQuadril', label: 'Rotadores do quadril' },
  { key: 'tecidosConectivosSuperficiais', label: 'Tecidos conectivos superficiais' },
  { key: 'tecidosConnectivosProfundos', label: 'Tecidos conectivos profundos' },
];

export function Step4PalpacaoEstatica({ form }: Props) {
  const tinelDireito = form.watch('testesNeurologicos.tinel.direito');
  const tinelEsquerdo = form.watch('testesNeurologicos.tinel.esquerdo');

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {textFields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={f.key} className="text-sm">{f.label}</Label>
            <Textarea
              id={f.key}
              rows={2}
              {...form.register(`palpacaoEstatica.${f.key}` as const)}
            />
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Cóccix</h5>
        <div className="grid sm:grid-cols-2 gap-3">
          <SegmentedRadio
            control={form.control}
            name="testesNeurologicos.coccix.lateral"
            label="Lateral"
            options={[
              { value: 'E', label: 'E' },
              { value: 'C', label: 'C' },
              { value: 'D', label: 'D' },
            ]}
          />
          <SegmentedRadio
            control={form.control}
            name="testesNeurologicos.coccix.sagital"
            label="Sagital"
            options={[
              { value: 'ANT', label: 'Anterior' },
              { value: 'N', label: 'Normal' },
              { value: 'PST', label: 'Posterior' },
            ]}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Tinel</h5>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <SegmentedRadio
              control={form.control}
              name="testesNeurologicos.tinel.direito"
              label="Direito"
              options={tinelOptions}
            />
            {tinelDireito === 'I' && (
              <SegmentedRadio
                control={form.control}
                name="testesNeurologicos.tinel.direitoSacro"
                label="Sacro (D)"
                options={sacroOptions}
              />
            )}
          </div>
          <div className="space-y-2">
            <SegmentedRadio
              control={form.control}
              name="testesNeurologicos.tinel.esquerdo"
              label="Esquerdo"
              options={tinelOptions}
            />
            {tinelEsquerdo === 'I' && (
              <SegmentedRadio
                control={form.control}
                name="testesNeurologicos.tinel.esquerdoSacro"
                label="Sacro (E)"
                options={sacroOptions}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
