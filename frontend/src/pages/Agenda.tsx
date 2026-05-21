import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
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
import { formatCurrency } from '@/lib/formatters';
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

// --- Constants ---
const START_HOUR = 8;
const END_HOUR = 21;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const SLOT_MINUTES = 30;
const PX_PER_MINUTE = 1; // 1px = 1min, so 1h = 60px
const TOTAL_SLOTS = TOTAL_HOURS * (60 / SLOT_MINUTES); // 20 half-hour slots
const GRID_HEIGHT = TOTAL_HOURS * 60 * PX_PER_MINUTE; // 600px
const SLOT_HEIGHT = SLOT_MINUTES * PX_PER_MINUTE; // 30px

// Half-hour slot definitions
const halfHourSlots = Array.from({ length: TOTAL_SLOTS }, (_, i) => {
  const totalMinutes = i * SLOT_MINUTES;
  const hour = Math.floor(totalMinutes / 60) + START_HOUR;
  const min = totalMinutes % 60;
  const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  return { time, index: i, isFullHour: min === 0 };
});

// Hour labels for the time column
const hourLabels = Array.from({ length: TOTAL_HOURS }, (_, i) => ({
  label: `${(i + START_HOUR).toString().padStart(2, '0')}:00`,
  top: i * 60 * PX_PER_MINUTE,
}));

// --- Position helpers ---
function getAppointmentTop(startAt: string): number {
  const date = parseISO(startAt);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return ((hours - START_HOUR) * 60 + minutes) * PX_PER_MINUTE;
}

function getAppointmentHeight(durationMinutes: number): number {
  return Math.max(durationMinutes * PX_PER_MINUTE, 20); // minimum 20px
}

// --- Status color helper ---
function getStatusClasses(status: AppointmentStatus) {
  switch (status) {
    case 'CONFIRMED': return 'bg-success/20 border-success/30 text-success';
    case 'SCHEDULED': return 'bg-info/20 border-info/30 text-info';
    case 'CANCELED': return 'bg-destructive/20 border-destructive/30 text-destructive';
    case 'DONE': return 'bg-muted border-border text-muted-foreground';
  }
}

// --- Draggable appointment card ---
function DraggableAppointment({
  apt,
  onClick,
  style,
}: {
  apt: Appointment;
  onClick: () => void;
  style: React.CSSProperties;
}) {
  const isDraggable = apt.status !== 'CANCELED' && apt.status !== 'DONE';
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: apt.id,
    data: { appointment: apt },
    disabled: !isDraggable,
  });

  const duration = apt.procedure?.durationMinutes ?? 30;
  const startTime = format(parseISO(apt.startAt), 'HH:mm');
  const endDate = new Date(parseISO(apt.startAt).getTime() + duration * 60000);
  const endTime = format(endDate, 'HH:mm');
  const isCompact = duration <= 30;

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      style={style}
      className={cn(
        'absolute left-1 right-1 rounded-md text-left text-xs border transition-all hover:brightness-95 overflow-hidden z-10',
        getStatusClasses(apt.status),
        isDragging && 'opacity-30',
      )}
    >
      <div className={cn('flex h-full', isCompact ? 'items-center px-1.5 gap-1' : 'flex-col p-1.5')}>
        {isDraggable && !isCompact && (
          <span {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing shrink-0 touch-none self-end">
            <GripVertical className="w-3 h-3 opacity-50" />
          </span>
        )}
        <p className="font-medium truncate">{apt.patient?.name ?? 'Paciente'}</p>
        {!isCompact && <p className="truncate opacity-80">{apt.procedure?.name ?? ''}</p>}
        <p className={cn('opacity-70', isCompact ? 'ml-auto shrink-0' : 'mt-auto')}>
          {startTime} - {endTime}
        </p>
        {isDraggable && isCompact && (
          <span {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing shrink-0 touch-none">
            <GripVertical className="w-3 h-3 opacity-50" />
          </span>
        )}
      </div>
    </button>
  );
}

// --- Droppable time slot zone (invisible, behind appointments) ---
function DroppableSlot({
  id,
  style,
  isFullHour,
  isToday,
  onClick,
}: {
  id: string;
  style: React.CSSProperties;
  isFullHour: boolean;
  isToday: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={cn(
        'absolute left-0 right-0 border-t transition-colors cursor-pointer',
        isFullHour ? 'border-border' : 'border-border/30 border-dashed',
        isToday && 'bg-primary/5',
        isOver ? 'bg-primary/10' : 'hover:bg-muted/30',
      )}
    />
  );
}

