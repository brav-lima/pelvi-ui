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

export function Step2InspecaoDinamica({ form }: Props) {
  const preContracaoTosseMain = form.watch('inspecaoDinamica.levantadores.preContracaoTosse.main');
  const preContracaoValsalvaMain = form.watch('inspecaoDinamica.levantadores.preContracaoValsalva.main');

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
              <div className="space-y-2 pt-1">
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
              <div className="space-y-2 pt-1">
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
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h5 className="font-semibold text-sm">Escape intra-teste</h5>
        <p className="text-xs text-muted-foreground">Marque os escapes observados.</p>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-2 font-medium w-1/3"></th>
                <th className="text-center p-2 font-medium">Tosse</th>
                <th className="text-center p-2 font-medium">Valsalva</th>
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
                        onCheckedChange={(c) => field.onChange(c === true ? true : undefined)}
                      />
                    )}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Label className="text-xs text-muted-foreground italic">
          Suspender se houver dor.
        </Label>
      </section>
    </div>
  );
}
