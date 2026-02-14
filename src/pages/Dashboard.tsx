import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calendar,
  Users,
  DollarSign,
  Clock,
  Plus,
  UserPlus,
  ChevronRight,
  CalendarDays,
  Loader2,
} from 'lucide-react';
import { appointmentsApi, patientsApi, financialApi } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  const { data: todayAppointments = [], isLoading: loadingApts } = useQuery({
    queryKey: ['appointments', today, today],
    queryFn: () => appointmentsApi.list({ startDate: today, endDate: today }),
  });

  const { data: patientsData } = useQuery({
    queryKey: ['patients-count'],
    queryFn: () => patientsApi.list({ page: 1, limit: 1 }),
  });

  const { data: summary } = useQuery({
    queryKey: ['financial-summary', month, year],
    queryFn: () => financialApi.summary({ month, year }),
  });

  // Fetch next 7 days for upcoming
  const nextWeek = format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd');
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');

  const { data: upcomingAppointments = [] } = useQuery({
    queryKey: ['appointments', tomorrow, nextWeek],
    queryFn: () => appointmentsApi.list({ startDate: tomorrow, endDate: nextWeek }),
  });

  const confirmedCount = todayAppointments.filter((a) => a.status === 'CONFIRMED').length;

  if (loadingApts) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard"
        description={format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/patients')}>
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Paciente
            </Button>
            <Button onClick={() => navigate('/agenda')}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Agendamento
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Consultas Hoje"
          value={todayAppointments.length}
          description={`${confirmedCount} confirmadas`}
          icon={Calendar}
        />
        <StatCard
          title="Próximas Consultas"
          value={upcomingAppointments.length}
          description="Nos próximos 7 dias"
          icon={Clock}
        />
        <StatCard
          title="Pacientes Ativos"
          value={patientsData?.meta?.total ?? 0}
          description="Cadastrados no sistema"
          icon={Users}
        />
        <StatCard
          title="Receita Mensal"
          value={`R$ ${(summary?.totalReceived ?? 0).toLocaleString('pt-BR')}`}
          description="Este mês"
          icon={DollarSign}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Schedule */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Agenda de Hoje</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/agenda')}>
              Ver tudo
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarDays className="w-12 h-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Nenhuma consulta agendada para hoje</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map((appointment) => {
                  const start = parseISO(appointment.startAt);
                  return (
                    <div
                      key={appointment.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-background border border-border">
                        <span className="text-lg font-bold text-foreground">{format(start, 'HH')}</span>
                        <span className="text-xs text-muted-foreground">{format(start, 'mm')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {appointment.patient?.name ?? 'Paciente'}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {appointment.procedure?.name ?? ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {appointment.professional?.person?.name ?? ''}
                        </p>
                      </div>
                      <StatusBadge status={appointment.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Proximos Agendamentos</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/agenda')}>
              Ver tudo
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Nenhuma consulta agendada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.slice(0, 5).map((appointment) => {
                  const start = parseISO(appointment.startAt);
                  return (
                    <div
                      key={appointment.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-background border border-border">
                        <span className="text-sm font-bold text-foreground">
                          {format(start, 'dd')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(start, 'MMM', { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {appointment.patient?.name ?? 'Paciente'}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {format(start, 'HH:mm')} - {appointment.procedure?.name ?? ''}
                        </p>
                      </div>
                      <StatusBadge status={appointment.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
