import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity, AlertTriangle, ArrowLeft, Check, ClipboardList, Download, Loader2, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { anamnesisApi, patientsApi, treatmentPackagesApi } from '@/lib/api';
import { useFeature } from '@/contexts/SubscriptionContext';
import { useAutosave } from '@/hooks/use-autosave';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { todayIso } from '@/lib/gestational-age';
import type { Anamnesis, AnamnesisStatus, AnamnesisType } from '@/types/clinic';
import {
  ANAMNESIS_FORMS, ANAMNESIS_TYPE_LABELS, asRecord, getSections, type SectionDef,
} from '@/components/anamnesis/anamnesis-forms';
import { AnamnesisPatientSidebar } from '@/components/anamnesis/AnamnesisPatientSidebar';
import { ClinicalNarrativeField } from '@/components/anamnesis/ClinicalNarrativeField';
import { CollapsibleSection } from '@/components/anamnesis/CollapsibleSection';
import { GestationalDataFields } from '@/components/anamnesis/GestationalDataFields';
import { IdentificationSection } from '@/components/anamnesis/IdentificationSection';
import { LegacyAnamnesisView } from '@/components/anamnesis/LegacyAnamnesisView';
import { ObstetricSummary } from '@/components/anamnesis/ObstetricSummary';
import { UltrasoundFields } from '@/components/anamnesis/UltrasoundFields';
import {
  asGestationalData, asUltrasound, recomputeGestational, type UltrasoundData,
} from '@/components/anamnesis/gestational-data';

const VALID_TYPES: AnamnesisType[] = ['PELVIC_GENERAL', 'PREGNANCY'];
const parseType = (raw: string | null): AnamnesisType | null =>
  VALID_TYPES.includes(raw as AnamnesisType) ? (raw as AnamnesisType) : null;

