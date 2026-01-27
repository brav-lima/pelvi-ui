import { useParams, useNavigate } from 'react-router-dom';
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
  User,
  FileText,
  TrendingUp,
  Clock
} from 'lucide-react';
import { mockPatients, mockAppointments, mockAnamnesis, mockEvolutions } from '@/data/mockData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const patient = mockPatients.find((p) => p.id === id);
  const patientAppointments = mockAppointments.filter((a) => a.patientId === id);
  const patientEvolutions = mockEvolutions.filter((e) => e.patientId === id);

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/patients')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <PageHeader
          title={patient.name}
          description={`CPF: ${patient.cpf}`}
          actions={
            <Button variant="outline">
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
              <p className="text-muted-foreground">
                {calculateAge(patient.birthDate)} anos • {patient.gender === 'male' ? 'Masculino' : 'Feminino'}
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="text-sm font-medium">{patient.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{patient.email}</p>
                </div>
              </div>
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
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Endereço</p>
                  <p className="text-sm font-medium">{patient.address}</p>
                </div>
              </div>
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

            <TabsContent value="appointments" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Histórico de Consultas</CardTitle>
                </CardHeader>
                <CardContent>
                  {patientAppointments.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhuma consulta registrada
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {patientAppointments.map((apt) => (
                        <div
                          key={apt.id}
                          className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-background border border-border">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{apt.procedureName}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(apt.date), "dd/MM/yyyy")} às {apt.time} • {apt.professionalName}
                            </p>
                          </div>
                          <StatusBadge status={apt.status} />
                        </div>
                      ))}
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
                  {mockAnamnesis.sections.map((section, idx) => (
                    <div key={idx} className="mb-6 last:mb-0">
                      <h4 className="font-semibold text-foreground mb-3">{section.title}</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {section.fields.map((field, fieldIdx) => (
                          <div key={fieldIdx} className="p-3 rounded-lg bg-muted/50">
                            <p className="text-sm text-muted-foreground">{field.label}</p>
                            <p className="text-sm font-medium mt-1">{field.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evolutions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Evoluções Clínicas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                    <div className="space-y-6">
                      {patientEvolutions.map((evolution) => (
                        <div key={evolution.id} className="relative pl-10">
                          <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                          <div className="p-4 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-foreground">
                                {format(new Date(evolution.date), "dd/MM/yyyy")}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                • {evolution.professionalName}
                              </span>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed">
                              {evolution.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
