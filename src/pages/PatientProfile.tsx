import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  Loader2,
} from 'lucide-react';
import { patientsApi, appointmentsApi, anamnesisApi, evolutionsApi } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PatientFormDialog } from '@/components/patients/PatientFormDialog';

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const { data: patient, isLoading, refetch } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsApi.getById(id!),
    enabled: !!id,
  });

  // Fetch all appointments for patient (wide range)
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/patients')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <PageHeader
          title={patient.name}
          description={patient.cpf ? `CPF: ${patient.cpf}` : undefined}
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
                    <p className="text-sm font-medium">{patient.phone}</p>
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
                Evolucoes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="appointments" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Histórico de Consultas</CardTitle>
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
                        return (
                          <div
                            key={apt.id}
                            className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-background border border-border">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{apt.procedure?.name ?? '-'}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(start, 'dd/MM/yyyy')} as {format(start, 'HH:mm')} • {apt.professional?.person?.name ?? ''}
                              </p>
                            </div>
                            <StatusBadge status={apt.status} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="anamnesis" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Anamnese</CardTitle>
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
                          <p className="text-sm text-muted-foreground mb-3">
                            {format(new Date(anamnesis.createdAt), 'dd/MM/yyyy')}
                            {anamnesis.professional?.person?.name && ` • ${anamnesis.professional.person.name}`}
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {Object.entries(anamnesis.data).map(([key, value]) => (
                              <div key={key} className="p-3 rounded-lg bg-muted/50">
                                <p className="text-sm text-muted-foreground">{key}</p>
                                <p className="text-sm font-medium mt-1">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-')}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evolutions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Evoluções Clínicas</CardTitle>
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

      <PatientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => refetch()}
        patient={patient}
      />
    </div>
  );
}
