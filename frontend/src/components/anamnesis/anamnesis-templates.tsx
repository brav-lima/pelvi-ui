import { Activity, Droplets, ClipboardList, Heart, Baby } from 'lucide-react';
import {
  type SD, type SS,
  str, arr, num,
  FormRow, FieldInput, FieldTextarea, ChipSelect, SegmentedControl,
} from './anamnesis-primitives';

export interface AnamnesisTemplateSection {
  id: string;
  label: string;
  sub: string;
  Component: React.ComponentType<{ data: SD; set: SS }>;
}

export interface AnamnesisTemplate {
  id: string;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
  sections: AnamnesisTemplateSection[];
}

// ─── Shared section blocks ────────────────────────────────────────────────────

function QueixaPrincipalBase({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Qual o motivo da sua consulta?">
        <FieldTextarea value={str(data, 'motivoConsulta')} onChange={v => set('motivoConsulta', v)} rows={2} />
      </FormRow>
      <FormRow label="Qual sua principal queixa no momento?">
        <FieldTextarea value={str(data, 'queixaPrincipal')} onChange={v => set('queixaPrincipal', v)} rows={2} />
      </FormRow>
      <FormRow label="Há quanto tempo os sintomas começaram?">
        <FieldInput value={str(data, 'tempoSintomas')} onChange={v => set('tempoSintomas', v)} placeholder="Ex: 3 meses, 1 ano…" />
      </FormRow>
      <FormRow label="Os sintomas iniciaram:">
        <SegmentedControl
          options={['Gradualmente', 'Subitamente']}
          value={str(data, 'formaInicio')}
          onChange={v => set('formaInicio', v)}
        />
      </FormRow>
      <FormRow label="Desde então os sintomas:">
        <SegmentedControl
          options={['Permanecem iguais', 'Melhoraram', 'Pioraram']}
          value={str(data, 'evolucaoSintomas')}
          onChange={v => set('evolucaoSintomas', v)}
        />
      </FormRow>
    </div>
  );
}

function MolestiaPregressaBase({
  data, set, historicoExtra,
}: { data: SD; set: SS; historicoExtra?: string[] }) {
  const historicoPadrao = [
    'Hipertensão arterial', 'Diabetes', 'Doença neurológica',
    'Gestação/parto', 'Menopausa', 'Cardiopatias', 'Pneumopatias', 'Câncer',
  ];
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Descreva como seu problema vem evoluindo no tempo.">
        <FieldTextarea value={str(data, 'evolucao')} onChange={v => set('evolucao', v)} rows={3} />
      </FormRow>
      <FormRow label="Possui histórico de:">
        <ChipSelect
          options={[...historicoPadrao, ...(historicoExtra ?? [])]}
          value={arr(data, 'historico')}
          onChange={v => set('historico', v)}
        />
      </FormRow>
      <FormRow label="Medicações em uso:">
        <FieldTextarea value={str(data, 'medicacoes')} onChange={v => set('medicacoes', v)} rows={2} />
      </FormRow>
      <FormRow label="Antecedentes cirúrgicos:">
        <FieldTextarea value={str(data, 'cirurgias')} onChange={v => set('cirurgias', v)} rows={2} />
      </FormRow>
    </div>
  );
}

function HabitosBase({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Tabagista? Há quanto tempo?">
        <FieldInput value={str(data, 'tabagismo')} onChange={v => set('tabagismo', v)} placeholder="Não / Sim – X anos" />
      </FormRow>
      <FormRow label="Consome bebida alcoólica? Frequência?">
        <FieldInput value={str(data, 'alcool')} onChange={v => set('alcool', v)} placeholder="Não / Ocasional / Frequente" />
      </FormRow>
      <FormRow label="Pratica atividade física? Qual? Frequência?">
        <FieldInput value={str(data, 'atividadeFisica')} onChange={v => set('atividadeFisica', v)} />
      </FormRow>
      <FormRow label="Ingesta hídrica?">
        <SegmentedControl
          options={['< 1L', '1–2L', '2–3L', '> 3L']}
          value={str(data, 'hidratacao')}
          onChange={v => set('hidratacao', v)}
        />
      </FormRow>
    </div>
  );
}

function ConclusaoBase({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Hipóteses diagnósticas:">
        <FieldTextarea value={str(data, 'hipoteses')} onChange={v => set('hipoteses', v)} rows={3} />
      </FormRow>
      <FormRow label="Exames complementares:">
        <FieldTextarea value={str(data, 'exames')} onChange={v => set('exames', v)} rows={2} />
      </FormRow>
      <FormRow label="Diagnóstico cinesiológico funcional:">
        <FieldTextarea value={str(data, 'diagnostico')} onChange={v => set('diagnostico', v)} rows={2} />
      </FormRow>
      <FormRow label="Objetivos do tratamento:">
        <FieldTextarea value={str(data, 'objetivos')} onChange={v => set('objetivos', v)} rows={2} />
      </FormRow>
    </div>
  );
}

