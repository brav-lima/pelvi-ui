import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Plus, Clock, Loader2, CheckCircle, XCircle, CalendarCheck } from 'lucide-react';
import { appointmentsApi, professionalsApi } from '@/lib/api';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import type { Appointment, AppointmentStatus } from '@/types/clinic';

type ViewMode = 'day' | 'week';

export default function Agenda() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [professionalFilter, setProfessionalFilter] = useState<string>('all');

  const timeSlots = Array.from({ length: 11 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Date range depends on view mode
  const startDate = viewMode === 'week'
    ? format(weekDays[0], 'yyyy-MM-dd')
    : format(currentDate, 'yyyy-MM-dd');
  const endDate = viewMode === 'week'
    ? format(weekDays[6], 'yyyy-MM-dd')
    : format(currentDate, 'yyyy-MM-dd');

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', startDate, endDate, professionalFilter],
    queryFn: () => appointmentsApi.list({
      startDate,
      endDate,
      ...(professionalFilter !== 'all' && { professionalId: professionalFilter }),
    }),
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals'],
    queryFn: professionalsApi.list,
  });

  const activeProfessionals = professionals.filter((p) => p.active);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      appointmentsApi.updateStatus(id, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setSelectedAppointment(updated);
      const labels: Record<string, string> = {
        CONFIRMED: 'Agendamento confirmado',
        CANCELED: 'Agendamento cancelado',
        DONE: 'Agendamento finalizado',
      };
      toast.success(labels[updated.status] ?? 'Status atualizado');
    },
    onError: () => toast.error('Erro ao alterar status'),
  });

  const getAppointmentsForSlot = (date: Date, time: string) => {
    return appointments.filter((a) => {
      const aptDate = parseISO(a.startAt);
      const aptTime = format(aptDate, 'HH:00');
      return isSameDay(aptDate, date) && aptTime === time;
    });
  };

  const navigatePrev = () => {
    setCurrentDate((prev) => addDays(prev, viewMode === 'week' ? -7 : -1));
  };

  const navigateNext = () => {
    setCurrentDate((prev) => addDays(prev, viewMode === 'week' ? 7 : 1));
  };

  const dayColumns = viewMode === 'day' ? [currentDate] : weekDays;
  const gridCols = viewMode === 'day'
    ? 'grid-cols-[80px_1fr]'
    : 'grid-cols-[80px_repeat(7,1fr)]';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Agenda"
        description="Gerencie os agendamentos da clínica"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Agendamento
          </Button>
        }
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigatePrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-2">
            {viewMode === 'week'
              ? `${format(weekDays[0], "dd 'de' MMM", { locale: ptBR })} - ${format(weekDays[6], "dd 'de' MMM", { locale: ptBR })}`
              : format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Professional Filter */}
          <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {activeProfessionals.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.person.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View Mode */}
          <Button variant={viewMode === 'day' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('day')}>
            Dia
          </Button>
          <Button variant={viewMode === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('week')}>
            Semana
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className={viewMode === 'week' ? 'min-w-[800px]' : ''}>
                {/* Header */}
                <div className={cn('grid border-b border-border', gridCols)}>
                  <div className="p-3 bg-muted/50" />
                  {dayColumns.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'p-3 text-center border-l border-border bg-muted/50',
                        isSameDay(day, new Date()) && 'bg-primary/10',
                      )}
                    >
                      <p className="text-xs text-muted-foreground uppercase">
                        {format(day, 'EEE', { locale: ptBR })}
                      </p>
                      <p className={cn('text-lg font-semibold mt-1', isSameDay(day, new Date()) && 'text-primary')}>
                        {format(day, 'dd')}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Time Slots */}
                {timeSlots.map((time) => (
                  <div key={time} className={cn('grid border-b border-border last:border-b-0', gridCols)}>
                    <div className="p-2 text-sm text-muted-foreground flex items-start justify-end pr-3 bg-muted/30">
                      {time}
                    </div>
                    {dayColumns.map((day) => {
                      const slotAppointments = getAppointmentsForSlot(day, time);
                      return (
                        <div
                          key={`${day.toISOString()}-${time}`}
                          className={cn(
                            'min-h-[60px] p-1 border-l border-border hover:bg-muted/30 transition-colors',
                            isSameDay(day, new Date()) && 'bg-primary/5',
                          )}
                        >
                          {slotAppointments.map((apt) => (
                            <button
                              key={apt.id}
                              onClick={() => setSelectedAppointment(apt)}
                              className={cn(
                                'w-full p-2 rounded-md text-left text-xs mb-1 transition-all hover:scale-[1.02]',
                                apt.status === 'CONFIRMED' && 'bg-success/20 border border-success/30 text-success',
                                apt.status === 'SCHEDULED' && 'bg-info/20 border border-info/30 text-info',
                                apt.status === 'CANCELED' && 'bg-destructive/20 border border-destructive/30 text-destructive',
                                apt.status === 'DONE' && 'bg-muted border border-border text-muted-foreground',
                              )}
                            >
                              <p className="font-medium truncate">{apt.patient?.name ?? 'Paciente'}</p>
                              <p className="truncate opacity-80">{apt.procedure?.name ?? ''}</p>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appointment Details Modal */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do Agendamento</DialogTitle>
            <DialogDescription>Informações completas da consulta</DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge status={selectedAppointment.status} />
              </div>
              <div className="grid gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Paciente</p>
                  <p className="font-medium">{selectedAppointment.patient?.name ?? '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Profissional</p>
                  <p className="font-medium">{selectedAppointment.professional?.person?.name ?? '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Procedimento</p>
                  <p className="font-medium">{selectedAppointment.procedure?.name ?? '-'}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Data</p>
                    <p className="font-medium">{format(parseISO(selectedAppointment.startAt), 'dd/MM/yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Horário</p>
                    <p className="font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(parseISO(selectedAppointment.startAt), 'HH:mm')}
                    </p>
                  </div>
                  {selectedAppointment.procedure?.durationMinutes && (
                    <div>
                      <p className="text-sm text-muted-foreground">Duração</p>
                      <p className="font-medium">{selectedAppointment.procedure.durationMinutes} min</p>
                    </div>
                  )}
                </div>
                {selectedAppointment.procedure?.price && (
                  <div>
                    <p className="text-sm text-muted-foreground">Valor</p>
                    <p className="font-medium text-lg">
                      R$ {Number(selectedAppointment.procedure.price).toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Actions */}
              {selectedAppointment.status !== 'CANCELED' && selectedAppointment.status !== 'DONE' && (
                <>
                  <Separator />
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    {selectedAppointment.status === 'SCHEDULED' && (
                      <Button
                        variant="outline"
                        className="flex-1 text-success border-success/30 hover:bg-success/10"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ id: selectedAppointment.id, status: 'CONFIRMED' })}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirmar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: selectedAppointment.id, status: 'DONE' })}
                    >
                      <CalendarCheck className="w-4 h-4 mr-2" />
                      Finalizar
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: selectedAppointment.id, status: 'CANCELED' })}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Appointment Dialog */}
      <AppointmentFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['appointments'] })}
      />
    </div>
  );
}
