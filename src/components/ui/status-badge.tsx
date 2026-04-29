import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type {
  AppointmentStatus,
  FinancialStatus,
  FinancialType,
  TreatmentPackageStatus,
} from '@/types/clinic';

/**
 * Union de todos os status de domínio aceitos pelo StatusBadge.
 * Adicionar um novo status ao backend? Inclua-o no type union do domínio
 * (em src/types/clinic.ts) e adicione a entrada correspondente em
 * `STATUS_MAP` aqui — o TS vai cobrar isso em compile-time.
 */
export type DomainStatus =
  | AppointmentStatus
  | FinancialStatus
  | FinancialType
  | TreatmentPackageStatus;

type StatusVariant =
  | 'soft-info'
  | 'soft-success'
  | 'soft-warning'
  | 'soft-destructive'
  | 'soft-muted';

interface StatusConfig {
  label: string;
  variant: StatusVariant;
}

// Single source of truth — colisões entre domínios são resolvidas aqui
// (CANCELED é compartilhado entre Appointment e TreatmentPackage; o label é o mesmo).
const STATUS_MAP: Record<DomainStatus, StatusConfig> = {
  // Appointment
  SCHEDULED: { label: 'Agendado',   variant: 'soft-info' },
  CONFIRMED: { label: 'Confirmado', variant: 'soft-success' },
  CANCELED:  { label: 'Cancelado',  variant: 'soft-destructive' },
  DONE:      { label: 'Concluído',  variant: 'soft-muted' },

  // Treatment package
  ACTIVE:    { label: 'Ativo',      variant: 'soft-success' },
  COMPLETED: { label: 'Concluído',  variant: 'soft-muted' },

  // Financial status
  PENDING:   { label: 'Pendente',   variant: 'soft-warning' },
  PAID:      { label: 'Pago',       variant: 'soft-success' },

  // Financial type
  INCOME:    { label: 'Receita',    variant: 'soft-success' },
  EXPENSE:   { label: 'Despesa',    variant: 'soft-destructive' },
};

interface StatusBadgeProps {
  status: DomainStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status];

  return (
    <Badge variant={config.variant} className={cn(className)}>
      {config.label}
    </Badge>
  );
}
