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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { treatmentPackagesApi, proceduresApi } from '@/lib/api';
import { maskCurrency, parseCurrency, formatCurrency } from '@/lib/formatters';
import { format, addMonths } from 'date-fns';

const packageSchema = z.object({
  name: z.string().min(1, 'Informe o nome do pacote'),
  procedureIds: z.array(z.string()).min(1, 'Selecione ao menos um procedimento'),
  totalSessions: z.number().min(1, 'Informe a quantidade de sessões'),
  totalPrice: z.string().min(1, 'Informe o valor total'),
  paymentMethod: z.string().optional(),
  installments: z.string().default('1'),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

type PackageFormData = z.infer<typeof packageSchema>;

interface TreatmentPackageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  patientId: string;
}

export function TreatmentPackageFormDialog({
  open,
  onOpenChange,
  onSuccess,
  patientId,
}: TreatmentPackageFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: procedures = [] } = useQuery({
    queryKey: ['procedures'],
    queryFn: proceduresApi.list,
    enabled: open,
  });

  const activeProcedures = procedures.filter((p) => p.active);

  const form = useForm<PackageFormData>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: '',
      procedureIds: [],
      totalSessions: 1,
      totalPrice: '',
      paymentMethod: '',
      installments: '1',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    },
  });

  const watchInstallments = parseInt(form.watch('installments') || '1', 10);
  const watchAmount = form.watch('totalPrice') || '';
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

  const selectedProcedureIds = form.watch('procedureIds') || [];

  const toggleProcedure = (procedureId: string) => {
    const current = form.getValues('procedureIds');
    const next = current.includes(procedureId)
      ? current.filter((id) => id !== procedureId)
      : [...current, procedureId];
    form.setValue('procedureIds', next, { shouldValidate: true });
  };

  const onSubmit = async (data: PackageFormData) => {
    setLoading(true);
    setError('');

    const installments = parseInt(data.installments, 10);

    try {
      await treatmentPackagesApi.create({
        name: data.name,
        patientId,
        procedureIds: data.procedureIds,
        totalSessions: data.totalSessions,
        totalPrice: parseCurrency(data.totalPrice),
        notes: data.notes || undefined,
        paymentMethod: data.paymentMethod || undefined,
        ...(installments > 1 && {
          installments,
          dueDate: data.dueDate || undefined,
        }),
        ...(installments === 1 && data.dueDate && {
          dueDate: data.dueDate,
        }),
      });

      toast.success('Pacote de tratamento criado com sucesso');
      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error('Erro ao criar pacote de tratamento');
      setError('Erro ao criar pacote. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Pacote de Tratamento</DialogTitle>
          <DialogDescription>
            Crie um pacote com sessões e valor fechado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pkg-name">Nome do Pacote *</Label>
            <Input
              id="pkg-name"
              placeholder="Ex: 10 Sessões de Fisioterapia"
              error={!!form.formState.errors.name}
              aria-describedby={form.formState.errors.name ? 'pkg-name-error' : undefined}
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p id="pkg-name-error" className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Procedures checkboxes */}
          <div className="space-y-2">
            <Label>Procedimentos *</Label>
            <div className="border border-border rounded-md p-3 space-y-2 max-h-[160px] overflow-y-auto">
              {activeProcedures.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum procedimento ativo</p>
              ) : (
                activeProcedures.map((proc) => (
                  <label
                    key={proc.id}
                    className="flex items-center gap-3 py-1 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedProcedureIds.includes(proc.id)}
                      onCheckedChange={() => toggleProcedure(proc.id)}
                    />
                    <span className="text-sm">{proc.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {proc.durationMinutes}min
                    </span>
                  </label>
                ))
              )}
            </div>
            {form.formState.errors.procedureIds && (
              <p className="text-sm text-destructive">{form.formState.errors.procedureIds.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalSessions">Total de Sessões *</Label>
              <Input
                id="totalSessions"
                type="number"
                min={1}
                error={!!form.formState.errors.totalSessions}
                aria-describedby={form.formState.errors.totalSessions ? 'pkg-sessions-error' : undefined}
                inputMode="numeric"
                className="tabular-nums"
                {...form.register('totalSessions', { valueAsNumber: true })}
              />
              {form.formState.errors.totalSessions && (
                <p id="pkg-sessions-error" className="text-sm text-destructive">{form.formState.errors.totalSessions.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalPrice">Valor Total (R$) *</Label>
              <Input
                id="totalPrice"
                placeholder="0,00"
                value={form.watch('totalPrice') || ''}
                onChange={(e) =>
                  form.setValue('totalPrice', maskCurrency(e.target.value), { shouldValidate: true })
                }
                error={!!form.formState.errors.totalPrice}
                aria-describedby={form.formState.errors.totalPrice ? 'pkg-price-error' : undefined}
                inputMode="decimal"
                className="tabular-nums"
              />
              {form.formState.errors.totalPrice && (
                <p id="pkg-price-error" className="text-sm text-destructive">{form.formState.errors.totalPrice.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
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
                    <SelectItem key={n} value={String(n)}>
                      {n}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">
              {isInstallment ? '1º Vencimento' : 'Vencimento'}
            </Label>
            <Input id="dueDate" type="date" {...form.register('dueDate')} />
          </div>

          {/* Installment preview */}
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

          <div className="space-y-2">
            <Label htmlFor="pkg-notes">Observações</Label>
            <Textarea
              id="pkg-notes"
              rows={2}
              placeholder="Observações sobre o pacote..."
              {...form.register('notes')}
            />
          </div>

          {error && <p role="alert" className="text-sm text-destructive text-center">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              {isInstallment ? `Criar Pacote (${watchInstallments}x)` : 'Criar Pacote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
