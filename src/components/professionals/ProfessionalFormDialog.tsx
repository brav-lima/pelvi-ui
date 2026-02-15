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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { personsApi, professionalsApi, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { maskCPF, maskPhone } from '@/lib/formatters';

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cpf: z.string().min(14, 'CPF inválido'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  role: z.string().min(1, 'Selecione o cargo'),
});

type FormData = z.infer<typeof schema>;

interface ProfessionalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ProfessionalFormDialog({ open, onOpenChange, onSuccess }: ProfessionalFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const { selectedClinic } = useAuth();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      cpf: '',
      email: '',
      phone: '',
      password: '',
      role: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!selectedClinic) return;
    setLoading(true);

    try {
      // Step 1: Create person
      const person = await personsApi.create({
        cpf: data.cpf.replace(/\D/g, ''),
        name: data.name,
        email: data.email,
        phone: data.phone?.replace(/\D/g, '') || undefined,
        password: data.password,
      });

      // Step 2: Link to organization
      await professionalsApi.addToOrg(selectedClinic.id, {
        personId: person.id,
        role: data.role,
      });

      toast.success('Profissional cadastrado com sucesso');
      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('CPF já cadastrado no sistema');
      } else {
        toast.error('Erro ao cadastrar profissional');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Profissional</DialogTitle>
          <DialogDescription>
            Preencha os dados para cadastrar um novo profissional na clínica.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prof-name">Nome *</Label>
            <Input id="prof-name" placeholder="Nome completo" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prof-cpf">CPF *</Label>
              <Input
                id="prof-cpf"
                placeholder="000.000.000-00"
                value={form.watch('cpf') || ''}
                onChange={(e) => form.setValue('cpf', maskCPF(e.target.value), { shouldValidate: true })}
              />
              {form.formState.errors.cpf && (
                <p className="text-sm text-destructive">{form.formState.errors.cpf.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prof-phone">Telefone</Label>
              <Input
                id="prof-phone"
                placeholder="(00) 00000-0000"
                value={form.watch('phone') || ''}
                onChange={(e) => form.setValue('phone', maskPhone(e.target.value), { shouldValidate: true })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prof-email">Email *</Label>
            <Input id="prof-email" type="email" placeholder="email@exemplo.com" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prof-password">Senha *</Label>
              <Input id="prof-password" type="password" placeholder="Mínimo 6 caracteres" {...form.register('password')} />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Cargo *</Label>
              <Select
                value={form.watch('role') || ''}
                onValueChange={(v) => form.setValue('role', v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="PROFESSIONAL">Profissional</SelectItem>
                  <SelectItem value="RECEPTIONIST">Recepção</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.role && (
                <p className="text-sm text-destructive">{form.formState.errors.role.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
