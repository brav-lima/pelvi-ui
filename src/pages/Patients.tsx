import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  Calendar,
  ChevronRight,
  Users
} from 'lucide-react';
import { mockPatients } from '@/data/mockData';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function Patients() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filteredPatients = mockPatients.filter(
    (patient) =>
      patient.name.toLowerCase().includes(search.toLowerCase()) ||
      patient.cpf.includes(search) ||
      patient.email.toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Pacientes"
        description="Gerencie os pacientes da clínica"
        actions={
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Novo Paciente
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Patients List */}
      {filteredPatients.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={Users}
              title="Nenhum paciente encontrado"
              description="Não encontramos pacientes com os critérios de busca informados."
              action={{
                label: 'Cadastrar Paciente',
                onClick: () => {},
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPatients.map((patient) => (
            <Card
              key={patient.id}
              className="cursor-pointer hover:shadow-md hover:border-primary/20 transition-all"
              onClick={() => navigate(`/patients/${patient.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(patient.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground truncate">{patient.name}</h3>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                    <p className="text-sm text-muted-foreground">{patient.cpf}</p>
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        <span>{patient.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{patient.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>Cadastrado em {format(new Date(patient.createdAt), 'dd/MM/yyyy')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
