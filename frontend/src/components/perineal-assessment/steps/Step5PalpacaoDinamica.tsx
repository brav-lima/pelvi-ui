import type { UseFormReturn } from 'react-hook-form';
import { SegmentedRadio } from '../fields/SegmentedRadio';
import { lateralidadeOptions, sinalOptions, tempoTripleOptions } from '../options';
import type { PerinealAssessmentFormData } from '../schema';

interface Props {
  form: UseFormReturn<PerinealAssessmentFormData>;
}

export function Step5PalpacaoDinamica({ form }: Props) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Atividade voluntária</h5>

        <SegmentedRadio
          control={form.control}
          name="palpacaoDinamica.movimento"
          label="Movimento"
          hint="0–4"
          options={[
            { value: 'COMPLETO', label: 'Completo (0)' },
            { value: 'PVs+PR+ICs', label: 'PVs+PR+ICs (1)' },
            { value: 'PVs+PR', label: 'PVs+PR (2)' },
            { value: 'PVs', label: 'PVs (3)' },
            { value: 'AUSENTE', label: 'Ausente (4)' },
          ]}
        />

        <SegmentedRadio
          control={form.control}
          name="palpacaoDinamica.relaxamento"
          label="Relaxamento"
          options={[
            { value: 'COMPLETO', label: 'Completo (0)' },
            { value: 'INCOMPLETO', label: 'Incompleto (1)' },
            { value: 'PARCIAL_DOWN', label: 'Parcial ↓ (2)' },
            { value: 'PARCIAL_UP', label: 'Parcial ↑ (3)' },
            { value: 'AUSENTE', label: 'Ausente (4)' },
          ]}
        />

        <div className="grid sm:grid-cols-2 gap-3">
          <SegmentedRadio
            control={form.control}
            name="palpacaoDinamica.abertura"
            label="Abertura"
            options={[
              { value: 'CAUDAL', label: 'Caudal' },
              { value: 'PRESENTE', label: 'Presente' },
              { value: 'AUSENTE', label: 'Ausente' },
              { value: 'CRANIAL', label: 'Cranial' },
            ]}
          />
          <SegmentedRadio
            control={form.control}
            name="palpacaoDinamica.atraso"
            label="Atraso"
            options={sinalOptions}
          />
        </div>

        <SegmentedRadio
          control={form.control}
          name="palpacaoDinamica.forca"
          label="Força (Oxford modificada)"
          hint="0–4"
          options={[
            { value: 'FORTE', label: 'Forte (0)' },
            { value: 'RAZOAVEL', label: 'Razoável (1)' },
            { value: 'FRACO', label: 'Fraco (2)' },
            { value: 'ESBOCO', label: 'Esboço (3)' },
            { value: 'AUSENTE', label: 'Ausente (4)' },
          ]}
        />

        <SegmentedRadio
          control={form.control}
          name="palpacaoDinamica.potencia"
          label="Potência (repetições)"
          hint="0–4"
          options={[
            { value: '>20', label: '> 20 (0)' },
            { value: '20-11', label: '20–11 (1)' },
            { value: '10-6', label: '10–6 (2)' },
            { value: '4-1', label: '4–1 (3)' },
            { value: 'ZERO', label: 'Zero (4)' },
          ]}
        />

        <SegmentedRadio
          control={form.control}
          name="palpacaoDinamica.endurance"
          label="Endurance (sustentação)"
          hint="0–4"
          options={[
            { value: '>10s', label: '> 10s (0)' },
            { value: '9-7s', label: '9–7s (1)' },
            { value: '6-4s', label: '6–4s (2)' },
            { value: '3-1s', label: '3–1s (3)' },
            { value: 'ZERO', label: 'Zero (4)' },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Atividade involuntária — Tosse</h5>
        <div className="grid sm:grid-cols-3 gap-3">
          <SegmentedRadio
            control={form.control}
            name="palpacaoDinamica.involuntariaTosse.antes"
            label="Antes"
            options={tempoTripleOptions}
          />
          <SegmentedRadio
            control={form.control}
            name="palpacaoDinamica.involuntariaTosse.durante"
            label="Durante"
            options={tempoTripleOptions}
          />
          <SegmentedRadio
            control={form.control}
            name="palpacaoDinamica.involuntariaTosse.depois"
            label="Depois"
            options={tempoTripleOptions}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Atividade involuntária — Valsalva</h5>
        <div className="grid sm:grid-cols-3 gap-3">
          <SegmentedRadio
            control={form.control}
            name="palpacaoDinamica.involuntariaValsalva.antes"
            label="Antes"
            options={tempoTripleOptions}
          />
          <SegmentedRadio
            control={form.control}
            name="palpacaoDinamica.involuntariaValsalva.durante"
            label="Durante"
            options={tempoTripleOptions}
          />
          <SegmentedRadio
            control={form.control}
            name="palpacaoDinamica.involuntariaValsalva.depois"
            label="Depois"
            options={tempoTripleOptions}
          />
        </div>
      </section>

      <SegmentedRadio
        control={form.control}
        name="palpacaoDinamica.simetria"
        label="Simetria"
        options={lateralidadeOptions}
      />
    </div>
  );
}