// ─── Template 1: Dor Pélvica ──────────────────────────────────────────────────

function DorPelvica_Impacto({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="O que você deixou de fazer por conta deste problema?">
        <FieldTextarea value={str(data, 'deixouFazer')} onChange={v => set('deixouFazer', v)} rows={2} />
      </FormRow>
      <FormRow label="Quanto os sintomas impactam sua rotina?">
        <div className="flex items-center gap-3">
          <input
            type="range" min={0} max={10}
            value={num(data, 'impactoRotina', 5)}
            onChange={e => set('impactoRotina', Number(e.target.value))}
            className="flex-1 accent-primary"
          />
          <span className="font-semibold tabular-nums text-primary min-w-[28px] text-right" style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>
            {num(data, 'impactoRotina', 5)}
          </span>
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
          <span>Pouco impacto</span>
          <span>Muito impacto</span>
        </div>
      </FormRow>
      <FormRow label="A dor interfere em:">
        <ChipSelect
          options={['Sono', 'Trabalho', 'Exercícios físicos', 'Relações sexuais', 'Humor', 'Vida social']}
          value={arr(data, 'interferencia')}
          onChange={v => set('interferencia', v)}
        />
      </FormRow>
    </div>
  );
}

function DorPelvica_MolestiaAtual({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Descreva o seu problema hoje.">
        <FieldTextarea value={str(data, 'descricao')} onChange={v => set('descricao', v)} rows={3} />
      </FormRow>
      <FormRow label="O que piora a dor?">
        <ChipSelect
          options={['Relação sexual', 'Menstruação', 'Exercício físico', 'Permanecer sentada', 'Urinar', 'Evacuar', 'Outro']}
          value={arr(data, 'piora')}
          onChange={v => set('piora', v)}
        />
      </FormRow>
      <FormRow label="O que melhora?">
        <ChipSelect
          options={['Repouso', 'Calor', 'Medicação', 'Alongamento', 'Outro']}
          value={arr(data, 'melhora')}
          onChange={v => set('melhora', v)}
        />
      </FormRow>
      <FormRow label="Apresenta:">
        <ChipSelect
          options={['Dor superficial', 'Dor profunda', 'Ardência', 'Ressecamento vaginal', 'Flatos vaginais', 'Dificuldade de penetração', 'Diminuição do prazer', 'Dificuldade para orgasmo']}
          value={arr(data, 'sintomas')}
          onChange={v => set('sintomas', v)}
        />
      </FormRow>
      <FormRow label="Dor durante o sexo:">
        <SegmentedControl
          options={['Nunca', 'Às vezes', 'Frequentemente', 'Sempre']}
          value={str(data, 'dorSexo')}
          onChange={v => set('dorSexo', v)}
        />
      </FormRow>
      <FormRow label="Intensidade da dor (0–10):">
        <div className="flex items-center gap-3">
          <input
            type="range" min={0} max={10}
            value={num(data, 'intensidade', 0)}
            onChange={e => set('intensidade', Number(e.target.value))}
            className="flex-1 accent-primary"
          />
          <span className="font-semibold tabular-nums text-primary min-w-[28px] text-right" style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>
            {num(data, 'intensidade', 0)}
          </span>
        </div>
      </FormRow>
      <FormRow label="Característica da dor:">
        <ChipSelect
          options={['Ardência', 'Corte', 'Pontada', 'Pressão', 'Fisgada']}
          value={arr(data, 'caracteristica')}
          onChange={v => set('caracteristica', v)}
        />
      </FormRow>
      <FormRow label="Localização:">
        <ChipSelect
          options={['Entrada vaginal/vulvar', 'Meio do canal vaginal', 'Fundo vaginal']}
          value={arr(data, 'localizacao')}
          onChange={v => set('localizacao', v)}
        />
      </FormRow>
    </div>
  );
}

function DorPelvica_HMP({ data, set }: { data: SD; set: SS }) {
  return (
    <MolestiaPregressaBase
      data={data}
      set={set}
      historicoExtra={['Endometriose', 'Infecção urinária recorrente', 'Cirurgias pélvicas', 'Trauma', 'Violência sexual', 'Ansiedade/estresse importante', 'Tratamento prévio para dor pélvica']}
    />
  );
}

// ─── Template 2: Função Urinária ──────────────────────────────────────────────

