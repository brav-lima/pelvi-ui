import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { perinealAssessmentsApi, patientsApi } from '@/lib/api';
import { perinealAssessmentSchema, type PerinealAssessmentFormData } from '@/components/perineal-assessment/schema';
import { ReadOnlyContext } from '@/components/perineal-assessment/ReadOnlyContext';
import { Step1InspecaoEstatica } from '@/components/perineal-assessment/steps/Step1InspecaoEstatica';
import { Step2InspecaoDinamica } from '@/components/perineal-assessment/steps/Step2InspecaoDinamica';
import { Step3TestesNeurologicos } from '@/components/perineal-assessment/steps/Step3TestesNeurologicos';
import { Step4PalpacaoEstatica } from '@/components/perineal-assessment/steps/Step4PalpacaoEstatica';
import { Step5PalpacaoDinamica } from '@/components/perineal-assessment/steps/Step5PalpacaoDinamica';
import { Step6Diagnostico } from '@/components/perineal-assessment/steps/Step6Diagnostico';

const STEP_SHORT = [
  'Inspeção estática',
  'Inspeção dinâmica',
  'Testes neurológicos',
  'Palpação estática',
  'Palpação dinâmica',
  'Diagnóstico cinesiológico funcional',
];

const STEP_GUIDES: string[] = [
  'Observe posição em repouso. Tônus bulbocavernoso avaliado com pressão suave no introito; corpo perineal medido entre fúrcula e ânus.',
  'Solicite contração voluntária máxima. Observe a direção do movimento do períneo — cranial é o padrão esperado. Avalie co-contrações durante a manobra.',
  'Para o reflexo bulbocavernoso, pressione o clitóris levemente e observe contração reflexa do esfíncter anal externo. Testes referentes ao nível S2–S4.',
  'Palpação bidigital intravaginal. Avalie tonicidade em repouso conforme protocolo Anatomia Palpatória 3D®. Registre presença de pontos dolorosos.',
  'Com dedo intravaginal, solicite contração máxima e avalie força pela Escala de Oxford Modificada (0–5). Observe sincronia entre tosse/esforço e resposta muscular.',
  'Integre os achados de todos os passos anteriores. O diagnóstico deve refletir a disfunção primária e os fatores contribuintes identificados.',
];

const EMPTY_DEFAULTS: PerinealAssessmentFormData = {};

function StepBubble({ n, label, state }: { n: number; label: string; state: 'done' | 'active' | 'pending' }) {
  return (
    <div className="flex flex-col items-start gap-2 min-w-0 flex-1">
      <div className="flex items-center w-full gap-2">
        <div className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-semibold border font-mono relative z-10',
          state === 'done' && 'bg-success text-white border-success',
          state === 'active' && 'bg-primary text-primary-foreground border-primary',
          state === 'pending' && 'bg-card text-muted-foreground border-border',
        )}>
          {state === 'done'
            ? <CheckCircle2 className="w-3.5 h-3.5" />
            : n}
        </div>
        {n < 6 && (
          <div className={cn('flex-1 h-0.5', state === 'done' ? 'bg-success' : 'bg-border')} />
        )}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.05em] font-mono">
          Passo {n}
        </div>
        <div className={cn(
          'text-[12px] font-medium leading-tight truncate',
          state === 'active' ? 'text-primary' : state === 'done' ? 'text-foreground' : 'text-muted-foreground',
        )}>
          {label}
        </div>
      </div>
    </div>
  );
}

