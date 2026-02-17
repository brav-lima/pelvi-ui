import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; style: string }> = {
  // Appointment statuses (uppercase from backend)
  SCHEDULED: { label: 'Agendado', style: 'status-scheduled' },
  CONFIRMED: { label: 'Confirmado', style: 'status-confirmed' },
  CANCELED: { label: 'Cancelado', style: 'status-canceled' },
  DONE: { label: 'Concluido', style: 'status-done' },
  // Treatment package statuses
  ACTIVE: { label: 'Ativo', style: 'status-confirmed' },
  COMPLETED: { label: 'Concluído', style: 'status-done' },
  // Financial statuses
  PENDING: { label: 'Pendente', style: 'status-pending' },
  PAID: { label: 'Pago', style: 'status-confirmed' },
  // Financial types
  INCOME: { label: 'Receita', style: 'status-confirmed' },
  EXPENSE: { label: 'Despesa', style: 'status-canceled' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, style: '' };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.style,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