function Urinaria_Impacto({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="O que você deixou de fazer por conta deste problema?">
        <FieldTextarea value={str(data, 'deixouFazer')} onChange={v => set('deixouFazer', v)} rows={2} />
      </FormRow>
      <FormRow label="Quanto os sintomas impactam sua rotina?">
        <FieldTextarea value={str(data, 'impactoRotina')} onChange={v => set('impactoRotina', v)} rows={2} />
      </FormRow>
      <FormRow label="Os sintomas fazem você:">
        <ChipSelect
          options={['Usar absorvente/proteção', 'Evitar sair de casa', 'Reduzir líquidos', 'Procurar banheiro frequentemente']}
          value={arr(data, 'comportamentos')}
          onChange={v => set('comportamentos', v)}
        />
      </FormRow>
    </div>
  );
}

function Urinaria_FuncaoArmazenamento({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Quantas vezes urina durante o dia?">
          <FieldInput value={str(data, 'frequenciaDia')} onChange={v => set('frequenciaDia', v)} placeholder="Ex: 8 vezes" />
        </FormRow>
        <FormRow label="Quantas vezes acorda à noite para urinar?">
          <FieldInput value={str(data, 'frequenciaNoite')} onChange={v => set('frequenciaNoite', v)} placeholder="Ex: 2 vezes" />
        </FormRow>
      </div>
      <FormRow label="Sintomas de armazenamento:">
        <ChipSelect
          options={['Urgência miccional', 'Forte vontade difícil de controlar', 'Aumento da frequência urinária', 'Sensação de bexiga cheia constante', 'Micção por precaução', 'Dificuldade para segurar a urina', 'Perda associada à urgência', 'Perda durante o sono']}
          value={arr(data, 'sintomasArmazenamento')}
          onChange={v => set('sintomasArmazenamento', v)}
        />
      </FormRow>
      <FormRow label="Situações desencadeantes:">
        <ChipSelect
          options={['Água correndo', 'Frio', 'Ansiedade/estresse', 'Chegar próximo ao banheiro', 'Chave na porta', 'Outro']}
          value={arr(data, 'desencadeantes')}
          onChange={v => set('desencadeantes', v)}
        />
      </FormRow>
      <FormRow label="Sintomas de esvaziamento:">
        <ChipSelect
          options={['Dificuldade para iniciar o jato', 'Necessidade de fazer força', 'Interrupção do fluxo', 'Jato fraco', 'Jato em leque', 'Ardência ao urinar', 'Esvaziamento incompleto', 'Retorno ao banheiro após urinar', 'Gotejamento pós-miccional']}
          value={arr(data, 'sintomasEsvaziamento')}
          onChange={v => set('sintomasEsvaziamento', v)}
        />
      </FormRow>
    </div>
  );
}

function Urinaria_Perda({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="A perda acontece:">
        <ChipSelect
          options={['Aos esforços', 'Sem esforço', 'Associada à urgência', 'Durante o sono', 'Sem perceber']}
          value={arr(data, 'quando')}
          onChange={v => set('quando', v)}
        />
      </FormRow>
      <FormRow label="Situações em que ocorre:">
        <ChipSelect
          options={['Tossir', 'Espirrar', 'Rir', 'Agachar', 'Erguer peso', 'Caminhar', 'Correr', 'Mudança de posição', 'Relação sexual', 'Próximo ao banheiro']}
          value={arr(data, 'situacoes')}
          onChange={v => set('situacoes', v)}
        />
      </FormRow>
      <FormRow label="Quantidade da perda:">
        <SegmentedControl
          options={['Gota', 'Algumas gotas', 'Jato/Escorrida', 'Todo conteúdo']}
          value={str(data, 'quantidade')}
          onChange={v => set('quantidade', v)}
        />
      </FormRow>
      <FormRow label="Uso de proteção:">
        <SegmentedControl
          options={['Não', 'Protetor diário', 'Absorvente', 'Fralda']}
          value={str(data, 'protecao')}
          onChange={v => set('protecao', v)}
        />
      </FormRow>
      <FormRow label="Número de trocas por dia:">
        <FieldInput value={str(data, 'trocasPorDia')} onChange={v => set('trocasPorDia', v)} placeholder="Ex: 3" />
      </FormRow>
    </div>
  );
}

function Urinaria_HabitosEConclusao({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <HabitosBase data={data} set={set} />
      <div className="border-t border-border pt-5">
        <ConclusaoBase data={data} set={set} />
      </div>
    </div>
  );
}

// ─── Template 3: Função Evacuatória ──────────────────────────────────────────

