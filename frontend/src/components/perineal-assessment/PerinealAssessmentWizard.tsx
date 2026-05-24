import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { perinealAssessmentsApi, ApiError } from '@/lib/api';
import type { PerinealAssessment } from '@/types/clinic';
import {
  perinealAssessmentSchema,
  STEP_TITLES,
  type PerinealAssessmentFormData,
} from './schema';
import { ReadOnlyContext } from './ReadOnlyContext';
import { Step1InspecaoEstatica } from './steps/Step1InspecaoEstatica';
import { Step2InspecaoDinamica } from './steps/Step2InspecaoDinamica';
import { Step3TestesNeurologicos } from './steps/Step3TestesNeurologicos';
import { Step4PalpacaoEstatica } from './steps/Step4PalpacaoEstatica';
import { Step5PalpacaoDinamica } from './steps/Step5PalpacaoDinamica';
import { Step6Diagnostico } from './steps/Step6Diagnostico';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  patientId: string;
  assessment?: PerinealAssessment;
  readOnly?: boolean;
}

const TOTAL_STEPS = STEP_TITLES.length;

const EMPTY_DEFAULTS: PerinealAssessmentFormData = {};

export function PerinealAssessmentWizard({
  open,
  onOpenChange,
  onSuccess,
  patientId,
  assessment,
  readOnly = false,
}: Props) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const isEditing = !!assessment;

  const form = useForm<PerinealAssessmentFormData>({
    resolver: zodResolver(perinealAssessmentSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    setStep(0);
    if (assessment?.data && typeof assessment.data === 'object') {
      form.reset(assessment.data as PerinealAssessmentFormData);
    } else {
      form.reset(EMPTY_DEFAULTS);
    }
  }, [open, assessment, form]);

  const StepComponent = useMemo(() => {
    switch (step) {
      case 0: return Step1InspecaoEstatica;
      case 1: return Step2InspecaoDinamica;
      case 2: return Step3TestesNeurologicos;
      case 3: return Step4PalpacaoEstatica;
      case 4: return Step5PalpacaoDinamica;
      case 5: return Step6Diagnostico;
      default: return Step1InspecaoEstatica;
    }
  }, [step]);

  const isLast = step === TOTAL_STEPS - 1;
  const progressValue = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  const handleNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = async (formData: PerinealAssessmentFormData) => {
    setLoading(true);
    try {
      if (isEditing) {
        await perinealAssessmentsApi.update(assessment.id, { data: formData });
        toast.success('Avaliação perineal atualizada com sucesso');
      } else {
        await perinealAssessmentsApi.create({ patientId, data: formData });
        toast.success('Avaliação perineal registrada com sucesso');
      }
      onSuccess();
      onOpenChange(false);
      form.reset(EMPTY_DEFAULTS);
      setStep(0);
    } catch (err) {
      if (err instanceof ApiError && err.status === 408) {
        toast.warning('Tempo limite excedido. Verifique se a avaliação foi registrada antes de tentar novamente.');
        onSuccess();
        onOpenChange(false);
        form.reset(EMPTY_DEFAULTS);
        setStep(0);
      } else {
        toast.error('Erro ao salvar avaliação perineal');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {readOnly ? 'Visualizar Avaliação Perineal' : isEditing ? 'Editar Avaliação Perineal' : 'Nova Avaliação Perineal'}
          </DialogTitle>
          <DialogDescription>
            Avaliação Cinesiológico-Funcional da Musculatura do Assoalho Pélvico
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="border-destructive/50 shrink-0">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="font-semibold">
            NUNCA UTILIZAR EM CASO DE DOR
          </AlertDescription>
        </Alert>

        <div className="space-y-2 shrink-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{STEP_TITLES[step]}</span>
            <span>
              Etapa {step + 1} de {TOTAL_STEPS}
            </span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 gap-4">
          <div className="flex-1 overflow-y-auto">
            <ReadOnlyContext.Provider value={readOnly}>
              <StepComponent form={form} />
            </ReadOnlyContext.Provider>
          </div>

          <DialogFooter className="gap-2 sm:justify-between sm:flex-row flex-col-reverse shrink-0 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {readOnly ? 'Fechar' : 'Cancelar'}
            </Button>
            <div className="flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={step === 0 || loading}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
              {!isLast && (
                <Button type="button" onClick={handleNext} disabled={loading}>
                  Próximo
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              {isLast && !readOnly && (
                <Button type="submit" loading={loading}>
                  {isEditing ? 'Salvar alterações' : 'Registrar avaliação'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
