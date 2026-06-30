import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO, addDays, addWeeks, addMonths } from 'date-fns';
import { Plus } from 'lucide-react';
import type { Appointment, Patient } from '@/types/clinic';
import { PatientFormDialog } from '@/components/patients/PatientFormDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { appointmentsApi, patientsApi, professionalsApi, proceduresApi, treatmentPackagesApi, ApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { isSlotBlocked, getBusinessHourForDate, type BusinessHour } from '@/lib/business-hours';
import { RecurrenceConflictDialog, type ConflictItem, type ConflictResolution } from './RecurrenceConflictDialog';

export function generateRecurrenceDates(
  base: Date,
  pattern: 'daily' | 'weekly' | 'monthly',
  repeatCount: number,
): Date[] {
  const dates: Date[] = [];
  for (let i = 1; i <= repeatCount; i++) {
    let next: Date;
    if (pattern === 'daily') next = addDays(base, i);
    else if (pattern === 'weekly') next = addWeeks(base, i);
    else next = addMonths(base, i);
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    dates.push(next);
  }
  return dates;
}

function findNextAvailableDate(date: Date, bh: BusinessHour[]): Date | null {
  for (let i = 1; i <= 14; i++) {
    const candidate = addDays(date, i);
    const rule = getBusinessHourForDate(candidate, bh);
    if (rule?.enabled) return candidate;
  }
  return null;
}

