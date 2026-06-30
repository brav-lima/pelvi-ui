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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scope: 'single' | 'forward') => void;
}

export function RecurrenceScopeDialog({ open, onOpenChange, onConfirm }: Props) {
  const [scope, setScope] = useState<'single' | 'forward'>('single');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Editar agendamento recorrente</DialogTitle>
          <DialogDescription>
            Este agendamento faz parte de uma série. Qual alteração deseja aplicar?
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={scope}
          onValueChange={(v) => setScope(v as 'single' | 'forward')}
          className="space-y-3 py-2"
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem value="single" id="scope-single" className="mt-0.5" />
            <Label htmlFor="scope-single" className="cursor-pointer space-y-0.5">
              <span className="text-sm font-medium">Somente este agendamento</span>
              <p className="text-xs text-muted-foreground">Apenas este será alterado.</p>
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="forward" id="scope-forward" className="mt-0.5" />
            <Label htmlFor="scope-forward" className="cursor-pointer space-y-0.5">
              <span className="text-sm font-medium">Este e todos os seguintes</span>
              <p className="text-xs text-muted-foreground">Este e os próximos da série serão alterados.</p>
            </Label>
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => onConfirm(scope)}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
