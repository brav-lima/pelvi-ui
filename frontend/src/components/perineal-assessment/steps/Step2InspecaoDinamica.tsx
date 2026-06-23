import { Controller, type UseFormReturn } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { SegmentedRadio } from '../fields/SegmentedRadio';
import { CheckboxGroup } from '../fields/CheckboxGroup';
import {
  movDirecaoOptions,
  presencaOptions,
  quandoOptions,
  sinalBinaryOptions,
  sinalOptions,
  tempoTripleOptions,
} from '../options';
import type { PerinealAssessmentFormData } from '../schema';
import { useReadOnly } from '../ReadOnlyContext';

interface Props {
  form: UseFormReturn<PerinealAssessmentFormData>;
}

const superficiaisLista = [
  { key: 'isquiocavernosos', label: 'Isquiocavernosos' },
  { key: 'bulbocavernosos', label: 'Bulbocavernosos' },
  { key: 'transversosPerineais', label: 'Transversos perineais' },
  { key: 'esfincterAnalExterno', label: 'Esfíncter anal externo' },
] as const;

export function Step2InspecaoDinamica({ form }: Props) {
  const readOnly = useReadOnly();
  const preContracaoTosseMain = form.watch('inspecaoDinamica.levantadores.preContracaoTosse.main');
  const preContracaoValsalvaMain = form.watch('inspecaoDinamica.levantadores.preContracaoValsalva.main');
  const relaxamentoMov = form.watch('inspecaoDinamica.levantadores.relaxamentoMovCaudal');

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
        <h5 className="font-semibold text-sm">Músculos levantadores</h5>
        <SegmentedRadio
          control={form.control}
          name="inspecaoDinamica.levantadores.contracaoMovCranial"
          label="Contração — movimento"
          options={movDirecaoOptions}
        />
        <CheckboxGroup
          control={form.control}
          name="inspecaoDinamica.levantadores.coContracoes"
          label="Co-contrações"
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
          label="Relaxamento — movimento"
          options={[
            { value: 'PRESENTE', label: 'Presente' },
            { value: 'AUSENTE', label: 'Ausente' },
          ]}
        />
        {relaxamentoMov === 'PRESENTE' && (
          <SegmentedRadio
            control={form.control}
            name="inspecaoDinamica.levantadores.relaxamentoAtraso"
            label="Atraso"
            options={sinalBinaryOptions}
          />
        )}
        <SegmentedRadio
          control={form.control}
          name="inspecaoDinamica.levantadores.abertura"
          label="Abertura"
          options={movDirecaoOptions}
        />
      </section>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Pré-contração</h5>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="border rounded-md p-3 space-y-3">
            <h6 className="text-sm font-medium">Tosse</h6>
            <SegmentedRadio
              control={form.control}
              name="inspecaoDinamica.levantadores.preContracaoTosse.main"
              label="Pré-contração"
              options={tempoTripleOptions}
            />
            {preContracaoTosseMain === 'CRANIAL' && (
              <SegmentedRadio
                control={form.control}
                name="inspecaoDinamica.levantadores.preContracaoTosse.quando"
                options={quandoOptions}
              />
            )}
          </div>

          <div className="border rounded-md p-3 space-y-3">
            <h6 className="text-sm font-medium">Valsalva</h6>
            <SegmentedRadio
              control={form.control}
              name="inspecaoDinamica.levantadores.preContracaoValsalva.main"
              label="Pré-contração"
              options={tempoTripleOptions}
            />
            {preContracaoValsalvaMain === 'CRANIAL' && (
              <SegmentedRadio
                control={form.control}
                name="inspecaoDinamica.levantadores.preContracaoValsalva.quando"
                options={quandoOptions}
              />
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Escape intra-teste</h5>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-2 font-medium w-1/4"></th>
                <th className="text-center p-2 font-medium">Tosse</th>
                <th className="text-center p-2 font-medium">Valsalva</th>
                <th className="text-center p-2 font-medium">Abertura</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-2 font-medium">Uretral</td>
                <td className="p-2 text-center">
                  <Controller
                    control={form.control}
                    name="inspecaoDinamica.escapeIntraTeste.tosseUretral"
                    render={({ field }) => (
                      <Checkbox
                        checked={!!field.value}
                        disabled={readOnly}
                        onCheckedChange={(c) => field.onChange(c === true ? true : undefined)}
                      />
                    )}
                  />
                </td>
                <td className="p-2 text-center">
                  <Controller
                    control={form.control}
                    name="inspecaoDinamica.escapeIntraTeste.valsalvaUretral"
                    render={({ field }) => (
                      <Checkbox
                        checked={!!field.value}
                        disabled={readOnly}
                        onCheckedChange={(c) => field.onChange(c === true ? true : undefined)}
                      />
                    )}
                  />
                </td>
                <td className="p-2 text-center">
                  <Controller
                    control={form.control}
                    name="inspecaoDinamica.escapeIntraTeste.aberturaUretral"
                    render={({ field }) => (
                      <Checkbox
                        checked={!!field.value}
                        disabled={readOnly}
                        onCheckedChange={(c) => field.onChange(c === true ? true : undefined)}
                      />
                    )}
                  />
                </td>
              </tr>
              <tr>
                <td className="p-2 font-medium">Anal</td>
                <td className="p-2 text-center">
                  <Controller
                    control={form.control}
                    name="inspecaoDinamica.escapeIntraTeste.tosseAnal"
                    render={({ field }) => (
                      <Checkbox
                        checked={!!field.value}
                        disabled={readOnly}
                        onCheckedChange={(c) => field.onChange(c === true ? true : undefined)}
                      />
                    )}
                  />
                </td>
                <td className="p-2 text-center">
                  <Controller
                    control={form.control}
                    name="inspecaoDinamica.escapeIntraTeste.valsalvaAnal"
                    render={({ field }) => (
                      <Checkbox
                        checked={!!field.value}
                        disabled={readOnly}
                        onCheckedChange={(c) => field.onChange(c === true ? true : undefined)}
                      />
                    )}
                  />
                </td>
                <td className="p-2 text-center">
                  <Controller
                    control={form.control}
                    name="inspecaoDinamica.escapeIntraTeste.aberturaAnal"
                    render={({ field }) => (
                      <Checkbox
                        checked={!!field.value}
                        disabled={readOnly}
                        onCheckedChange={(c) => field.onChange(c === true ? true : undefined)}
                      />
                    )}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
