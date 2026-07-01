import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export interface ConflictItem {
  date: Date;
  nextAvailableDate: Date;
}

export interface ConflictResolution {
  date: Date;
  action: 'reschedule' | 'skip';
  resolvedDate?: Date;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: ConflictItem[];
  onConfirm: (resolutions: ConflictResolution[]) => void;
}

export function RecurrenceConflictDialog({ open, onOpenChange, conflicts, onConfirm }: Props) {
  const [choices, setChoices] = useState<Record<number, 'next' | 'skip'>>(() =>
    Object.fromEntries(conflicts.map((_c, i) => [i, 'next'])),
  );

  const handleConfirm = () => {
    const resolutions: ConflictResolution[] = conflicts.map((c, i) => {
      if (choices[i] === 'next') {
        return { date: c.date, action: 'reschedule', resolvedDate: c.nextAvailableDate };
      }
      return { date: c.date, action: 'skip' };
    });
    onConfirm(resolutions);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Dias com conflito de horário
          </DialogTitle>
          <DialogDescription>
            Alguns dias da série caem em dias que a clínica não atende. Escolha como resolver cada um.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {conflicts.map((conflict, i) => (
            <div key={i} className="rounded-md border border-border p-3 space-y-2">
              <p className="text-sm font-medium">
                {format(conflict.date, "EEEE, dd/MM/yyyy", { locale: ptBR })} — Clínica fechada
              </p>
              <RadioGroup
                value={choices[i]}
                onValueChange={(v) => setChoices((prev) => ({ ...prev, [i]: v as 'next' | 'skip' }))}
                className="space-y-1"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="next" id={`next-${i}`} />
                  <Label htmlFor={`next-${i}`} className="cursor-pointer text-sm">
                    Agendar no próximo dia disponível ({format(conflict.nextAvailableDate, 'dd/MM', { locale: ptBR })})
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="skip" id={`skip-${i}`} />
                  <Label htmlFor={`skip-${i}`} className="cursor-pointer text-sm text-muted-foreground">
                    Pular este dia
                  </Label>
                </div>
              </RadioGroup>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Confirmar e Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
