import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { appointmentsApi, patientsApi, professionalsApi, proceduresApi } from '@/lib/api';

const timeSlots = Array.from({ length: 21 }, (_, i) => {
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
}

export function AppointmentFormDialog({ open, onOpenChange, onSuccess }: AppointmentFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const onSubmit = async (data: AppointmentFormData) => {
    setLoading(true);
    setError('');

    const startAt = `${data.date}T${data.time}:00.000Z`;

    try {
      await appointmentsApi.create({
        patientId: data.patientId,
        professionalId: data.professionalId,
        procedureId: data.procedureId,
        startAt,
        notes: data.notes || undefined,
      });
      toast.success('Agendamento criado com sucesso');
      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error('Erro ao criar agendamento');
      setError('Erro ao criar agendamento. Verifique se não há conflito de horário.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
          <DialogDescription>
            Preencha os dados para agendar uma consulta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Paciente *</Label>
            <Select
              value={form.watch('patientId') || ''}
              onValueChange={(v) => form.setValue('patientId', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um paciente" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.patientId && (
              <p className="text-sm text-destructive">{form.formState.errors.patientId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Profissional *</Label>
            <Select
              value={form.watch('professionalId') || ''}
              onValueChange={(v) => form.setValue('professionalId', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {activeProfessionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.person.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.professionalId && (
              <p className="text-sm text-destructive">{form.formState.errors.professionalId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Procedimento *</Label>
            <Select
              value={form.watch('procedureId') || ''}
              onValueChange={(v) => form.setValue('procedureId', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um procedimento" />
              </SelectTrigger>
              <SelectContent>
                {activeProcedures.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.durationMinutes}min - R$ {Number(p.price).toLocaleString('pt-BR')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.procedureId && (
              <p className="text-sm text-destructive">{form.formState.errors.procedureId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data *</Label>
              <Input id="date" type="date" {...form.register('date')} />
              {form.formState.errors.date && (
                <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Horário *</Label>
              <Select
                value={form.watch('time') || ''}
                onValueChange={(v) => form.setValue('time', v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.time && (
                <p className="text-sm text-destructive">{form.formState.errors.time.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" rows={3} placeholder="Observações sobre a consulta..." {...form.register('notes')} />
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Agendar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
