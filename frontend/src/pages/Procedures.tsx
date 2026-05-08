import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Plus, Clock, DollarSign, Edit, Trash2, Loader2, LayoutGrid, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { proceduresApi } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ProcedureFormDialog } from '@/components/procedures/ProcedureFormDialog';
import { useHasRole } from '@/components/auth/RoleGuard';
import type { Procedure } from '@/types/clinic';

type ViewMode = 'card' | 'list';

export default function Procedures() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | undefined>();
  const isAdmin = useHasRole('ADMIN');
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('procedures-view') as ViewMode) || 'card',
  );

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('procedures-view', mode);
  };

  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ['procedures'],
    queryFn: proceduresApi.list,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      proceduresApi.update(id, { active }),
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      toast.success(active ? 'Procedimento ativado' : 'Procedimento desativado');
    },
    onError: () => toast.error('Erro ao alterar procedimento'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => proceduresApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      toast.success('Procedimento excluído com sucesso');
    },
    onError: () => toast.error('Erro ao excluir procedimento'),
  });

  const openCreate = () => {
    setEditingProcedure(undefined);
    setDialogOpen(true);
  };

  const openEdit = (procedure: Procedure) => {
    setEditingProcedure(procedure);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Procedimentos"
        description="Gerencie os procedimentos oferecidos pela clínica"
        actions={
          isAdmin ? (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Procedimento
            </Button>
          ) : undefined
        }
      />

      {/* View Toggle */}
      <div className="flex justify-end">
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

      {viewMode === 'card' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {procedures.map((procedure) => (
            <Card
              key={procedure.id}
              className={cn('transition-all', !procedure.active && 'opacity-60')}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{procedure.name}</h3>
                  </div>
                  {isAdmin && (
                    <Switch
                      checked={procedure.active}
                      onCheckedChange={() =>
                        toggleMutation.mutate({ id: procedure.id, active: !procedure.active })
                      }
                    />
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{procedure.durationMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <DollarSign className="w-4 h-4" />
                    <span>{formatCurrency(procedure.price)}</span>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                    <Button variant="ghost" size="sm" className="flex-1" onClick={() => openEdit(procedure)}>
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Procedimento</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o procedimento "{procedure.name}"?
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteMutation.mutate(procedure.id)}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
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
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Duração</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Preço</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    {isAdmin && <th className="py-3 px-4 text-sm font-medium text-muted-foreground w-32" />}
                  </tr>
                </thead>
                <tbody>
                  {procedures.map((procedure) => (
                    <tr
                      key={procedure.id}
                      className={cn(
                        'border-b border-border last:border-0 hover:bg-muted/50 transition-colors',
                        !procedure.active && 'opacity-60',
                      )}
                    >
                      <td className="py-3 px-4 text-sm font-medium text-foreground">{procedure.name}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{procedure.durationMinutes} min</td>
                      <td className="py-3 px-4 text-sm font-medium text-foreground">R$ {formatCurrency(procedure.price)}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={procedure.active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'}>
                          {procedure.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <Switch
                              checked={procedure.active}
                              onCheckedChange={() =>
                                toggleMutation.mutate({ id: procedure.id, active: !procedure.active })
                              }
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(procedure)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Procedimento</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir o procedimento "{procedure.name}"?
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteMutation.mutate(procedure.id)}
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ProcedureFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['procedures'] })}
        procedure={editingProcedure}
      />
    </div>
  );
}
