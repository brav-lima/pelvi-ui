import type { UseFormReturn } from 'react-hook-form';
import { SegmentedRadio } from '../fields/SegmentedRadio';
import { lateralidadeOptions, tempoTripleOptions } from '../options';
import type { PerinealAssessmentFormData } from '../schema';

interface Props {
  form: UseFormReturn<PerinealAssessmentFormData>;
}

export function Step5PalpacaoDinamica({ form }: Props) {
  const invTosseMain = form.watch('palpacaoDinamica.involuntariaTosse.main');
  const invValsalvaMain = form.watch('palpacaoDinamica.involuntariaValsalva.main');

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Atividade voluntária</h5>

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
              <div className="space-y-2 pt-1">
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
              <div className="space-y-2 pt-1">
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
