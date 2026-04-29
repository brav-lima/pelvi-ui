import { useState, useEffect } from 'react';
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
import { Loader2, Search } from 'lucide-react';
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
  addressCep: z.string().optional(),
  addressStreet: z.string().optional(),
  addressNumber: z.string().optional(),
  addressComplement: z.string().optional(),
  addressNeighborhood: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
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
  const [cepLoading, setCepLoading] = useState(false);
  const [error, setError] = useState('');
  const isEditing = !!patient;

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: '',
      cpf: '',
      email: '',
      phone: '',
      birthDate: '',
      gender: '',
      addressCep: '',
      addressStreet: '',
      addressNumber: '',
      addressComplement: '',
      addressNeighborhood: '',
      addressCity: '',
      addressState: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: patient?.name ?? '',
        cpf: patient?.cpf ? maskCPF(patient.cpf) : '',
        email: patient?.email ?? '',
        phone: patient?.phone ? maskPhone(patient.phone) : '',
        birthDate: patient?.birthDate ? patient.birthDate.slice(0, 10) : '',
        gender: patient?.gender ?? '',
        addressCep: patient?.addressCep ?? '',
        addressStreet: patient?.addressStreet ?? '',
        addressNumber: patient?.addressNumber ?? '',
        addressComplement: patient?.addressComplement ?? '',
        addressNeighborhood: patient?.addressNeighborhood ?? '',
        addressCity: patient?.addressCity ?? '',
        addressState: patient?.addressState ?? '',
        notes: patient?.notes ?? '',
      });
    }
  }, [open, patient]);

  const handleCepBlur = async () => {
    const cep = form.getValues('addressCep')?.replace(/\D/g, '');
    if (!cep || cep.length !== 8) return;

    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }
      form.setValue('addressStreet', data.logradouro ?? '');
      form.setValue('addressNeighborhood', data.bairro ?? '');
      form.setValue('addressCity', data.localidade ?? '');
      form.setValue('addressState', data.uf ?? '');
    } catch {
      toast.error('Erro ao buscar CEP');
    } finally {
      setCepLoading(false);
    }
  };

  const onSubmit = async (data: PatientFormData) => {
    setLoading(true);
    setError('');

    const cleaned = {
      ...data,
      cpf: data.cpf ? data.cpf.replace(/\D/g, '') : undefined,
      phone: data.phone ? data.phone.replace(/\D/g, '') : undefined,
      addressCep: data.addressCep ? data.addressCep.replace(/\D/g, '') : undefined,
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
    } catch {
      toast.error('Erro ao salvar paciente');
      setError('Erro ao salvar paciente. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Paciente' : 'Novo Paciente'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados do paciente.'
              : 'Preencha os dados para cadastrar um novo paciente.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              error={!!form.formState.errors.name}
              aria-describedby={form.formState.errors.name ? 'name-error' : undefined}
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p id="name-error" className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* CPF + Nascimento */}
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

          {/* Email + Telefone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                error={!!form.formState.errors.email}
                aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p id="email-error" className="text-sm text-destructive">{form.formState.errors.email.message}</p>
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

          {/* Gênero */}
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

          {/* Endereço */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">Endereço</h4>

            {/* CEP */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addressCep">CEP</Label>
                <div className="relative">
                  <Input
                    id="addressCep"
                    placeholder="00000-000"
                    maxLength={9}
                    {...form.register('addressCep')}
                    onBlur={handleCepBlur}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                      form.setValue('addressCep', v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v);
                    }}
                  />
                  {cepLoading && (
                    <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                  {!cepLoading && (
                    <Search className="absolute right-2 top-2.5 w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="addressStreet">Rua / Logradouro</Label>
                <Input id="addressStreet" {...form.register('addressStreet')} />
              </div>
            </div>

            {/* Número + Complemento */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addressNumber">Número</Label>
                <Input id="addressNumber" placeholder="123" {...form.register('addressNumber')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressComplement">Complemento</Label>
                <Input id="addressComplement" placeholder="Apto, Sala..." {...form.register('addressComplement')} />
              </div>
            </div>

            {/* Bairro + Cidade + Estado */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addressNeighborhood">Bairro</Label>
                <Input id="addressNeighborhood" {...form.register('addressNeighborhood')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressCity">Cidade</Label>
                <Input id="addressCity" {...form.register('addressCity')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressState">UF</Label>
                <Input id="addressState" maxLength={2} placeholder="SP" {...form.register('addressState')} />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" rows={3} {...form.register('notes')} />
          </div>

          {error && <p role="alert" className="text-sm text-destructive text-center">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              {isEditing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
