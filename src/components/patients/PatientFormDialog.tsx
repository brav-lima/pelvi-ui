import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { patientsApi } from '@/lib/api';
import { maskCPF, maskPhone } from '@/lib/formatters';
import type { Patient } from '@/types/clinic';

const patientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cpf: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface PatientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  patient?: Patient;
}

export function PatientFormDialog({ open, onOpenChange, onSuccess, patient }: PatientFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEditing = !!patient;

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: patient?.name ?? '',
      cpf: patient?.cpf ? maskCPF(patient.cpf) : '',
      email: patient?.email ?? '',
      phone: patient?.phone ? maskPhone(patient.phone) : '',
      birthDate: patient?.birthDate ? patient.birthDate.slice(0, 10) : '',
      gender: patient?.gender ?? '',
      address: patient?.address ?? '',
      notes: patient?.notes ?? '',
    },
  });

  const onSubmit = async (data: PatientFormData) => {
    setLoading(true);
    setError('');

    // Strip masks and clean empty strings
    const cleaned = {
      ...data,
      cpf: data.cpf ? data.cpf.replace(/\D/g, '') : undefined,
      phone: data.phone ? data.phone.replace(/\D/g, '') : undefined,
    };
    const payload = Object.fromEntries(
      Object.entries(cleaned).filter(([, v]) => v !== '' && v !== undefined),
    );

    try {
      if (isEditing) {
        await patientsApi.update(patient.id, payload);
      } else {
        await patientsApi.create({ ...payload, name: data.name });
      }
      toast.success(isEditing ? 'Paciente atualizado com sucesso' : 'Paciente cadastrado com sucesso');
      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error('Erro ao salvar paciente');
      setError('Erro ao salvar paciente. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Paciente' : 'Novo Paciente'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados do paciente.'
              : 'Preencha os dados para cadastrar um novo paciente.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={form.watch('cpf') || ''}
                onChange={(e) => form.setValue('cpf', maskCPF(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate">Data de Nascimento</Label>
              <Input id="birthDate" type="date" {...form.register('birthDate')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                placeholder="(00) 00000-0000"
                value={form.watch('phone') || ''}
                onChange={(e) => form.setValue('phone', maskPhone(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gênero</Label>
            <Select
              value={form.watch('gender') || ''}
              onValueChange={(v) => form.setValue('gender', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="F">Feminino</SelectItem>
                <SelectItem value="O">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" {...form.register('address')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" rows={3} {...form.register('notes')} />
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
