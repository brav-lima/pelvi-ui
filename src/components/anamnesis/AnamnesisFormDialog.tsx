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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { anamnesisApi } from '@/lib/api';
import type { Anamnesis } from '@/types/clinic';

const anamnesisSchema = z.object({
  motivoConsulta: z.string().optional(),
  inicioSintomas: z.string().optional(),
  doencasPreexistentes: z.string().optional(),
  cirurgiasAnteriores: z.string().optional(),
  alergias: z.string().optional(),
  medicacoesEmUso: z.string().optional(),
  atividadeFisica: z.string().optional(),
  alimentacao: z.string().optional(),
  tabagismo: z.string().optional(),
  consumoAlcool: z.string().optional(),
  observacoes: z.string().optional(),
});

type AnamnesisFormData = z.infer<typeof anamnesisSchema>;

interface AnamnesisFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  patientId: string;
  anamnesis?: Anamnesis;
}

function extractField(data: Record<string, unknown>, section: string, field: string): string {
  const sec = data[section];
  if (sec && typeof sec === 'object' && sec !== null) {
    const val = (sec as Record<string, unknown>)[field];
    return val ? String(val) : '';
  }
  return '';
}

export function AnamnesisFormDialog({ open, onOpenChange, onSuccess, patientId, anamnesis }: AnamnesisFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEditing = !!anamnesis;

  const form = useForm<AnamnesisFormData>({
    resolver: zodResolver(anamnesisSchema),
    defaultValues: {
      motivoConsulta: '',
      inicioSintomas: '',
      doencasPreexistentes: '',
      cirurgiasAnteriores: '',
      alergias: '',
      medicacoesEmUso: '',
      atividadeFisica: '',
      alimentacao: '',
      tabagismo: '',
      consumoAlcool: '',
      observacoes: '',
    },
  });

  useEffect(() => {
    if (open) {
      const d = anamnesis?.data ?? {};
      form.reset({
        motivoConsulta: extractField(d, 'Queixa Principal', 'Motivo da Consulta'),
        inicioSintomas: extractField(d, 'Queixa Principal', 'Inicio dos Sintomas'),
        doencasPreexistentes: extractField(d, 'Historico Medico', 'Doencas Preexistentes'),
        cirurgiasAnteriores: extractField(d, 'Historico Medico', 'Cirurgias Anteriores'),
        alergias: extractField(d, 'Historico Medico', 'Alergias'),
        medicacoesEmUso: extractField(d, 'Historico Medico', 'Medicacoes em Uso'),
        atividadeFisica: extractField(d, 'Habitos de Vida', 'Atividade Fisica'),
        alimentacao: extractField(d, 'Habitos de Vida', 'Alimentacao'),
        tabagismo: extractField(d, 'Habitos de Vida', 'Tabagismo'),
        consumoAlcool: extractField(d, 'Habitos de Vida', 'Consumo de Alcool'),
        observacoes: typeof d['Observacoes Gerais'] === 'string' ? d['Observacoes Gerais'] : '',
      });
    }
  }, [open, anamnesis]);

  const onSubmit = async (formData: AnamnesisFormData) => {
    setLoading(true);
    setError('');

    const payload: Record<string, unknown> = {
      'Queixa Principal': {
        'Motivo da Consulta': formData.motivoConsulta || '',
        'Inicio dos Sintomas': formData.inicioSintomas || '',
      },
      'Historico Medico': {
        'Doencas Preexistentes': formData.doencasPreexistentes || '',
        'Cirurgias Anteriores': formData.cirurgiasAnteriores || '',
        'Alergias': formData.alergias || '',
        'Medicacoes em Uso': formData.medicacoesEmUso || '',
      },
      'Habitos de Vida': {
        'Atividade Fisica': formData.atividadeFisica || '',
        'Alimentacao': formData.alimentacao || '',
        'Tabagismo': formData.tabagismo || '',
        'Consumo de Alcool': formData.consumoAlcool || '',
      },
      'Observacoes Gerais': formData.observacoes || '',
    };

    try {
      if (isEditing) {
        await anamnesisApi.update(anamnesis.id, { data: payload });
      } else {
        await anamnesisApi.create({ patientId, data: payload });
      }
      toast.success(isEditing ? 'Avaliação atualizada com sucesso' : 'Avaliação registrada com sucesso');
      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error('Erro ao salvar avaliação');
      setError('Erro ao salvar avaliação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Avaliação' : 'Nova Avaliação'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados da avaliação.'
              : 'Preencha o formulário de avaliação do paciente.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Queixa Principal */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground border-b border-border pb-2">Queixa Principal</h4>
            <div className="space-y-2">
              <Label htmlFor="motivoConsulta">Motivo da Consulta</Label>
              <Textarea id="motivoConsulta" rows={2} {...form.register('motivoConsulta')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inicioSintomas">Inicio dos Sintomas</Label>
              <Input id="inicioSintomas" {...form.register('inicioSintomas')} />
            </div>
          </div>

          {/* Historico Medico */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground border-b border-border pb-2">Histórico Médico</h4>
            <div className="space-y-2">
              <Label htmlFor="doencasPreexistentes">Doenças Preexistentes</Label>
              <Textarea id="doencasPreexistentes" rows={2} {...form.register('doencasPreexistentes')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cirurgiasAnteriores">Cirurgias Anteriores</Label>
              <Input id="cirurgiasAnteriores" {...form.register('cirurgiasAnteriores')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="alergias">Alergias</Label>
                <Input id="alergias" {...form.register('alergias')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medicacoesEmUso">Medicações em Uso</Label>
                <Input id="medicacoesEmUso" {...form.register('medicacoesEmUso')} />
              </div>
            </div>
          </div>

          {/* Habitos de Vida */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground border-b border-border pb-2">Hábitos de Vida</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="atividadeFisica">Atividade Física</Label>
                <Input id="atividadeFisica" {...form.register('atividadeFisica')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alimentacao">Alimentação</Label>
                <Input id="alimentacao" {...form.register('alimentacao')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tabagismo">Tabagismo</Label>
                <Input id="tabagismo" placeholder="Sim/Não" {...form.register('tabagismo')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consumoAlcool">Consumo de Alcool</Label>
                <Input id="consumoAlcool" placeholder="Não/Ocasional/Frequente" {...form.register('consumoAlcool')} />
              </div>
            </div>
          </div>

          {/* Observacoes */}
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground border-b border-border pb-2">Observações Gerais</h4>
            <Textarea id="observacoes" rows={3} {...form.register('observacoes')} />
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Salvar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
