import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Pencil, Trash2, Loader2, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { tasksApi, professionalsApi } from '@/lib/api';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import type { Task, TaskStatus } from '@/types/clinic';

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
};

const STATUS_NEXT: Record<TaskStatus, TaskStatus> = {
  PENDING: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: 'PENDING',
};

const STATUS_VARIANT: Record<TaskStatus, 'default' | 'secondary' | 'outline'> = {
  PENDING: 'outline',
  IN_PROGRESS: 'secondary',
  DONE: 'default',
};

const PRIORITY_LABELS = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' } as const;

const PRIORITY_CLASS: Record<string, string> = {
  LOW: 'bg-muted text-muted-foreground',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  HIGH: 'bg-destructive/10 text-destructive',
};

export default function Tasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | undefined>();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', { statusFilter, priorityFilter, assignedFilter }],
    queryFn: () =>
      tasksApi.list({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        assignedToId: assignedFilter !== 'all' ? assignedFilter : undefined,
      }),
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals'],
    queryFn: () => professionalsApi.list(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasksApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa excluída');
    },
    onError: () => toast.error('Erro ao excluir tarefa'),
  });

  const isCreator = (task: Task) => task.createdBy?.person?.id === user?.id;

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditTask(undefined);
  };

  const openCreate = () => {
    setEditTask(undefined);
    setFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditTask(task);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarefas"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Tarefa
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
            <SelectItem value="IN_PROGRESS">Em andamento</SelectItem>
            <SelectItem value="DONE">Concluída</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="HIGH">Alta</SelectItem>
            <SelectItem value="MEDIUM">Média</SelectItem>
            <SelectItem value="LOW">Baixa</SelectItem>
          </SelectContent>
        </Select>

        <Select value={assignedFilter} onValueChange={setAssignedFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {professionals.filter((p) => p.active).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.person.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Nenhuma tarefa encontrada"
          description="Crie uma tarefa para começar."
          action={{ label: 'Nova Tarefa', onClick: openCreate }}
        />
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Título</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                  Responsável
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                  Prioridade
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                  Prazo
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((task) => {
                const overdue =
                  task.dueDate &&
                  task.status !== 'DONE' &&
                  isPast(parseISO(task.dueDate));

                return (
                  <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                    {/* Título */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
                          {task.description}
                        </p>
                      )}
                    </td>

                    {/* Responsável */}
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {task.assignedTo?.person?.name ?? '—'}
                    </td>

                    {/* Prioridade */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_CLASS[task.priority] ?? ''}`}
                      >
                        {PRIORITY_LABELS[task.priority] ?? task.priority}
                      </span>
                    </td>

                    {/* Prazo */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {task.dueDate ? (
                        <span
                          className={
                            overdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                          }
                        >
                          {format(parseISO(task.dueDate), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Status (clickable toggle) */}
                    <td className="px-4 py-3">
                      <Badge
                        variant={STATUS_VARIANT[task.status]}
                        className="cursor-pointer select-none"
                        onClick={() =>
                          statusMutation.mutate({
                            id: task.id,
                            status: STATUS_NEXT[task.status],
                          })
                        }
                        title="Clique para avançar o status"
                      >
                        {STATUS_LABELS[task.status]}
                      </Badge>
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isCreator(task) && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(task)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Tarefa</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir &ldquo;{task.title}&rdquo;? Esta
                                    ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteMutation.mutate(task.id)}
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TaskFormDialog open={formOpen} onOpenChange={handleFormClose} task={editTask} />
    </div>
  );
}