function Evacuatoria_FuncaoIntestinal({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Função intestinal:">
        <ChipSelect
          options={['Normal', 'Constipação', 'Hemorroidas', 'Incontinência anal']}
          value={arr(data, 'funcaoIntestinal')}
          onChange={v => set('funcaoIntestinal', v)}
        />
      </FormRow>
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Frequência evacuatória:">
          <FieldInput value={str(data, 'frequencia')} onChange={v => set('frequencia', v)} placeholder="Ex: 1x/dia" />
        </FormRow>
        <FormRow label="Tempo médio para evacuar:">
          <FieldInput value={str(data, 'tempoEvacuar')} onChange={v => set('tempoEvacuar', v)} placeholder="Ex: 10 minutos" />
        </FormRow>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Necessita de esforço evacuatório?">
          <SegmentedControl
            options={['Não', 'Sim']}
            value={str(data, 'esforco')}
            onChange={v => set('esforco', v)}
          />
        </FormRow>
        <FormRow label="Necessita de manobra para evacuar?">
          <SegmentedControl
            options={['Não', 'Sim']}
            value={str(data, 'manobra')}
            onChange={v => set('manobra', v)}
          />
        </FormRow>
      </div>
      <FormRow label="Uso de medicamentos/laxantes?">
        <FieldInput value={str(data, 'laxantes')} onChange={v => set('laxantes', v)} placeholder="Não / Qual?" />
      </FormRow>
      <FormRow label="Escala de Bristol:">
        <SegmentedControl
          options={['1', '2', '3', '4', '5', '6', '7']}
          value={str(data, 'bristol')}
          onChange={v => set('bristol', v)}
        />
      </FormRow>
      <div className="grid grid-cols-3 gap-4">
        <FormRow label="Sensação de evacuação incompleta?">
          <SegmentedControl options={['Não', 'Sim']} value={str(data, 'evacuacaoIncompleta')} onChange={v => set('evacuacaoIncompleta', v)} />
        </FormRow>
        <FormRow label="Dor ao evacuar?">
          <SegmentedControl options={['Não', 'Sim']} value={str(data, 'dorEvacuar')} onChange={v => set('dorEvacuar', v)} />
        </FormRow>
        <FormRow label="Sangramento?">
          <SegmentedControl options={['Não', 'Sim']} value={str(data, 'sangramento')} onChange={v => set('sangramento', v)} />
        </FormRow>
      </div>
    </div>
  );
}

function Evacuatoria_HMP({ data, set }: { data: SD; set: SS }) {
  return (
    <MolestiaPregressaBase
      data={data}
      set={set}
      historicoExtra={['Hemorroidas', 'Fissura anal', 'Doença intestinal', 'Postergação']}
    />
  );
}

function Evacuatoria_HabitosEConclusao({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <HabitosBase data={data} set={set} />
      <div className="border-t border-border pt-5">
        <ConclusaoBase data={data} set={set} />
      </div>
    </div>
  );
}

// ─── Template 4: Gestação ─────────────────────────────────────────────────────

function Gestacao_DadosGestacionais({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Idade gestacional:">
          <FieldInput value={str(data, 'idadeGestacional')} onChange={v => set('idadeGestacional', v)} placeholder="Ex: 28 semanas" />
        </FormRow>
        <FormRow label="Data prevista do parto:">
          <FieldInput type="date" value={str(data, 'dataPrevistaParto')} onChange={v => set('dataPrevistaParto', v)} />
        </FormRow>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {(['gestacoes', 'cesareas', 'partos', 'abortos'] as const).map(f => (
          <FormRow key={f} label={{ gestacoes: 'G', cesareas: 'C', partos: 'P', abortos: 'A' }[f]}>
            <input
              type="number" min={0}
              value={num(data, f)}
              onChange={e => set(f, Number(e.target.value))}
              className="w-full h-9 px-3 rounded-lg border border-border bg-card text-[13px] font-mono text-center outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </FormRow>
        ))}
      </div>
      <FormRow label="Médico Pré-natal em acompanhamento:">
        <FieldInput value={str(data, 'medicoPrenatal')} onChange={v => set('medicoPrenatal', v)} />
      </FormRow>
      <FormRow label="Intercorrências gestacionais prévias:">
        <FieldTextarea value={str(data, 'intercorrencias')} onChange={v => set('intercorrencias', v)} rows={2} />
      </FormRow>
      <FormRow label="Pretensão de via de parto:">
        <SegmentedControl
          options={['Vaginal', 'Cesárea', 'Sem preferência']}
          value={str(data, 'viaParto')}
          onChange={v => set('viaParto', v)}
        />
      </FormRow>
    </div>
  );
}

function Gestacao_QueixasAtuais({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Apresenta:">
        <ChipSelect
          options={['Dor lombar', 'Dor pélvica', 'Incontinência urinária', 'Constipação']}
          value={arr(data, 'queixas')}
          onChange={v => set('queixas', v)}
        />
      </FormRow>
      <FormRow label="Descrição das queixas:">
        <FieldTextarea value={str(data, 'descricao')} onChange={v => set('descricao', v)} rows={3} />
      </FormRow>
    </div>
  );
}