export default function AnamnesisEditorPage() {
  const { patientId, anamnesisId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !anamnesisId || anamnesisId === 'new';

  const [newType] = useState<AnamnesisType | null>(() => parseType(searchParams.get('type')));
  const [sections, setSections] = useState<Record<string, unknown>>({});
  const [assessmentDate, setAssessmentDate] = useState<string>(todayIso());
  const [dirty, setDirty] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<AnamnesisStatus | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const hydratedId = useRef<string | null>(null);

  const hasPerineal = useFeature('PERINEAL_ASSESSMENT');
  const hasEvolutions = useFeature('EVOLUTIONS');
  const hasPackages = useFeature('TREATMENT_PACKAGES');

  const { data: patient, isLoading: loadingPatient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.getById(patientId!),
    enabled: !!patientId,
  });

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['anamnesis', anamnesisId],
    queryFn: () => anamnesisApi.getById(anamnesisId!),
    enabled: !isNew,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['treatment-packages', patientId],
    queryFn: () => treatmentPackagesApi.list({ patientId }),
    enabled: !!patientId,
  });

  const type: AnamnesisType | null = existing ? existing.type : newType;
  const isLegacy = !isNew && !!existing && existing.type === null;
  const status: AnamnesisStatus = savedStatus ?? existing?.status ?? 'DRAFT';
  const effectiveId = savedId ?? (isNew ? null : anamnesisId ?? null);

  useEffect(() => {
    if (!existing || hydratedId.current === existing.id) return;
    hydratedId.current = existing.id;
    setSections(getSections(existing.data));
    setAssessmentDate(existing.assessmentDate ? existing.assessmentDate.slice(0, 10) : todayIso());
  }, [existing]);

  const persist = async (finalize: boolean): Promise<Anamnesis> => {
    const content = { sections };
    if (!effectiveId) {
      const created = await anamnesisApi.create({
        patientId: patientId!,
        type: type!,
        assessmentDate,
        data: content,
      });
      hydratedId.current = created.id;
      setSavedId(created.id);
      navigate(`/patients/${patientId}/anamnesis/${created.id}`, { replace: true });
      return finalize ? anamnesisApi.update(created.id, { status: 'COMPLETED' }) : created;
    }
    return anamnesisApi.update(effectiveId, {
      data: content,
      assessmentDate,
      ...(finalize && status === 'DRAFT' ? { status: 'COMPLETED' as const } : {}),
    });
  };

  const saveMutation = useMutation({
    mutationFn: (finalize: boolean) => persist(finalize),
    onSuccess: (result) => {
      if (result.status) setSavedStatus(result.status);
      setDirty(false);
      setLastSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ['patient-anamneses', patientId] });
      queryClient.invalidateQueries({ queryKey: ['anamnesis', result.id] });
    },
    onError: () => toast.error('Erro ao salvar anamnese', { id: 'anamnesis-save-error' }),
  });

  const handleSave = () =>
    saveMutation.mutate(false, {
      onSuccess: () => toast.success(status === 'COMPLETED' ? 'Alterações salvas' : 'Rascunho salvo'),
    });

  const handleFinalize = async () => {
    try {
      await saveMutation.mutateAsync(true);
      toast.success('Anamnese finalizada');
      navigate(`/patients/${patientId}`);
    } catch {
      /* onError already toasted */
    }
  };

  useAutosave({
    enabled: !!type && !isLegacy && status === 'DRAFT' && dirty && !saveMutation.isPending,
    onSave: () => saveMutation.mutate(false),
  });
  useUnsavedChangesGuard(dirty, setPendingPath);

  const requestNavigate = (path: string) => (dirty ? setPendingPath(path) : navigate(path));

  const setSection = (id: string, value: unknown) => {
    setSections((prev) => ({ ...prev, [id]: value }));
    setDirty(true);
  };

  const handleUltrasoundChange = (next: UltrasoundData) => {
    setSections((prev) => {
      if (prev.gestationalData === undefined) return { ...prev, ultrasound: next };
      return {
        ...prev,
        ultrasound: next,
        gestationalData: recomputeGestational(asGestationalData(prev.gestationalData), {
          assessmentDate,
          ultrasound: next,
        }),
      };
    });
    setDirty(true);
  };

  const handleAssessmentDateChange = (value: string) => {
    setAssessmentDate(value);
    setDirty(true);
    if (type === 'PREGNANCY') {
      setSections((prev) =>
        prev.gestationalData === undefined
          ? prev
          : {
              ...prev,
              gestationalData: recomputeGestational(asGestationalData(prev.gestationalData), {
                assessmentDate: value,
                ultrasound: asUltrasound(prev.ultrasound),
              }),
            },
      );
    }
  };

  const activePackage = packages.find((p) => p.status === 'ACTIVE');
  const shortcuts = [
    hasPerineal && {
      icon: <Activity className="w-4 h-4 shrink-0" />,
      label: 'Avaliação perineal',
      to: `/patients/${patientId}/perineal-assessment/new`,
    },
    hasEvolutions && {
      icon: <ClipboardList className="w-4 h-4 shrink-0" />,
      label: 'Nova evolução',
      to: `/patients/${patientId}`,
    },
    hasPackages && {
      icon: <Package className="w-4 h-4 shrink-0" />,
      label: 'Adicionar pacote',
      to: `/patients/${patientId}`,
    },
  ].filter(Boolean) as { icon: JSX.Element; label: string; to: string }[];

  if (isNew && !newType) return <Navigate to={`/patients/${patientId}`} replace />;

  if (loadingPatient || (!isNew && loadingExisting && !savedId)) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const backButton = (
    <button
      type="button"
      onClick={() => requestNavigate(`/patients/${patientId}`)}
      className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Voltar para perfil
    </button>
  );

  const title = (
    <div>
      <h1
        className="text-[24px] font-semibold leading-8"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
      >
        {isLegacy ? 'Anamnese' : type ? ANAMNESIS_TYPE_LABELS[type] : 'Anamnese'}
        {patient ? ` · ${patient.name}` : ''}
      </h1>
      <div className="text-[12.5px] text-muted-foreground">
        {existing
          ? [
              `criada em ${format(new Date(existing.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
              existing.professional?.person?.name && `por ${existing.professional.person.name}`,
              `última atualização ${format(new Date(existing.updatedAt), 'dd/MM/yyyy HH:mm')}`,
            ]
              .filter(Boolean)
              .join(' · ')
          : 'Nova avaliação'}
      </div>
    </div>
  );

  if (isLegacy && existing) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between gap-4">{backButton}</div>
        {title}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Formato anterior — somente leitura. Este registro foi preservado como foi salvo; para uma
            nova avaliação, crie uma Anamnese Pélvica Geral ou Gestacional.
          </AlertDescription>
        </Alert>
        <Card className="p-5">
          <LegacyAnamnesisView data={existing.data} />
        </Card>
      </div>
    );
  }

  const gestational = asGestationalData(sections.gestationalData);
  const ultrasound = asUltrasound(sections.ultrasound);

  const renderSection = (def: SectionDef) => {
    if (def.component === 'identification') {
      const identification = asRecord(sections.identification);
      return (
        <IdentificationSection
          patient={patient}
          referral={typeof identification.referral === 'string' ? identification.referral : ''}
          onReferralChange={(v) => setSection('identification', { ...identification, referral: v })}
          onEditPatient={() => requestNavigate(`/patients/${patientId}`)}
        />
      );
    }
    if (def.component === 'gestationalData') {
      return (
        <GestationalDataFields
          value={gestational}
          ultrasound={ultrasound}
          assessmentDate={assessmentDate}
          onChange={(v) => setSection('gestationalData', v)}
        />
      );
    }
    if (def.component === 'ultrasound') {
      return <UltrasoundFields value={ultrasound} onChange={handleUltrasoundChange} />;
    }
    const raw = sections[def.id];
    return (
      <ClinicalNarrativeField
        id={`field-${def.id}`}
        title={def.title}
        hideTitle
        placeholder={def.placeholder}
        guidance={def.guidance}
        value={typeof raw === 'string' ? raw : ''}
        onChange={(v) => setSection(def.id, v)}
      />
    );
  };

  const isCompleted = status === 'COMPLETED';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {backButton}
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground" aria-live="polite">
            {dirty
              ? 'Alterações não salvas'
              : lastSavedAt
                ? `Salvo às ${format(lastSavedAt, 'HH:mm')}`
                : ''}
          </span>
          <Button variant="outline" size="sm">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Exportar PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending || (isCompleted && !dirty)}
          >
            {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {isCompleted ? 'Salvar alterações' : 'Salvar rascunho'}
          </Button>
          {!isCompleted && (
            <Button size="sm" onClick={handleFinalize} disabled={saveMutation.isPending}>
              <Check className="w-3.5 h-3.5 mr-1.5" />
              Salvar e finalizar
            </Button>
          )}
        </div>
      </div>

      {title}

      {isCompleted && (
        <Alert>
          <AlertDescription>
            Esta anamnese foi finalizada. Você pode continuar editando; cada alteração fica registrada
            no histórico.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 items-start lg:grid-cols-[1fr_280px]">
        <Card className="p-5 space-y-4">
          <div className="max-w-xs space-y-2">
            <label htmlFor="assessment-date" className="block text-[12.5px] font-medium text-muted-foreground">
              Data da avaliação
            </label>
            <Input
              id="assessment-date"
              type="date"
              value={assessmentDate}
              onChange={(e) => handleAssessmentDateChange(e.target.value || todayIso())}
            />
          </div>

          {type === 'PREGNANCY' && (
            <ObstetricSummary
              gestational={gestational}
              ultrasound={ultrasound}
              assessmentDate={assessmentDate}
            />
          )}

          {type &&
            ANAMNESIS_FORMS[type].map((def) => (
              <CollapsibleSection key={def.id} id={def.id} title={def.title}>
                {renderSection(def)}
              </CollapsibleSection>
            ))}
        </Card>

        <AnamnesisPatientSidebar
          patient={patient}
          activePackage={activePackage}
          shortcuts={shortcuts}
          onNavigate={requestNavigate}
        />
      </div>

      <AlertDialog open={pendingPath !== null} onOpenChange={(open) => !open && setPendingPath(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Há alterações que ainda não foram salvas nesta anamnese. Se sair agora, elas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const path = pendingPath;
                setDirty(false);
                setPendingPath(null);
                if (path) navigate(path);
              }}
            >
              Sair sem salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