export default function PerinealAssessmentPage() {
  const { patientId, assessmentId } = useParams<{ patientId: string; assessmentId?: string }>();
  const [searchParams] = useSearchParams();
  const isNew = assessmentId === 'new' || !assessmentId;
  const readOnly = searchParams.get('view') === '1';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.getById(patientId!),
    enabled: !!patientId,
  });

  const { data: allAssessments = [] } = useQuery({
    queryKey: ['patient-perineal-assessments', patientId],
    queryFn: () => perinealAssessmentsApi.list(patientId!),
    enabled: !!patientId,
  });

  // Previous assessment for Comparativo (not the current one)
  const previousAssessment = allAssessments.find(a => a.id !== assessmentId);

  const form = useForm<PerinealAssessmentFormData>({
    resolver: zodResolver(perinealAssessmentSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  // Load existing assessment data when editing/viewing
  useEffect(() => {
    if (!isNew && assessmentId) {
      const existing = allAssessments.find(a => a.id === assessmentId);
      if (existing?.data) {
        form.reset(existing.data as PerinealAssessmentFormData);
        setCompletedSteps(new Set([0, 1, 2, 3, 4, 5]));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, assessmentId, allAssessments]);

  const saveMutation = useMutation({
    mutationFn: async (data: PerinealAssessmentFormData) => {
      if (isNew) {
        return perinealAssessmentsApi.create({ patientId: patientId!, data });
      } else {
        return perinealAssessmentsApi.update(assessmentId!, { data });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-perineal-assessments', patientId] });
    },
  });

  const handleSaveAndExit = async () => {
    setSaveStatus('saving');
    try {
      await saveMutation.mutateAsync(form.getValues());
      setSaveStatus('saved');
      toast.success('Avaliação salva');
      navigate(`/patients/${patientId}?tab=perineal`);
    } catch {
      setSaveStatus('idle');
      toast.error('Erro ao salvar avaliação');
    }
  };

  const handleConclude = async () => {
    const valid = await form.trigger();
    if (!valid) {
      toast.error('Corrija os campos obrigatórios antes de concluir');
      return;
    }
    setSaveStatus('saving');
    try {
      await saveMutation.mutateAsync(form.getValues());
      toast.success('Avaliação concluída');
      navigate(`/patients/${patientId}?tab=perineal`);
    } catch {
      setSaveStatus('idle');
      toast.error('Erro ao salvar avaliação');
    }
  };

  const goNext = () => {
    setCompletedSteps(prev => new Set([...prev, step]));
    setStep(s => Math.min(s + 1, 5));
  };

  const goPrev = () => setStep(s => Math.max(s - 1, 0));

  const stepLabel = STEP_SHORT[step];

  // Comparativo: extract a couple of human-readable values from previous assessment data per step
  const prevData = previousAssessment?.data as PerinealAssessmentFormData | undefined;
  const comparativoRows = getComparativoRows(step, prevData, form.getValues());

  const startedAt = format(new Date(), "HH:mm", { locale: ptBR });

  return (
    <ReadOnlyContext.Provider value={readOnly}>
      <div className="space-y-5 animate-fade-in">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={() => navigate(`/patients/${patientId}?tab=perineal`)}
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para perfil
          </button>
          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && (
              <Badge variant="secondary" className="gap-1.5 text-[12px]">
                <Loader2 className="w-3 h-3 animate-spin" />
                Salvando…
              </Badge>
            )}
            {saveStatus === 'saved' && (
              <Badge variant="soft-success" className="gap-1.5 text-[12px]">
                <CheckCircle2 className="w-3 h-3" />
                Salvo
              </Badge>
            )}

            {!readOnly && (
              <>
                <Button variant="outline" size="sm" onClick={handleSaveAndExit} disabled={saveMutation.isPending}>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Salvar e sair
                </Button>
                <Button size="sm" onClick={handleConclude} disabled={saveMutation.isPending}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Concluir avaliação
                </Button>
              </>
            )}
            {readOnly && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/patients/${patientId}/perineal-assessment/${assessmentId}`)}>
                Editar
              </Button>
            )}
          </div>
        </div>

        {/* Page title */}
        <div>
          <h1 className="text-[26px] font-semibold leading-8" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}>
            Avaliação perineal
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {patient?.name ?? '…'}
            {!isNew && previousAssessment && (
              <> · iniciada às <span className="font-mono">{startedAt}</span></>
            )}
          </p>
        </div>

        {/* Stepper */}
        <Card className="px-5 py-4">
          <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(6, 1fr)` }}>
            {STEP_SHORT.map((label, i) => (
              <button
                key={i}
                onClick={() => !readOnly && setStep(i)}
                className={cn('text-left', !readOnly && 'cursor-pointer')}
              >
                <StepBubble
                  n={i + 1}
                  label={label}
                  state={completedSteps.has(i) && i !== step ? 'done' : i === step ? 'active' : 'pending'}
                />
              </button>
            ))}
          </div>
        </Card>

        {/* 2-column layout */}
        <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1fr 300px' }}>
          {/* Main form card */}
          <Card className="overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                  Passo {step + 1} · {stepLabel}
                </div>
                <div className="text-[12px] text-muted-foreground mt-0.5">
                  {getStepSub(step)}
                </div>
              </div>
              <span className="inline-flex items-center h-[22px] px-2.5 rounded-full text-[11.5px] font-medium bg-primary/10 text-primary border border-primary/20 font-mono">
                {step + 1} / 6
              </span>
            </div>

            {/* Step body */}
            <CardContent className="p-5">
              {step === 0 && <Step1InspecaoEstatica form={form} />}
              {step === 1 && <Step2InspecaoDinamica form={form} />}
              {step === 2 && <Step3TestesNeurologicos form={form} />}
              {step === 3 && <Step4PalpacaoEstatica form={form} />}
              {step === 4 && <Step5PalpacaoDinamica form={form} />}
              {step === 5 && <Step6Diagnostico form={form} />}
            </CardContent>

            {/* Card footer navigation */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-muted/30">
              <Button
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={step === 0}
                className="gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {step > 0 ? STEP_SHORT[step - 1] : 'Anterior'}
              </Button>
              <div className="flex gap-2">
                {!readOnly && (
                  <Button variant="ghost" size="sm" onClick={handleSaveAndExit} disabled={saveMutation.isPending}>
                    Salvar e sair
                  </Button>
                )}
                {step < 5 ? (
                  <Button size="sm" onClick={goNext} className="gap-1.5">
                    {STEP_SHORT[step + 1]}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  !readOnly && (
                    <Button size="sm" onClick={handleConclude} disabled={saveMutation.isPending} className="gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Concluir
                    </Button>
                  )
                )}
              </div>
            </div>
          </Card>

          {/* Right sidebar */}
          <div className="flex flex-col gap-4 sticky top-4">
            {/* Comparativo */}
            {previousAssessment ? (
              <Card>
                <div className="px-4 pt-4 pb-3 border-b border-border">
                  <div className="text-[13.5px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                    Comparativo
                  </div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5">
                    avaliação anterior · {format(new Date(previousAssessment.createdAt), 'dd/MMM', { locale: ptBR })}
                  </div>
                </div>
                <CardContent className="p-4">
                  {comparativoRows.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">Sem dados comparativos para este passo.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {comparativoRows.map((row, i) => (
                        <div key={i}>
                          <div className="text-[11px] text-muted-foreground mb-1">{row.label}</div>
                          <div className="flex items-center gap-2 text-[12px]">
                            <span className="text-muted-foreground">{row.before ?? '—'}</span>
                            <span className="text-muted-foreground/40">→</span>
                            <span className={cn(
                              'font-medium',
                              row.before !== row.now ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
                            )}>
                              {row.now ?? '—'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4">
                  <div className="text-[13.5px] font-semibold mb-1" style={{ fontFamily: 'var(--font-display)' }}>Comparativo</div>
                  <p className="text-[12px] text-muted-foreground">Primeira avaliação desta paciente. Sem dados anteriores para comparar.</p>
                </CardContent>
              </Card>
            )}

            {/* Guia clínico */}
            <Card style={{ background: 'hsl(var(--primary) / 0.04)', borderColor: 'hsl(var(--primary) / 0.18)' }}>
              <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: 'hsl(var(--primary) / 0.18)' }}>
                <div className="text-[13.5px] font-semibold text-primary" style={{ fontFamily: 'var(--font-display)' }}>
                  Guia clínico
                </div>
              </div>
              <CardContent className="p-4">
                <p className="text-[12.5px] leading-[18px]" style={{ color: 'hsl(var(--primary) / 0.85)' }}>
                  {STEP_GUIDES[step]}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ReadOnlyContext.Provider>
  );
}

function getStepSub(step: number): string {
  const subs = [
    '',
    'Atividade muscular durante manobras funcionais.',
    '',
    '',
    '',
    '',
  ];
  return subs[step] ?? '';
}

// Simplified comparativo: show a couple of key field values per step
interface ComparativoRow { label: string; before: string | undefined; now: string | undefined }

function getComparativoRows(
  step: number,
  prev: PerinealAssessmentFormData | undefined,
  curr: PerinealAssessmentFormData,
): ComparativoRow[] {
  const fmt = (v: string | undefined) => v ?? '—';
  switch (step) {
    case 0:
      return [
        { label: 'Tônus bulbocavernoso', before: fmt(prev?.inspecaoEstatica?.tonusBulbocav as string), now: fmt(curr?.inspecaoEstatica?.tonusBulbocav as string) },
        { label: 'Corpo perineal', before: fmt(prev?.inspecaoEstatica?.corpoPerineal as string), now: fmt(curr?.inspecaoEstatica?.corpoPerineal as string) },
      ];
    case 1:
      return [
        { label: 'Contração cranial', before: fmt(prev?.inspecaoDinamica?.levantadores?.contracaoMovCranial), now: fmt(curr?.inspecaoDinamica?.levantadores?.contracaoMovCranial) },
        { label: 'Relaxamento caudal', before: fmt(prev?.inspecaoDinamica?.levantadores?.relaxamentoMovCaudal), now: fmt(curr?.inspecaoDinamica?.levantadores?.relaxamentoMovCaudal) },
      ];
    case 2:
      return [
        { label: 'Reflexo clitoridiano (E)', before: fmt(prev?.testesNeurologicos?.atividadeReflexa?.clitoridianoE), now: fmt(curr?.testesNeurologicos?.atividadeReflexa?.clitoridianoE) },
        { label: 'Reflexo cutaneoanal', before: fmt(prev?.testesNeurologicos?.atividadeReflexa?.cutaneoanal), now: fmt(curr?.testesNeurologicos?.atividadeReflexa?.cutaneoanal) },
      ];
    case 3:
      return [
        { label: 'Trofismo', before: fmt(prev?.palpacaoEstatica?.trofismo), now: fmt(curr?.palpacaoEstatica?.trofismo) },
        { label: 'Superficiais', before: fmt(prev?.palpacaoEstatica?.superficiais), now: fmt(curr?.palpacaoEstatica?.superficiais) },
      ];
    case 4:
      return [
        { label: 'Força (Oxford)', before: fmt(prev?.palpacaoDinamica?.forca), now: fmt(curr?.palpacaoDinamica?.forca) },
        { label: 'Simetria', before: fmt(prev?.palpacaoDinamica?.simetria), now: fmt(curr?.palpacaoDinamica?.simetria) },
      ];
    case 5:
      return [];
    default:
      return [];
  }
}
