import type { UseFormReturn } from 'react-hook-form';
import { SegmentedRadio } from '../fields/SegmentedRadio';
import { escala3Options, lateralidadeOptions } from '../options';
import type { PerinealAssessmentFormData } from '../schema';

interface Props {
  form: UseFormReturn<PerinealAssessmentFormData>;
}

const sensibilidadeMusculos: Array<{
  key:
    | 'quadriceps'
    | 'adutores'
    | 'isquiotibiais'
    | 'pudendo'
    | 'cutFemoral'
    | 'ilioinguinal'
    | 'iliohipogastrico';
  label: string;
}> = [
  { key: 'quadriceps', label: 'Quadríceps' },
  { key: 'adutores', label: 'Adutores' },
  { key: 'isquiotibiais', label: 'Isquiotibiais' },
  { key: 'pudendo', label: 'Pudendo' },
  { key: 'cutFemoral', label: 'Cut. femoral' },
  { key: 'ilioinguinal', label: 'Ilioinguinal' },
  { key: 'iliohipogastrico', label: 'Iliohipogástrico' },
];

const reflexos: Array<{
  key:
    | 'clitoridianoE'
    | 'clitoridianoD'
    | 'cutaneoanal'
    | 'cremasterico'
    | 'levantadores';
  label: string;
}> = [
  { key: 'clitoridianoE', label: 'Clitoridiano (E)' },
  { key: 'clitoridianoD', label: 'Clitoridiano (D)' },
  { key: 'cutaneoanal', label: 'Cutaneoanal' },
  { key: 'cremasterico', label: 'Cremastérico' },
  { key: 'levantadores', label: 'Levantadores' },
];

export function Step3TestesNeurologicos({ form }: Props) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Sensibilidade</h5>
        <div className="grid sm:grid-cols-2 gap-3">
          {sensibilidadeMusculos.map((m) => (
            <SegmentedRadio
              key={m.key}
              control={form.control}
              name={`testesNeurologicos.sensibilidade.${m.key}` as const}
              label={m.label}
              options={lateralidadeOptions}
            />
          ))}
          <SegmentedRadio
            control={form.control}
            name="testesNeurologicos.sensibilidade.trofismoSensor"
            label="Trofismo sensor"
            options={escala3Options}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Atividade reflexa</h5>
        <div className="grid sm:grid-cols-2 gap-3">
          {reflexos.map((r) => (
            <SegmentedRadio
              key={r.key}
              control={form.control}
              name={`testesNeurologicos.atividadeReflexa.${r.key}` as const}
              label={r.label}
              options={escala3Options}
            />
          ))}
        </div>
      </section>

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
        <div className="grid sm:grid-cols-2 gap-3">
          <SegmentedRadio
            control={form.control}
            name="testesNeurologicos.tinel.direito"
            label="Direito"
            options={[
              { value: 'I', label: 'I' },
              { value: 'II', label: 'II' },
              { value: 'III', label: 'III' },
              { value: 'IV', label: 'IV' },
            ]}
          />
          <SegmentedRadio
            control={form.control}
            name="testesNeurologicos.tinel.esquerdo"
            label="Esquerdo"
            options={[
              { value: 'I', label: 'I' },
              { value: 'II', label: 'II' },
              { value: 'III', label: 'III' },
              { value: 'IV', label: 'IV' },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