function Gestacao_HabitosEMedicacoes({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Pratica atividade física? Qual? Frequência?">
        <FieldInput value={str(data, 'atividadeFisica')} onChange={v => set('atividadeFisica', v)} />
      </FormRow>
      <FormRow label="Ingesta hídrica:">
        <SegmentedControl
          options={['< 1L', '1–2L', '2–3L', '> 3L']}
          value={str(data, 'hidratacao')}
          onChange={v => set('hidratacao', v)}
        />
      </FormRow>
      <FormRow label="Medicações e Suplementos em uso:">
        <FieldTextarea value={str(data, 'medicacoes')} onChange={v => set('medicacoes', v)} rows={3} />
      </FormRow>
      <FormRow label="Exames complementares:">
        <FieldTextarea value={str(data, 'exames')} onChange={v => set('exames', v)} rows={2} />
      </FormRow>
    </div>
  );
}

function Gestacao_FuncoesPelvicas({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h5 className="text-[13px] font-semibold text-foreground mb-3 pb-1.5 border-b border-border">Urinária</h5>
        <div className="grid grid-cols-3 gap-4">
          <FormRow label="Frequência urinária:">
            <FieldInput value={str(data, 'frequenciaUrinaria')} onChange={v => set('frequenciaUrinaria', v)} placeholder="Ex: 8x/dia" />
          </FormRow>
          <FormRow label="Urgência miccional?">
            <SegmentedControl options={['Não', 'Sim']} value={str(data, 'urgencia')} onChange={v => set('urgencia', v)} />
          </FormRow>
          <FormRow label="Perda urinária?">
            <SegmentedControl options={['Não', 'Sim']} value={str(data, 'perdaUrinaria')} onChange={v => set('perdaUrinaria', v)} />
          </FormRow>
        </div>
      </div>
      <div>
        <h5 className="text-[13px] font-semibold text-foreground mb-3 pb-1.5 border-b border-border">Intestinal</h5>
        <div className="grid grid-cols-4 gap-4">
          <FormRow label="Frequência evacuatória:">
            <FieldInput value={str(data, 'frequenciaEvacuatoria')} onChange={v => set('frequenciaEvacuatoria', v)} />
          </FormRow>
          <FormRow label="Bristol:">
            <FieldInput value={str(data, 'bristol')} onChange={v => set('bristol', v)} placeholder="1–7" />
          </FormRow>
          <FormRow label="Esforço evacuatório?">
            <SegmentedControl options={['Não', 'Sim']} value={str(data, 'esforcoEvacuatorio')} onChange={v => set('esforcoEvacuatorio', v)} />
          </FormRow>
          <FormRow label="Hemorroida?">
            <SegmentedControl options={['Não', 'Sim']} value={str(data, 'hemorroida')} onChange={v => set('hemorroida', v)} />
          </FormRow>
        </div>
      </div>
      <div>
        <h5 className="text-[13px] font-semibold text-foreground mb-3 pb-1.5 border-b border-border">Sexual</h5>
        <div className="grid grid-cols-3 gap-4">
          <FormRow label="Vida sexual ativa?">
            <SegmentedControl options={['Não', 'Sim']} value={str(data, 'vidaSexualAtiva')} onChange={v => set('vidaSexualAtiva', v)} />
          </FormRow>
          <FormRow label="Dor/Desconforto?">
            <SegmentedControl options={['Não', 'Sim']} value={str(data, 'dorSexual')} onChange={v => set('dorSexual', v)} />
          </FormRow>
          <FormRow label="Lubrificação?">
            <SegmentedControl options={['Normal', 'Diminuída']} value={str(data, 'lubrificacao')} onChange={v => set('lubrificacao', v)} />
          </FormRow>
        </div>
      </div>
    </div>
  );
}

function Gestacao_TestesMovilidade({ data, set }: { data: SD; set: SS }) {
  const testes = [
    { id: 'fecharLivro', label: 'Fechar o livro' },
    { id: 'gaenslen', label: 'Gaenslen' },
    { id: 'fabere', label: 'Fabere' },
    { id: 'palpacaoDireta', label: 'Palpação direta' },
    { id: 'lordose', label: 'Lordose' },
  ];
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[12.5px] text-muted-foreground">Testes de mobilidade sacroilíaca</p>
      {testes.map(t => (
        <FormRow key={t.id} label={t.label}>
          <SegmentedControl
            options={['Negativo', 'Positivo']}
            value={str(data, t.id)}
            onChange={v => set(t.id, v)}
          />
        </FormRow>
      ))}
      <FormRow label="Observações:">
        <FieldTextarea value={str(data, 'observacoes')} onChange={v => set('observacoes', v)} rows={3} />
      </FormRow>
    </div>
  );
}

