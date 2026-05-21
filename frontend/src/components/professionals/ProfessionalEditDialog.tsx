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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { professionalsApi } from '@/lib/api';
import type { Professional } from '@/types/clinic';

interface ProfessionalEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  professional: Professional;
}

export function ProfessionalEditDialog({ open, onOpenChange, onSuccess, professional }: ProfessionalEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(professional.role);
  const [specialty, setSpecialty] = useState(professional.specialty ?? '');
  const [professionalRegistration, setProfessionalRegistration] = useState(professional.professionalRegistration ?? '');

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await professionalsApi.update(professional.id, {
        role,
        specialty: specialty || undefined,
        professionalRegistration: professionalRegistration || undefined,
      });
      toast.success('Profissional atualizado com sucesso');
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao atualizar profissional');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Editar Profissional</DialogTitle>
          <DialogDescription>
            Atualize as informações de {professional.person.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Professional['role'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Administrador</SelectItem>
                <SelectItem value="PROFESSIONAL">Profissional</SelectItem>
                <SelectItem value="RECEPTIONIST">Recepcionista</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Especialidade</Label>
            <input
              className="w-full h-9 px-3 rounded-lg bg-background border border-border text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              placeholder="Ex: Fisioterapia pélvica"
              value={specialty}
              onChange={e => setSpecialty(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Registro profissional</Label>
            <input
              className="w-full h-9 px-3 rounded-lg bg-background border border-border text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-mono"
              placeholder="Ex: CREFITO-3 12345"
              value={professionalRegistration}
              onChange={e => setProfessionalRegistration(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
