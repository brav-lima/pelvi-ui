import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DollarSign, 
  TrendingUp, 
  Clock,
  CheckCircle
} from 'lucide-react';
import { mockFinancialRecords } from '@/data/mockData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Financial() {
  const totalIncome = mockFinancialRecords
    .filter((r) => r.status === 'paid')
    .reduce((sum, r) => sum + r.amount, 0);
  
  const totalPending = mockFinancialRecords
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + r.amount, 0);

  const paidCount = mockFinancialRecords.filter((r) => r.status === 'paid').length;
  const pendingCount = mockFinancialRecords.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Financeiro"
        description="Visão geral das finanças da clínica"
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Receita Total"
          value={`R$ ${totalIncome.toLocaleString('pt-BR')}`}
          description="Este mês"
          icon={DollarSign}
          trend={{ value: 8, positive: true }}
        />
        <StatCard
          title="Valores Pendentes"
          value={`R$ ${totalPending.toLocaleString('pt-BR')}`}
          description={`${pendingCount} registros`}
          icon={Clock}
        />
        <StatCard
          title="Pagos"
          value={paidCount}
          description="Registros quitados"
          icon={CheckCircle}
        />
        <StatCard
          title="Ticket Médio"
          value={`R$ ${Math.round(totalIncome / (paidCount || 1)).toLocaleString('pt-BR')}`}
          description="Por atendimento"
          icon={TrendingUp}
        />
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registros Financeiros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Paciente</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockFinancialRecords.map((record) => (
                  <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4 text-sm text-foreground">
                      {format(new Date(record.date), "dd/MM/yyyy")}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      {record.patientName}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {record.description}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      R$ {record.amount.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={record.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