// ─── Template 5: Pós-Parto ────────────────────────────────────────────────────

function PosParto_DadosObstetricos({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Tempo de pós-parto:">
          <FieldInput value={str(data, 'tempoPosParto')} onChange={v => set('tempoPosParto', v)} placeholder="Ex: 3 meses" />
        </FormRow>
        <FormRow label="Peso do bebê ao nascer:">
          <FieldInput value={str(data, 'pesoBebe')} onChange={v => set('pesoBebe', v)} placeholder="Ex: 3.500g" />
        </FormRow>
      </div>
      <FormRow label="Tipo de parto:">
        <SegmentedControl
          options={['Vaginal', 'Cesárea']}
          value={str(data, 'tipoParto')}
          onChange={v => set('tipoParto', v)}
        />
      </FormRow>
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Uso de fórceps?">
          <SegmentedControl options={['Não', 'Sim']} value={str(data, 'forceps')} onChange={v => set('forceps', v)} />
        </FormRow>
        <FormRow label="Episiotomia/laceração?">
          <SegmentedControl options={['Não', 'Sim']} value={str(data, 'episiotomia')} onChange={v => set('episiotomia', v)} />
        </FormRow>
      </div>
    </div>
  );
}

function PosParto_QueixasEImpacto({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Apresenta:">
        <ChipSelect
          options={['Dor perineal', 'Dor na cicatriz', 'Incontinência urinária', 'Urgência miccional', 'Constipação', 'Sensação de peso vaginal', 'Dor na relação sexual']}
          value={arr(data, 'queixas')}
          onChange={v => set('queixas', v)}
        />
      </FormRow>
      <FormRow label="Os sintomas interferem em:">
        <ChipSelect
          options={['Nos cuidados com o bebê', 'Sono', 'Vida sexual', 'Exercícios físicos']}
          value={arr(data, 'interferencia')}
          onChange={v => set('interferencia', v)}
        />
      </FormRow>
      <FormRow label="Está amamentando?">
        <SegmentedControl
          options={['Não', 'Sim – exclusivo', 'Sim – misto']}
          value={str(data, 'amamentando')}
          onChange={v => set('amamentando', v)}
        />
      </FormRow>
    </div>
  );
}

function PosParto_FuncoesPelvicas({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h5 className="text-[13px] font-semibold text-foreground mb-3 pb-1.5 border-b border-border">Urinária</h5>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Frequência urinária:">
            <FieldInput value={str(data, 'frequenciaUrinaria')} onChange={v => set('frequenciaUrinaria', v)} placeholder="Ex: 8x/dia" />
          </FormRow>
          <FormRow label="Perda urinária?">
            <SegmentedControl options={['Não', 'Sim']} value={str(data, 'perdaUrinaria')} onChange={v => set('perdaUrinaria', v)} />
          </FormRow>
        </div>
      </div>
      <div>
        <h5 className="text-[13px] font-semibold text-foreground mb-3 pb-1.5 border-b border-border">Intestinal</h5>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Frequência evacuatória:">
            <FieldInput value={str(data, 'frequenciaEvacuatoria')} onChange={v => set('frequenciaEvacuatoria', v)} />
          </FormRow>
          <FormRow label="Necessidade de esforço?">
            <SegmentedControl options={['Não', 'Sim']} value={str(data, 'esforco')} onChange={v => set('esforco', v)} />
          </FormRow>
        </div>
      </div>
      <div>
        <h5 className="text-[13px] font-semibold text-foreground mb-3 pb-1.5 border-b border-border">Sexual</h5>
        <div className="grid grid-cols-3 gap-4">
          <FormRow label="Retornou às relações?">
            <SegmentedControl options={['Não', 'Sim']} value={str(data, 'retornouRelacoes')} onChange={v => set('retornouRelacoes', v)} />
          </FormRow>
          <FormRow label="Dor?">
            <SegmentedControl options={['Não', 'Sim']} value={str(data, 'dorSexual')} onChange={v => set('dorSexual', v)} />
          </FormRow>
          <FormRow label="Ressecamento?">
            <SegmentedControl options={['Não', 'Sim']} value={str(data, 'ressecamento')} onChange={v => set('ressecamento', v)} />
          </FormRow>
        </div>
      </div>
    </div>
  );
}

