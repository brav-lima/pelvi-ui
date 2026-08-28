import { useEffect, useState } from 'react';
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
import { financialApi } from '@/lib/api';
import { maskCurrency, parseCurrency, formatCurrency } from '@/lib/formatters';
import type { FinancialRecord } from '@/types/clinic';

interface FinancialEditDialogProps {
  record: FinancialRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function FinancialEditDialog({ record, open, onOpenChange, onSuccess }: FinancialEditDialogProps) {
  const [description, setDescription] = useState(record.description ?? '');
  const [amount, setAmount] = useState(formatCurrency(record.amount));
  const [status, setStatus] = useState(record.status);
  const [paymentMethod, setPaymentMethod] = useState(record.paymentMethod ?? '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setDescription(record.description ?? '');
      setAmount(formatCurrency(record.amount));
      setStatus(record.status);
      setPaymentMethod(record.paymentMethod ?? '');
    }
  }, [open, record]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await financialApi.update(record.id, {
        description: description || undefined,
        amount: parseCurrency(amount),
        status,
        paymentMethod: paymentMethod || undefined,
      });
      toast.success('Registro atualizado com sucesso');
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao atualizar registro financeiro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Registro Financeiro</DialogTitle>
          <DialogDescription>Atualize os dados do registro.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-description">Descrição</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Valor (R$)</Label>
              <Input
                id="edit-amount"
                value={amount}
                onChange={(e) => setAmount(maskCurrency(e.target.value))}
                inputMode="decimal"
                className="tabular-nums"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'PENDING' | 'PAID')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="PAID">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Método de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                <SelectItem value="CARTAO_CREDITO">Cartão Crédito</SelectItem>
                <SelectItem value="CARTAO_DEBITO">Cartão Débito</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" loading={loading} onClick={handleSubmit}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
