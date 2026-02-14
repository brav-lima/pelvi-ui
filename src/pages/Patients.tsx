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
} from 'lucide-react';
import { patientsApi } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { PatientFormDialog } from '@/components/patients/PatientFormDialog';

export default function Patients() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const navigate = useNavigate();

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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
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
                  ? 'Nao encontramos pacientes com os criterios de busca informados.'
                  : 'Cadastre o primeiro paciente da clinica.'
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
                        <p className="text-sm text-muted-foreground">{patient.cpf}</p>
                      )}
                      <div className="mt-3 space-y-1">
                        {patient.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span>{patient.phone}</span>
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
                  Proximo
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