function PosParto_ExameFisico({ data, set }: { data: SD; set: SS }) {
  const insercoes = [
    { id: 'pubovaginalPuboperinealInf', label: 'Inserções inferiores de Pubovaginal e Puboperineal' },
    { id: 'pubovaginalPuboperinealSup', label: 'Inserções superiores de Pubovaginal e Puboperineal' },
    { id: 'transversosPerineais', label: 'Inserções perineais dos Transversos' },
    { id: 'paredeVaginalAnterior', label: 'Inserções da Parede Vaginal Anterior' },
  ];
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Cicatriz de cesárea:">
        <ChipSelect
          options={['Sem alterações', 'Aderida', 'Dolorosa', 'Hiperemiada']}
          value={arr(data, 'cicatrizCesarea')}
          onChange={v => set('cicatrizCesarea', v)}
        />
      </FormRow>
      <div>
        <p className="text-[12px] font-medium text-muted-foreground mb-3">Avaliação de Trauma Obstétrico</p>
        <div className="flex flex-col gap-3">
          {insercoes.map(item => (
            <FormRow key={item.id} label={item.label}>
              <SegmentedControl
                options={['Preservada', 'Desinserida']}
                value={str(data, item.id)}
                onChange={v => set(item.id, v)}
              />
            </FormRow>
          ))}
          <div className="grid grid-cols-3 gap-4">
            <FormRow label="Ruptura Parede Vaginal Posterior:">
              <SegmentedControl options={['Não', 'Sim']} value={str(data, 'rupturaVaginalPosterior')} onChange={v => set('rupturaVaginalPosterior', v)} />
            </FormRow>
            <FormRow label="Ruptura do EAE:">
              <SegmentedControl options={['Não', 'Sim']} value={str(data, 'rupturaEAE')} onChange={v => set('rupturaEAE', v)} />
            </FormRow>
            <FormRow label="Ruptura do EAI:">
              <SegmentedControl options={['Não', 'Sim']} value={str(data, 'rupturaEAI')} onChange={v => set('rupturaEAI', v)} />
            </FormRow>
          </div>
        </div>
      </div>
    </div>
  );
}

function PosParto_AvaliacaoAbdominal({ data, set }: { data: SD; set: SS }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Sensação de abaulamento vaginal?">
        <SegmentedControl options={['Não', 'Sim']} value={str(data, 'abaulamentoVaginal')} onChange={v => set('abaulamentoVaginal', v)} />
      </FormRow>
      <FormRow label="Dor abdominal?">
        <SegmentedControl options={['Não', 'Sim']} value={str(data, 'dorAbdominal')} onChange={v => set('dorAbdominal', v)} />
      </FormRow>
      <FormRow label="Diástase abdominal:">
        <FieldInput value={str(data, 'diastase')} onChange={v => set('diastase', v)} placeholder="Ex: 2 dedos, 3cm…" />
      </FormRow>
      <FormRow label="Controle de pressão abdominal:">
        <FieldTextarea value={str(data, 'controlePressao')} onChange={v => set('controlePressao', v)} rows={2} />
      </FormRow>
      <FormRow label="Observações:">
        <FieldTextarea value={str(data, 'observacoes')} onChange={v => set('observacoes', v)} rows={3} />
      </FormRow>
    </div>
  );
}

// ─── Template catalog ─────────────────────────────────────────────────────────

