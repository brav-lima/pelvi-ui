import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { financialApi } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Scale, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface LivroCaixaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMonth: number;
  initialYear: number;
}

export function LivroCaixaSheet({ open, onOpenChange, initialMonth, initialYear }: LivroCaixaSheetProps) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  const { data: records = [] } = useQuery({
    queryKey: ['financial', 'livro', month, year],
    queryFn: () => financialApi.list({ month, year }),
    enabled: open,
  });

  const { data: summary } = useQuery({
    queryKey: ['financial-summary', 'livro', month, year],
    queryFn: () => financialApi.summary({ month, year }),
    enabled: open,
  });

  const pendingIncome = records.filter((r) => r.type === 'INCOME' && r.status === 'PENDING');
  const pendingExpenses = records.filter((r) => r.type === 'EXPENSE' && r.status === 'PENDING');

  const totalPendingIncome = pendingIncome.reduce((s, r) => s + Number(r.amount), 0);
  const totalPendingExpenses = pendingExpenses.reduce((s, r) => s + Number(r.amount), 0);

  const balance = summary?.balance ?? 0;
  const balancePositive = balance >= 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0 overflow-hidden">
        <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
          <SheetTitle>Livro Caixa</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Filtro */}
          <div className="px-6 py-4 flex items-center gap-3 border-b border-border bg-muted/30">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-24 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Saldo */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Saldo</span>
              </div>
              <p className={`text-3xl font-bold ${balancePositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                R$ {formatCurrency(balance)}
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Receitas recebidas</p>
                  <p className="text-sm font-semibold text-emerald-500">R$ {formatCurrency(summary?.totalReceived)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Despesas pagas</p>
                  <p className="text-sm font-semibold text-rose-500">R$ {formatCurrency(summary?.totalExpenses)}</p>
                </div>
              </div>
            </div>

            {/* A Receber */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold">A Receber</span>
                </div>
                <span className="text-sm font-semibold text-emerald-500">
                  R$ {formatCurrency(totalPendingIncome)}
                </span>
              </div>
              {pendingIncome.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Nenhum recebimento pendente</p>
              ) : (
                <div className="space-y-1">
                  {pendingIncome.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 text-sm">
                      <div className="min-w-0 flex-1">
                        {r.patient?.name ? (
                          <Link to={`/patients/${r.patientId}`} className="font-medium hover:underline truncate block">
                            {r.patient.name}
                          </Link>
                        ) : (
                          <span className="font-medium text-muted-foreground truncate block">{r.description || '—'}</span>
                        )}
                        {r.dueDate && (
                          <span className="text-xs text-muted-foreground">
                            Vence {format(new Date(r.dueDate), 'dd/MM/yyyy')}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 ml-3 font-medium">R$ {formatCurrency(r.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* A Pagar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-rose-500" />
                  <span className="text-sm font-semibold">A Pagar</span>
                </div>
                <span className="text-sm font-semibold text-rose-500">
                  R$ {formatCurrency(totalPendingExpenses)}
                </span>
              </div>
              {pendingExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Nenhum pagamento pendente</p>
              ) : (
                <div className="space-y-1">
                  {pendingExpenses.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium truncate block">{r.description || '—'}</span>
                        {r.dueDate && (
                          <span className="text-xs text-muted-foreground">
                            Vence {format(new Date(r.dueDate), 'dd/MM/yyyy')}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 ml-3 font-medium">R$ {formatCurrency(r.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
