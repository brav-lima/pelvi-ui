import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  ArrowLeft, Edit, Eye, Phone, Mail, MapPin, Calendar,
  TrendingUp, Plus, Loader2, CheckCircle, XCircle,
  CalendarCheck, Package, DollarSign, Wallet,
  ClipboardList, Stethoscope, FileText, User,
} from 'lucide-react';
import {
  patientsApi, appointmentsApi, anamnesisApi, evolutionsApi,
  treatmentPackagesApi, financialApi, perinealAssessmentsApi,
} from '@/lib/api';
import { toast } from 'sonner';
import { format, parseISO, isAfter, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PatientFormDialog } from '@/components/patients/PatientFormDialog';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { EvolutionFormDialog } from '@/components/evolutions/EvolutionFormDialog';
import { TreatmentPackageFormDialog } from '@/components/treatment-packages/TreatmentPackageFormDialog';
import { formatCPFMasked, formatPhone, formatCurrency } from '@/lib/formatters';
import type { AppointmentStatus, TreatmentPackage, FinancialRecord, PerinealAssessment } from '@/types/clinic';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useFeature } from '@/contexts/SubscriptionContext';

const AVATAR_COLORS = [
  ['hsl(296 30% 94%)', 'hsl(296 28% 26%)'],
  ['hsl(142 55% 93%)', 'hsl(142 60% 22%)'],
  ['hsl(199 75% 93%)', 'hsl(199 70% 28%)'],
  ['hsl(38 80% 93%)',  'hsl(30 75% 30%)'],
  ['hsl(265 60% 94%)', 'hsl(265 50% 32%)'],
  ['hsl(290 8% 92%)',  'hsl(290 18% 28%)'],
] as const;

function hashColor(name: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31 + name.charCodeAt(i)) >>> 0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
}

function calculateAge(birthDate: string) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function genderLabel(g?: string) {
  if (g === 'M') return 'Masculino';
  if (g === 'F') return 'Feminino';
  if (g === 'O') return 'Outro';
  return g || '';
}

const TAB_TRIGGER = cn(
  'rounded-none border-b-2 border-transparent',
  'data-[state=active]:border-primary data-[state=active]:text-primary',
  'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
  'pb-3 pt-1 px-4 h-auto text-[13.5px] font-medium text-muted-foreground',
  'hover:text-foreground/80 transition-colors -mb-px',
);

