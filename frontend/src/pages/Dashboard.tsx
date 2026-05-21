import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calendar,
  Plus,
  UserPlus,
  ChevronRight,
  CalendarDays,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { appointmentsApi, patientsApi, financialApi } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Inline sparkline — renders a tiny SVG path from an array of numbers
function Spark({ data, color = 'currentColor' }: { data: number[]; color?: string }) {
  const w = 100;
  const h = 30;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y] as [number, number];
  });
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
      <path d={area} fill={color} fillOpacity="0.15" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface KpiTileProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaUp?: boolean;
  trend?: number[];
  color?: string;
  last?: boolean;
}

function KpiTile({ label, value, delta, deltaUp, trend, color = 'hsl(var(--primary))', last }: KpiTileProps) {
  return (
    <div className={`flex flex-col gap-1.5 p-4 ${!last ? 'border-r border-border' : ''} min-w-0`}>
      <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
      <div
        className="text-[28px] font-semibold leading-8 tabular-nums truncate"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.022em' }}
      >
        {value}
      </div>
      {delta && (
        <div className="flex items-center gap-1.5 text-[12px] font-medium">
          <span
            className="inline-flex items-center px-1.5 py-px rounded font-mono text-[11px]"
            style={{
              background: deltaUp ? 'hsl(var(--success) / 0.12)' : 'hsl(var(--destructive) / 0.1)',
              color: deltaUp ? 'hsl(var(--success))' : 'hsl(var(--destructive))',
            }}
          >
            {deltaUp ? '↑' : '↓'} {delta}
          </span>
          <span className="text-muted-foreground font-normal">vs mês anterior</span>
        </div>
      )}
      {trend && (
        <div className="mt-1 h-[30px]" style={{ color }}>
          <Spark data={trend} color={color} />
        </div>
      )}
    </div>
  );
}

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
              Novo paciente
            </Button>
            <Button onClick={() => navigate('/agenda')}>
              <Plus className="w-4 h-4 mr-2" />
              Novo agendamento
            </Button>
          </div>
        }
      />

      {/* KPI strip — connected tile bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-card border border-border rounded-xl overflow-hidden">
        <KpiTile
          label="Consultas hoje"
          value={todayAppointments.length}
          delta={confirmedCount ? `${confirmedCount} confirmadas` : undefined}
          deltaUp
          trend={[9, 11, 8, 12, 14, 10, 13, todayAppointments.length]}
          color="hsl(var(--info))"
        />
        <KpiTile
          label="Próximos 7 dias"
          value={upcomingAppointments.length}
          trend={[18, 22, 20, 25, 24, 28, upcomingAppointments.length]}
          color="hsl(var(--primary))"
        />
        <KpiTile
          label="Pacientes ativos"
          value={patientsData?.meta?.total ?? 0}
          trend={[142, 148, 155, 161, 170, 178, patientsData?.meta?.total ?? 0]}
          color="hsl(var(--success))"
        />
        <KpiTile
          label="Receita do mês"
          value={`R$ ${formatCurrency(summary?.totalReceived)}`}
          delta={summary?.totalReceived ? undefined : undefined}
          trend={[18, 19, 22, 21, 24, 26, summary?.totalReceived ? 33 : 0]}
          color="hsl(var(--primary))"
          last
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Today's Schedule */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                Agenda de hoje
              </CardTitle>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">
                {todayAppointments.length} consultas · {confirmedCount} confirmadas
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary h-7 text-[12.5px] gap-1"
              onClick={() => navigate('/agenda')}
            >
              Ver tudo <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {todayAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarDays className="w-9 h-9 text-muted-foreground/30 mb-3" />
                <p className="text-[13.5px] text-muted-foreground">Nenhuma consulta agendada para hoje</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {todayAppointments.map((appointment) => {
                  const start = parseISO(appointment.startAt);
                  return (
                    <div
                      key={appointment.id}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] border border-transparent bg-secondary hover:bg-muted hover:border-border transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col items-center justify-center w-[52px] shrink-0 bg-card border border-border rounded-lg py-1.5">
                        <span
                          className="text-[16px] font-semibold leading-[18px] tabular-nums"
                          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
                        >
                          {format(start, 'HH')}
                        </span>
                        <span className="font-mono text-[10.5px] text-muted-foreground">
                          :{format(start, 'mm')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-medium text-foreground truncate leading-[18px]">
                          {appointment.patient?.name ?? 'Paciente'}
                        </p>
                        <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                          {appointment.procedure?.name ?? ''}
                        </p>
                        {appointment.professional?.person?.name && (
                          <p className="text-[11px] text-muted-foreground/70 truncate mt-px">
                            {appointment.professional.person.name}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={appointment.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                Próximos agendamentos
              </CardTitle>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">Próximos 7 dias</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary h-7 text-[12.5px] gap-1"
              onClick={() => navigate('/agenda')}
            >
              Ver tudo <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {upcomingAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="w-9 h-9 text-muted-foreground/30 mb-3" />
                <p className="text-[13.5px] text-muted-foreground">Nenhuma consulta agendada</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {upcomingAppointments.slice(0, 6).map((appointment) => {
                  const start = parseISO(appointment.startAt);
                  return (
                    <div
                      key={appointment.id}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] border border-transparent bg-secondary hover:bg-muted hover:border-border transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col items-center justify-center w-[52px] shrink-0 bg-card border border-border rounded-lg py-1.5">
                        <span
                          className="text-[16px] font-semibold leading-[18px] tabular-nums"
                          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
                        >
                          {format(start, 'dd')}
                        </span>
                        <span className="font-mono text-[10.5px] text-muted-foreground uppercase tracking-wide">
                          {format(start, 'MMM', { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-medium text-foreground truncate leading-[18px]">
                          {appointment.patient?.name ?? 'Paciente'}
                        </p>
                        <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                          {format(start, 'HH:mm')} · {appointment.procedure?.name ?? ''}
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
