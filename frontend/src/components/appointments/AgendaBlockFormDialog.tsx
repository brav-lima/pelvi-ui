import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import type { AgendaBlock } from '@/types/clinic';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { agendaBlocksApi, professionalsApi, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const timeSlots = Array.from({ length: 26 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const min = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${min}`;
});

// When only a start time is provided (e.g. clicking a slot in the agenda),
// default the end time to the next slot so the form is submittable without
// requiring an extra selection.
function nextTimeSlot(time: string): string {
  const idx = timeSlots.indexOf(time);
  return idx >= 0 && idx + 1 < timeSlots.length ? timeSlots[idx + 1] : time;
}

const blockSchema = z
  .object({
    professionalId: z.string().min(1, 'Selecione um profissional'),
    title: z.string().min(1, 'Informe um título').max(200),
    date: z.string().min(1, 'Selecione a data'),
    startTime: z.string().min(1, 'Selecione o horário de início'),
    endTime: z.string().min(1, 'Selecione o horário de fim'),
    notes: z.string().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'Horário de fim deve ser depois do início',
    path: ['endTime'],
  });

type BlockFormData = z.infer<typeof blockSchema>;

interface AgendaBlockFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultDate?: string;
  defaultTime?: string;
  block?: AgendaBlock;
}

export function AgendaBlockFormDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultDate,
  defaultTime,
  block,
}: AgendaBlockFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const isEditMode = !!block;

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals'],
    queryFn: () => professionalsApi.list(),
    enabled: open,
  });

  const activeProfessionals = professionals.filter((p) => p.active);
  const isProfessionalRole = user?.role === 'PROFESSIONAL';
  const ownProfessional = activeProfessionals.find((p) => p.personId === user?.id);

  const form = useForm<BlockFormData>({
    resolver: zodResolver(blockSchema),
    defaultValues: {
      professionalId: '',
      title: '',
      date: '',
      startTime: '',
      endTime: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) return;

    if (isEditMode && block) {
      form.reset({
        professionalId: block.professionalId,
        title: block.title,
        date: format(parseISO(block.startAt), 'yyyy-MM-dd'),
        startTime: format(parseISO(block.startAt), 'HH:mm'),
        endTime: format(parseISO(block.endAt), 'HH:mm'),
        notes: block.notes ?? '',
      });
    } else {
      form.reset({
        professionalId: isProfessionalRole ? (ownProfessional?.id ?? '') : '',
        title: '',
        date: defaultDate ?? '',
        startTime: defaultTime ?? '',
        endTime: defaultTime ? nextTimeSlot(defaultTime) : '',
        notes: '',
      });
    }
    // Re-runs only on open/close, mirroring AppointmentFormDialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ownProfessional?.id]);

  const onSubmit = async (data: BlockFormData) => {
    setLoading(true);
    setError('');

    const startAt = new Date(`${data.date}T${data.startTime}:00`).toISOString();
    const endAt = new Date(`${data.date}T${data.endTime}:00`).toISOString();

    try {
      if (isEditMode && block) {
        await agendaBlocksApi.update(block.id, {
          professionalId: data.professionalId,
          title: data.title,
          startAt,
          endAt,
          notes: data.notes || undefined,
        });
        toast.success('Bloqueio atualizado com sucesso');
      } else {
        await agendaBlocksApi.create({
          professionalId: data.professionalId,
          title: data.title,
          startAt,
          endAt,
          notes: data.notes || undefined,
        });
        toast.success('Bloqueio criado com sucesso');
      }
      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Conflito de horário');
        setError('Já existe um bloqueio ou agendamento neste período para este profissional.');
      } else if (err instanceof ApiError && err.status === 403) {
        toast.error('Sem permissão');
        setError('Você só pode bloquear a própria agenda.');
      } else {
        toast.error(isEditMode ? 'Erro ao atualizar bloqueio' : 'Erro ao criar bloqueio');
        setError('Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!block) return;
    setDeleting(true);
    try {
      await agendaBlocksApi.remove(block.id);
      toast.success('Bloqueio removido com sucesso');
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao remover bloqueio');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Editar Bloqueio' : 'Bloquear Horário'}</DialogTitle>
          <DialogDescription>
            Reserve um horário na agenda para algo que não é um atendimento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="block-professional">Profissional *</Label>
            <Select
              value={form.watch('professionalId') || ''}
              onValueChange={(v) => form.setValue('professionalId', v, { shouldValidate: true })}
              disabled={isProfessionalRole}
            >
              <SelectTrigger
                id="block-professional"
                error={!!form.formState.errors.professionalId}
              >
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {(isProfessionalRole && ownProfessional ? [ownProfessional] : activeProfessionals).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.person.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.professionalId && (
              <p className="text-sm text-destructive">{form.formState.errors.professionalId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="block-title">Título *</Label>
            <Input
              id="block-title"
              placeholder="Ex.: Consulta odontológica"
              error={!!form.formState.errors.title}
              {...form.register('title')}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="block-date">Data *</Label>
            <Input
              id="block-date"
              type="date"
              error={!!form.formState.errors.date}
              {...form.register('date')}
            />
            {form.formState.errors.date && (
              <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="block-start">Início *</Label>
              <Select
                value={form.watch('startTime') || ''}
                onValueChange={(v) => form.setValue('startTime', v, { shouldValidate: true })}
              >
                <SelectTrigger id="block-start" error={!!form.formState.errors.startTime}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.startTime && (
                <p className="text-sm text-destructive">{form.formState.errors.startTime.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="block-end">Fim *</Label>
              <Select
                value={form.watch('endTime') || ''}
                onValueChange={(v) => form.setValue('endTime', v, { shouldValidate: true })}
              >
                <SelectTrigger id="block-end" error={!!form.formState.errors.endTime}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.endTime && (
                <p className="text-sm text-destructive">{form.formState.errors.endTime.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="block-notes">Observações</Label>
            <Textarea id="block-notes" rows={2} {...form.register('notes')} />
          </div>

          {error && <p role="alert" className="text-sm text-destructive text-center">{error}</p>}

          <DialogFooter className="sm:justify-between">
            {isEditMode && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" className="sm:mr-auto">
                    Remover bloqueio
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover bloqueio</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja remover este bloqueio? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleting}
                      onClick={handleDelete}
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={loading}>
                {isEditMode ? 'Salvar' : 'Bloquear'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