const timeSlots = Array.from({ length: 26 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const min = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${min}`;
});

const appointmentSchema = z.object({
  patientId: z.string().min(1, 'Selecione um paciente'),
  professionalId: z.string().min(1, 'Selecione um profissional'),
  procedureId: z.string().min(1, 'Selecione um procedimento'),
  date: z.string().min(1, 'Selecione a data'),
  time: z.string().min(1, 'Selecione o horário'),
  notes: z.string().optional(),
  repeat: z.boolean().default(false),
  repeatPattern: z.enum(['daily', 'weekly', 'monthly']).optional(),
  repeatCount: z.number().min(1).max(52).optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultDate?: string;
  defaultTime?: string;
  appointment?: Appointment;
  businessHours?: BusinessHour[];
  recurrenceEditScope?: 'single' | 'forward';
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultDate,
  defaultTime,
  appointment,
  businessHours,
  recurrenceEditScope,
}: AppointmentFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [quickPatientOpen, setQuickPatientOpen] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState<ConflictItem[]>([]);
  const [pendingDates, setPendingDates] = useState<Date[]>([]);
  const [pendingFormData, setPendingFormData] = useState<AppointmentFormData | null>(null);
  const queryClient = useQueryClient();

  const isEditMode = !!appointment;

  const { data: patientsData } = useQuery({
    queryKey: ['patients-select'],
    queryFn: () => patientsApi.list({ page: 1, limit: 100 }),
    enabled: open,
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals'],
    queryFn: professionalsApi.list,
    enabled: open,
  });

  const { data: procedures = [] } = useQuery({
    queryKey: ['procedures'],
    queryFn: proceduresApi.list,
    enabled: open,
  });

  const patients = patientsData?.data ?? [];
  const activeProfessionals = professionals.filter((p) => p.active);
  const activeProcedures = procedures.filter((p) => p.active);

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: '',
      professionalId: '',
      procedureId: '',
      date: '',
      time: '',
      notes: '',
      repeat: false,
      repeatPattern: 'daily',
      repeatCount: 1,
    },
  });

  useEffect(() => {
    if (open) {
      if (isEditMode && appointment) {
        form.reset({
          patientId: appointment.patientId,
          professionalId: appointment.professionalId,
          procedureId: appointment.procedureId,
          date: format(parseISO(appointment.startAt), 'yyyy-MM-dd'),
          time: format(parseISO(appointment.startAt), 'HH:mm'),
          notes: appointment.notes ?? '',
          repeat: false,
          repeatPattern: 'daily',
          repeatCount: 1,
        });
        setSelectedPackageId('');
      } else {
        form.reset({
          patientId: '',
          professionalId: '',
          procedureId: '',
          date: defaultDate ?? '',
          time: defaultTime ?? '',
          notes: '',
          repeat: false,
          repeatPattern: 'daily',
          repeatCount: 1,
        });
        setSelectedPackageId('');
      }
    }
    // Re-runs only on open/close. We do not re-populate mid-session if the
    // appointment prop changes while the dialog is already open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const watchPatientId = form.watch('patientId');

  const { data: patientPackages = [] } = useQuery({
    queryKey: ['treatment-packages', watchPatientId, 'active'],
    queryFn: () => treatmentPackagesApi.list({ patientId: watchPatientId, status: 'ACTIVE' }),
    enabled: open && !!watchPatientId,
  });

  const selectedPackage = patientPackages.find((p) => p.id === selectedPackageId);
  const packageProcedureIds = selectedPackage?.procedures?.map((pp) => pp.procedureId) ?? [];

  const filteredProcedures = selectedPackageId
    ? activeProcedures.filter((p) => packageProcedureIds.includes(p.id))
    : activeProcedures;

  const handleQuickPatientSuccess = (patient?: Patient) => {
    queryClient.invalidateQueries({ queryKey: ['patients-select'] });
    if (patient) {
      form.setValue('patientId', patient.id, { shouldValidate: true });
      setSelectedPackageId('');
      form.setValue('procedureId', '');
    }
  };

  const submitSingle = async (data: AppointmentFormData) => {
    const startAt = new Date(`${data.date}T${data.time}:00`).toISOString();
    if (isEditMode && appointment) {
      if (recurrenceEditScope === 'forward') {
        await appointmentsApi.updateRecurrenceForward(appointment.id, {
          patientId: data.patientId,
          professionalId: data.professionalId,
          procedureId: data.procedureId,
          startAt,
          notes: data.notes || undefined,
        });
        toast.success('Série de agendamentos atualizada');
      } else {
        await appointmentsApi.update(appointment.id, {
          patientId: data.patientId,
          professionalId: data.professionalId,
          procedureId: data.procedureId,
          startAt,
          notes: data.notes || undefined,
        });
        toast.success('Agendamento atualizado com sucesso');
      }
    } else {
      await appointmentsApi.create({
        patientId: data.patientId,
        professionalId: data.professionalId,
        procedureId: data.procedureId,
        startAt,
        notes: data.notes || undefined,
        treatmentPackageId: selectedPackageId || undefined,
      });
      toast.success('Agendamento criado com sucesso');
    }
    onSuccess();
    onOpenChange(false);
    form.reset();
    setSelectedPackageId('');
  };

  const submitBulk = async (data: AppointmentFormData, resolvedDates: Date[]) => {
    const recurrenceGroupId = crypto.randomUUID();
    await appointmentsApi.createBulk({
      recurrenceGroupId,
      appointments: resolvedDates.map((date, i) => ({
        patientId: data.patientId,
        professionalId: data.professionalId,
        procedureId: data.procedureId,
        startAt: date.toISOString(),
        notes: data.notes || undefined,
        treatmentPackageId: selectedPackageId || undefined,
        recurrenceIndex: i,
      })),
    });
    toast.success(`${resolvedDates.length} agendamentos criados com sucesso`);
    onSuccess();
    onOpenChange(false);
    form.reset();
    setSelectedPackageId('');
  };

  const onSubmit = async (data: AppointmentFormData) => {
    setLoading(true);
    setError('');

    try {
      if (!isEditMode && data.repeat && data.repeatCount && data.repeatPattern) {
        const baseDate = new Date(`${data.date}T${data.time}:00`);
        const allDates = [baseDate, ...generateRecurrenceDates(baseDate, data.repeatPattern, data.repeatCount)];

        const conflictItems: ConflictItem[] = [];
        const skippedNoNext: Date[] = [];

        for (const d of allDates) {
          const blocked = businessHours ? isSlotBlocked(data.time, d, businessHours) : false;
          if (blocked) {
            const next = businessHours ? findNextAvailableDate(d, businessHours) : null;
            if (next) {
              conflictItems.push({ date: d, nextAvailableDate: next });
            } else {
              skippedNoNext.push(d);
            }
          }
        }

        const validDates = allDates.filter((d) => !skippedNoNext.includes(d));

        if (conflictItems.length > 0) {
          setPendingConflicts(conflictItems);
          setPendingDates(validDates);
          setPendingFormData(data);
          setConflictDialogOpen(true);
          return;
        }

        if (validDates.length === 0) {
          toast.error('Nenhuma data disponível no período selecionado');
          setLoading(false);
          return;
        }

        await submitBulk(data, validDates);
        return;
      }

      await submitSingle(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Conflito de horário');
        setError('Já existe um agendamento neste período para este profissional.');
      } else if (err instanceof ApiError && err.status === 408) {
        toast.warning(
          isEditMode
            ? 'Tempo limite excedido. Verifique a agenda — o agendamento pode ter sido atualizado.'
            : 'Tempo limite excedido. Verifique a agenda — o agendamento pode ter sido criado.'
        );
        onSuccess();
        onOpenChange(false);
        form.reset();
        setSelectedPackageId('');
      } else {
        toast.error(isEditMode ? 'Erro ao atualizar agendamento' : 'Erro ao criar agendamento');
        setError(isEditMode ? 'Erro ao atualizar agendamento. Tente novamente.' : 'Erro ao criar agendamento. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConflictConfirm = async (resolutions: ConflictResolution[]) => {
    if (!pendingFormData || !pendingDates.length) return;
    setConflictDialogOpen(false);
    setLoading(true);
    setError('');

    try {
      const conflictOriginalDates = new Set(
        pendingConflicts.map((c) => c.date.toISOString()),
      );
      const resolutionMap = new Map(
        resolutions.map((r) => [r.date.toISOString(), r.resolvedDate]),
      );

      const resolvedDates: Date[] = [];
      for (const date of pendingDates) {
        const iso = date.toISOString();
        if (conflictOriginalDates.has(iso)) {
          const resolved = resolutionMap.get(iso);
          if (resolved) {
            const d = new Date(resolved);
            d.setHours(date.getHours(), date.getMinutes(), 0, 0);
            resolvedDates.push(d);
          }
          // undefined = skip this date
        } else {
          resolvedDates.push(date);
        }
      }

      await submitBulk(pendingFormData, resolvedDates);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Conflito de horário em um dos dias resolvidos');
        setError('Conflito de horário detectado. Tente outros dias.');
      } else {
        toast.error('Erro ao criar agendamentos');
        setError('Erro ao criar agendamentos. Tente novamente.');
      }
    } finally {
      setLoading(false);
      setPendingFormData(null);
      setPendingDates([]);
      setPendingConflicts([]);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Altere os dados do agendamento.' : 'Preencha os dados para agendar uma consulta.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="apt-patient">Paciente *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto py-0 px-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setQuickPatientOpen(true)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Novo paciente
              </Button>
            </div>
            <Select
              value={form.watch('patientId') || ''}
              onValueChange={(v) => {
                form.setValue('patientId', v, { shouldValidate: true });
                setSelectedPackageId('');
                form.setValue('procedureId', '');
              }}
            >
              <SelectTrigger
                id="apt-patient"
                error={!!form.formState.errors.patientId}
                aria-describedby={form.formState.errors.patientId ? 'apt-patient-error' : undefined}
              >
                <SelectValue placeholder="Selecione um paciente" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.patientId && (
              <p id="apt-patient-error" className="text-sm text-destructive">{form.formState.errors.patientId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="apt-professional">Profissional *</Label>
            <Select
              value={form.watch('professionalId') || ''}
              onValueChange={(v) => form.setValue('professionalId', v, { shouldValidate: true })}
            >
              <SelectTrigger
                id="apt-professional"
                error={!!form.formState.errors.professionalId}
                aria-describedby={form.formState.errors.professionalId ? 'apt-professional-error' : undefined}
              >
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {activeProfessionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.person.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.professionalId && (
              <p id="apt-professional-error" className="text-sm text-destructive">{form.formState.errors.professionalId.message}</p>
            )}
          </div>

          {/* Package select (only if patient has active packages) */}
          {!isEditMode && watchPatientId && patientPackages.length > 0 && (
            <div className="space-y-2">
              <Label>Pacote de Tratamento</Label>
              <Select
                value={selectedPackageId}
                onValueChange={(v) => {
                  setSelectedPackageId(v === '__none__' ? '' : v);
                  form.setValue('procedureId', '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum (avulso)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum (avulso)</SelectItem>
                  {patientPackages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.totalSessions - pkg.usedSessions} sessões restantes)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="apt-procedure">Procedimento *</Label>
            <Select
              value={form.watch('procedureId') || ''}
              onValueChange={(v) => form.setValue('procedureId', v, { shouldValidate: true })}
            >
              <SelectTrigger
                id="apt-procedure"
                error={!!form.formState.errors.procedureId}
                aria-describedby={form.formState.errors.procedureId ? 'apt-procedure-error' : undefined}
              >
                <SelectValue placeholder="Selecione um procedimento" />
              </SelectTrigger>
              <SelectContent>
                {filteredProcedures.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.durationMinutes}min{!selectedPackageId && ` - R$ ${formatCurrency(p.price)}`})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.procedureId && (
              <p id="apt-procedure-error" className="text-sm text-destructive">{form.formState.errors.procedureId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                error={!!form.formState.errors.date}
                aria-describedby={form.formState.errors.date ? 'date-error' : undefined}
                {...form.register('date')}
              />
              {form.formState.errors.date && (
                <p id="date-error" className="text-sm text-destructive">{form.formState.errors.date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="apt-time">Horário *</Label>
              <Select
                value={form.watch('time') || ''}
                onValueChange={(v) => form.setValue('time', v, { shouldValidate: true })}
              >
                <SelectTrigger
                  id="apt-time"
                  error={!!form.formState.errors.time}
                  aria-describedby={form.formState.errors.time ? 'apt-time-error' : undefined}
                >
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.time && (
                <p id="apt-time-error" className="text-sm text-destructive">{form.formState.errors.time.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" rows={3} placeholder="Observações sobre a consulta..." {...form.register('notes')} />
          </div>

          {!isEditMode && (
            <div className="space-y-3 border-t border-border pt-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="repeat"
                  checked={form.watch('repeat') ?? false}
                  onCheckedChange={(checked) => {
                    form.setValue('repeat', !!checked);
                  }}
                />
                <Label htmlFor="repeat" className="cursor-pointer">Repetir agendamento</Label>
              </div>

              {form.watch('repeat') && (
                <div className="grid grid-cols-2 gap-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="repeatPattern">Padrão</Label>
                    <Select
                      value={form.watch('repeatPattern') ?? 'daily'}
                      onValueChange={(v) => form.setValue('repeatPattern', v as 'daily' | 'weekly' | 'monthly')}
                    >
                      <SelectTrigger id="repeatPattern">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="repeatCount">Repetir (vezes)</Label>
                    <Input
                      id="repeatCount"
                      type="number"
                      min={1}
                      max={52}
                      inputMode="numeric"
                      className="tabular-nums"
                      {...form.register('repeatCount', { valueAsNumber: true })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p role="alert" className="text-sm text-destructive text-center">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              {isEditMode ? 'Salvar' : 'Agendar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <RecurrenceConflictDialog
      open={conflictDialogOpen}
      onOpenChange={setConflictDialogOpen}
      conflicts={pendingConflicts}
      onConfirm={handleConflictConfirm}
    />

    <PatientFormDialog
      open={quickPatientOpen}
      onOpenChange={setQuickPatientOpen}
      onSuccess={handleQuickPatientSuccess}
      mode="quick"
    />
    </>
  );
}
