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
import { Loader2 } from 'lucide-react';
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

  const handleSubmit = async () => {
    if (role === professional.role) {
      onOpenChange(false);
      return;
    }
    setLoading(true);
    try {
      await professionalsApi.update(professional.id, { role });
      toast.success('Cargo atualizado com sucesso');
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao atualizar cargo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Editar Cargo</DialogTitle>
          <DialogDescription>
            Altere o cargo de {professional.person.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label>Cargo</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Professional['role'])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="PROFESSIONAL">Profissional</SelectItem>
              <SelectItem value="RECEPTIONIST">Recepção</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
