import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  TrendingUp,
  Clock,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  CalendarCheck,
} from 'lucide-react';
import { patientsApi, appointmentsApi, anamnesisApi, evolutionsApi } from '@/lib/api';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PatientFormDialog } from '@/components/patients/PatientFormDialog';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { EvolutionFormDialog } from '@/components/evolutions/EvolutionFormDialog';
import { AnamnesisFormDialog } from '@/components/anamnesis/AnamnesisFormDialog';
import { formatCPF, formatCPFMasked, formatPhone } from '@/lib/formatters';
import type { Anamnesis, AppointmentStatus } from '@/types/clinic';

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [evolutionOpen, setEvolutionOpen] = useState(false);
  const [anamnesisOpen, setAnamnesisOpen] = useState(false);
  const [editingAnamnesis, setEditingAnamnesis] = useState<Anamnesis | undefined>();

  const { data: patient, isLoading, refetch } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsApi.getById(id!),
    enabled: !!id,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['patient-appointments', id],
    queryFn: () => appointmentsApi.list({ startDate: '2020-01-01', endDate: '2030-12-31' }),
    enabled: !!id,
    select: (data) => data.filter((a) => a.patientId === id),
  });

  const { data: anamneses = [] } = useQuery({
    queryKey: ['patient-anamneses', id],
    queryFn: () => anamnesisApi.list(id!),
    enabled: !!id,
  });

  const { data: evolutions = [] } = useQuery({
    queryKey: ['patient-evolutions', id],
    queryFn: () => evolutionsApi.list(id!),
    enabled: !!id,
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const genderLabel = (g?: string) => {
    if (g === 'M') return 'Masculino';
    if (g === 'F') return 'Feminino';
    if (g === 'O') return 'Outro';
    return g || '';
  };

  const openCreateAnamnesis = () => {
    setEditingAnamnesis(undefined);
    setAnamnesisOpen(true);
  };

  const openEditAnamnesis = (anamnesis: Anamnesis) => {
    setEditingAnamnesis(anamnesis);
    setAnamnesisOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/patients')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <PageHeader
          title={patient.name}
          description={patient.cpf ? `CPF: ${formatCPFMasked(patient.cpf)}` : undefined}
          actions={
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Patient Info Card */}
        <Card className="lg:col-span-1">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
                  {getInitials(patient.name)}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-semibold">{patient.name}</h2>
              {(patient.birthDate || patient.gender) && (
                <p className="text-muted-foreground">
                  {patient.birthDate && `${calculateAge(patient.birthDate)} anos`}
                  {patient.birthDate && patient.gender && ' • '}
                  {patient.gender && genderLabel(patient.gender)}
                </p>
              )}
            </div>

            <div className="mt-6 space-y-4">
              {patient.phone && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="text-sm font-medium">{formatPhone(patient.phone)}</p>
                  </div>
                </div>
              )}
              {patient.email && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{patient.email}</p>
                  </div>
                </div>
              )}
              {patient.birthDate && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                    <p className="text-sm font-medium">
                      {format(new Date(patient.birthDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}
              {patient.address && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Endereço</p>
                    <p className="text-sm font-medium">{patient.address}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="appointments">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="appointments" className="gap-2">
                <Calendar className="w-4 h-4" />
                Consultas
              </TabsTrigger>
              <TabsTrigger value="anamnesis" className="gap-2">
                <FileText className="w-4 h-4" />
                Anamnese
              </TabsTrigger>
              <TabsTrigger value="evolutions" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Evoluções
              </TabsTrigger>
            </TabsList>

            {/* === Appointments Tab === */}
            <TabsContent value="appointments" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Histórico de Consultas</CardTitle>
                  <Button size="sm" onClick={() => setAppointmentOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Agendamento
                  </Button>
                </CardHeader>
                <CardContent>
                  {appointments.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhuma consulta registrada
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {appointments.map((apt) => {
                        const start = parseISO(apt.startAt);
                        const canChangeStatus = apt.status !== 'CANCELED' && apt.status !== 'DONE';
                        return (
                          <div
                            key={apt.id}
                            className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-background border border-border">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{apt.procedure?.name ?? '-'}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(start, 'dd/MM/yyyy')} às {format(start, 'HH:mm')} • {apt.professional?.person?.name ?? ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={apt.status} />
                              {canChangeStatus && (
                                <div className="flex gap-1">
                                  {apt.status === 'SCHEDULED' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-success hover:text-success"
                                      title="Confirmar"
                                      disabled={statusMutation.isPending}
                                      onClick={() => statusMutation.mutate({ aptId: apt.id, status: 'CONFIRMED' })}
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Finalizar"
                                    disabled={statusMutation.isPending}
                                    onClick={() => statusMutation.mutate({ aptId: apt.id, status: 'DONE' })}
                                  >
                                    <CalendarCheck className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    title="Cancelar"
                                    disabled={statusMutation.isPending}
                                    onClick={() => statusMutation.mutate({ aptId: apt.id, status: 'CANCELED' })}
                                  >
                                    <XCircle className="w-4 h-4" />
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

            {/* === Anamnesis Tab === */}
            <TabsContent value="anamnesis" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Anamnese</CardTitle>
                  <Button size="sm" onClick={openCreateAnamnesis}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Anamnese
                  </Button>
                </CardHeader>
                <CardContent>
                  {anamneses.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhuma anamnese registrada
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {anamneses.map((anamnesis) => (
                        <div key={anamnesis.id} className="border border-border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(anamnesis.createdAt), 'dd/MM/yyyy')}
                              {anamnesis.professional?.person?.name && ` • ${anamnesis.professional.person.name}`}
                            </p>
                            <Button variant="ghost" size="sm" onClick={() => openEditAnamnesis(anamnesis)}>
                              <Edit className="w-4 h-4 mr-1" />
                              Editar
                            </Button>
                          </div>
                          <div className="space-y-4">
                            {Object.entries(anamnesis.data).map(([key, value]) => {
                              if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                                const section = value as Record<string, unknown>;
                                return (
                                  <div key={key} className="border border-border rounded-lg p-4">
                                    <h4 className="font-semibold text-foreground mb-3 pb-2 border-b border-border">
                                      {key}
                                    </h4>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      {Object.entries(section).map(([fieldKey, fieldValue]) => (
                                        <div key={fieldKey} className="p-3 rounded-lg bg-muted/50">
                                          <p className="text-sm text-muted-foreground">{fieldKey}</p>
                                          <p className="text-sm font-medium mt-1">
                                            {fieldValue != null && String(fieldValue).trim() !== ''
                                              ? String(fieldValue)
                                              : 'Não informado'}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div key={key} className="p-3 rounded-lg bg-muted/50">
                                  <p className="text-sm text-muted-foreground">{key}</p>
                                  <p className="text-sm font-medium mt-1">
                                    {value != null && String(value).trim() !== ''
                                      ? String(value)
                                      : 'Não informado'}
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

            {/* === Evolutions Tab === */}
            <TabsContent value="evolutions" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Evoluções Clínicas</CardTitle>
                  <Button size="sm" onClick={() => setEvolutionOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Evolução
                  </Button>
                </CardHeader>
                <CardContent>
                  {evolutions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhuma evolução registrada
                    </p>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                      <div className="space-y-6">
                        {evolutions.map((evolution) => (
                          <div key={evolution.id} className="relative pl-10">
                            <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                            <div className="p-4 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-semibold text-foreground">
                                  {format(new Date(evolution.createdAt), 'dd/MM/yyyy')}
                                </span>
                                {evolution.professional?.person?.name && (
                                  <span className="text-sm text-muted-foreground">
                                    • {evolution.professional.person.name}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-foreground leading-relaxed">
                                {evolution.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Patient Dialog */}
      <PatientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => refetch()}
        patient={patient}
      />

      {/* Create Appointment Dialog */}
      <AppointmentFormDialog
        open={appointmentOpen}
        onOpenChange={setAppointmentOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['patient-appointments', id] })}
      />

      {/* Create Evolution Dialog */}
      {id && (
        <EvolutionFormDialog
          open={evolutionOpen}
          onOpenChange={setEvolutionOpen}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['patient-evolutions', id] })}
          patientId={id}
        />
      )}

      {/* Create/Edit Anamnesis Dialog */}
      {id && (
        <AnamnesisFormDialog
          open={anamnesisOpen}
          onOpenChange={setAnamnesisOpen}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['patient-anamneses', id] })}
          patientId={id}
          anamnesis={editingAnamnesis}
        />
      )}
    </div>
  );
}
