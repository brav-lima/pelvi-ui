import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Search,
  Users,
  FileText,
  Printer,
  Loader2,
} from 'lucide-react';
import { patientsApi, anamnesisApi } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AnamnesisFormDialog } from '@/components/anamnesis/AnamnesisFormDialog';
import type { Anamnesis as AnamnesisType } from '@/types/clinic';

export default function Anamnesis() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnamnesis, setEditingAnamnesis] = useState<AnamnesisType | undefined>();

  const { data: patientsData, isLoading: loadingPatients } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => patientsApi.list({ search, page: 1, limit: 50 }),
  });

  const patients = patientsData?.data ?? [];

  const { data: anamneses = [], isLoading: loadingAnamneses } = useQuery({
    queryKey: ['anamneses', selectedPatient],
    queryFn: () => anamnesisApi.list(selectedPatient!),
    enabled: !!selectedPatient,
  });

  const latestAnamnesis = anamneses[0];
  const patient = patients.find((p) => p.id === selectedPatient);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const openCreate = () => {
    setEditingAnamnesis(undefined);
    setDialogOpen(true);
  };

  const openEdit = (anamnesis: AnamnesisType) => {
    setEditingAnamnesis(anamnesis);
    setDialogOpen(true);
  };

  const renderAnamnesisData = (data: Record<string, unknown>) => {
    return Object.entries(data).map(([key, value]) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const section = value as Record<string, unknown>;
        return (
          <div key={key} className="border border-border rounded-lg p-4">
            <h4 className="font-semibold text-foreground mb-4 pb-2 border-b border-border">
              {key}
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(section).map(([fieldKey, fieldValue]) => (
                <div key={fieldKey}>
                  <p className="text-sm text-muted-foreground mb-1">{fieldKey}</p>
                  <p className="text-sm font-medium text-foreground bg-muted/50 p-2 rounded">
                    {String(fieldValue ?? '-')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      }
      return (
        <div key={key} className="border border-border rounded-lg p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{key}</p>
              <p className="text-sm font-medium text-foreground bg-muted/50 p-2 rounded">
                {String(value ?? '-')}
              </p>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Anamnese"
        description="Formularios de anamnese dos pacientes"
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
            {loadingPatients ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatient(p.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                      selectedPatient === p.id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-sm text-muted-foreground">{p.cpf ?? ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Anamnesis Content */}
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
            {!selectedPatient ? (
              <EmptyState
                icon={Users}
                title="Nenhum paciente selecionado"
                description="Selecione um paciente na lista ao lado para visualizar sua anamnese"
              />
            ) : loadingAnamneses ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !latestAnamnesis ? (
              <EmptyState
                icon={FileText}
                title="Nenhuma anamnese registrada"
                description="Este paciente ainda nao possui anamnese"
                action={{
                  label: 'Nova Anamnese',
                  onClick: openCreate,
                }}
              />
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span>
                    Ultima atualizacao: {format(new Date(latestAnamnesis.updatedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>

                {renderAnamnesisData(latestAnamnesis.data)}

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => openEdit(latestAnamnesis)}>
                    Editar Anamnese
                  </Button>
                  <Button className="flex-1" onClick={openCreate}>
                    Nova Anamnese
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedPatient && (
        <AnamnesisFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['anamneses', selectedPatient] })}
          patientId={selectedPatient}
          anamnesis={editingAnamnesis}
        />
      )}
    </div>
  );
}
