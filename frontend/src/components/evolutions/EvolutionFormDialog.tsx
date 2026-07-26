import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { track, AnalyticsEvent } from '@/lib/analytics';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { evolutionsApi } from '@/lib/api';
import type { Evolution } from '@/types/clinic';

function makeEvolutionSchema(isEditMode: boolean) {
  return z.object({
    description: isEditMode
      ? z.string().min(1, 'Descrição é obrigatória')
      : z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
    evolutionDate: z.string().min(1, 'Data é obrigatória'),
  });
}

type EvolutionFormData = z.infer<ReturnType<typeof makeEvolutionSchema>>;

interface EvolutionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  patientId: string;
  evolution?: Evolution;
}

export function EvolutionFormDialog({ open, onOpenChange, onSuccess, patientId, evolution }: EvolutionFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditMode = !!evolution;

  const form = useForm<EvolutionFormData>({
    resolver: zodResolver(makeEvolutionSchema(isEditMode)),
    defaultValues: {
      description: '',
      evolutionDate: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  useEffect(() => {
    if (open) {
      if (isEditMode && evolution) {
        form.reset({
          description: evolution.description,
          evolutionDate: format(new Date(evolution.evolutionDate), 'yyyy-MM-dd'),
        });
      } else {
        form.reset({
          description: '',
          evolutionDate: format(new Date(), 'yyyy-MM-dd'),
        });
      }
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = async (data: EvolutionFormData) => {
    setLoading(true);
    setError('');

    try {
      const evolutionDateIso = new Date(`${data.evolutionDate}T00:00:00`).toISOString();

      if (isEditMode && evolution) {
        await evolutionsApi.update(evolution.id, {
          description: data.description,
          evolutionDate: evolutionDateIso,
        });
        toast.success('Evolução atualizada com sucesso');
      } else {
        await evolutionsApi.create({
          patientId,
          description: data.description,
          evolutionDate: evolutionDateIso,
        });
        toast.success('Evolução registrada com sucesso');
        track(AnalyticsEvent.EvolutionCreated);
      }
      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error(isEditMode ? 'Erro ao atualizar evolução' : 'Erro ao salvar evolução');
      setError(isEditMode ? 'Erro ao atualizar evolução. Tente novamente.' : 'Erro ao salvar evolução. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Editar Evolução' : 'Nova Evolução'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Altere a data ou o texto da evolução clínica.' : 'Registre a evolução clínica do paciente.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="evolutionDate">Data da evolução *</Label>
            <Input
              id="evolutionDate"
              type="date"
              max={format(new Date(), 'yyyy-MM-dd')}
              error={!!form.formState.errors.evolutionDate}
              {...form.register('evolutionDate')}
            />
            {form.formState.errors.evolutionDate && (
              <p className="text-sm text-destructive">{form.formState.errors.evolutionDate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea
              id="description"
              rows={8}
              placeholder="Descreva a evolução clínica do paciente..."
              error={!!form.formState.errors.description}
              aria-describedby={form.formState.errors.description ? 'evo-desc-error' : undefined}
              {...form.register('description')}
            />
            {form.formState.errors.description && (
              <p id="evo-desc-error" className="text-sm text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          {error && <p role="alert" className="text-sm text-destructive text-center">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              {isEditMode ? 'Salvar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
