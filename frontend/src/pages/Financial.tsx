import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, BookOpen, CheckCircle, Plus, Trash2, Loader2, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';
import { financialApi } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import { format, addMonths, subMonths } from 'date-fns';
import { FinancialFormDialog } from '@/components/financial/FinancialFormDialog';
import { LivroCaixaSheet } from '@/components/financial/LivroCaixaSheet';
import { useHasRole } from '@/components/auth/RoleGuard';

export default function Financial() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [livroOpen, setLivroOpen] = useState(false);
  const isAdmin = useHasRole('ADMIN');

  const now = new Date();
  const [selectedPeriod, setSelectedPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const { month, year } = selectedPeriod;

  const navigatePeriod = (dir: 1 | -1) => {
    const base = new Date(year, month - 1, 1);
    const next = dir === 1 ? addMonths(base, 1) : subMonths(base, 1);
    setSelectedPeriod({ month: next.getMonth() + 1, year: next.getFullYear() });
  };

  const periodLabel = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const { data: recordsPage, isLoading: loadingRecords } = useQuery({
    queryKey: ['financial', 'month', month, year],
    queryFn: () => financialApi.list({ month, year }),
  });
  const records = recordsPage?.data ?? [];

  const { data: summary } = useQuery({
    queryKey: ['financial-summary', month, year],
    queryFn: () => financialApi.summary({ month, year }),
  });

  const pendingCount = records.filter(r => r.status === 'PENDING').length;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financialApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial', 'month'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Registro excluído com sucesso');
    },
    onError: () => toast.error('Erro ao excluir registro'),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => financialApi.update(id, { status: 'PAID' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial', 'month'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Pagamento confirmado');
    },
    onError: () => toast.error('Erro ao confirmar pagamento'),
  });

  if (loadingRecords) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['financial', 'month'] });
    queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Financeiro"
        description={
          <span className="flex items-center gap-2">
            <button onClick={() => navigatePeriod(-1)} className="p-0.5 rounded hover:bg-muted transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="capitalize tabular-nums">{periodLabel}</span>
            <button onClick={() => navigatePeriod(1)} className="p-0.5 rounded hover:bg-muted transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </span>
        }
        actions={
          isAdmin ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Registro
            </Button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Receitas"
          value={`R$ ${formatCurrency(summary?.totalReceived)}`}
          description="Recebidas no mês"
          icon={TrendingUp}
        />
        <StatCard
          title="Despesas"
          value={`R$ ${formatCurrency(summary?.totalExpenses)}`}
          description="Pagas no mês"
          icon={TrendingDown}
        />
        <StatCard
          title="Faturas pendentes"
          value={pendingCount}
          description="Aguardando pagamento"
          icon={AlertCircle}
        />
        <button
          onClick={() => setLivroOpen(true)}
          className="text-left w-full"
        >
          <Card className="overflow-hidden h-full hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Livro Caixa</p>
                  <p className="text-lg font-semibold text-foreground">Ver detalhes</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Saldo e pendências <ChevronRight className="w-3.5 h-3.5" />
                  </p>
                </div>
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent shrink-0">
                  <BookOpen className="w-6 h-6 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-baseline gap-2">
            Registros Financeiros
            <span className="text-sm font-normal text-muted-foreground capitalize">{periodLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum registro financeiro neste mês.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Paciente</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Procedimento</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Pagamento</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    {isAdmin && <th className="py-3 px-4 text-sm font-medium text-muted-foreground w-24" />}
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 text-sm text-foreground">
                        {format(new Date(record.dueDate ?? record.createdAt), 'dd/MM/yyyy')}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-foreground">
                        {record.patient?.name ? (
                          <Link
                            to={`/patients/${record.patientId}`}
                            className="hover:underline"
                          >
                            {record.patient.name}
                          </Link>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="truncate">
                            {record.appointment?.procedure?.name || record.description || '-'}
                          </span>
                          {record.installment && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                              {record.installment.current}/{record.installment.total}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {record.paymentMethod ?? '-'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={record.type} />
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-foreground">
                        R$ {formatCurrency(record.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={record.status} />
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            {record.status === 'PENDING' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-success hover:text-success"
                                    title="Dar baixa"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Pagamento</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Deseja marcar este registro de R$ {formatCurrency(record.amount)} como pago?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => markPaidMutation.mutate(record.id)}>
                                      Confirmar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Registro</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir este registro financeiro?
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteMutation.mutate(record.id)}
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <LivroCaixaSheet
        open={livroOpen}
        onOpenChange={setLivroOpen}
        initialYear={year}
      />

      <FinancialFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
