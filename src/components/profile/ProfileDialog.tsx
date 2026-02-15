import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authApi, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { maskPhone } from '@/lib/formatters';

const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'profile' | 'password'>('profile');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Meu Perfil</DialogTitle>
          <DialogDescription>Gerencie suas informações pessoais</DialogDescription>
        </DialogHeader>

        {/* Tab selector */}
        <div className="flex border-b border-border">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'profile'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab('profile')}
          >
            Dados Pessoais
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'password'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab('password')}
          >
            Alterar Senha
          </button>
        </div>

        {tab === 'profile' ? (
          <ProfileForm user={user} onSuccess={() => onOpenChange(false)} />
        ) : (
          <PasswordForm onSuccess={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProfileForm({
  user,
  onSuccess,
}: {
  user: { name: string; email: string | null; cpf: string } | null;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setLoading(true);
    try {
      await authApi.updateProfile({
        name: data.name,
        email: data.email,
        phone: data.phone?.replace(/\D/g, '') || undefined,
      });
      toast.success('Perfil atualizado com sucesso. Faça login novamente para ver as alterações.');
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Email já cadastrado por outro usuário');
      } else {
        toast.error('Erro ao atualizar perfil');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="profile-name">Nome</Label>
        <Input id="profile-name" {...form.register('name')} />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" type="email" {...form.register('email')} />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-phone">Telefone</Label>
        <Input
          id="profile-phone"
          placeholder="(00) 00000-0000"
          value={form.watch('phone') || ''}
          onChange={(e) => form.setValue('phone', maskPhone(e.target.value))}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}

function PasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: PasswordFormData) => {
    setLoading(true);
    try {
      await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Senha alterada com sucesso');
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error('Senha atual incorreta');
      } else {
        toast.error('Erro ao alterar senha');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="current-password">Senha Atual</Label>
        <Input id="current-password" type="password" {...form.register('currentPassword')} />
        {form.formState.errors.currentPassword && (
          <p className="text-sm text-destructive">{form.formState.errors.currentPassword.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">Nova Senha</Label>
        <Input id="new-password" type="password" {...form.register('newPassword')} />
        {form.formState.errors.newPassword && (
          <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
        <Input id="confirm-password" type="password" {...form.register('confirmPassword')} />
        {form.formState.errors.confirmPassword && (
          <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Alterar Senha
        </Button>
      </div>
    </form>
  );
}
