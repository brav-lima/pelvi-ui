import { cn } from '@/lib/utils';
import { AppointmentStatus, FinancialStatus } from '@/types/clinic';

interface StatusBadgeProps {
  status: AppointmentStatus | FinancialStatus;
  className?: string;
}

const statusLabels: Record<AppointmentStatus | FinancialStatus, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  canceled: 'Cancelado',
  done: 'Concluído',
  paid: 'Pago',
  pending: 'Pendente',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        status === 'scheduled' && 'status-scheduled',
        status === 'confirmed' && 'status-confirmed',
        status === 'canceled' && 'status-canceled',
        status === 'done' && 'status-done',
        status === 'paid' && 'status-confirmed',
        status === 'pending' && 'status-pending',
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
