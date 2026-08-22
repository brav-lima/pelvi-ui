import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowLeft, Check, Download, Loader2,
  Activity, ClipboardList, Package,
} from 'lucide-react';
import { patientsApi, anamnesisApi, treatmentPackagesApi } from '@/lib/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCPFMasked } from '@/lib/formatters';
import { toast } from 'sonner';
import {
  ANAMNESIS_FIELDS, emptyAnamnesisData, isAnamnesisData,
  HypothesisField, GroupedHypotheses,
  type AnamnesisData,
} from '@/components/anamnesis/anamnesis-fields';

export default function AnamnesisEditorPage() {
  const { patientId, anamnesisId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !anamnesisId || anamnesisId === 'new';

  const [formData, setFormData] = useState<AnamnesisData>(emptyAnamnesisData());
  const [savedId, setSavedId] = useState<string | null>(null);

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
    if (existing?.data && isAnamnesisData(existing.data)) {
      setFormData(existing.data);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const effectiveId = savedId ?? (isNew ? null : anamnesisId ?? null);

  const saveMutation = useMutation({
    mutationFn: (data: AnamnesisData) =>
      effectiveId
        ? anamnesisApi.update(effectiveId, { data })
        : anamnesisApi.create({ patientId: patientId!, data }),
    onSuccess: (result) => {
      if (!effectiveId) setSavedId(result.id);
      queryClient.invalidateQueries({ queryKey: ['patient-anamneses', patientId] });
      toast.success('Anamnese salva com sucesso');
    },
    onError: () => toast.error('Erro ao salvar anamnese'),
  });

  const setField = <K extends keyof AnamnesisData>(key: K, value: AnamnesisData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => saveMutation.mutate(formData);
  const handleSaveAndExit = async () => {
    await saveMutation.mutateAsync(formData);
    navigate(`/patients/${patientId}`);
  };

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
        <div className="text-[12.5px] text-muted-foreground">
          {isNew
            ? 'Nova avaliação'
            : existing
            ? `criada em ${format(new Date(existing.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
            : 'Editando avaliação'}
        </div>
      </div>

      {/* 2-column layout: form + patient sidebar */}
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1fr 280px' }}>
        <Card className="p-5 space-y-6">
          {ANAMNESIS_FIELDS.map(field => (
            <HypothesisField
              key={field.key}
              label={field.label}
              question={field.question}
              value={formData[field.key]}
              onChange={v => setField(field.key, v)}
            />
          ))}
          <div className="border-t border-border pt-5">
            <GroupedHypotheses data={formData} />
          </div>
        </Card>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4 sticky top-4">
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
