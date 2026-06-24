import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { tasksApi, professionalsApi } from '@/lib/api';
import type { Task } from '@/types/clinic';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  PROFESSIONAL: 'Profissional',
  RECEPTIONIST: 'Recepcionista',
};

interface FormValues {
  title: string;
  description: string;
  assignedToId: string;
  priority: string;
  dueDate: string;
}

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  onSuccess?: () => void;
}

export function TaskFormDialog({ open, onOpenChange, task, onSuccess }: TaskFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!task;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: '',
      description: '',
      assignedToId: '',
      priority: 'MEDIUM',
      dueDate: '',
    },
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals'],
    queryFn: () => professionalsApi.list(),
    enabled: open,
  });

  const activeProfessionals = professionals.filter((p) => p.active);

  useEffect(() => {
    if (open) {
      reset({
        title: task?.title ?? '',
        description: task?.description ?? '',
        assignedToId: task?.assignedToId ?? '',
        priority: task?.priority ?? 'MEDIUM',
        dueDate: task?.dueDate ? task.dueDate.split('T')[0] : '',
      });
    }
  }, [open, task, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        title: values.title,
        description: values.description || undefined,
        priority: values.priority as Task['priority'],
        dueDate: values.dueDate || null,
        assignedToId: values.assignedToId,
      };
      return isEdit
        ? tasksApi.update(task!.id, payload)
        : tasksApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(isEdit ? 'Tarefa atualizada' : 'Tarefa criada');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error(isEdit ? 'Erro ao atualizar tarefa' : 'Erro ao criar tarefa');
    },
  });

  const onSubmit = handleSubmit((values) => mutation.mutate(values));
  const assignedToId = watch('assignedToId');
  const priority = watch('priority');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              {...register('title', { required: 'Título é obrigatório' })}
              placeholder="Descreva a tarefa"
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Detalhes opcionais"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Responsável *</Label>
            <Select value={assignedToId} onValueChange={(v) => setValue('assignedToId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {activeProfessionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.person.name}
                    {p.role && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        — {ROLE_LABELS[p.role] ?? p.role}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setValue('priority', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baixa</SelectItem>
                  <SelectItem value="MEDIUM">Média</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Prazo</Label>
              <Input id="dueDate" type="date" {...register('dueDate')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending || !assignedToId}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
