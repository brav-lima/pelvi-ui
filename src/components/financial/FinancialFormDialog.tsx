import { useState, useMemo } from 'react';
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
import { toast } from 'sonner';
import { financialApi, patientsApi } from '@/lib/api';
import { maskCurrency, parseCurrency, formatCurrency } from '@/lib/formatters';
import { format, addMonths } from 'date-fns';

const financialSchema = z.object({
  patientId: z.string().min(1, 'Selecione um paciente'),
  amount: z.string().min(1, 'Informe o valor'),
  type: z.enum(['INCOME', 'EXPENSE'], { required_error: 'Selecione o tipo' }),
  status: z.enum(['PENDING', 'PAID']),
  description: z.string().optional(),
  paymentMethod: z.string().optional(),
  installments: z.string().default('1'),
  dueDate: z.string().optional(),
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
      installments: '1',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const watchInstallments = parseInt(form.watch('installments') || '1', 10);
  const watchAmount = form.watch('amount') || '';
  const watchDueDate = form.watch('dueDate') || '';
  const isInstallment = watchInstallments > 1;

  const installmentPreview = useMemo(() => {
    if (!isInstallment || !watchAmount || !watchDueDate) return [];

    const totalAmount = parseCurrency(watchAmount);
    if (!totalAmount || totalAmount <= 0) return [];

    const baseAmount = Math.floor((totalAmount * 100) / watchInstallments) / 100;
    const remainder = Math.round((totalAmount - baseAmount * watchInstallments) * 100) / 100;
    const firstDate = new Date(watchDueDate + 'T00:00:00');

    return Array.from({ length: watchInstallments }, (_, i) => {
      const date = addMonths(firstDate, i);
      const isLast = i === watchInstallments - 1;
      const amount = isLast ? baseAmount + remainder : baseAmount;
      return {
        number: i + 1,
        amount,
        date: format(date, 'dd/MM/yyyy'),
      };
    });
  }, [isInstallment, watchAmount, watchDueDate, watchInstallments]);

  const onSubmit = async (data: FinancialFormData) => {
    setLoading(true);
    setError('');

    const installments = parseInt(data.installments, 10);

    try {
      await financialApi.create({
        patientId: data.patientId,
        amount: parseCurrency(data.amount),
        type: data.type,
        description: data.description || undefined,
        paymentMethod: data.paymentMethod || undefined,
        ...(installments > 1 && {
          installments,
          dueDate: data.dueDate || undefined,
        }),
        ...(installments === 1 && data.dueDate && {
          dueDate: data.dueDate,
        }),
      });

      const msg = installments > 1
        ? `${installments} parcelas criadas com sucesso`
        : 'Registro financeiro criado com sucesso';
      toast.success(msg);
      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error('Erro ao salvar registro financeiro');
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
              <Label htmlFor="amount">Valor Total (R$) *</Label>
              <Input
                id="amount"
                placeholder="0,00"
                value={form.watch('amount') || ''}
                onChange={(e) => form.setValue('amount', maskCurrency(e.target.value), { shouldValidate: true })}
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
              <Label>Método de Pagamento</Label>
              <Select
                value={form.watch('paymentMethod') || ''}
                onValueChange={(v) => form.setValue('paymentMethod', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="CARTAO_CREDITO">Cartão Crédito</SelectItem>
                  <SelectItem value="CARTAO_DEBITO">Cartão Débito</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" placeholder="Ex: Consulta Inicial" {...form.register('description')} />
          </div>

          {/* Parcelamento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Parcelas</Label>
              <Select
                value={form.watch('installments')}
                onValueChange={(v) => form.setValue('installments', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">À vista</SelectItem>
                  {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">
                {isInstallment ? '1º Vencimento' : 'Vencimento'}
              </Label>
              <Input
                id="dueDate"
                type="date"
                {...form.register('dueDate')}
              />
            </div>
          </div>

          {/* Preview de parcelas */}
          {isInstallment && installmentPreview.length > 0 && (
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Parcelas geradas
              </p>
              <div className="space-y-1 max-h-[160px] overflow-y-auto">
                {installmentPreview.map((p) => (
                  <div
                    key={p.number}
                    className="flex items-center justify-between text-sm py-1 px-2 rounded bg-background"
                  >
                    <span className="text-muted-foreground">
                      Parcela {p.number}/{watchInstallments}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-xs">{p.date}</span>
                      <span className="font-medium">R$ {formatCurrency(p.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isInstallment ? `Registrar ${watchInstallments}x` : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
