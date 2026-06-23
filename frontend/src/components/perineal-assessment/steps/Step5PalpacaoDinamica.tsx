import type { UseFormReturn } from 'react-hook-form';
import { SegmentedRadio } from '../fields/SegmentedRadio';
import { lateralidadeOptions, movDirecaoOptions, quandoOptions, tempoTripleOptions } from '../options';
import type { PerinealAssessmentFormData } from '../schema';

interface Props {
  form: UseFormReturn<PerinealAssessmentFormData>;
}

export function Step5PalpacaoDinamica({ form }: Props) {
  const invTosseMain = form.watch('palpacaoDinamica.involuntariaTosse.main');
  const invValsalvaMain = form.watch('palpacaoDinamica.involuntariaValsalva.main');
  const relaxamento = form.watch('palpacaoDinamica.relaxamento');

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
            { value: 'PVS_PR_ICS', label: 'PVs+PR+ICs (1)' },
            { value: 'PVS_PR', label: 'PVs+PR (2)' },
            { value: 'PVS', label: 'PVs (3)' },
            { value: 'AUSENTE', label: 'Ausente (4)' },
          ]}
        />

        <SegmentedRadio
          control={form.control}
          name="palpacaoDinamica.relaxamento"
          label="Relaxamento"
          hint="0–4"
          options={[
            { value: 'COMPLETO', label: 'Completo (0)' },
            { value: 'INCOMPLETO', label: 'Incompleto (1)' },
            { value: 'PARCIAL_DOWN', label: 'Parcial↓ (2)' },
            { value: 'PARCIAL_UP', label: 'Parcial↑ (3)' },
            { value: 'AUSENTE', label: 'Ausente (4)' },
          ]}
        />
        {relaxamento === 'AUSENTE' && (
          <SegmentedRadio
            control={form.control}
            name="palpacaoDinamica.relaxamentoAtraso"
            label="Atraso"
            options={[
              { value: '+', label: '+' },
              { value: '-', label: '-' },
            ]}
          />
        )}

        <SegmentedRadio
          control={form.control}
          name="palpacaoDinamica.abertura"
          label="Abertura"
          options={movDirecaoOptions}
        />

        <SegmentedRadio
          control={form.control}
          name="palpacaoDinamica.forca"
          label="Força"
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
          label="Potência"
          hint="0–4"
          options={[
            { value: 'GT20', label: '>20 (0)' },
            { value: 'DE20A11', label: '20 a 11 (1)' },
            { value: 'DE10A6', label: '10 a 6 (2)' },
            { value: 'DE4A1', label: '4 a 1 (3)' },
            { value: 'ZERO', label: 'Zero (4)' },
          ]}
        />

        <SegmentedRadio
          control={form.control}
          name="palpacaoDinamica.endurance"
          label="Endurance"
          hint="0–4"
          options={[
            { value: 'GT10S', label: '>10s (0)' },
            { value: 'DE9A7S', label: '9 a 7s (1)' },
            { value: 'DE6A4S', label: '6 a 4s (2)' },
            { value: 'DE3A1S', label: '3 a 1s (3)' },
            { value: 'ZERO', label: 'Zero (4)' },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Atividade involuntária</h5>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="border rounded-md p-3 space-y-3">
            <h6 className="text-sm font-medium">Tosse</h6>
            <SegmentedRadio
              control={form.control}
              name="palpacaoDinamica.involuntariaTosse.main"
              label="Movimento"
              options={tempoTripleOptions}
            />
            {invTosseMain === 'CRANIAL' && (
              <SegmentedRadio
                control={form.control}
                name="palpacaoDinamica.involuntariaTosse.quando"
                options={quandoOptions}
              />
            )}
          </div>

          <div className="border rounded-md p-3 space-y-3">
            <h6 className="text-sm font-medium">Valsalva</h6>
            <SegmentedRadio
              control={form.control}
              name="palpacaoDinamica.involuntariaValsalva.main"
              label="Movimento"
              options={tempoTripleOptions}
            />
            {invValsalvaMain === 'CRANIAL' && (
              <SegmentedRadio
                control={form.control}
                name="palpacaoDinamica.involuntariaValsalva.quando"
                options={quandoOptions}
              />
            )}
          </div>
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
