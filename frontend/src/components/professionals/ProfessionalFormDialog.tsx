import { useState } from 'react';
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
import { toast } from 'sonner';
import { professionalsApi, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { maskCPF, maskPhone } from '@/lib/formatters';

interface ProfessionalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = 'cpf' | 'existing' | 'new';

const onlyDigits = (value: string) => value.replace(/\D/g, '');
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function ProfessionalFormDialog({ open, onOpenChange, onSuccess }: ProfessionalFormDialogProps) {
  const { selectedClinic } = useAuth();

  const [step, setStep] = useState<Step>('cpf');
  const [loading, setLoading] = useState(false);
  const [cpf, setCpf] = useState('');
  const [masked, setMasked] = useState<{ name: string; email: string } | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setStep('cpf');
    setLoading(false);
    setCpf('');
    setMasked(null);
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setRole('');
    setErrors({});
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const handleLookup = async () => {
    if (onlyDigits(cpf).length !== 11) {
      setErrors({ cpf: 'CPF inválido' });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const result = await professionalsApi.lookup(onlyDigits(cpf));
      if (result.exists) {
        setMasked({ name: result.maskedName ?? '', email: result.maskedEmail ?? '' });
        setStep('existing');
      } else {
        setStep('new');
      }
    } catch {
      toast.error('Erro ao verificar o CPF');
    } finally {
      setLoading(false);
    }
  };

  const submitInvite = async (payload: Parameters<typeof professionalsApi.invite>[0]) => {
    if (!selectedClinic) return;
    setLoading(true);
    try {
      await professionalsApi.invite(payload);
      toast.success('Profissional vinculado com sucesso');
      onSuccess();
      handleOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
        toast.error(err.message || 'Não foi possível concluir o convite');
      } else {
        toast.error('Erro ao convidar profissional');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExistingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      setErrors({ role: 'Selecione o cargo' });
      return;
    }
    void submitInvite({ cpf: onlyDigits(cpf), role });
  };

  const handleNewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Nome deve ter pelo menos 2 caracteres';
    if (!EMAIL_RE.test(email)) next.email = 'E-mail inválido';
    if (password.length < 6) next.password = 'Senha deve ter no mínimo 6 caracteres';
    if (!role) next.role = 'Selecione o cargo';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    void submitInvite({
      cpf: onlyDigits(cpf),
      role,
      name: name.trim(),
      email,
      phone: onlyDigits(phone) || undefined,
      password,
    });
  };

  const roleSelect = (
    <div className="space-y-2">
      <Label htmlFor="prof-role">Cargo *</Label>
      <Select value={role} onValueChange={(v) => setRole(v)}>
        <SelectTrigger
          id="prof-role"
          error={!!errors.role}
          aria-describedby={errors.role ? 'prof-role-error' : undefined}
        >
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ADMIN">Admin</SelectItem>
          <SelectItem value="PROFESSIONAL">Profissional</SelectItem>
          <SelectItem value="RECEPTIONIST">Recepção</SelectItem>
        </SelectContent>
      </Select>
      {errors.role && (
        <p id="prof-role-error" className="text-sm text-destructive">{errors.role}</p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Convidar profissional</DialogTitle>
          <DialogDescription>
            {step === 'cpf' && 'Informe o CPF do profissional para verificar se ele já possui cadastro.'}
            {step === 'existing' && 'Esta pessoa já possui cadastro. Confirme a identidade e escolha o cargo na clínica.'}
            {step === 'new' && 'Nenhum cadastro encontrado para este CPF. Preencha os dados do novo profissional.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'cpf' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prof-cpf">CPF</Label>
              <Input
                id="prof-cpf"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(maskCPF(e.target.value))}
                error={!!errors.cpf}
                aria-describedby={errors.cpf ? 'prof-cpf-error' : undefined}
                inputMode="numeric"
                className="tabular-nums"
              />
              {errors.cpf && (
                <p id="prof-cpf-error" className="text-sm text-destructive">{errors.cpf}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleLookup} loading={loading}>
                Continuar
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'existing' && (
          <form onSubmit={handleExistingSubmit} className="space-y-4">
            <div className="rounded-lg border border-border p-3 space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Nome: </span>
                <span className="font-medium">{masked?.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">E-mail: </span>
                <span className="font-medium">{masked?.email}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Dados parcialmente ocultos por privacidade.
              </p>
            </div>

            {roleSelect}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('cpf')}>
                Voltar
              </Button>
              <Button type="submit" loading={loading}>
                Vincular
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === 'new' && (
          <form onSubmit={handleNewSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prof-name">Nome *</Label>
              <Input
                id="prof-name"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={!!errors.name}
                aria-describedby={errors.name ? 'prof-name-error' : undefined}
              />
              {errors.name && (
                <p id="prof-name-error" className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prof-email">E-mail *</Label>
                <Input
                  id="prof-email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={!!errors.email}
                  aria-describedby={errors.email ? 'prof-email-error' : undefined}
                />
                {errors.email && (
                  <p id="prof-email-error" className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="prof-phone">Telefone</Label>
                <Input
                  id="prof-phone"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prof-password">Senha *</Label>
                <Input
                  id="prof-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={!!errors.password}
                  aria-describedby={errors.password ? 'prof-password-error' : undefined}
                  autoComplete="new-password"
                />
                {errors.password && (
                  <p id="prof-password-error" className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              {roleSelect}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('cpf')}>
                Voltar
              </Button>
              <Button type="submit" loading={loading}>
                Cadastrar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