function CountBadge({ n, active }: { n: number; active?: boolean }) {
  return (
    <span className={cn(
      'ml-1.5 text-[11px] px-1.5 py-px rounded-full font-medium tabular-nums',
      active || n > 0 ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground',
    )}>
      {n}
    </span>
  );
}

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const hasPerineal   = useFeature('PERINEAL_ASSESSMENT');
  const hasAnamnesis  = useFeature('ANAMNESIS');
  const hasEvolutions = useFeature('EVOLUTIONS');
  const hasPackages   = useFeature('TREATMENT_PACKAGES');
  const hasFinancial  = useFeature('FINANCIAL_BASIC');

  const [editOpen, setEditOpen] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [evolutionOpen, setEvolutionOpen] = useState(false);
  const [quickEvolution, setQuickEvolution] = useState('');

  const [packageOpen, setPackageOpen] = useState(false);
  const [cancelingPackage, setCancelingPackage] = useState<TreatmentPackage | null>(null);

  const { data: patient, isLoading, refetch } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsApi.getById(id!),
    enabled: !!id,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['patient-appointments', id],
    queryFn: () => appointmentsApi.list({ startDate: '2020-01-01', endDate: '2030-12-31' }),
    enabled: !!id,
    select: (data) => data
      .filter((a) => a.patientId === id)
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
  });

  const { data: anamneses = [] } = useQuery({
    queryKey: ['patient-anamneses', id],
    queryFn: () => anamnesisApi.list(id!),
    enabled: !!id && hasAnamnesis,
  });

  const { data: evolutions = [] } = useQuery({
    queryKey: ['patient-evolutions', id],
    queryFn: () => evolutionsApi.list(id!),
    enabled: !!id && hasEvolutions,
  });

  const { data: treatmentPackages = [] } = useQuery({
    queryKey: ['treatment-packages', id],
    queryFn: () => treatmentPackagesApi.list({ patientId: id }),
    enabled: !!id && hasPackages,
  });

  const { data: patientFinancial = [] } = useQuery({
    queryKey: ['patient-financial', id],
    queryFn: () => financialApi.listByPatient(id!),
    enabled: !!id && hasFinancial,
  });

  const { data: perinealAssessments = [] } = useQuery({
    queryKey: ['patient-perineal-assessments', id],
    queryFn: () => perinealAssessmentsApi.list(id!),
    enabled: !!id && hasPerineal,
  });

  const now = new Date();
  const upcomingAppointments = [...appointments]
    .filter(a => isAfter(new Date(a.startAt), now) && (a.status === 'SCHEDULED' || a.status === 'CONFIRMED'))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const nextAppointment = upcomingAppointments[0];
  const firstAppointment = appointments.length > 0
    ? [...appointments].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0]
    : null;
  const todayAppointment = appointments.find(a =>
    isToday(new Date(a.startAt)) && (a.status === 'SCHEDULED' || a.status === 'CONFIRMED' || a.status === 'DONE')
  );
  const activePackage = treatmentPackages.find(p => p.status === 'ACTIVE');

  const quickEvolutionMutation = useMutation({
    mutationFn: () => evolutionsApi.create({
      patientId: id!,
      description: quickEvolution,
      appointmentId: todayAppointment?.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-evolutions', id] });
      setQuickEvolution('');
      toast.success('Evolução registrada');
    },
    onError: () => toast.error('Erro ao registrar evolução'),
  });

  const cancelPackageMutation = useMutation({
    mutationFn: (pkgId: string) => treatmentPackagesApi.update(pkgId, { status: 'CANCELED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment-packages', id] });
      toast.success('Pacote cancelado com sucesso');
      setCancelingPackage(null);
    },
    onError: () => toast.error('Erro ao cancelar pacote'),
  });

  const darBaixaMutation = useMutation({
    mutationFn: (finId: string) => financialApi.update(finId, { status: 'PAID' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-financial', id] });
      toast.success('Pagamento confirmado');
    },
    onError: () => toast.error('Erro ao confirmar pagamento'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ aptId, status }: { aptId: string; status: AppointmentStatus }) =>
      appointmentsApi.updateStatus(aptId, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['patient-appointments', id] });
      const labels: Record<string, string> = {
        CONFIRMED: 'Agendamento confirmado',
        CANCELED: 'Agendamento cancelado',
        DONE: 'Agendamento finalizado',
      };
      toast.success(labels[updated.status] ?? 'Status atualizado');
    },
    onError: () => toast.error('Erro ao alterar status'),
  });

  const perinealPreview = (a: PerinealAssessment): string => {
    const data = a.data as Record<string, unknown> | undefined;
    const diag = data?.diagnostico as { classificacoes?: string[] } | undefined;
    if (diag?.classificacoes?.length) return diag.classificacoes.join(' • ');
    return 'Avaliação registrada';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Paciente não encontrado</p>
      </div>
    );
  }

  const [avatarBg, avatarFg] = hashColor(patient.name);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Back + page actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/patients')}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para pacientes
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit className="w-3.5 h-3.5 mr-1.5" />
            Editar dados
          </Button>
          <Button size="sm" onClick={() => setAppointmentOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nova consulta
          </Button>
        </div>
      </div>

      {/* Profile header card — horizontal */}
      <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
        {/* Avatar */}
        <div
          className="rounded-full flex items-center justify-center shrink-0 font-semibold"
          style={{ width: 64, height: 64, background: avatarBg, color: avatarFg, fontSize: 22, fontFamily: 'var(--font-display)' }}
        >
          {initials(patient.name)}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2
              className="text-[22px] font-semibold leading-7"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.015em' }}
            >
              {patient.name}
            </h2>
            {activePackage && (
              <span className="inline-flex items-center h-5 px-2 rounded bg-secondary text-[11px] font-medium text-muted-foreground font-mono">
                {activePackage.name} · {activePackage.usedSessions}/{activePackage.totalSessions}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {(patient.birthDate || patient.gender) && (
              <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <User className="w-3.5 h-3.5 shrink-0" />
                {patient.birthDate && (
                  <strong className="text-foreground/80 font-medium">{calculateAge(patient.birthDate)} anos</strong>
                )}
                {patient.birthDate && patient.gender && ' · '}
                {patient.gender && genderLabel(patient.gender)}
              </div>
            )}
            {patient.phone && (
              <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono">{formatPhone(patient.phone)}</span>
              </div>
            )}
            {patient.email && (
              <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span>{patient.email}</span>
              </div>
            )}
            {patient.addressCity && (
              <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{patient.addressCity}{patient.addressState ? ` · ${patient.addressState}` : ''}</span>
              </div>
            )}
            {patient.cpf && (
              <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono">{formatCPFMasked(patient.cpf)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="hidden sm:flex gap-6 pl-5 border-l border-border shrink-0">
          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] text-muted-foreground font-medium">Consultas</span>
            <span
              className="text-[22px] font-semibold tabular-nums leading-7"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
            >
              {appointments.length}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] text-muted-foreground font-medium">Desde</span>
            <span className="text-[13.5px] font-medium">
              {firstAppointment
                ? format(new Date(firstAppointment.startAt), 'MMM/yyyy', { locale: ptBR })
                : format(new Date(patient.createdAt), 'MMM/yyyy', { locale: ptBR })}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] text-muted-foreground font-medium">Próxima</span>
            <span className={cn('text-[13.5px] font-medium', nextAppointment ? 'text-primary' : 'text-muted-foreground')}>
              {nextAppointment
                ? isToday(new Date(nextAppointment.startAt))
                  ? `hoje ${format(new Date(nextAppointment.startAt), 'HH:mm')}`
                  : format(new Date(nextAppointment.startAt), "dd/MM 'às' HH:mm")
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="appointments">
        <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 gap-0">
          <TabsTrigger value="appointments" className={TAB_TRIGGER}>
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            Consultas
            <CountBadge n={appointments.length} />
          </TabsTrigger>
          {hasAnamnesis && (
            <TabsTrigger value="anamnesis" className={TAB_TRIGGER}>
              <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
              Anamnese
              <CountBadge n={anamneses.length} />
            </TabsTrigger>
          )}
          {hasEvolutions && (
            <TabsTrigger value="evolutions" className={TAB_TRIGGER}>
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
              Evoluções
              <CountBadge n={evolutions.length} />
            </TabsTrigger>
          )}
          {hasPerineal && (
            <TabsTrigger value="perineal" className={TAB_TRIGGER}>
              <Stethoscope className="w-3.5 h-3.5 mr-1.5" />
              Av. Perineal
              <CountBadge n={perinealAssessments.length} />
            </TabsTrigger>
          )}
          {hasPackages && (
            <TabsTrigger value="packages" className={TAB_TRIGGER}>
              <Package className="w-3.5 h-3.5 mr-1.5" />
              Pacotes
              <CountBadge n={treatmentPackages.length} />
            </TabsTrigger>
          )}
          {hasFinancial && (
            <TabsTrigger value="financial" className={TAB_TRIGGER}>
              <Wallet className="w-3.5 h-3.5 mr-1.5" />
              Financeiro
              <CountBadge n={patientFinancial.length} />
            </TabsTrigger>
          )}
        </TabsList>

        {/* 2-column content: main (1.7fr) + right sidebar (1fr) */}
        <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: '1.7fr 1fr', alignItems: 'flex-start' }}>

          {/* Main column — tab content */}
          <div>

            {/* === Consultas === */}
            <TabsContent value="appointments" className="mt-0">
              <Card className="p-0 overflow-hidden">
                <div className="flex items-start justify-between p-4 border-b border-border">
                  <div>
                    <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Histórico de consultas</div>
                    <div className="text-[12.5px] text-muted-foreground mt-0.5">
                      {appointments.length} registros · ordem mais recente primeiro
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setAppointmentOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Nova consulta
                  </Button>
                </div>
                <CardContent className="p-4">
                  {appointments.length === 0 ? (
                    <p className="text-[13.5px] text-muted-foreground text-center py-8">Nenhuma consulta registrada</p>
                  ) : (
                    <div className="space-y-2">
                      {appointments.map((apt) => {
                        const start = parseISO(apt.startAt);
                        const canChange = apt.status !== 'CANCELED' && apt.status !== 'DONE';
                        return (
                          <div key={apt.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                            <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-card border border-border shrink-0">
                              <span className="font-mono text-[9px] text-muted-foreground uppercase">{format(start, 'EEE', { locale: ptBR })}</span>
                              <span className="text-[14px] font-semibold leading-none tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
                                {format(start, 'dd')}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13.5px] font-medium truncate">{apt.procedure?.name ?? '—'}</p>
                              <p className="text-[12px] text-muted-foreground">
                                <span className="font-mono">{format(start, 'HH:mm')}</span>
                                {apt.professional?.person?.name && ` · ${apt.professional.person.name}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <StatusBadge status={apt.status} />
                              {canChange && (
                                <div className="flex gap-0.5 ml-1">
                                  {apt.status === 'SCHEDULED' && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-success hover:text-success" title="Confirmar" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ aptId: apt.id, status: 'CONFIRMED' })}>
                                      <CheckCircle className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Finalizar" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ aptId: apt.id, status: 'DONE' })}>
                                    <CalendarCheck className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Cancelar" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ aptId: apt.id, status: 'CANCELED' })}>
                                    <XCircle className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* === Anamnese === */}
            {hasAnamnesis && (
              <TabsContent value="anamnesis" className="mt-0">
                <Card className="p-0 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Anamnese</div>
                    <Button size="sm" onClick={() => navigate(`/patients/${id}/anamnesis/new`)}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Nova avaliação
                    </Button>
                  </div>
                  <CardContent className="p-4">
                    {anamneses.length === 0 ? (
                      <p className="text-[13.5px] text-muted-foreground text-center py-8">Nenhuma avaliação registrada</p>
                    ) : (
                      <div className="space-y-6">
                        {anamneses.map((anamnesis) => (
                          <div key={anamnesis.id} className="border border-border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-[12.5px] text-muted-foreground">
                                {format(new Date(anamnesis.createdAt), 'dd/MM/yyyy')}
                                {anamnesis.professional?.person?.name && ` · ${anamnesis.professional.person.name}`}
                              </p>
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${id}/anamnesis/${anamnesis.id}`)}>
                                <Edit className="w-3.5 h-3.5 mr-1" />
                                Editar
                              </Button>
                            </div>
                            <div className="space-y-4">
                              {Object.entries(anamnesis.data).map(([key, value]) => {
                                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                                  const section = value as Record<string, unknown>;
                                  return (
                                    <div key={key} className="border border-border rounded-lg p-4">
                                      <h4 className="text-[13.5px] font-semibold text-foreground mb-3 pb-2 border-b border-border">{key}</h4>
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        {Object.entries(section).map(([fk, fv]) => (
                                          <div key={fk} className="p-3 rounded-lg bg-secondary/50">
                                            <p className="text-[12px] text-muted-foreground">{fk}</p>
                                            <p className="text-[13px] font-medium mt-1">
                                              {fv != null && String(fv).trim() !== '' ? String(fv) : 'Não informado'}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={key} className="p-3 rounded-lg bg-secondary/50">
                                    <p className="text-[12px] text-muted-foreground">{key}</p>
                                    <p className="text-[13px] font-medium mt-1">
                                      {value != null && String(value).trim() !== '' ? String(value) : 'Não informado'}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* === Evoluções === */}
            {hasEvolutions && (
              <TabsContent value="evolutions" className="mt-0">
                <Card className="p-0 overflow-hidden">
                  <div className="flex items-start justify-between p-4 border-b border-border">
                    <div>
                      <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Evoluções clínicas</div>
                      <div className="text-[12.5px] text-muted-foreground mt-0.5">
                        {evolutions.length} registros · ordem mais recente primeiro
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setEvolutionOpen(true)}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Nova evolução
                    </Button>
                  </div>
                  <CardContent className="p-4 space-y-4">
                    {/* Quick-add */}
                    <div>
                      <textarea
                        className="w-full min-h-[88px] p-3 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-y"
                        placeholder="Registrar evolução rápida desta consulta…"
                        value={quickEvolution}
                        onChange={e => setQuickEvolution(e.target.value)}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                          <span>Vinculada a:</span>
                          {todayAppointment ? (
                            <span className="inline-flex items-center h-5 px-2 rounded bg-secondary text-[11px] font-mono font-medium text-muted-foreground">
                              Consulta de hoje · {format(new Date(todayAppointment.startAt), 'HH:mm')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 italic text-[12px]">nenhuma consulta hoje</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          disabled={!quickEvolution.trim() || quickEvolutionMutation.isPending}
                          onClick={() => quickEvolutionMutation.mutate()}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                          Salvar
                        </Button>
                      </div>
                    </div>

                    <hr className="border-border" />

                    {/* Timeline */}
                    {evolutions.length === 0 ? (
                      <p className="text-[13.5px] text-muted-foreground text-center py-4">Nenhuma evolução registrada</p>
                    ) : (
                      <div>
                        {evolutions.map((evo, i) => {
                          const d = new Date(evo.createdAt);
                          return (
                            <div key={evo.id} className="grid gap-3 py-2.5" style={{ gridTemplateColumns: '72px 20px 1fr' }}>
                              <div className="text-right pt-1 font-mono text-[11px] text-muted-foreground leading-tight">
                                <div>{format(d, 'dd MMM', { locale: ptBR })}</div>
                              </div>
                              <div className="relative flex justify-center">
                                {i < evolutions.length - 1 && (
                                  <div className="absolute w-px bg-border" style={{ top: 18, bottom: -10 }} />
                                )}
                                <div className="w-2.5 h-2.5 rounded-full bg-primary mt-[5px] z-10 shrink-0" />
                              </div>
                              <div className="min-w-0 pb-2">
                                <div className="text-[13.5px] font-medium text-foreground leading-5">Evolução clínica</div>
                                <div className="text-[12.5px] text-muted-foreground mt-0.5 leading-[18px]">{evo.description}</div>
                                {evo.professional?.person?.name && (
                                  <div className="text-[11.5px] text-muted-foreground/60 mt-1">
                                    por <span className="text-muted-foreground">{evo.professional.person.name}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* === Avaliação Perineal === */}
            {hasPerineal && (
              <TabsContent value="perineal" className="mt-0">
                <Card className="p-0 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Avaliações perineais</div>
                    <Button size="sm" onClick={() => navigate(`/patients/${id}/perineal-assessment/new`)}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Nova avaliação
                    </Button>
                  </div>
                  <CardContent className="p-4">
                    {perinealAssessments.length === 0 ? (
                      <p className="text-[13.5px] text-muted-foreground text-center py-8">Nenhuma avaliação perineal registrada</p>
                    ) : (
                      <div className="space-y-3">
                        {perinealAssessments.map((assessment) => (
                          <div key={assessment.id} className="border border-border rounded-lg p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
                                <Stethoscope className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13.5px] font-medium">
                                  {format(new Date(assessment.createdAt), 'dd/MM/yyyy')}
                                  {assessment.professional?.person?.name && ` · ${assessment.professional.person.name}`}
                                </p>
                                <p className="text-[12px] text-muted-foreground truncate">{perinealPreview(assessment)}</p>
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${id}/perineal-assessment/${assessment.id}?view=1`)}>
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                Ver
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${id}/perineal-assessment/${assessment.id}`)}>
                                <Edit className="w-3.5 h-3.5 mr-1" />
                                Editar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* === Pacotes === */}
            {hasPackages && (
              <TabsContent value="packages" className="mt-0">
                <Card className="p-0 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Pacotes de tratamento</div>
                    <Button size="sm" onClick={() => setPackageOpen(true)}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Novo pacote
                    </Button>
                  </div>
                  <CardContent className="p-4">
                    {treatmentPackages.length === 0 ? (
                      <p className="text-[13.5px] text-muted-foreground text-center py-8">Nenhum pacote registrado</p>
                    ) : (
                      <div className="space-y-4">
                        {treatmentPackages.map((pkg) => {
                          const progress = pkg.totalSessions > 0 ? Math.round((pkg.usedSessions / pkg.totalSessions) * 100) : 0;
                          const remaining = pkg.totalSessions - pkg.usedSessions;
                          return (
                            <div key={pkg.id} className="border border-border rounded-lg p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                                    <Package className="w-5 h-5 text-primary" />
                                  </div>
                                  <div>
                                    <h4 className="text-[13.5px] font-medium">{pkg.name}</h4>
                                    <p className="text-[12px] text-muted-foreground">R$ {formatCurrency(pkg.totalPrice)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={pkg.status} />
                                  {pkg.status === 'ACTIVE' && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setCancelingPackage(pkg)}>
                                      <XCircle className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[12.5px]">
                                  <span className="text-muted-foreground">{pkg.usedSessions}/{pkg.totalSessions} sessões utilizadas</span>
                                  <span className="font-medium">{remaining > 0 ? `${remaining} restantes` : 'Concluído'}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                                </div>
                              </div>
                              {pkg.procedures && pkg.procedures.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {pkg.procedures.map((pp) => (
                                    <span key={pp.id} className="inline-flex items-center h-5 px-2 rounded bg-secondary text-[11px] text-muted-foreground">
                                      {pp.procedure.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* === Financeiro === */}
            {hasFinancial && (
              <TabsContent value="financial" className="mt-0">
                <Card className="p-0 overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Financeiro</div>
                  </div>
                  <CardContent className="p-4">
                    {patientFinancial.length === 0 ? (
                      <p className="text-[13.5px] text-muted-foreground text-center py-8">Nenhum registro financeiro</p>
                    ) : (
                      <div className="space-y-3">
                        {[...patientFinancial]
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .map((fin) => {
                            const isIncome = fin.type === 'INCOME';
                            const isPending = fin.status === 'PENDING';
                            return (
                              <div key={fin.id} className="border border-border rounded-lg p-4 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={cn(
                                    'flex items-center justify-center w-10 h-10 rounded-lg shrink-0',
                                    isIncome ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/10 text-destructive',
                                  )}>
                                    <DollarSign className="w-5 h-5" />
                                  </div>
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={cn(
                                        'text-[11.5px] font-medium px-2 py-px rounded-full border',
                                        isIncome ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400' : 'bg-destructive/10 text-destructive border-destructive/20',
                                      )}>
                                        {isIncome ? 'Receita' : 'Despesa'}
                                      </span>
                                      <StatusBadge status={fin.status} />
                                    </div>
                                    <p className="text-[13.5px] font-medium">
                                      R$ {formatCurrency(fin.amount)}
                                      {fin.installment && fin.installment.total > 1
                                        ? ` · Parcela ${fin.installment.current}/${fin.installment.total}` : ''}
                                    </p>
                                    {fin.description && <p className="text-[12px] text-muted-foreground truncate">{fin.description}</p>}
                                    <p className="text-[12px] text-muted-foreground">
                                      {format(new Date(fin.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                    </p>
                                  </div>
                                </div>
                                {isPending && (
                                  <Button
                                    variant="outline" size="sm"
                                    className="shrink-0 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/10 dark:text-emerald-400"
                                    onClick={() => darBaixaMutation.mutate(fin.id)}
                                    disabled={darBaixaMutation.isPending}
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                    Dar baixa
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </div>

          {/* Right sidebar — always visible regardless of active tab */}
          <div className="flex flex-col gap-4">

            {/* Resumo clínico */}
            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b border-border">
                <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Resumo clínico</div>
              </div>
              <CardContent className="p-4 flex flex-col gap-4">
                <div>
                  <div className="text-[11.5px] text-muted-foreground font-medium mb-1.5">Queixa principal</div>
                  {patient.notes ? (
                    <div className="text-[13px] text-foreground/80 leading-relaxed">{patient.notes}</div>
                  ) : anamneses[0] ? (
                    <div className="text-[12.5px] text-muted-foreground">
                      Última avaliação {format(new Date(anamneses[0].createdAt), 'dd/MM/yyyy')}
                      {anamneses[0].professional?.person?.name && ` · ${anamneses[0].professional.person.name}`}
                    </div>
                  ) : (
                    <div className="text-[13px] text-muted-foreground/50 italic">Não informada</div>
                  )}
                </div>

                {perinealAssessments[0] && (
                  <>
                    <hr className="border-border" />
                    <div>
                      <div className="text-[11.5px] text-muted-foreground font-medium mb-1.5">Avaliação perineal</div>
                      <div className="text-[12.5px] text-muted-foreground">
                        {format(new Date(perinealAssessments[0].createdAt), 'dd/MM/yyyy')}
                        {perinealAssessments[0].professional?.person?.name && ` · ${perinealAssessments[0].professional.person.name}`}
                      </div>
                      <div className="text-[12.5px] text-muted-foreground mt-0.5">
                        {perinealPreview(perinealAssessments[0])}
                      </div>
                    </div>
                  </>
                )}

                {activePackage && (
                  <>
                    <hr className="border-border" />
                    <div>
                      <div className="text-[11.5px] text-muted-foreground font-medium mb-1.5">Pacote ativo</div>
                      <div className="text-[13px] font-medium">{activePackage.name}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, (activePackage.usedSessions / activePackage.totalSessions) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {activePackage.usedSessions}/{activePackage.totalSessions}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Próximas consultas */}
            <Card className="p-0 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Próximas consultas</div>
                <button
                  onClick={() => navigate('/agenda')}
                  className="text-[12.5px] text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-0.5"
                >
                  Agenda →
                </button>
              </div>
              {upcomingAppointments.length === 0 ? (
                <div className="p-4 text-center text-[13px] text-muted-foreground">Nenhuma consulta agendada</div>
              ) : (
                <div>
                  {upcomingAppointments.slice(0, 4).map((apt, i, arr) => {
                    const d = new Date(apt.startAt);
                    return (
                      <div
                        key={apt.id}
                        className={cn('flex items-center gap-3 px-4 py-3', i < arr.length - 1 && 'border-b border-border/60')}
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0"
                          style={{ background: 'hsl(296 30% 94%)', color: 'hsl(296 28% 26%)' }}
                        >
                          <span className="font-mono text-[9px] uppercase">{format(d, 'EEE', { locale: ptBR })}</span>
                          <span className="text-[14px] font-semibold leading-none tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
                            {format(d, 'dd')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate">{apt.procedure?.name ?? 'Consulta'}</div>
                          <div className="text-[11.5px] text-muted-foreground">
                            <span className="font-mono">{format(d, 'HH:mm')}</span>
                            {apt.professional?.person?.name && ` · ${apt.professional.person.name}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </Tabs>

      {/* Dialogs */}
      <PatientFormDialog open={editOpen} onOpenChange={setEditOpen} onSuccess={() => refetch()} patient={patient} />
      <AppointmentFormDialog
        open={appointmentOpen}
        onOpenChange={setAppointmentOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['patient-appointments', id] })}
      />
      {id && (
        <EvolutionFormDialog
          open={evolutionOpen}
          onOpenChange={setEvolutionOpen}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['patient-evolutions', id] })}
          patientId={id}
        />
      )}
      {id && (
        <TreatmentPackageFormDialog
          open={packageOpen}
          onOpenChange={setPackageOpen}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['treatment-packages', id] })}
          patientId={id}
        />
      )}

      <AlertDialog open={!!cancelingPackage} onOpenChange={() => setCancelingPackage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Pacote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o pacote "{cancelingPackage?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelingPackage && cancelPackageMutation.mutate(cancelingPackage.id)}
            >
              Cancelar Pacote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
