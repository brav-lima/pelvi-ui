import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowLeft, ArrowRight, Check, Download, Loader2,
  Activity, ClipboardList, Package,
} from 'lucide-react';
import { patientsApi, anamnesisApi, treatmentPackagesApi } from '@/lib/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCPFMasked } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SECTIONS = [
  { id: 'identificacao',        label: 'Identificação' },
  { id: 'historiaQueixa',       label: 'História da queixa' },
  { id: 'historiaObstetrica',   label: 'História obstétrica' },
  { id: 'historiaGinecologica', label: 'História ginecológica' },
  { id: 'habitosVida',          label: 'Hábitos de vida' },
  { id: 'medicamentos',         label: 'Medicamentos / alergias' },
  { id: 'examesComplementares', label: 'Exames complementares' },
  { id: 'planoTerapeutico',     label: 'Plano terapêutico' },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

const SECTION_SUBS: Record<SectionId, string> = {
  identificacao:        'Dados complementares da paciente',
  historiaQueixa:       'Detalhamento da motivação para tratamento',
  historiaObstetrica:   'Gestações, partos e intercorrências',
  historiaGinecologica: 'Ciclo, contracepção e histórico ginecológico',
  habitosVida:          'Atividade física, tabagismo, hidratação',
  medicamentos:         'Medicamentos em uso, alergias e antecedentes',
  examesComplementares: 'Resultados de exames relevantes',
  planoTerapeutico:     'Objetivos, técnicas e metas do tratamento',
};

// ─── Primitives ─────────────────────────────────────────────────────────────

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-muted-foreground mb-2">{label}</label>
      {children}
    </div>
  );
}

function FieldInput({
  value, onChange, placeholder = '', type = 'text',
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 px-3 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
    />
  );
}

function FieldTextarea({
  value, onChange, placeholder = '', rows = 3,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-y"
    />
  );
}

