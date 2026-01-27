import { useState } from 'react';
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
  CalendarDays
} from 'lucide-react';
import { mockAppointments, mockPatients } from '@/data/mockData';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const todayAppointments = mockAppointments.filter(a => a.date === today);
  const upcomingAppointments = mockAppointments.filter(a => a.date > today).slice(0, 5);
  const totalRevenue = mockAppointments
    .filter(a => a.status === 'done' || a.status === 'confirmed')
    .reduce((sum, a) => sum + a.price, 0);

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
          description={`${todayAppointments.filter(a => a.status === 'confirmed').length} confirmadas`}
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
          value={mockPatients.length}
          description="Cadastrados no sistema"
          icon={Users}
        />
        <StatCard
          title="Receita Mensal"
          value={`R$ ${totalRevenue.toLocaleString('pt-BR')}`}
          description="Este mês"
          icon={DollarSign}
          trend={{ value: 12, positive: true }}
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
                {todayAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  >
                    <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-background border border-border">
                      <span className="text-lg font-bold text-foreground">{appointment.time.split(':')[0]}</span>
                      <span className="text-xs text-muted-foreground">{appointment.time.split(':')[1]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{appointment.patientName}</p>
                      <p className="text-sm text-muted-foreground truncate">{appointment.procedureName}</p>
                      <p className="text-xs text-muted-foreground">{appointment.professionalName}</p>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Próximos Agendamentos</CardTitle>
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
                {upcomingAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  >
                    <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-background border border-border">
                      <span className="text-sm font-bold text-foreground">
                        {format(new Date(appointment.date), 'dd')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(appointment.date), 'MMM', { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{appointment.patientName}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {appointment.time} - {appointment.procedureName}
                      </p>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
