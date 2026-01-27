import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Search,
  Users,
  FileText,
  Printer
} from 'lucide-react';
import { mockPatients, mockAnamnesis } from '@/data/mockData';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Anamnesis() {
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

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Anamnese"
        description="Formulários de anamnese dos pacientes"
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

        {/* Anamnesis Form */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {patient ? `Anamnese - ${patient.name}` : 'Selecione um Paciente'}
            </CardTitle>
            {patient && (
              <Button variant="outline" size="sm">
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!patient ? (
              <EmptyState
                icon={Users}
                title="Nenhum paciente selecionado"
                description="Selecione um paciente na lista ao lado para visualizar sua anamnese"
              />
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span>
                    Última atualização: {format(new Date(mockAnamnesis.updatedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>

                {mockAnamnesis.sections.map((section, idx) => (
                  <div key={idx} className="border border-border rounded-lg p-4">
                    <h4 className="font-semibold text-foreground mb-4 pb-2 border-b border-border">
                      {section.title}
                    </h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {section.fields.map((field, fieldIdx) => (
                        <div key={fieldIdx}>
                          <p className="text-sm text-muted-foreground mb-1">{field.label}</p>
                          <p className="text-sm font-medium text-foreground bg-muted/50 p-2 rounded">
                            {field.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1">Editar Anamnese</Button>
                  <Button className="flex-1">Nova Anamnese</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
