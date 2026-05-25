import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowLeft, ArrowRight, Check, Download, Loader2,
  Activity, ClipboardList, Package, ChevronRight,
} from 'lucide-react';
import { patientsApi, anamnesisApi, treatmentPackagesApi } from '@/lib/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCPFMasked } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ANAMNESIS_TEMPLATES, type AnamnesisTemplate } from '@/components/anamnesis/anamnesis-templates';
import { type SD } from '@/components/anamnesis/anamnesis-primitives';

// ─── Template selection screen ────────────────────────────────────────────────

function TemplateSelectionScreen({
  onSelect,
  onBack,
}: { onSelect: (t: AnamnesisTemplate) => void; onBack: () => void }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para perfil
      </button>

      <div>
        <h1
          className="text-[24px] font-semibold leading-8"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
        >
          Escolha o modelo de anamnese
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          O modelo define as seções e campos específicos para cada tipo de avaliação.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ANAMNESIS_TEMPLATES.map(template => {
          const { Icon } = template;
          return (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="group text-left rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center bg-muted', template.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors mt-1" />
              </div>
              <div
                className="text-[15px] font-semibold text-foreground mb-1"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {template.label}
              </div>
              <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                {template.description}
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <span>{template.sections.length} seções</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section done check ───────────────────────────────────────────────────────

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

  const [selectedTemplate, setSelectedTemplate] = useState<AnamnesisTemplate | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [formData, setFormData] = useState<Record<string, SD>>({});

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
      const { _template, ...sections } = existing.data as Record<string, unknown>;
      setFormData(sections as Record<string, SD>);
      if (_template) {
        const t = ANAMNESIS_TEMPLATES.find(t => t.id === _template);
        if (t) setSelectedTemplate(t);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const SECTIONS = selectedTemplate?.sections ?? [];

  const buildPayload = () => ({ _template: selectedTemplate?.id, ...formData });

  const handleSave = () => saveMutation.mutate(buildPayload());
  const handleSaveAndExit = async () => {
    await saveMutation.mutateAsync(buildPayload());
    navigate(`/patients/${patientId}`);
  };

  const setSectionField = (key: string, value: unknown) => {
    const sectionId = SECTIONS[activeSection].id;
    setFormData(prev => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] ?? {}), [key]: value },
    }));
  };
  const doneCount = SECTIONS.filter(s => isSectionDone(formData[s.id])).length;
  const progress = SECTIONS.length > 0 ? Math.round((doneCount / SECTIONS.length) * 100) : 0;
  const currentSection = SECTIONS[activeSection];
  const currentData = currentSection ? (formData[currentSection.id] ?? {}) : {};
  const activePackage = packages.find(p => p.status === 'ACTIVE');

  if (loadingPatient) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show template selection for new anamneses before wizard
  if (isNew && !selectedTemplate) {
    return (
      <TemplateSelectionScreen
        onSelect={t => { setSelectedTemplate(t); setActiveSection(0); }}
        onBack={() => navigate(`/patients/${patientId}`)}
      />
    );
  }

  if (!selectedTemplate) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { Icon: TemplateIcon } = selectedTemplate;

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
        <div className="flex items-center gap-2 mb-1">
          <div className={cn('w-7 h-7 rounded-md flex items-center justify-center bg-muted', selectedTemplate.color)}>
            <TemplateIcon className="w-3.5 h-3.5" />
          </div>
          <h1
            className="text-[24px] font-semibold leading-8"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
          >
            Anamnese – {selectedTemplate.label}{patient ? ` · ${patient.name}` : ''}
          </h1>
        </div>
        <div className="text-[12.5px] text-muted-foreground">
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
          {currentSection && (
            <>
              {/* Section header */}
              <div className="px-5 py-4 border-b border-border">
                <div className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                  {currentSection.label}
                </div>
                <div className="text-[12.5px] text-muted-foreground mt-0.5">
                  {currentSection.sub}
                </div>
              </div>

              {/* Section body */}
              <div className="p-5">
                <currentSection.Component
                  data={currentData}
                  set={setSectionField}
                />
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
            </>
          )}
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
