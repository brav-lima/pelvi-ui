import type { UseFormReturn } from 'react-hook-form';
import type { PerinealAssessmentFormData } from '../schema';
import { SegmentedRadio } from '../fields/SegmentedRadio';
import { sinalBinaryOptions } from '../options';

interface Props {
  form: UseFormReturn<PerinealAssessmentFormData>;
}

export function Step1InspecaoEstatica({ form }: Props) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Medidas observacionais em repouso. Selecione a faixa correspondente para cada item.
      </p>

      <SegmentedRadio
        control={form.control}
        name="inspecaoEstatica.tonusBulbocav"
        label="Tônus bulbocavernoso"
        options={[
          { value: '<0.5', label: '< 0,5 cm' },
          { value: '=0.5', label: '= 0,5 cm' },
          { value: '>0.5', label: '> 0,5 cm' },
        ]}
      />

      <SegmentedRadio
        control={form.control}
        name="inspecaoEstatica.corpoPerineal"
        label="Corpo perineal"
        options={[
          { value: '<2', label: '< 2 cm' },
          { value: '=2', label: '= 2 cm' },
          { value: '>2', label: '> 2 cm' },
        ]}
      />

      <SegmentedRadio
        control={form.control}
        name="inspecaoEstatica.aberturaUretral"
        label="Abertura uretral"
        options={sinalBinaryOptions}
      />
    </div>
  );
}
