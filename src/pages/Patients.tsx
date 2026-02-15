import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  ChevronLeft,
  Users,
  Loader2,
  LayoutGrid,
  List,
} from 'lucide-react';
import { patientsApi } from '@/lib/api';
import { formatCPF, formatPhone } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { PatientFormDialog } from '@/components/patients/PatientFormDialog';

type ViewMode = 'card' | 'list';

export default function Patients() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('patients-view') as ViewMode) || 'card',
  );
  const navigate = useNavigate();

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('patients-view', mode);
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['patients', debouncedSearch, page],
    queryFn: () => patientsApi.list({ search: debouncedSearch, page, limit: 12 }),
  });

  const patients = data?.data ?? [];
  const meta = data?.meta;

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
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Paciente
          </Button>
        }
      />

      {/* Search + View Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center border border-border rounded-md">
          <Button
            variant={viewMode === 'card' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-9 w-9 rounded-r-none"
            onClick={() => handleViewChange('card')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-9 w-9 rounded-l-none"
            onClick={() => handleViewChange('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : patients.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={Users}
              title="Nenhum paciente encontrado"
              description={
                debouncedSearch
                  ? 'Não encontramos pacientes com os critérios de busca informados.'
                  : 'Cadastre o primeiro paciente da clínica.'
              }
              action={{
                label: 'Cadastrar Paciente',
                onClick: () => setFormOpen(true),
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === 'card' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {patients.map((patient) => (
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
                        {patient.cpf && (
                          <p className="text-sm text-muted-foreground">{formatCPF(patient.cpf)}</p>
                        )}
                        <div className="mt-3 space-y-1">
                          {patient.phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              <span>{formatPhone(patient.phone)}</span>
                            </div>
                          )}
                          {patient.email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              <span className="truncate">{patient.email}</span>
                            </div>
                          )}
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
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nome</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">CPF</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Telefone</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Cadastro</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map((patient) => (
                        <tr
                          key={patient.id}
                          className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/patients/${patient.id}`)}
                        >
                          <td className="py-3 px-4 text-sm font-medium text-foreground">{patient.name}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{formatCPF(patient.cpf)}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{formatPhone(patient.phone)}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{patient.email || '-'}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {format(new Date(patient.createdAt), 'dd/MM/yyyy')}
                          </td>
                          <td className="py-3 px-4">
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {meta.total} paciente{meta.total !== 1 ? 's' : ''} encontrado{meta.total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} de {meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <PatientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
