import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Plus, Clock, Loader2, CheckCircle, XCircle, CalendarCheck, GripVertical } from 'lucide-react';
import { appointmentsApi, professionalsApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  format,
  addDays,
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
  parseISO,
  setHours,
  setMinutes,
} from 'date-fns';
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
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import type { Appointment, AppointmentStatus } from '@/types/clinic';

// --- Draggable appointment card ---
function DraggableAppointment({
  apt,
  onClick,
}: {
  apt: Appointment;
  onClick: () => void;
}) {
  const isDraggable = apt.status !== 'CANCELED' && apt.status !== 'DONE';
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: apt.id,
    data: { appointment: apt },
    disabled: !isDraggable,
  });

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        'w-full p-2 rounded-md text-left text-xs mb-1 transition-all hover:scale-[1.02]',
        apt.status === 'CONFIRMED' && 'bg-success/20 border border-success/30 text-success',
        apt.status === 'SCHEDULED' && 'bg-info/20 border border-info/30 text-info',
        apt.status === 'CANCELED' && 'bg-destructive/20 border border-destructive/30 text-destructive',
        apt.status === 'DONE' && 'bg-muted border border-border text-muted-foreground',
        isDragging && 'opacity-30',
      )}
    >
      <div className="flex items-start gap-1">
        {isDraggable && (
          <span {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing shrink-0 mt-0.5 touch-none">
            <GripVertical className="w-3 h-3 opacity-50" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{apt.patient?.name ?? 'Paciente'}</p>
          <p className="truncate opacity-80">{apt.procedure?.name ?? ''}</p>
        </div>
      </div>
    </button>
  );
}

// --- Droppable time slot cell ---
function DroppableSlot({
  id,
  children,
  isToday,
}: {
  id: string;
  children: React.ReactNode;
  isToday: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[60px] p-1 border-l border-border transition-colors',
        isToday && 'bg-primary/5',
        isOver ? 'bg-primary/10' : 'hover:bg-muted/30',
      )}
    >
      {children}
    </div>
  );
}

type ViewMode = 'day' | 'week' | 'month';