function ChipSelect({
  options, value, onChange,
}: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter(o => o !== opt) : [...value, opt]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={cn(
            'h-7 px-3 rounded-full text-[12.5px] font-medium border transition-colors',
            value.includes(opt)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SegmentedControl({
  options, value, onChange,
}: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden">
      {options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'flex-1 h-8 text-[12px] font-medium transition-colors px-2',
            i > 0 && 'border-l border-border',
            value === opt
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-muted-foreground hover:text-foreground',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Section forms ────────────────────────────────────────────────────────────

function SectionIdentificacao({ data, set }: { data: any; set: (k: string, v: any) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Profissão">
        <FieldInput value={data.profissao ?? ''} onChange={v => set('profissao', v)} placeholder="Ex: Professora, Enfermeira…" />
      </FormRow>
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Estado civil">
          <SegmentedControl
            options={['Solteira', 'Casada', 'Divorciada', 'Viúva']}
            value={data.estadoCivil ?? ''}
            onChange={v => set('estadoCivil', v)}
          />
        </FormRow>
        <FormRow label="Escolaridade">
          <SegmentedControl
            options={['Fundamental', 'Médio', 'Superior']}
            value={data.escolaridade ?? ''}
            onChange={v => set('escolaridade', v)}
          />
        </FormRow>
      </div>
      <FormRow label="Observações">
        <FieldTextarea
          value={data.observacoes ?? ''}
          onChange={v => set('observacoes', v)}
          placeholder="Informações adicionais relevantes…"
        />
      </FormRow>
    </div>
  );
}

function SectionHistoriaQueixa({ data, set }: { data: any; set: (k: string, v: any) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Queixa principal">
        <FieldInput
          value={data.queixaPrincipal ?? ''}
          onChange={v => set('queixaPrincipal', v)}
          placeholder="Descreva a queixa principal…"
        />
      </FormRow>

      <FormRow label="Início dos sintomas">
        <div className="flex gap-2">
          <input
            type="month"
            value={data.inicioSintomas ?? ''}
            onChange={e => set('inicioSintomas', e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-card text-[13px] font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            style={{ maxWidth: 160 }}
          />
          <select
            value={data.contextoInicio ?? ''}
            onChange={e => set('contextoInicio', e.target.value)}
            className="flex-1 h-9 px-3 rounded-lg border border-border bg-card text-[13px] text-foreground outline-none focus:border-primary transition-all"
          >
            <option value="">Contexto…</option>
            <option>Após gestação</option>
            <option>Após parto normal</option>
            <option>Após cesariana</option>
            <option>Após menopausa</option>
            <option>Sem relação identificada</option>
            <option>Outro</option>
          </select>
        </div>
      </FormRow>

      <FormRow label="Frequência dos episódios">
        <ChipSelect
          options={['Diária', 'Semanal', 'Quinzenal', 'Mensal', 'Esporádica']}
          value={data.frequencia ?? []}
          onChange={v => set('frequencia', v)}
        />
      </FormRow>

      <FormRow label="Gatilhos identificados">
        <ChipSelect
          options={['Tosse', 'Espirro', 'Riso', 'Exercício físico', 'Levantar peso', 'Mudança de posição', 'Urgência miccional']}
          value={data.gatilhos ?? []}
          onChange={v => set('gatilhos', v)}
        />
      </FormRow>

      <FormRow label="Volume de perda urinária">
        <SegmentedControl
          options={['Gotas', 'Pequena (jato curto)', 'Grande (encharca proteção)']}
          value={data.volumePerdaUrinaria ?? ''}
          onChange={v => set('volumePerdaUrinaria', v)}
        />
      </FormRow>

      <FormRow label="Uso de proteção (absorvente / fralda)">
        <div className="flex items-center gap-4 flex-wrap">
          <SegmentedControl
            options={['Não', 'Sim, ocasional', 'Sim, diário']}
            value={data.usoProtecao ?? ''}
            onChange={v => set('usoProtecao', v)}
          />
          {data.usoProtecao && data.usoProtecao !== 'Não' && (
            <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              em média
              <input
                type="number"
                min={0}
                value={data.protecaoPorDia ?? 0}
                onChange={e => set('protecaoPorDia', Number(e.target.value))}
                className="w-14 h-8 px-2 rounded-lg border border-border bg-card text-[13px] font-mono text-center outline-none focus:border-primary transition-all"
              />
              trocas / dia
            </span>
          )}
        </div>
      </FormRow>

      <FormRow label="Impacto na vida diária (1–10)">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={10}
            value={data.impactoQualidadeVida ?? 5}
            onChange={e => set('impactoQualidadeVida', Number(e.target.value))}
            className="flex-1 accent-primary"
          />
          <span
            className="font-semibold tabular-nums text-primary min-w-[28px] text-right"
            style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '-0.02em' }}
          >
            {data.impactoQualidadeVida ?? 5}
          </span>
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
          <span>Pouco impacto</span>
          <span>Muito impacto</span>
        </div>
      </FormRow>

      <FormRow label="Observações da profissional">
        <FieldTextarea
          value={data.observacoes ?? ''}
          onChange={v => set('observacoes', v)}
          placeholder="Observações clínicas relevantes…"
          rows={4}
        />
      </FormRow>
    </div>
  );
}

function SectionHistoriaObstetrica({ data, set }: { data: any; set: (k: string, v: any) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-3">
        {(['gestacoes', 'partos', 'cesareas', 'abortos'] as const).map(field => (
          <FormRow key={field} label={{ gestacoes: 'Gestações', partos: 'Partos', cesareas: 'Cesáreas', abortos: 'Abortos' }[field]}>
            <input
              type="number"
              min={0}
              value={data[field] ?? 0}
              onChange={e => set(field, Number(e.target.value))}
              className="w-full h-9 px-3 rounded-lg border border-border bg-card text-[13px] font-mono text-center outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </FormRow>
        ))}
      </div>
      <FormRow label="Data do último parto">
        <FieldInput type="date" value={data.ultimoParto ?? ''} onChange={v => set('ultimoParto', v)} />
      </FormRow>
      <FormRow label="Tipo do último parto">
        <SegmentedControl
          options={['Normal', 'Fórceps', 'Cesárea', 'Não houve']}
          value={data.tipoUltimoParto ?? ''}
          onChange={v => set('tipoUltimoParto', v)}
        />
      </FormRow>
      <FormRow label="Observações">
        <FieldTextarea
          value={data.observacoes ?? ''}
          onChange={v => set('observacoes', v)}
          placeholder="Intercorrências, lacerações, episiotomia…"
        />
      </FormRow>
    </div>
  );
}

function SectionHistoriaGinecologica({ data, set }: { data: any; set: (k: string, v: any) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Menarca">
          <FieldInput value={data.menarca ?? ''} onChange={v => set('menarca', v)} placeholder="Ex: 12 anos" />
        </FormRow>
        <FormRow label="Ciclo menstrual">
          <SegmentedControl
            options={['Regular', 'Irregular', 'Amenorreia']}
            value={data.cicloMenstrual ?? ''}
            onChange={v => set('cicloMenstrual', v)}
          />
        </FormRow>
      </div>
      <FormRow label="DPU (data da última menstruação)">
        <FieldInput type="date" value={data.dataDpu ?? ''} onChange={v => set('dataDpu', v)} />
      </FormRow>
      <FormRow label="Anticoncepcional atual">
        <FieldInput value={data.contraceptivo ?? ''} onChange={v => set('contraceptivo', v)} placeholder="Tipo e nome, ou 'Nenhum'" />
      </FormRow>
      <FormRow label="Menopausa">
        <SegmentedControl
          options={['Não', 'Peri', 'Sim']}
          value={data.menopausa ?? ''}
          onChange={v => set('menopausa', v)}
        />
      </FormRow>
      <FormRow label="Observações">
        <FieldTextarea
          value={data.observacoes ?? ''}
          onChange={v => set('observacoes', v)}
          placeholder="Histórico de infecções, DSTs, cirurgias ginecológicas…"
        />
      </FormRow>
    </div>
  );
}

function SectionHabitosVida({ data, set }: { data: any; set: (k: string, v: any) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Atividade física">
        <ChipSelect
          options={['Sedentária', 'Caminhada', 'Corrida', 'Musculação', 'Pilates', 'Yoga', 'Natação', 'Outra']}
          value={data.atividadeFisica ?? []}
          onChange={v => set('atividadeFisica', v)}
        />
      </FormRow>
      <FormRow label="Frequência de atividade">
        <SegmentedControl
          options={['Raramente', '1–2×/sem', '3–4×/sem', 'Diária']}
          value={data.frequenciaAtividade ?? ''}
          onChange={v => set('frequenciaAtividade', v)}
        />
      </FormRow>
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Tabagismo">
          <SegmentedControl
            options={['Não', 'Ex-fumante', 'Fumante']}
            value={data.tabagismo ?? ''}
            onChange={v => set('tabagismo', v)}
          />
        </FormRow>
        <FormRow label="Consumo de álcool">
          <SegmentedControl
            options={['Não', 'Ocasional', 'Frequente']}
            value={data.alcool ?? ''}
            onChange={v => set('alcool', v)}
          />
        </FormRow>
      </div>
      <FormRow label="Hidratação (água / dia)">
        <SegmentedControl
          options={['< 1L', '1–2L', '2–3L', '> 3L']}
          value={data.hidratacao ?? ''}
          onChange={v => set('hidratacao', v)}
        />
      </FormRow>
      <FormRow label="Observações">
        <FieldTextarea value={data.observacoes ?? ''} onChange={v => set('observacoes', v)} placeholder="Hábitos relevantes…" />
      </FormRow>
    </div>
  );
}

function SectionMedicamentos({ data, set }: { data: any; set: (k: string, v: any) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Medicações em uso">
        <FieldTextarea value={data.medicacoesEmUso ?? ''} onChange={v => set('medicacoesEmUso', v)} placeholder="Nome, dose, frequência…" rows={3} />
      </FormRow>
      <FormRow label="Alergias">
        <FieldInput value={data.alergias ?? ''} onChange={v => set('alergias', v)} placeholder="Medicamentos, alimentos, látex…" />
      </FormRow>
      <FormRow label="Doenças preexistentes">
        <FieldTextarea value={data.doencasPreexistentes ?? ''} onChange={v => set('doencasPreexistentes', v)} placeholder="Diagnósticos, condições crônicas…" rows={2} />
      </FormRow>
      <FormRow label="Cirurgias anteriores">
        <FieldTextarea value={data.cirurgiasAnteriores ?? ''} onChange={v => set('cirurgiasAnteriores', v)} placeholder="Tipo, ano, complicações…" rows={2} />
      </FormRow>
      <FormRow label="Observações">
        <FieldTextarea value={data.observacoes ?? ''} onChange={v => set('observacoes', v)} placeholder="Informações adicionais…" />
      </FormRow>
    </div>
  );
}

function SectionExames({ data, set }: { data: any; set: (k: string, v: any) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Uroculturas / exames de urina">
        <FieldTextarea value={data.uroculturas ?? ''} onChange={v => set('uroculturas', v)} placeholder="Resultados, datas…" rows={2} />
      </FormRow>
      <FormRow label="Ultrassonografia">
        <FieldTextarea value={data.ultrassonografia ?? ''} onChange={v => set('ultrassonografia', v)} placeholder="Tipo, data, achados…" rows={2} />
      </FormRow>
      <FormRow label="Urodinâmica">
        <FieldTextarea value={data.urodinamica ?? ''} onChange={v => set('urodinamica', v)} placeholder="Resultados da avaliação urodinâmica…" rows={2} />
      </FormRow>
      <FormRow label="Outros exames">
        <FieldTextarea value={data.outros ?? ''} onChange={v => set('outros', v)} placeholder="Outros exames relevantes…" rows={2} />
      </FormRow>
      <FormRow label="Observações">
        <FieldTextarea value={data.observacoes ?? ''} onChange={v => set('observacoes', v)} placeholder="Interpretação clínica…" />
      </FormRow>
    </div>
  );
}

function SectionPlano({ data, set }: { data: any; set: (k: string, v: any) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow label="Objetivos do tratamento">
        <FieldTextarea value={data.objetivos ?? ''} onChange={v => set('objetivos', v)} placeholder="O que esperamos alcançar…" rows={3} />
      </FormRow>
      <FormRow label="Técnicas planejadas">
        <ChipSelect
          options={['Biofeedback', 'Eletroestimulação', 'Cones vaginais', 'Exercícios perineais', 'TENS', 'Calor local', 'Massagem perineal', 'Hipopressivos']}
          value={data.tecnicas ?? []}
          onChange={v => set('tecnicas', v)}
        />
      </FormRow>
      <FormRow label="Frequência de sessões">
        <SegmentedControl
          options={['1×/semana', '2×/semana', '3×/semana', 'Quinzenal']}
          value={data.frequenciaSessoes ?? ''}
          onChange={v => set('frequenciaSessoes', v)}
        />
      </FormRow>
      <FormRow label="Metas de curto prazo">
        <FieldTextarea value={data.metas ?? ''} onChange={v => set('metas', v)} placeholder="Indicadores de melhora esperados nas primeiras semanas…" rows={2} />
      </FormRow>
      <FormRow label="Observações">
        <FieldTextarea value={data.observacoes ?? ''} onChange={v => set('observacoes', v)} placeholder="Considerações sobre o plano…" />
      </FormRow>
    </div>
  );
}

function renderSection(id: SectionId, data: any, set: (k: string, v: any) => void) {
  switch (id) {
    case 'identificacao':        return <SectionIdentificacao data={data} set={set} />;
    case 'historiaQueixa':       return <SectionHistoriaQueixa data={data} set={set} />;
    case 'historiaObstetrica':   return <SectionHistoriaObstetrica data={data} set={set} />;
    case 'historiaGinecologica': return <SectionHistoriaGinecologica data={data} set={set} />;
    case 'habitosVida':          return <SectionHabitosVida data={data} set={set} />;
    case 'medicamentos':         return <SectionMedicamentos data={data} set={set} />;
    case 'examesComplementares': return <SectionExames data={data} set={set} />;
    case 'planoTerapeutico':     return <SectionPlano data={data} set={set} />;
  }
}

function isSectionDone(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  return Object.values(data as Record<string, unknown>).some(v => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'number') return v > 0;
    return v && String(v).trim() !== '';
  });
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AnamnesisEditorPage() {
  const { patientId, anamnesisId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !anamnesisId || anamnesisId === 'new';

  const [activeSection, setActiveSection] = useState(0);
  const [formData, setFormData] = useState<Record<string, Record<string, any>>>({});

  const { data: patient, isLoading: loadingPatient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.getById(patientId!),
    enabled: !!patientId,
  });

  const { data: allAnamneses = [] } = useQuery({
    queryKey: ['patient-anamneses', patientId],
    queryFn: () => anamnesisApi.list(patientId!),
    enabled: !!patientId,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['treatment-packages', patientId],
    queryFn: () => treatmentPackagesApi.list({ patientId }),
    enabled: !!patientId,
  });

  const existing = isNew ? null : allAnamneses.find(a => a.id === anamnesisId);

  useEffect(() => {
    if (existing?.data) {
      setFormData(existing.data as Record<string, Record<string, any>>);
    }
  }, [existing?.id]);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isNew
        ? anamnesisApi.create({ patientId: patientId!, data })
        : anamnesisApi.update(anamnesisId!, { data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-anamneses', patientId] });
      toast.success('Anamnese salva com sucesso');
    },
    onError: () => toast.error('Erro ao salvar anamnese'),
  });

  const handleSave = () => saveMutation.mutate(formData);
  const handleSaveAndExit = async () => {
    await saveMutation.mutateAsync(formData);
    navigate(`/patients/${patientId}`);
  };

  const setSectionField = (key: string, value: any) => {
    const sectionId = SECTIONS[activeSection].id;
    setFormData(prev => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] ?? {}), [key]: value },
    }));
  };

  const doneCount = SECTIONS.filter(s => isSectionDone(formData[s.id])).length;
  const progress = Math.round((doneCount / SECTIONS.length) * 100);
  const currentSection = SECTIONS[activeSection];
  const currentData = formData[currentSection.id] ?? {};
  const activePackage = packages.find(p => p.status === 'ACTIVE');

  if (loadingPatient) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate(`/patients/${patientId}`)}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para perfil
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Exportar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : null}
            Salvar rascunho
          </Button>
          <Button size="sm" onClick={handleSaveAndExit} disabled={saveMutation.isPending}>
            <Check className="w-3.5 h-3.5 mr-1.5" />
            Salvar e finalizar
          </Button>
        </div>
      </div>

      {/* Page title */}
      <div>
        <h1
          className="text-[24px] font-semibold leading-8"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
        >
          Anamnese{patient ? ` · ${patient.name}` : ''}
        </h1>
        <div className="text-[12.5px] text-muted-foreground mt-1">
          {isNew
            ? 'Nova avaliação'
            : existing
            ? `criada em ${format(new Date(existing.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
            : 'Editando avaliação'}
        </div>
      </div>

      {/* 3-column layout */}
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '220px 1fr 280px' }}>

        {/* Section nav */}
        <Card className="p-1.5 sticky top-4">
          {SECTIONS.map((s, i) => {
            const done = isSectionDone(formData[s.id]);
            const active = i === activeSection;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(i)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-[9px] rounded-lg text-left transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                )}
              >
                <span className={cn(
                  'w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                  done
                    ? 'bg-emerald-500 border-emerald-500'
                    : active ? 'border-primary' : 'border-border',
                )}>
                  {done && <Check className="w-2 h-2 text-white" strokeWidth={3.5} />}
                </span>
                <span className={cn('text-[13px] flex-1 truncate', active && 'font-semibold')}>
                  {s.label}
                </span>
              </button>
            );
          })}
          <div className="border-t border-border mt-2 pt-3 px-3 pb-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
              <span>Progresso</span>
              <span className="tabular-nums text-foreground/70">{doneCount}/{SECTIONS.length}</span>
            </div>
            <div className="h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Form card */}
        <Card className="overflow-hidden">
          {/* Section header */}
          <div className="px-5 py-4 border-b border-border">
            <div className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              {currentSection.label}
            </div>
            <div className="text-[12.5px] text-muted-foreground mt-0.5">
              {SECTION_SUBS[currentSection.id]}
            </div>
          </div>

          {/* Section body */}
          <div className="p-5">
            {renderSection(currentSection.id, currentData, setSectionField)}
          </div>

          {/* Footer nav */}
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={activeSection === 0}
              onClick={() => setActiveSection(i => i - 1)}
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              {activeSection > 0 ? SECTIONS[activeSection - 1].label : 'Anterior'}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                Salvar rascunho
              </Button>
              {activeSection < SECTIONS.length - 1 ? (
                <Button size="sm" onClick={() => setActiveSection(i => i + 1)}>
                  {SECTIONS[activeSection + 1].label}
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              ) : (
                <Button size="sm" onClick={handleSaveAndExit} disabled={saveMutation.isPending}>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Concluir
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4 sticky top-4">
          {/* Patient card */}
          <Card>
            <div className="px-4 py-3 border-b border-border">
              <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Paciente</div>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {patient && (
                <>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-[15px] font-semibold shrink-0"
                      style={{
                        background: 'hsl(296 30% 94%)',
                        color: 'hsl(296 28% 26%)',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {patient.name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <div className="text-[13.5px] font-medium">{patient.name}</div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {patient.birthDate
                          ? `${Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 86400000))} anos`
                          : '—'}
                        {patient.cpf && ` · ${formatCPFMasked(patient.cpf)}`}
                      </div>
                    </div>
                  </div>
                  {activePackage && (
                    <div className="border-t border-border pt-3 flex flex-col gap-0.5">
                      <div className="text-[11.5px] text-muted-foreground">Pacote</div>
                      <div className="text-[13px] font-medium">
                        {activePackage.name} · {activePackage.usedSessions}/{activePackage.totalSessions}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Quick links */}
          <Card>
            <div className="px-4 py-3 border-b border-border">
              <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Atalhos de avaliação</div>
            </div>
            <div className="p-3 flex flex-col gap-1">
              {[
                {
                  icon: <Activity className="w-4 h-4 shrink-0" />,
                  label: 'Avaliação perineal',
                  to: `/patients/${patientId}/perineal-assessment/new`,
                },
                {
                  icon: <ClipboardList className="w-4 h-4 shrink-0" />,
                  label: 'Nova evolução',
                  to: `/patients/${patientId}`,
                },
                {
                  icon: <Package className="w-4 h-4 shrink-0" />,
                  label: 'Adicionar pacote',
                  to: `/patients/${patientId}`,
                },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.to)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full text-left"
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
