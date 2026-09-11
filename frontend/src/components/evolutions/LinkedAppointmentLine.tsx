import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Evolution } from '@/types/clinic';

interface LinkedAppointmentLineProps {
  appointment: NonNullable<Evolution['appointment']>;
}

export function LinkedAppointmentLine({ appointment }: LinkedAppointmentLineProps) {
  const when = format(new Date(appointment.startAt), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>
        Atendimento: {appointment.procedure?.name ? `${appointment.procedure.name} — ` : ''}
        {when}
      </span>
      <StatusBadge status={appointment.status} />
    </div>
  );
}
