import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Search,
  Users,
  Plus,
  TrendingUp
} from 'lucide-react';
import { mockPatients, mockEvolutions } from '@/data/mockData';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Evolutions() {
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const filteredPatients = mockPatients.filter(
    (patient) =>
      patient.name.toLowerCase().includes(search.toLowerCase()) ||
      patient.cpf.includes(search)
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const patient = selectedPatient ? mockPatients.find((p) => p.id === selectedPatient) : null;
  const patientEvolutions = mockEvolutions.filter((e) => e.patientId === selectedPatient);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Evoluções"
        description="Histórico de evoluções clínicas dos pacientes"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Patient List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Pacientes</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[500px] overflow-y-auto scrollbar-thin">
            <div className="space-y-2">
              {filteredPatients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selectedPatient === patient.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(patient.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{patient.name}</p>
                    <p className="text-sm text-muted-foreground">{patient.cpf}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Evolution Timeline */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {patient ? `Evoluções - ${patient.name}` : 'Selecione um Paciente'}
            </CardTitle>
            {patient && (
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Nova Evolução
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!patient ? (
              <EmptyState
                icon={Users}
                title="Nenhum paciente selecionado"
                description="Selecione um paciente na lista ao lado para visualizar suas evoluções"
              />
            ) : patientEvolutions.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Nenhuma evolução registrada"
                description="Adicione a primeira evolução clínica deste paciente"
                action={{
                  label: 'Nova Evolução',
                  onClick: () => {},
                }}
              />
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                <div className="space-y-6">
                  {patientEvolutions.map((evolution) => (
                    <div key={evolution.id} className="relative pl-10">
                      <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                      <div className="p-4 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {format(new Date(evolution.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {evolution.professionalName}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {evolution.description}
                        </p>
                        <div className="flex gap-2 mt-4">
                          <Button variant="ghost" size="sm">Editar</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