const AVATAR_COLORS = [
  ['hsl(296 30% 94%)', 'hsl(296 28% 26%)'],
  ['hsl(142 55% 93%)', 'hsl(142 60% 22%)'],
  ['hsl(199 75% 93%)', 'hsl(199 70% 28%)'],
  ['hsl(38 80% 93%)',  'hsl(30 75% 30%)'],
  ['hsl(285 50% 94%)', 'hsl(285 50% 32%)'],
] as const;

function hashColor(name: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31 + name.charCodeAt(i)) >>> 0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
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
  const [slotPreset, setSlotPreset] = useState<{ date: string; time: string } | null>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Month view cells
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

  // Date range for the query
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
    onMutate: async ({ id, startAt }) => {
      // Cancel in-flight fetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['appointments'] });

      // Snapshot current cache
      const queryKey = ['appointments', startDate, endDate, professionalFilter];
      const previous = queryClient.getQueryData<Appointment[]>(queryKey);

      // Optimistically update the appointment in the cache
      if (previous) {
        queryClient.setQueryData<Appointment[]>(queryKey, (old) =>
          (old ?? []).map((apt) => {
            if (apt.id !== id) return apt;
            const duration = apt.procedure?.durationMinutes ?? 30;
            const newEnd = new Date(new Date(startAt).getTime() + duration * 60_000);
            return { ...apt, startAt, endAt: newEnd.toISOString() };
          }),
        );
      }

      return { previous, queryKey };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      toast.error('Erro ao reagendar');
    },
    onSuccess: () => {
      toast.success('Agendamento reagendado');
    },
    onSettled: () => {
      // Always refetch to ensure server state is in sync
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
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

    const slotId = over.id as string;
    if (!slotId.startsWith('slot-')) return;

    const parts = slotId.replace('slot-', '').split('_');
    const dateStr = parts[0];
    const timeStr = parts[1]; // HH:MM

    const [hourStr, minStr] = timeStr.split(':');
    const hour = parseInt(hourStr, 10);
    const min = parseInt(minStr, 10);

    const newDate = setMinutes(setHours(parseISO(dateStr + 'T00:00:00'), hour), min);
    const newStartAt = newDate.toISOString();

    const originalDate = parseISO(apt.startAt);
    if (format(originalDate, 'yyyy-MM-dd HH:mm') === `${dateStr} ${timeStr}`) return;

    dragMutation.mutate({ id: apt.id, startAt: newStartAt });
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

  // Current time indicator
  const nowDate = new Date();
  const currentTimeTop = ((nowDate.getHours() - START_HOUR) * 60 + nowDate.getMinutes()) * PX_PER_MINUTE;
  const isCurrentTimeVisible = nowDate.getHours() >= START_HOUR && nowDate.getHours() < END_HOUR;

  const dayColumns = viewMode === 'day' ? [currentDate] : weekDays;
  const gridCols = viewMode === 'day'
    ? 'grid-cols-[60px_1fr]'
    : 'grid-cols-[60px_repeat(7,1fr)]';

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

        <div className="flex items-center gap-3 flex-wrap">
          {/* Professional filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setProfessionalFilter('all')}
              className={cn(
                'h-[28px] px-3 rounded-full text-[12.5px] font-medium border transition-colors',
                professionalFilter === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground',
              )}
            >
              Todos
            </button>
            {activeProfessionals.map((p) => {
              const [bg, fg] = hashColor(p.person.name);
              const isSelected = professionalFilter === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setProfessionalFilter(p.id)}
                  className={cn(
                    'h-[28px] pl-1 pr-3 rounded-full text-[12.5px] font-medium border transition-colors flex items-center gap-1.5',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0"
                    style={isSelected ? { background: 'hsl(var(--primary-foreground) / 0.25)', color: 'currentColor' } : { background: bg, color: fg }}
                  >
                    {initials(p.person.name)}
                  </span>
                  {p.person.name.split(' ')[0]}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
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
      </div>

      {/* Calendar Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === 'month' ? (
        /* ====== Month View ====== */
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b border-border">
              {weekDayHeaders.map((d) => (
                <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground uppercase bg-muted/50">
                  {d}
                </div>
              ))}
            </div>
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
                      'text-sm font-medium mb-1 tabular-nums',
                      isToday && 'text-primary font-bold',
                      !isCurrentMonth && 'text-muted-foreground',
                    )}>
                      {format(d, 'd')}
                    </p>
                    {dayAppts.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {scheduled > 0 && (
                          <Badge variant="soft-info" className="text-[10px] px-1 py-0 h-4 tabular-nums">
                            {scheduled}
                          </Badge>
                        )}
                        {confirmed > 0 && (
                          <Badge variant="soft-success" className="text-[10px] px-1 py-0 h-4 tabular-nums">
                            {confirmed}
                          </Badge>
                        )}
                        {done > 0 && (
                          <Badge variant="soft-muted" className="text-[10px] px-1 py-0 h-4 tabular-nums">
                            {done}
                          </Badge>
                        )}
                        {canceled > 0 && (
                          <Badge variant="soft-destructive" className="text-[10px] px-1 py-0 h-4 tabular-nums">
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
        /* ====== Day / Week View with duration-based blocks ====== */
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className={viewMode === 'week' ? 'min-w-[800px]' : ''}>
                  {/* Day Headers */}
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
                        <p className={cn('text-lg font-semibold mt-1 tabular-nums', isSameDay(d, new Date()) && 'text-primary')}>
                          {format(d, 'dd')}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Time Grid (absolute positioning) */}
                  <div className={cn('grid', gridCols)}>
                    {/* Time Labels Column */}
                    <div className="relative bg-muted/30" style={{ height: GRID_HEIGHT }}>
                      {hourLabels.map(({ label, top }) => (
                        <div
                          key={label}
                          className="absolute right-0 pr-2 text-xs text-muted-foreground -translate-y-1/2 tabular-nums"
                          style={{ top }}
                        >
                          {label}
                        </div>
                      ))}
                    </div>

                    {/* Day Columns */}
                    {dayColumns.map((d) => {
                      const dayAppts = getAppointmentsForDay(d);
                      const isToday = isSameDay(d, new Date());
                      const dateStr = format(d, 'yyyy-MM-dd');

                      return (
                        <div
                          key={d.toISOString()}
                          className="relative border-l border-border"
                          style={{ height: GRID_HEIGHT }}
                        >
                          {/* Grid lines + droppable zones */}
                          {halfHourSlots.map((slot) => {
                            const slotId = `slot-${dateStr}_${slot.time}`;
                            return (
                              <DroppableSlot
                                key={slotId}
                                id={slotId}
                                isFullHour={slot.isFullHour}
                                isToday={isToday}
                                style={{ top: slot.index * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                                onClick={() => {
                                  setSlotPreset({ date: dateStr, time: slot.time });
                                  setCreateOpen(true);
                                }}
                              />
                            );
                          })}

                          {/* Appointments */}
                          {dayAppts.map((apt) => {
                            const top = getAppointmentTop(apt.startAt);
                            const duration = apt.procedure?.durationMinutes ?? 30;
                            const height = getAppointmentHeight(duration);

                            // Skip if outside visible range
                            if (top < 0 || top >= GRID_HEIGHT) return null;

                            return (
                              <DraggableAppointment
                                key={apt.id}
                                apt={apt}
                                onClick={() => setSelectedAppointment(apt)}
                                style={{ top, height: Math.min(height, GRID_HEIGHT - top) }}
                              />
                            );
                          })}

                          {/* Current time indicator */}
                          {isToday && isCurrentTimeVisible && (
                            <div
                              className="absolute left-0 right-0 z-20 pointer-events-none"
                              style={{ top: currentTimeTop }}
                            >
                              <div className="relative flex items-center">
                                <div className="w-2 h-2 rounded-full bg-primary shrink-0 -ml-1" />
                                <div className="flex-1 h-px bg-primary" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Drag Overlay */}
          <DragOverlay>
            {draggedAppointment && (() => {
              const duration = draggedAppointment.procedure?.durationMinutes ?? 30;
              const height = getAppointmentHeight(duration);
              return (
                <div
                  className={cn(
                    'p-1.5 rounded-md text-xs shadow-lg border',
                    getStatusClasses(draggedAppointment.status),
                  )}
                  style={{ height, width: 120 }}
                >
                  <p className="font-medium truncate">{draggedAppointment.patient?.name ?? 'Paciente'}</p>
                  <p className="truncate opacity-80">{draggedAppointment.procedure?.name ?? ''}</p>
                </div>
              );
            })()}
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
                      R$ {formatCurrency(selectedAppointment.procedure.price)}
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
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setSlotPreset(null);
        }}
        defaultDate={slotPreset?.date}
        defaultTime={slotPreset?.time}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['appointments'] })}
      />
    </div>
  );
}
