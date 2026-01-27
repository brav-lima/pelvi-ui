import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Clock,
  DollarSign,
  Edit,
  Trash2
} from 'lucide-react';
import { mockProcedures } from '@/data/mockData';
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

export default function Procedures() {
  const [procedures, setProcedures] = useState(mockProcedures);

  const toggleActive = (id: string) => {
    setProcedures((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Procedimentos"
        description="Gerencie os procedimentos oferecidos pela clínica"
        actions={
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Novo Procedimento
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {procedures.map((procedure) => (
          <Card
            key={procedure.id}
            className={cn(
              'transition-all',
              !procedure.active && 'opacity-60'
            )}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-foreground">{procedure.name}</h3>
                  {procedure.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {procedure.description}
                    </p>
                  )}
                </div>
                <Switch
                  checked={procedure.active}
                  onCheckedChange={() => toggleActive(procedure.id)}
                />
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{procedure.duration} min</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground font-medium">
                  <DollarSign className="w-4 h-4" />
                  <span>R$ {procedure.price.toLocaleString('pt-BR')}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                <Button variant="ghost" size="sm" className="flex-1">
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
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
    </div>
  );
}
