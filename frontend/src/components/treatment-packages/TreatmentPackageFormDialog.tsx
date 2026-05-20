import { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Plus, Trash2 } from 'lucide-react';
import { treatmentPackagesApi, proceduresApi } from '@/lib/api';
import { maskCurrency, parseCurrency, formatCurrency } from '@/lib/formatters';
import { format, addMonths } from 'date-fns';

const PAYMENT_METHODS = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO_CREDITO', label: 'Cartão Crédito' },
  { value: 'CARTAO_DEBITO', label: 'Cartão Débito' },
  { value: 'PIX', label: 'PIX' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
];

const packageSchema = z.object({
  name: z.string().min(1, 'Informe o nome do pacote'),
  procedureIds: z.array(z.string()).min(1, 'Selecione ao menos um procedimento'),
  totalSessions: z.number().min(1, 'Informe a quantidade de sessões'),
  totalPrice: z.string().min(1, 'Informe o valor total'),
  mode: z.enum(['fixed', 'flexible']).default('fixed'),
  notes: z.string().optional(),
  // Fixed mode
  paymentMethod: z.string().optional(),
  installments: z.string().default('1'),
  dueDate: z.string().optional(),
  downPayment: z.string().optional(),
  downPaymentDueDate: z.string().optional(),
  // Flexible mode
  customInstallments: z
    .array(
      z.object({
        amount: z.string().min(1, 'Informe o valor'),
        dueDate: z.string().min(1, 'Informe o vencimento'),
        paymentMethod: z.string().optional(),
      }),
    )
    .optional(),
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
      mode: 'fixed',
      paymentMethod: '',
      installments: '1',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      downPayment: '',
      downPaymentDueDate: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      customInstallments: [{ amount: '', dueDate: format(new Date(), 'yyyy-MM-dd'), paymentMethod: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'customInstallments',
  });

  const mode = form.watch('mode');
  const watchInstallments = parseInt(form.watch('installments') || '1', 10);
  const watchAmount = form.watch('totalPrice') || '';
  const watchDueDate = form.watch('dueDate') || '';
  const watchDownPayment = form.watch('downPayment') || '';
  const watchDownPaymentDueDate = form.watch('downPaymentDueDate') || '';
  const isInstallment = watchInstallments > 1;
  const hasDownPayment = parseCurrency(watchDownPayment) > 0;

  // Fixed mode preview
  const fixedPreview = useMemo(() => {
    const total = parseCurrency(watchAmount);
    if (!total || total <= 0 || !watchDueDate) return [];

    const downAmt = parseCurrency(watchDownPayment);
    const hasDown = downAmt > 0;
    const remaining = hasDown ? total - downAmt : total;
    const firstDate = new Date(watchDueDate + 'T00:00:00');
    const rows: { label: string; amount: number; date: string }[] = [];

    if (hasDown && watchDownPaymentDueDate) {
      const downDate = new Date(watchDownPaymentDueDate + 'T00:00:00');
      rows.push({ label: 'Entrada', amount: downAmt, date: format(downDate, 'dd/MM/yyyy') });
    }

    if (!isInstallment && !hasDown) {
      rows.push({ label: 'À vista', amount: total, date: format(firstDate, 'dd/MM/yyyy') });
      return rows;
    }

    if (remaining > 0) {
      const baseAmount = Math.floor((remaining * 100) / watchInstallments) / 100;
      const remainder = Math.round((remaining - baseAmount * watchInstallments) * 100) / 100;
      const labelTotal = hasDown ? watchInstallments + 1 : watchInstallments;
      const labelStart = hasDown ? 2 : 1;

      for (let i = 0; i < watchInstallments; i++) {
        const date = addMonths(firstDate, i);
        const isLast = i === watchInstallments - 1;
        const amount = isLast ? baseAmount + remainder : baseAmount;
        const label = labelStart + i;
        rows.push({
          label: `Parcela ${label}/${labelTotal}`,
          amount,
          date: format(date, 'dd/MM/yyyy'),
        });
      }
    }

    return rows;
  }, [watchAmount, watchDueDate, watchDownPayment, watchDownPaymentDueDate, watchInstallments, isInstallment]);

  // Flexible mode sum validation
  const customInstallments = form.watch('customInstallments') || [];
  const flexSum = customInstallments.reduce((acc, inst) => acc + (parseCurrency(inst.amount) || 0), 0);
  const totalAmount = parseCurrency(watchAmount) || 0;
  const flexValid = totalAmount > 0 && Math.abs(flexSum - totalAmount) < 0.02;

  const selectedProcedureIds = form.watch('procedureIds') || [];

  const toggleProcedure = (procedureId: string) => {
    const current = form.getValues('procedureIds');
    const next = current.includes(procedureId)
      ? current.filter((id) => id !== procedureId)
      : [...current, procedureId];
    form.setValue('procedureIds', next, { shouldValidate: true });
  };

  const onSubmit = async (data: PackageFormData) => {
    if (data.mode === 'flexible') {
      if (!data.customInstallments || data.customInstallments.length === 0) {
        setError('Adicione ao menos uma parcela.');
        return;
      }
      if (!flexValid) {
        setError(
          `A soma das parcelas (R$ ${formatCurrency(flexSum)}) não corresponde ao valor total (R$ ${formatCurrency(totalAmount)}).`,
        );
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const totalPrice = parseCurrency(data.totalPrice);
      const installments = parseInt(data.installments, 10);

      if (data.mode === 'flexible') {
        await treatmentPackagesApi.create({
          name: data.name,
          patientId,
          procedureIds: data.procedureIds,
          totalSessions: data.totalSessions,
          totalPrice,
          notes: data.notes || undefined,
          customInstallments: data.customInstallments.map((inst) => ({
            amount: parseCurrency(inst.amount),
            dueDate: inst.dueDate,
            paymentMethod: inst.paymentMethod || undefined,
          })),
        });
      } else {
        const downPaymentAmt = parseCurrency(data.downPayment);
        const hasDown = downPaymentAmt > 0;

        await treatmentPackagesApi.create({
          name: data.name,
          patientId,
          procedureIds: data.procedureIds,
          totalSessions: data.totalSessions,
          totalPrice,
          notes: data.notes || undefined,
          paymentMethod: data.paymentMethod || undefined,
          ...(installments > 1 && {
            installments,
            dueDate: data.dueDate || undefined,
          }),
          ...(installments === 1 && !hasDown && data.dueDate && {
            dueDate: data.dueDate,
          }),
          ...(hasDown && {
            downPayment: downPaymentAmt,
            downPaymentDueDate: data.downPaymentDueDate || undefined,
            ...(installments > 1 && { installments, dueDate: data.dueDate || undefined }),
            ...(installments === 1 && { installments: 1, dueDate: data.dueDate || undefined }),
          }),
        });
      }

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

  const submitLabel = useMemo(() => {
    if (mode === 'flexible') {
      const n = customInstallments.length;
      return n > 1 ? `Criar Pacote (${n} parcelas)` : 'Criar Pacote';
    }
    if (hasDownPayment && isInstallment) return `Criar Pacote (Entrada + ${watchInstallments}x)`;
    if (hasDownPayment) return 'Criar Pacote (Entrada + 1x)';
    if (isInstallment) return `Criar Pacote (${watchInstallments}x)`;
    return 'Criar Pacote';
  }, [mode, customInstallments.length, hasDownPayment, isInstallment, watchInstallments]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Pacote de Tratamento</DialogTitle>
          <DialogDescription>
            Crie um pacote com sessões e valor fechado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="pkg-name">Nome do Pacote *</Label>
            <Input
              id="pkg-name"
              placeholder="Ex: 10 Sessões de Fisioterapia"
              error={!!form.formState.errors.name}
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Procedures */}
          <div className="space-y-2">
            <Label>Procedimentos *</Label>
            <div className="border border-border rounded-md p-3 space-y-2 max-h-[160px] overflow-y-auto">
              {activeProcedures.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum procedimento ativo</p>
              ) : (
                activeProcedures.map((proc) => (
                  <label key={proc.id} className="flex items-center gap-3 py-1 cursor-pointer">
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

          {/* Sessions + Total price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalSessions">Total de Sessões *</Label>
              <Input
                id="totalSessions"
                type="number"
                min={1}
                inputMode="numeric"
                className="tabular-nums"
                error={!!form.formState.errors.totalSessions}
                {...form.register('totalSessions', { valueAsNumber: true })}
              />
              {form.formState.errors.totalSessions && (
                <p className="text-sm text-destructive">{form.formState.errors.totalSessions.message}</p>
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
                inputMode="decimal"
                className="tabular-nums"
              />
              {form.formState.errors.totalPrice && (
                <p className="text-sm text-destructive">{form.formState.errors.totalPrice.message}</p>
              )}
            </div>
          </div>

          {/* Mode toggle */}
          <div className="space-y-2">
            <Label>Modo de Parcelamento</Label>
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => form.setValue('mode', 'fixed')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === 'fixed'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                Fixo
              </button>
              <button
                type="button"
                onClick={() => form.setValue('mode', 'flexible')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === 'flexible'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                Flexível
              </button>
            </div>
          </div>

          {/* ── FIXED MODE ── */}
          {mode === 'fixed' && (
            <>
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
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
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
                      {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Down payment */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="downPayment">Entrada (R$)</Label>
                  <Input
                    id="downPayment"
                    placeholder="0,00 (opcional)"
                    value={form.watch('downPayment') || ''}
                    onChange={(e) =>
                      form.setValue('downPayment', maskCurrency(e.target.value))
                    }
                    inputMode="decimal"
                    className="tabular-nums"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="downPaymentDueDate">Vencimento Entrada</Label>
                  <Input
                    id="downPaymentDueDate"
                    type="date"
                    disabled={!hasDownPayment}
                    {...form.register('downPaymentDueDate')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">
                  {isInstallment || hasDownPayment
                    ? hasDownPayment
                      ? '1º Vencimento das Parcelas'
                      : '1º Vencimento'
                    : 'Vencimento'}
                </Label>
                <Input id="dueDate" type="date" {...form.register('dueDate')} />
              </div>

              {/* Fixed preview */}
              {fixedPreview.length > 0 && (
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Resumo de cobranças
                  </p>
                  <div className="space-y-1 max-h-[160px] overflow-y-auto">
                    {fixedPreview.map((row, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm py-1 px-2 rounded bg-background"
                      >
                        <span className="text-muted-foreground">{row.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground text-xs">{row.date}</span>
                          <span className="font-medium">R$ {formatCurrency(row.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── FLEXIBLE MODE ── */}
          {mode === 'flexible' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Parcelas</Label>
                {totalAmount > 0 && (
                  <span
                    className={`text-xs font-medium tabular-nums ${
                      flexValid ? 'text-green-600 dark:text-green-400' : 'text-destructive'
                    }`}
                  >
                    Soma: R$ {formatCurrency(flexSum)} / R$ {formatCurrency(totalAmount)}
                  </span>
                )}
              </div>

              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {fields.map((field, idx) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-[1fr_130px_auto_auto] gap-2 items-start"
                  >
                    <div className="space-y-1">
                      {idx === 0 && (
                        <span className="text-xs text-muted-foreground">Valor (R$)</span>
                      )}
                      <Input
                        placeholder="0,00"
                        value={form.watch(`customInstallments.${idx}.amount`) || ''}
                        onChange={(e) =>
                          form.setValue(
                            `customInstallments.${idx}.amount`,
                            maskCurrency(e.target.value),
                          )
                        }
                        inputMode="decimal"
                        className="tabular-nums"
                      />
                    </div>

                    <div className="space-y-1">
                      {idx === 0 && (
                        <span className="text-xs text-muted-foreground">Vencimento</span>
                      )}
                      <Input
                        type="date"
                        {...form.register(`customInstallments.${idx}.dueDate`)}
                      />
                    </div>

                    <div className="space-y-1 min-w-[120px]">
                      {idx === 0 && (
                        <span className="text-xs text-muted-foreground">Forma pag.</span>
                      )}
                      <Select
                        value={form.watch(`customInstallments.${idx}.paymentMethod`) || ''}
                        onValueChange={(v) =>
                          form.setValue(`customInstallments.${idx}.paymentMethod`, v)
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={idx === 0 ? 'pt-5' : ''}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(idx)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  append({
                    amount: '',
                    dueDate: format(
                      addMonths(new Date(), fields.length),
                      'yyyy-MM-dd',
                    ),
                    paymentMethod: '',
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar parcela
              </Button>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="pkg-notes">Observações</Label>
            <Textarea
              id="pkg-notes"
              rows={2}
              placeholder="Observações sobre o pacote..."
              {...form.register('notes')}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive text-center">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