export default function Agenda() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [professionalFilter, setProfessionalFilter] = useState<string>('all');
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null);

  const timeSlots = Array.from({ length: 11 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Month view: calculate all calendar cells (including overflow from prev/next month)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const monthDays: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    monthDays.push(day);
    day = addDays(day, 1);
  }

  // Date range depends on view mode
  const startDate =
    viewMode === 'month'
      ? format(calendarStart, 'yyyy-MM-dd')
      : viewMode === 'week'
        ? format(weekDays[0], 'yyyy-MM-dd')
        : format(currentDate, 'yyyy-MM-dd');
  const endDate =
    viewMode === 'month'
      ? format(calendarEnd, 'yyyy-MM-dd')
      : viewMode === 'week'
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

  const dragMutation = useMutation({
    mutationFn: ({ id, startAt }: { id: string; startAt: string }) =>
      appointmentsApi.update(id, { startAt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Agendamento reagendado');
    },
    onError: () => toast.error('Erro ao reagendar'),
  });

  const handleDragStart = (event: DragStartEvent) => {
    const apt = event.active.data.current?.appointment as Appointment;
    setDraggedAppointment(apt ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedAppointment(null);
    const { active, over } = event;
    if (!over) return;

    const apt = active.data.current?.appointment as Appointment;
    if (!apt) return;

    // Slot id format: "slot-{isoDate}-{HH:00}"
    const slotId = over.id as string;
    if (!slotId.startsWith('slot-')) return;

    const parts = slotId.replace('slot-', '').split('_');
    const dateStr = parts[0]; // yyyy-MM-dd
    const timeStr = parts[1]; // HH:00

    // Keep original minutes from the appointment
    const originalDate = parseISO(apt.startAt);
    const originalMinutes = originalDate.getMinutes();
    const hour = parseInt(timeStr.split(':')[0], 10);

    const newDate = setMinutes(setHours(parseISO(dateStr + 'T00:00:00'), hour), originalMinutes);
    const newStartAt = newDate.toISOString();

    // Don't update if same slot
    if (format(originalDate, 'yyyy-MM-dd HH:00') === `${dateStr} ${timeStr}`) return;

    dragMutation.mutate({ id: apt.id, startAt: newStartAt });
  };

  const getAppointmentsForSlot = (date: Date, time: string) => {
    return appointments.filter((a) => {
      const aptDate = parseISO(a.startAt);
      const aptTime = format(aptDate, 'HH:00');
      return isSameDay(aptDate, date) && aptTime === time;
    });
  };

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter((a) => isSameDay(parseISO(a.startAt), date));
  };

  const navigatePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate((prev) => addMonths(prev, -1));
    } else {
      setCurrentDate((prev) => addDays(prev, viewMode === 'week' ? -7 : -1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'month') {
      setCurrentDate((prev) => addMonths(prev, 1));
    } else {
      setCurrentDate((prev) => addDays(prev, viewMode === 'week' ? 7 : 1));
    }
  };

  const goToDay = (date: Date) => {
    setCurrentDate(date);
    setViewMode('day');
  };

  const dayColumns = viewMode === 'day' ? [currentDate] : weekDays;
  const gridCols = viewMode === 'day'
    ? 'grid-cols-[80px_1fr]'
    : 'grid-cols-[80px_repeat(7,1fr)]';

  const headerLabel =
    viewMode === 'month'
      ? format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })
      : viewMode === 'week'
        ? `${format(weekDays[0], "dd 'de' MMM", { locale: ptBR })} - ${format(weekDays[6], "dd 'de' MMM", { locale: ptBR })}`
        : format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR });

  const weekDayHeaders = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

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
          <h2 className="text-lg font-semibold ml-2 capitalize">
            {headerLabel}
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
          <Button variant={viewMode === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('month')}>
            Mês
          </Button>
        </div>
      </div>

      {/* Calendar Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === 'month' ? (
        /* Month View */
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Week day headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {weekDayHeaders.map((d) => (
                <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground uppercase bg-muted/50">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {monthDays.map((d) => {
                const dayAppts = getAppointmentsForDay(d);
                const isCurrentMonth = isSameMonth(d, currentDate);
                const isToday = isSameDay(d, new Date());
                const scheduled = dayAppts.filter((a) => a.status === 'SCHEDULED').length;
                const confirmed = dayAppts.filter((a) => a.status === 'CONFIRMED').length;
                const done = dayAppts.filter((a) => a.status === 'DONE').length;
                const canceled = dayAppts.filter((a) => a.status === 'CANCELED').length;

                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => goToDay(d)}
                    className={cn(
                      'min-h-[80px] p-2 border-b border-r border-border text-left transition-colors hover:bg-muted/30',
                      !isCurrentMonth && 'opacity-40',
                      isToday && 'bg-primary/5',
                    )}
                  >
                    <p className={cn(
                      'text-sm font-medium mb-1',
                      isToday && 'text-primary font-bold',
                      !isCurrentMonth && 'text-muted-foreground',
                    )}>
                      {format(d, 'd')}
                    </p>
                    {dayAppts.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {scheduled > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-info/20 border-info/30 text-info">
                            {scheduled}
                          </Badge>
                        )}
                        {confirmed > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-success/20 border-success/30 text-success">
                            {confirmed}
                          </Badge>
                        )}
                        {done > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-muted border-border text-muted-foreground">
                            {done}
                          </Badge>
                        )}
                        {canceled > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-destructive/20 border-destructive/30 text-destructive">
                            {canceled}
                          </Badge>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Day / Week View with Drag & Drop */
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className={viewMode === 'week' ? 'min-w-[800px]' : ''}>
                  {/* Header */}
                  <div className={cn('grid border-b border-border', gridCols)}>
                    <div className="p-3 bg-muted/50" />
                    {dayColumns.map((d) => (
                      <div
                        key={d.toISOString()}
                        className={cn(
                          'p-3 text-center border-l border-border bg-muted/50',
                          isSameDay(d, new Date()) && 'bg-primary/10',
                        )}
                      >
                        <p className="text-xs text-muted-foreground uppercase">
                          {format(d, 'EEE', { locale: ptBR })}
                        </p>
                        <p className={cn('text-lg font-semibold mt-1', isSameDay(d, new Date()) && 'text-primary')}>
                          {format(d, 'dd')}
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
                      {dayColumns.map((d) => {
                        const slotAppointments = getAppointmentsForSlot(d, time);
                        const slotId = `slot-${format(d, 'yyyy-MM-dd')}_${time}`;
                        return (
                          <DroppableSlot
                            key={slotId}
                            id={slotId}
                            isToday={isSameDay(d, new Date())}
                          >
                            {slotAppointments.map((apt) => (
                              <DraggableAppointment
                                key={apt.id}
                                apt={apt}
                                onClick={() => setSelectedAppointment(apt)}
                              />
                            ))}
                          </DroppableSlot>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Drag Overlay */}
          <DragOverlay>
            {draggedAppointment && (
              <div className={cn(
                'p-2 rounded-md text-xs shadow-lg',
                draggedAppointment.status === 'CONFIRMED' && 'bg-success/20 border border-success/30 text-success',
                draggedAppointment.status === 'SCHEDULED' && 'bg-info/20 border border-info/30 text-info',
              )}>
                <p className="font-medium truncate">{draggedAppointment.patient?.name ?? 'Paciente'}</p>
                <p className="truncate opacity-80">{draggedAppointment.procedure?.name ?? ''}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
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
