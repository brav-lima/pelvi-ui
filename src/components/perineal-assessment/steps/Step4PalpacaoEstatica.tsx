import type { UseFormReturn } from 'react-hook-form';
import { SegmentedRadio } from '../fields/SegmentedRadio';
import { escala3Options, sinalOptions } from '../options';
import type { PerinealAssessmentFormData } from '../schema';

interface Props {
  form: UseFormReturn<PerinealAssessmentFormData>;
}

const musculos: Array<{
  key: 'rabdo' | 'puboanal' | 'puborretal' | 'iliococcigeos' | 'piriformes' | 'obturadores';
  label: string;
}> = [
  { key: 'rabdo', label: 'Rabdoesfíncter (RBD)' },
  { key: 'puboanal', label: 'Puboanal' },
  { key: 'puborretal', label: 'Puborretal' },
  { key: 'iliococcigeos', label: 'Iliococcígeos' },
  { key: 'piriformes', label: 'Piriformes' },
  { key: 'obturadores', label: 'Obturadores' },
];

export function Step4PalpacaoEstatica({ form }: Props) {
  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground italic">
        Anatomia Palpatória 3D® — tonicidade muscular em repouso.
      </p>

      <SegmentedRadio
        control={form.control}
        name="palpacaoEstatica.superficiais"
        label="Superficiais"
        options={sinalOptions}
      />

      <div className="border rounded-md p-3 space-y-3">
        <h6 className="text-sm font-semibold">Pubovaginal / Puboperineal</h6>
        <div className="grid sm:grid-cols-2 gap-3">
          <SegmentedRadio
            control={form.control}
            name="palpacaoEstatica.pubovaginalPuboperineal.tonus"
            label="Tônus"
            options={escala3Options}
          />
          <SegmentedRadio
            control={form.control}
            name="palpacaoEstatica.pubovaginalPuboperineal.sinal"
            label="Sinal"
            options={sinalOptions}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {musculos.map((m) => (
          <SegmentedRadio
            key={m.key}
            control={form.control}
            name={`palpacaoEstatica.${m.key}` as const}
            label={m.label}
            options={escala3Options}
          />
        ))}
      </div>
    </div>
  );
}
