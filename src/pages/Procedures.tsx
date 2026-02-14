import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Plus, Clock, DollarSign, Edit, Trash2, Loader2 } from 'lucide-react';
import { proceduresApi } from '@/lib/api';
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
import type { Procedure } from '@/types/clinic';

export default function Procedures() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | undefined>();

  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ['procedures'],
    queryFn: proceduresApi.list,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      proceduresApi.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procedures'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => proceduresApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procedures'] }),
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
        description="Gerencie os procedimentos oferecidos pela clinica"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Procedimento
          </Button>
        }
      />

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
                <Switch
                  checked={procedure.active}
                  onCheckedChange={() =>
                    toggleMutation.mutate({ id: procedure.id, active: !procedure.active })
                  }
                />
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{procedure.durationMinutes} min</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground font-medium">
                  <DollarSign className="w-4 h-4" />
                  <span>R$ {Number(procedure.price).toLocaleString('pt-BR')}</span>
                </div>
              </div>

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
                        Esta acao nao pode ser desfeita.
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
            </CardContent>
          </Card>
        ))}
      </div>

      <ProcedureFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['procedures'] })}
        procedure={editingProcedure}
      />
    </div>
  );
}
