import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { financialApi } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, BookOpen, Loader2 } from 'lucide-react';
import type { FinancialRecord } from '@/types/clinic';

// ── Constants ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ── Types ──────────────────────────────────────────────────────────────────────

type RecordWithBalance = FinancialRecord & {
  effectiveDate: Date;
  runningBalance: number | null;
};

interface DayGroup {
  key: string;
  label: string;
  records: RecordWithBalance[];
}

interface MonthGroup {
  key: string;
  label: string;
  openingBalance: number;
  closingBalance: number;
  paidIncome: number;
  paidExpenses: number;
  pendingIncome: number;
  pendingExpenses: number;
  days: DayGroup[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getEffectiveDate(r: FinancialRecord): Date {
  return r.dueDate ? new Date(r.dueDate) : new Date(r.createdAt);
}

function getMonthKey(effectiveDate: Date): string {
  return format(effectiveDate, 'yyyy-MM');
}

function buildCashBook(records: FinancialRecord[]): MonthGroup[] {
  if (records.length === 0) return [];

  // Sort by effective date ASC
  const sorted = [...records].sort(
    (a, b) => getEffectiveDate(a).getTime() - getEffectiveDate(b).getTime(),
  );

  // Compute running balance (PAID entries only) and attach effective date
  let running = 0;
  const withBalance: RecordWithBalance[] = sorted.map((r) => {
    const effectiveDate = getEffectiveDate(r);
    if (r.status === 'PAID') {
      running += r.type === 'INCOME' ? Number(r.amount) : -Number(r.amount);
      return { ...r, effectiveDate, runningBalance: running };
    }
    return { ...r, effectiveDate, runningBalance: null };
  });

  // Compute opening balance for each month (balance just before first entry)
  let cumulative = 0;
  const monthOpenings = new Map<string, number>();
  for (const r of withBalance) {
    const mk = getMonthKey(r.effectiveDate);
    if (!monthOpenings.has(mk)) monthOpenings.set(mk, cumulative);
    if (r.status === 'PAID') {
      cumulative += r.type === 'INCOME' ? Number(r.amount) : -Number(r.amount);
    }
  }

  // Group into months → days
  const monthMap = new Map<string, RecordWithBalance[]>();
  for (const r of withBalance) {
    const mk = getMonthKey(r.effectiveDate);
    monthMap.set(mk, [...(monthMap.get(mk) ?? []), r]);
  }

  const groups: MonthGroup[] = [];
  for (const [mk, monthRecords] of monthMap) {
    const [yearStr, monthStr] = mk.split('-');
    const label = `${MONTH_NAMES[parseInt(monthStr) - 1]} ${yearStr}`;
    const openingBalance = monthOpenings.get(mk) ?? 0;

    const paidIncome = monthRecords
      .filter((r) => r.type === 'INCOME' && r.status === 'PAID')
      .reduce((s, r) => s + Number(r.amount), 0);
    const paidExpenses = monthRecords
      .filter((r) => r.type === 'EXPENSE' && r.status === 'PAID')
      .reduce((s, r) => s + Number(r.amount), 0);
    const pendingIncome = monthRecords
      .filter((r) => r.type === 'INCOME' && r.status === 'PENDING')
      .reduce((s, r) => s + Number(r.amount), 0);
    const pendingExpenses = monthRecords
      .filter((r) => r.type === 'EXPENSE' && r.status === 'PENDING')
      .reduce((s, r) => s + Number(r.amount), 0);

    // Group into days
    const dayMap = new Map<string, RecordWithBalance[]>();
    for (const r of monthRecords) {
      const dk = format(r.effectiveDate, 'yyyy-MM-dd');
      dayMap.set(dk, [...(dayMap.get(dk) ?? []), r]);
    }

    const days: DayGroup[] = [];
    for (const [dk, dayRecords] of dayMap) {
      days.push({
        key: dk,
        label: format(dayRecords[0].effectiveDate, 'dd/MM'),
        records: dayRecords,
      });
    }

    groups.push({
      key: mk,
      label,
      openingBalance,
      closingBalance: openingBalance + paidIncome - paidExpenses,
      paidIncome,
      paidExpenses,
      pendingIncome,
      pendingExpenses,
      days,
    });
  }

  return groups;
}

// ── Component ──────────────────────────────────────────────────────────────────

interface LivroCaixaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialYear: number;
}

export function LivroCaixaSheet({ open, onOpenChange, initialYear }: LivroCaixaSheetProps) {
  const [year, setYear] = useState(initialYear);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['financial', 'livro', year],
    queryFn: () =>
      financialApi.list({ startDate: `${year}-01-01`, endDate: `${year}-12-31` }),
    enabled: open,
  });

  const monthGroups = useMemo(() => buildCashBook(records), [records]);

  const yearPaidIncome = monthGroups.reduce((s, m) => s + m.paidIncome, 0);
  const yearPaidExpenses = monthGroups.reduce((s, m) => s + m.paidExpenses, 0);
  const yearBalance = yearPaidIncome - yearPaidExpenses;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Livro Caixa
          </SheetTitle>
        </SheetHeader>

        {/* Filter bar + year totals */}
        <div className="px-6 py-3 border-b border-border bg-muted/30 flex items-center gap-4 shrink-0">
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

          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}

          {!isLoading && records.length > 0 && (
            <div className="flex items-center gap-3 ml-auto text-xs tabular-nums">
              <span className="text-emerald-600">+R$ {formatCurrency(yearPaidIncome)}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-rose-600">−R$ {formatCurrency(yearPaidExpenses)}</span>
              <span className="text-muted-foreground">·</span>
              <span className={`font-semibold ${yearBalance >= 0 ? 'text-foreground' : 'text-rose-600'}`}>
                = R$ {formatCurrency(yearBalance)}
              </span>
            </div>
          )}
        </div>

        {/* Cash book body */}
        <div className="flex-1 overflow-y-auto">

          {/* Empty state */}
          {!isLoading && monthGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-20">
              <BookOpen className="w-10 h-10 opacity-20" />
              <p className="text-sm">Nenhum lançamento em {year}</p>
            </div>
          )}

          {/* Month sections */}
          {monthGroups.map((month) => (
            <div key={month.key}>

              {/* Month header — sticky */}
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-6 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest">{month.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Saldo anterior:{' '}
                  <span className={`font-semibold ${month.openingBalance >= 0 ? 'text-foreground' : 'text-rose-600'}`}>
                    R$ {formatCurrency(month.openingBalance)}
                  </span>
                </span>
              </div>

              {/* Day groups */}
              {month.days.map((day) => (
                <div key={day.key}>

                  {/* Day separator */}
                  <div className="flex items-center gap-3 px-6 py-1 bg-muted/20">
                    <span className="text-[11px] font-semibold text-muted-foreground tabular-nums shrink-0">
                      {day.label}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Entries */}
                  {day.records.map((record) => (
                    <div
                      key={record.id}
                      className={`flex items-center gap-3 px-6 py-2.5 border-b border-border/40 hover:bg-muted/30 transition-colors ${
                        record.status === 'PENDING' ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Type icon */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        record.type === 'INCOME' ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                      }`}>
                        {record.type === 'INCOME'
                          ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                          : <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                        }
                      </div>

                      {/* Description */}
                      <div className="flex-1 min-w-0">
                        {record.patient?.name ? (
                          <Link
                            to={`/patients/${record.patientId}`}
                            className="text-sm font-medium hover:underline truncate block"
                          >
                            {record.patient.name}
                          </Link>
                        ) : (
                          <p className="text-sm font-medium truncate">{record.description || '—'}</p>
                        )}
                        {record.description && record.patient?.name && (
                          <p className="text-xs text-muted-foreground truncate">{record.description}</p>
                        )}
                      </div>

                      {/* Pending badge */}
                      {record.status === 'PENDING' && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 shrink-0 border-dashed"
                        >
                          pendente
                        </Badge>
                      )}

                      {/* Amount + running balance */}
                      <div className="text-right shrink-0 tabular-nums">
                        <p className={`text-sm font-semibold leading-tight ${
                          record.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {record.type === 'INCOME' ? '+' : '−'}R$ {formatCurrency(record.amount)}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {record.runningBalance !== null
                            ? `R$ ${formatCurrency(record.runningBalance)}`
                            : '—'
                          }
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Month footer */}
              <div className="px-6 py-3 bg-muted/20 border-b-2 border-border space-y-1.5">
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="text-emerald-600">
                    Entradas: +R$ {formatCurrency(month.paidIncome)}
                  </span>
                  <span className="text-rose-600">
                    Saídas: −R$ {formatCurrency(month.paidExpenses)}
                  </span>
                  <span className={`font-bold ${month.closingBalance >= 0 ? 'text-foreground' : 'text-rose-600'}`}>
                    Saldo: R$ {formatCurrency(month.closingBalance)}
                  </span>
                </div>

                {(month.pendingIncome > 0 || month.pendingExpenses > 0) && (
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="uppercase tracking-wide">Pendente:</span>
                    {month.pendingIncome > 0 && (
                      <span>a receber R$ {formatCurrency(month.pendingIncome)}</span>
                    )}
                    {month.pendingIncome > 0 && month.pendingExpenses > 0 && (
                      <span>·</span>
                    )}
                    {month.pendingExpenses > 0 && (
                      <span>a pagar R$ {formatCurrency(month.pendingExpenses)}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
