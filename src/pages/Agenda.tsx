import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Clock
} from 'lucide-react';
import { mockAppointments, mockProfessionals } from '@/data/mockData';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Appointment } from '@/types/clinic';

type ViewMode = 'day' | 'week' | 'month';

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const timeSlots = Array.from({ length: 11 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getAppointmentsForSlot = (date: Date, time: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return mockAppointments.filter(
      (a) => a.date === dateStr && a.time === time
    );
  };

  const navigatePrev = () => {
    setCurrentDate((prev) => addDays(prev, viewMode === 'week' ? -7 : -1));
  };

  const navigateNext = () => {
    setCurrentDate((prev) => addDays(prev, viewMode === 'week' ? 7 : 1));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Agenda"
        description="Gerencie os agendamentos da clínica"
        actions={
          <Button>
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
              : format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
            }
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'day' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('day')}
          >
            Dia
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('week')}
          >
            Semana
          </Button>
          <Button
            variant={viewMode === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('month')}
          >
            Mês
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header */}
              <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border">
                <div className="p-3 bg-muted/50" />
                {weekDays.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'p-3 text-center border-l border-border bg-muted/50',
                      isSameDay(day, new Date()) && 'bg-primary/10'
                    )}
                  >
                    <p className="text-xs text-muted-foreground uppercase">
                      {format(day, 'EEE', { locale: ptBR })}
                    </p>
                    <p className={cn(
                      'text-lg font-semibold mt-1',
                      isSameDay(day, new Date()) && 'text-primary'
                    )}>
                      {format(day, 'dd')}
                    </p>
                  </div>
                ))}
              </div>

              {/* Time Slots */}
              {timeSlots.map((time) => (
                <div key={time} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border last:border-b-0">
                  <div className="p-2 text-sm text-muted-foreground flex items-start justify-end pr-3 bg-muted/30">
                    {time}
                  </div>
                  {weekDays.map((day) => {
                    const appointments = getAppointmentsForSlot(day, time);
                    return (
                      <div
                        key={`${day.toISOString()}-${time}`}
                        className={cn(
                          'min-h-[60px] p-1 border-l border-border hover:bg-muted/30 transition-colors',
                          isSameDay(day, new Date()) && 'bg-primary/5'
                        )}
                      >
                        {appointments.map((apt) => (
                          <button
                            key={apt.id}
                            onClick={() => setSelectedAppointment(apt)}
                            className={cn(
                              'w-full p-2 rounded-md text-left text-xs mb-1 transition-all hover:scale-[1.02]',
                              apt.status === 'confirmed' && 'bg-success/20 border border-success/30 text-success',
                              apt.status === 'scheduled' && 'bg-info/20 border border-info/30 text-info',
                              apt.status === 'canceled' && 'bg-destructive/20 border border-destructive/30 text-destructive',
                              apt.status === 'done' && 'bg-muted border border-border text-muted-foreground'
                            )}
                          >
                            <p className="font-medium truncate">{apt.patientName}</p>
                            <p className="truncate opacity-80">{apt.procedureName}</p>
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

      {/* Appointment Details Modal */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do Agendamento</DialogTitle>
            <DialogDescription>
              Informações completas da consulta
            </DialogDescription>
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
                  <p className="font-medium">{selectedAppointment.patientName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Profissional</p>
                  <p className="font-medium">{selectedAppointment.professionalName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Procedimento</p>
                  <p className="font-medium">{selectedAppointment.procedureName}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Data</p>
                    <p className="font-medium">
                      {format(new Date(selectedAppointment.date), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Horário</p>
                    <p className="font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {selectedAppointment.time}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Duração</p>
                    <p className="font-medium">{selectedAppointment.duration} min</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor</p>
                  <p className="font-medium text-lg">
                    R$ {selectedAppointment.price.toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1">Editar</Button>
                <Button variant="destructive" className="flex-1">Cancelar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
