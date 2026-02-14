import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { proceduresApi } from '@/lib/api';
import type { Procedure } from '@/types/clinic';

const procedureSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  durationMinutes: z.string().min(1, 'Selecione a duracao'),
  price: z.string().min(1, 'Informe o preco'),
});

type ProcedureFormData = z.infer<typeof procedureSchema>;

interface ProcedureFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  procedure?: Procedure;
}

export function ProcedureFormDialog({ open, onOpenChange, onSuccess, procedure }: ProcedureFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEditing = !!procedure;

  const form = useForm<ProcedureFormData>({
    resolver: zodResolver(procedureSchema),
    defaultValues: {
      name: procedure?.name ?? '',
      durationMinutes: procedure?.durationMinutes?.toString() ?? '',
      price: procedure?.price?.toString() ?? '',
    },
  });

  const onSubmit = async (data: ProcedureFormData) => {
    setLoading(true);
    setError('');

    const payload = {
      name: data.name,
      durationMinutes: Number(data.durationMinutes),
      price: Number(data.price),
    };

    try {
      if (isEditing) {
        await proceduresApi.update(procedure.id, payload);
      } else {
        await proceduresApi.create(payload);
      }
      toast.success(isEditing ? 'Procedimento atualizado com sucesso' : 'Procedimento cadastrado com sucesso');
      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error('Erro ao salvar procedimento');
      setError('Erro ao salvar procedimento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Procedimento' : 'Novo Procedimento'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados do procedimento.'
              : 'Preencha os dados para cadastrar um novo procedimento.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" placeholder="Ex: Consulta Inicial" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duracao *</Label>
              <Select
                value={form.watch('durationMinutes') || ''}
                onValueChange={(v) => form.setValue('durationMinutes', v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="90">90 min</SelectItem>
                  <SelectItem value="120">120 min</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.durationMinutes && (
                <p className="text-sm text-destructive">{form.formState.errors.durationMinutes.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Preco (R$) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...form.register('price')}
              />
              {form.formState.errors.price && (
                <p className="text-sm text-destructive">{form.formState.errors.price.message}</p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
