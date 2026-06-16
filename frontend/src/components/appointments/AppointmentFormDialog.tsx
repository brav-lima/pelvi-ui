import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
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
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultDate?: string;
  defaultTime?: string;
  appointment?: Appointment;
}

export function AppointmentFormDialog({ open, onOpenChange, onSuccess, defaultDate, defaultTime, appointment }: AppointmentFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [quickPatientOpen, setQuickPatientOpen] = useState(false);
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

  const onSubmit = async (data: AppointmentFormData) => {
    setLoading(true);
    setError('');

    const startAt = new Date(`${data.date}T${data.time}:00`).toISOString();

    try {
      if (isEditMode && appointment) {
        await appointmentsApi.update(appointment.id, {
          patientId: data.patientId,
          professionalId: data.professionalId,
          procedureId: data.procedureId,
          startAt,
          notes: data.notes || undefined,
        });
        toast.success('Agendamento atualizado com sucesso');
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

    <PatientFormDialog
      open={quickPatientOpen}
      onOpenChange={setQuickPatientOpen}
      onSuccess={handleQuickPatientSuccess}
      mode="quick"
    />
    </>
  );
}
