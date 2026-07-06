import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { financialApi, patientsApi } from '@/lib/api';
import { maskCurrency, parseCurrency, formatCurrency } from '@/lib/formatters';
import { format, addMonths } from 'date-fns';

const financialSchema = z.object({
  patientId: z.string().optional(),
  amount: z.string().min(1, 'Informe o valor'),
  type: z.enum(['INCOME', 'EXPENSE'], { required_error: 'Selecione o tipo' }),
  status: z.enum(['PENDING', 'PAID']),
  description: z.string().optional(),
  paymentMethod: z.string().optional(),
  installments: z.string().default('1'),
  dueDate: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurrenceMonths: z.string().default('12'),
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
  const [linkPatient, setLinkPatient] = useState(false);

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
      isRecurring: false,
      recurrenceMonths: '12',
    },
  });

  const watchInstallments = parseInt(form.watch('installments') || '1', 10);
  const watchAmount = form.watch('amount') || '';
  const watchDueDate = form.watch('dueDate') || '';
  const watchType = form.watch('type');
  const isInstallment = watchInstallments > 1;
  const watchIsRecurring = form.watch('isRecurring');
  const watchRecurrenceMonths = parseInt(form.watch('recurrenceMonths') || '12', 10);
  const showPatient = watchType === 'INCOME' || linkPatient;

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

  const recurrencePreview = useMemo(() => {
    if (!watchIsRecurring || !watchAmount || !watchDueDate) return null;
    const amount = parseCurrency(watchAmount);
    if (!amount || amount <= 0 || watchRecurrenceMonths < 2) return null;

    const firstDate = new Date(watchDueDate + 'T00:00:00');
    const lastDate = addMonths(firstDate, watchRecurrenceMonths - 1);

    return {
      months: watchRecurrenceMonths,
      amount,
      from: format(firstDate, 'MM/yyyy'),
      to: format(lastDate, 'MM/yyyy'),
      day: firstDate.getDate(),
    };
  }, [watchIsRecurring, watchAmount, watchDueDate, watchRecurrenceMonths]);

  const onSubmit = async (data: FinancialFormData) => {
    setLoading(true);
    setError('');

    const installments = parseInt(data.installments, 10);

    try {
      let payload: Parameters<typeof financialApi.create>[0];

      if (data.isRecurring) {
        payload = {
          patientId: data.patientId || undefined,
          amount: parseCurrency(data.amount),
          type: data.type,
          description: data.description || undefined,
          paymentMethod: data.paymentMethod || undefined,
          isRecurring: true,
          recurrenceMonths: parseInt(data.recurrenceMonths, 10),
          dueDate: data.dueDate || undefined,
        };
      } else {
        payload = {
          patientId: data.patientId || undefined,
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
        };
      }

      await financialApi.create(payload);
      track(AnalyticsEvent.FinancialRecordCreated, { type: payload.type });

      const msg = data.isRecurring
        ? `${parseInt(data.recurrenceMonths, 10)} registros recorrentes criados`
        : installments > 1
          ? `${installments} parcelas criadas com sucesso`
          : 'Registro financeiro criado com sucesso';

      toast.success(msg);
      onSuccess();
      onOpenChange(false);
      form.reset();
      setLinkPatient(false);
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
          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select
              value={form.watch('type')}
              onValueChange={(v) => {
                form.setValue('type', v as 'INCOME' | 'EXPENSE');
                if (v === 'EXPENSE') {
                  form.setValue('patientId', '');
                  setLinkPatient(false);
                }
              }}
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

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" placeholder="Ex: Consulta Inicial" {...form.register('description')} />
          </div>

          {/* Valor + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor Total (R$) *</Label>
              <Input
                id="amount"
                placeholder="0,00"
                value={form.watch('amount') || ''}
                onChange={(e) => form.setValue('amount', maskCurrency(e.target.value), { shouldValidate: true })}
                error={!!form.formState.errors.amount}
                aria-describedby={form.formState.errors.amount ? 'amount-error' : undefined}
                inputMode="decimal"
                className="tabular-nums"
              />
              {form.formState.errors.amount && (
                <p id="amount-error" className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
              )}
            </div>

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
          </div>

          {/* Paciente */}
          {showPatient ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Paciente {watchType === 'INCOME' ? '(opcional)' : ''}</Label>
                {watchType === 'EXPENSE' && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={() => { setLinkPatient(false); form.setValue('patientId', ''); }}
                  >
                    Remover
                  </button>
                )}
              </div>
              <Select
                value={form.watch('patientId') || ''}
                onValueChange={(v) => form.setValue('patientId', v)}
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
            </div>
          ) : (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline w-full text-left"
              onClick={() => setLinkPatient(true)}
            >
              + Vincular a um paciente (opcional)
            </button>
          )}

          {/* Método de Pagamento */}
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

          {/* Vencimento + Parcelas */}
          <div className="grid grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <Label>Parcelas</Label>
              <Select
                value={form.watch('installments')}
                onValueChange={(v) => {
                  form.setValue('installments', v);
                  if (parseInt(v, 10) > 1) {
                    form.setValue('isRecurring', false);
                  }
                }}
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
          </div>

          {/* Recorrência — só visível quando à vista */}
          {!isInstallment && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  id="isRecurring"
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={form.watch('isRecurring')}
                  onChange={(e) => form.setValue('isRecurring', e.target.checked)}
                />
                <Label htmlFor="isRecurring" className="cursor-pointer font-normal">
                  Recorrência mensal
                </Label>
              </div>

              {watchIsRecurring && (
                <div className="space-y-2">
                  <Label>Repetir por (meses)</Label>
                  <Select
                    value={form.watch('recurrenceMonths')}
                    onValueChange={(v) => form.setValue('recurrenceMonths', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 59 }, (_, i) => i + 2).map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} meses</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {recurrencePreview && (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                    Recorrência gerada
                  </p>
                  <p className="text-sm text-foreground">
                    {recurrencePreview.months} registros de{' '}
                    <span className="font-medium">R$ {formatCurrency(recurrencePreview.amount)}</span>
                    {' '}· todo dia {recurrencePreview.day}
                    {' '}· {recurrencePreview.from} – {recurrencePreview.to}
                  </p>
                </div>
              )}
            </div>
          )}

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

          {error && <p role="alert" className="text-sm text-destructive text-center">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              {watchIsRecurring
                ? `Registrar ${watchRecurrenceMonths}x recorrente`
                : isInstallment
                  ? `Registrar ${watchInstallments}x`
                  : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