export const ANAMNESIS_TEMPLATES: AnamnesisTemplate[] = [
  {
    id: 'dor-pelvica',
    label: 'Dor Pélvica',
    description: 'Avaliação de dor pélvica crônica, dispareunia e disfunções sexuais.',
    Icon: Activity,
    color: 'text-rose-500',
    sections: [
      { id: 'queixaPrincipal', label: 'Queixa Principal', sub: 'Motivo da consulta e evolução dos sintomas', Component: QueixaPrincipalBase },
      { id: 'impacto', label: 'Impacto na Qualidade de Vida', sub: 'Interferência dos sintomas na rotina', Component: DorPelvica_Impacto },
      { id: 'molestiaAtual', label: 'Moléstia Atual (HMA)', sub: 'Caracterização detalhada da dor', Component: DorPelvica_MolestiaAtual },
      { id: 'molestiaPregressa', label: 'Moléstia Pregressa (HMP)', sub: 'Histórico médico e cirúrgico', Component: DorPelvica_HMP },
      { id: 'habitos', label: 'Hábitos Comportamentais', sub: 'Estilo de vida e fatores de risco', Component: HabitosBase },
      { id: 'conclusao', label: 'Hipóteses e Diagnóstico', sub: 'Impressão clínica e objetivos terapêuticos', Component: ConclusaoBase },
    ],
  },
  {
    id: 'funcao-urinaria',
    label: 'Função Urinária',
    description: 'Incontinência urinária, urgência miccional e disfunções do trato urinário.',
    Icon: Droplets,
    color: 'text-blue-500',
    sections: [
      { id: 'queixaPrincipal', label: 'Queixa Principal', sub: 'Motivo da consulta e evolução dos sintomas', Component: QueixaPrincipalBase },
      { id: 'impacto', label: 'Impacto', sub: 'Interferência dos sintomas na rotina', Component: Urinaria_Impacto },
      { id: 'funcaoArmazenamento', label: 'Função Urinária', sub: 'Frequência, armazenamento e esvaziamento', Component: Urinaria_FuncaoArmazenamento },
      { id: 'perdaUrinaria', label: 'Perda Urinária', sub: 'Caracterização da perda e uso de proteção', Component: Urinaria_Perda },
      { id: 'molestiaPregressa', label: 'Moléstia Pregressa (HMP)', sub: 'Histórico médico e cirúrgico', Component: (p) => <MolestiaPregressaBase {...p} /> },
      { id: 'habiConclusao', label: 'Hábitos e Conclusão', sub: 'Estilo de vida, hipóteses e objetivos', Component: Urinaria_HabitosEConclusao },
    ],
  },
  {
    id: 'funcao-evacuatoria',
    label: 'Função Evacuatória',
    description: 'Constipação intestinal, incontinência anal e disfunções evacuatórias.',
    Icon: ClipboardList,
    color: 'text-amber-500',
    sections: [
      { id: 'queixaPrincipal', label: 'Queixa Principal', sub: 'Motivo da consulta e evolução dos sintomas', Component: QueixaPrincipalBase },
      { id: 'impacto', label: 'Impacto', sub: 'Interferência dos sintomas na rotina', Component: Urinaria_Impacto },
      { id: 'funcaoIntestinal', label: 'Função Intestinal', sub: 'Hábito intestinal e caracterização dos sintomas', Component: Evacuatoria_FuncaoIntestinal },
      { id: 'molestiaPregressa', label: 'Moléstia Pregressa (HMP)', sub: 'Histórico médico e cirúrgico', Component: Evacuatoria_HMP },
      { id: 'habiConclusao', label: 'Hábitos e Conclusão', sub: 'Estilo de vida, hipóteses e objetivos', Component: Evacuatoria_HabitosEConclusao },
    ],
  },
  {
    id: 'gestacao',
    label: 'Gestação',
    description: 'Avaliação fisioterapêutica durante a gestação e preparação para o parto.',
    Icon: Heart,
    color: 'text-pink-500',
    sections: [
      { id: 'dadosGestacionais', label: 'Dados Gestacionais', sub: 'Informações da gestação atual', Component: Gestacao_DadosGestacionais },
      { id: 'queixasAtuais', label: 'Queixas Atuais', sub: 'Sintomas presentes na gestação', Component: Gestacao_QueixasAtuais },
      { id: 'habitosMedicacoes', label: 'Hábitos e Medicações', sub: 'Estilo de vida, suplementos e exames', Component: Gestacao_HabitosEMedicacoes },
      { id: 'funcoesPelvicas', label: 'Funções Pélvicas', sub: 'Avaliação urinária, intestinal e sexual', Component: Gestacao_FuncoesPelvicas },
      { id: 'testesMovilidade', label: 'Testes de Mobilidade', sub: 'Avaliação sacroilíaca', Component: Gestacao_TestesMovilidade },
    ],
  },
  {
    id: 'pos-parto',
    label: 'Pós-Parto',
    description: 'Reabilitação perineal, abdominal e pélvica no período pós-natal.',
    Icon: Baby,
    color: 'text-violet-500',
    sections: [
      { id: 'dadosObstetricos', label: 'Dados Obstétricos', sub: 'Informações sobre o parto', Component: PosParto_DadosObstetricos },
      { id: 'queixasImpacto', label: 'Queixas e Impacto', sub: 'Sintomas atuais e amamentação', Component: PosParto_QueixasEImpacto },
      { id: 'funcoesPelvicas', label: 'Funções Pélvicas', sub: 'Avaliação urinária, intestinal e sexual', Component: PosParto_FuncoesPelvicas },
      { id: 'exameFisico', label: 'Exame Físico', sub: 'Avaliação de trauma obstétrico', Component: PosParto_ExameFisico },
      { id: 'avaliacaoAbdominal', label: 'Avaliação Abdominal e Prolapso', sub: 'Diástase e controle pressórico', Component: PosParto_AvaliacaoAbdominal },
    ],
  },
];

export const ANAMNESIS_SECTION_LABELS: Record<string, string> = Object.fromEntries(
  ANAMNESIS_TEMPLATES.flatMap(t => t.sections.map(s => [s.id, s.label])),
);

export function formatAnamnesisKey(key: string): string {
  const result = key.replace(/([A-Z])/g, ' $1').toLowerCase();
  return result.charAt(0).toUpperCase() + result.slice(1);
}
