import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Clock, CheckCircle, Plus, Loader2 } from 'lucide-react';
import { financialApi } from '@/lib/api';
import { format } from 'date-fns';
import { FinancialFormDialog } from '@/components/financial/FinancialFormDialog';

export default function Financial() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: records = [], isLoading: loadingRecords } = useQuery({
    queryKey: ['financial', month, year],
    queryFn: () => financialApi.list({ month, year }),
  });

  const { data: summary } = useQuery({
    queryKey: ['financial-summary', month, year],
    queryFn: () => financialApi.summary({ month, year }),
  });

  if (loadingRecords) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const paidCount = records.filter((r) => r.status === 'PAID').length;

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['financial'] });
    queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Financeiro"
        description="Visao geral das financas da clinica"
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Registro
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Receita Total"
          value={`R$ ${(summary?.totalReceived ?? 0).toLocaleString('pt-BR')}`}
          description="Este mes"
          icon={DollarSign}
        />
        <StatCard
          title="Valores Pendentes"
          value={`R$ ${(summary?.totalPending ?? 0).toLocaleString('pt-BR')}`}
          description="Aguardando pagamento"
          icon={Clock}
        />
        <StatCard
          title="Despesas"
          value={`R$ ${(summary?.totalExpenses ?? 0).toLocaleString('pt-BR')}`}
          description="Este mes"
          icon={TrendingUp}
        />
        <StatCard
          title="Saldo"
          value={`R$ ${(summary?.balance ?? 0).toLocaleString('pt-BR')}`}
          description={`${paidCount} pagamentos realizados`}
          icon={CheckCircle}
        />
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registros Financeiros</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum registro financeiro neste mes.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Paciente</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Descricao</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 text-sm text-foreground">
                        {format(new Date(record.createdAt), 'dd/MM/yyyy')}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-foreground">
                        {record.patient?.name ?? '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {record.description || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={record.type} />
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-foreground">
                        R$ {Number(record.amount).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={record.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <FinancialFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
