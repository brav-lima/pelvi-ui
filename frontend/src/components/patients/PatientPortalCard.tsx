import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { patientPortalApi } from '@/lib/api';
import type { PatientTreatmentPlanFeatures } from '@/types/clinic';

interface PatientPortalCardProps {
  patientId: string;
  patientCpf?: string;
}

const FEATURE_LABELS: Record<keyof PatientTreatmentPlanFeatures, string> = {
  diarioMiccional: 'Diário miccional',
  diarioEvacuatorio: 'Diário evacuatório',
  cronometros: 'Cronômetros',
};

export function PatientPortalCard({ patientId, patientCpf }: PatientPortalCardProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['patient-portal', patientId],
    queryFn: () => patientPortalApi.getPortalStatus(patientId),
  });

  const inviteMutation = useMutation({
    mutationFn: () => patientPortalApi.invite(patientId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['patient-portal', patientId] });
      toast.success(res.message);
    },
    onError: () => toast.error('Erro ao enviar convite'),
  });

  const resendMutation = useMutation({
    mutationFn: (linkId: string) => patientPortalApi.resendConsent(linkId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['patient-portal', patientId] });
      toast.success(res.message);
    },
    onError: () => toast.error('Erro ao reenviar solicitação'),
  });

  const updatePlanMutation = useMutation({
    mutationFn: (features: PatientTreatmentPlanFeatures) =>
      patientPortalApi.updatePlan(patientId, features),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-portal', patientId] });
      toast.success('Plano atualizado');
    },
    onError: () => toast.error('Erro ao atualizar plano'),
  });

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          Portal da paciente
        </div>
      </div>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : isError || !data ? null : data.linkStatus === null ? (
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              onClick={() => inviteMutation.mutate()}
              disabled={!patientCpf}
              loading={inviteMutation.isPending}
            >
              Convidar para o app
            </Button>
            {!patientCpf && (
              <p className="text-[12px] text-muted-foreground">
                Cadastre o CPF da paciente para habilitar o convite.
              </p>
            )}
          </div>
        ) : data.linkStatus === 'PENDING_CONSENT' ? (
          <p className="text-[13px] text-muted-foreground">
            Convite/solicitação pendente desde{' '}
            {data.invitedAt && format(new Date(data.invitedAt), 'dd/MM/yyyy')}
          </p>
        ) : data.linkStatus === 'DECLINED' ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-muted-foreground">
              Recusado em {data.confirmedAt && format(new Date(data.confirmedAt), 'dd/MM/yyyy')}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => data.linkId && resendMutation.mutate(data.linkId)}
              loading={resendMutation.isPending}
            >
              Reenviar solicitação
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-muted-foreground">
              Vinculada desde {data.confirmedAt && format(new Date(data.confirmedAt), 'dd/MM/yyyy')}
            </p>
            <div className="flex flex-col gap-2.5 pt-1">
              {(Object.keys(FEATURE_LABELS) as Array<keyof PatientTreatmentPlanFeatures>).map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <label htmlFor={`plan-${key}`} className="text-[13px] text-foreground/80">
                    {FEATURE_LABELS[key]}
                  </label>
                  <Switch
                    id={`plan-${key}`}
                    checked={data.features[key]}
                    disabled={updatePlanMutation.isPending}
                    onCheckedChange={(checked) =>
                      updatePlanMutation.mutate({ ...data.features, [key]: checked })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
