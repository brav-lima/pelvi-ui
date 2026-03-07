import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users, UserCog, FileText, MessageCircle, Check } from 'lucide-react';
import { organizationApi, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import type { PlanUsage, Organization, Plan } from '@/types/clinic';

function UsageLine({
  icon: Icon,
  label,
  current,
  max,
}: {
  icon: typeof Users;
  label: string;
  current: number;
  max: number | null;
}) {
  const unlimited = max === null;
  const pct = unlimited ? 0 : Math.min(Math.round((current / max) * 100), 100);
  const nearLimit = !unlimited && pct >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="w-4 h-4" />
          {label}
        </span>
        <span className={nearLimit ? 'text-destructive font-medium' : 'text-foreground'}>
          {current}
          {' / '}
          {unlimited ? (
            <span className="text-muted-foreground">Ilimitado</span>
          ) : (
            max
          )}
        </span>
      </div>
      {!unlimited && (
        <Progress
          value={pct}
          className={`h-1.5 ${nearLimit ? '[&>div]:bg-destructive' : ''}`}
        />
      )}
    </div>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: planData, isLoading: planLoading } = useQuery<PlanUsage>({
    queryKey: ['plan-usage'],
    queryFn: organizationApi.getPlanUsage,
  });

  const { data: orgData, isLoading: orgLoading } = useQuery<Organization>({
    queryKey: ['organization-me'],
    queryFn: organizationApi.getMe,
  });

  const { data: availablePlans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ['available-plans'],
    queryFn: organizationApi.getAvailablePlans,
  });

  const settingsMutation = useMutation({
    mutationFn: organizationApi.updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData<Organization>(['organization-me'], updated);
      toast({ title: 'Configuração salva' });
    },
    onError: () => {
      toast({ title: 'Erro ao salvar configuração', variant: 'destructive' });
    },
  });

  const planChangeMutation = useMutation({
    mutationFn: organizationApi.changePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-usage'] });
      queryClient.invalidateQueries({ queryKey: ['organization-me'] });
      toast({ title: 'Plano alterado com sucesso' });
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Erro ao alterar plano';
      toast({ title: message, variant: 'destructive' });
    },
  });

  const isLoading = planLoading || orgLoading;
  const whatsappEnabled = orgData?.settings?.whatsappNotificationsEnabled ?? false;
  const reminderHours = orgData?.settings?.reminderHours;
  const whatsappAllowedByPlan = orgData?.planFeatures?.whatsapp === true;

  function isCurrentPlan(plan: Plan) {
    return (
      planData?.planMaxPatients === plan.maxPatients &&
      planData?.planMaxUsers === plan.maxUsers
    );
  }

  function canDowngrade(plan: Plan) {
    const overPatients =
      planData?.planMaxPatients !== null &&
      plan.maxPatients < (planData?.currentPatients ?? 0);
    const overUsers =
      planData?.planMaxUsers !== null &&
      plan.maxUsers < (planData?.currentUsers ?? 0);
    return !overPatients && !overUsers;
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <PageHeader
        title="Opções"
        description="Informações do contrato e limites do plano."
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Notificações WhatsApp */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Notificações WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Quando ativado, os pacientes recebem mensagens automáticas no WhatsApp ao confirmar ou cancelar um agendamento.
              </p>
              {whatsappAllowedByPlan ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="whatsapp-toggle"
                      checked={whatsappEnabled}
                      disabled={settingsMutation.isPending}
                      onCheckedChange={(checked) =>
                        settingsMutation.mutate({ whatsappNotificationsEnabled: checked })
                      }
                    />
                    <Label htmlFor="whatsapp-toggle" className="text-sm cursor-pointer">
                      {whatsappEnabled ? 'Ativado' : 'Desativado'}
                    </Label>
                    {settingsMutation.isPending && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {whatsappEnabled && (
                    <div className="flex items-center gap-3">
                      <Label className="text-sm text-muted-foreground whitespace-nowrap">
                        Enviar lembrete
                      </Label>
                      <Select
                        value={reminderHours?.toString() ?? ''}
                        disabled={settingsMutation.isPending}
                        onValueChange={(value) =>
                          settingsMutation.mutate({ reminderHours: Number(value) })
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3h antes</SelectItem>
                          <SelectItem value="6">6h antes</SelectItem>
                          <SelectItem value="12">12h antes</SelectItem>
                          <SelectItem value="24">24h antes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Disponível apenas em planos que incluem notificações WhatsApp.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Contrato */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Contrato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status de acesso</span>
                {planData?.accessStatus === 'BLOCKED' ? (
                  <Badge variant="destructive">Suspenso</Badge>
                ) : (
                  <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">
                    Ativo
                  </Badge>
                )}
              </div>

              <div className="space-y-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Uso do plano
                </p>
                <UsageLine
                  icon={Users}
                  label="Pacientes"
                  current={planData?.currentPatients ?? 0}
                  max={planData?.planMaxPatients ?? null}
                />
                <UsageLine
                  icon={UserCog}
                  label="Usuários"
                  current={planData?.currentUsers ?? 0}
                  max={planData?.planMaxUsers ?? null}
                />
              </div>
            </CardContent>
          </Card>

          {/* Planos disponíveis */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Alterar plano</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {plansLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando planos...
                </div>
              ) : availablePlans.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Planos indisponíveis no momento. Tente novamente mais tarde ou entre em contato com o suporte.
                </p>
              ) : (
                availablePlans.map((plan) => {
                  const current = isCurrentPlan(plan);
                  const allowed = canDowngrade(plan);
                  const pending = planChangeMutation.isPending;

                  return (
                    <div
                      key={plan.id}
                      className={`flex items-center justify-between rounded-lg border p-4 ${
                        current ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{plan.name}</p>
                          {current && (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                              Plano atual
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {plan.maxPatients} pacientes · {plan.maxUsers} usuários
                          {plan.priceMonthly > 0
                            ? ` · R$ ${Number(plan.priceMonthly).toFixed(2).replace('.', ',')}/mês`
                            : ''}
                        </p>
                        {!allowed && !current && (
                          <p className="text-xs text-destructive">
                            Reduza pacientes ou usuários antes de fazer downgrade.
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={current ? 'outline' : 'default'}
                        disabled={current || !allowed || pending}
                        onClick={() => planChangeMutation.mutate(plan.id)}
                      >
                        {pending && planChangeMutation.variables === plan.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : current ? (
                          <><Check className="w-3.5 h-3.5 mr-1" />Ativo</>
                        ) : (
                          'Selecionar'
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
