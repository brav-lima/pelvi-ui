import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
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
import { financialApi, patientsApi } from '@/lib/api';

const financialSchema = z.object({
  patientId: z.string().min(1, 'Selecione um paciente'),
  amount: z.string().min(1, 'Informe o valor'),
  type: z.enum(['INCOME', 'EXPENSE'], { required_error: 'Selecione o tipo' }),
  status: z.enum(['PENDING', 'PAID']),
  description: z.string().optional(),
  paymentMethod: z.string().optional(),
});

type FinancialFormData = z.infer<typeof financialSchema>;

interface FinancialFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function FinancialFormDialog({ open, onOpenChange, onSuccess }: FinancialFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: patientsData } = useQuery({
    queryKey: ['patients-select'],
    queryFn: () => patientsApi.list({ page: 1, limit: 100 }),
    enabled: open,
  });

  const patients = patientsData?.data ?? [];

  const form = useForm<FinancialFormData>({
    resolver: zodResolver(financialSchema),
    defaultValues: {
      patientId: '',
      amount: '',
      type: 'INCOME',
      status: 'PENDING',
      description: '',
      paymentMethod: '',
    },
  });

  const onSubmit = async (data: FinancialFormData) => {
    setLoading(true);
    setError('');

    try {
      await financialApi.create({
        patientId: data.patientId,
        amount: Number(data.amount),
        type: data.type,
        description: data.description || undefined,
        paymentMethod: data.paymentMethod || undefined,
      });
      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch {
      setError('Erro ao salvar registro financeiro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Registro Financeiro</DialogTitle>
          <DialogDescription>
            Registre uma receita ou despesa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Paciente *</Label>
            <Select
              value={form.watch('patientId') || ''}
              onValueChange={(v) => form.setValue('patientId', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um paciente" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.patientId && (
              <p className="text-sm text-destructive">{form.formState.errors.patientId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...form.register('amount')}
              />
              {form.formState.errors.amount && (
                <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select
                value={form.watch('type')}
                onValueChange={(v) => form.setValue('type', v as 'INCOME' | 'EXPENSE')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">Receita</SelectItem>
                  <SelectItem value="EXPENSE">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) => form.setValue('status', v as 'PENDING' | 'PAID')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="PAID">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Metodo de Pagamento</Label>
              <Select
                value={form.watch('paymentMethod') || ''}
                onValueChange={(v) => form.setValue('paymentMethod', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="CARTAO_CREDITO">Cartao Credito</SelectItem>
                  <SelectItem value="CARTAO_DEBITO">Cartao Debito</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descricao</Label>
            <Input id="description" placeholder="Ex: Consulta Inicial" {...form.register('description')} />
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
