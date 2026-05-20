import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Users, UserCog, FileText, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';
import { organizationApi, subscriptionApi } from '@/lib/api';
import type { Plan, PlanUsage, SubscriptionData } from '@/types/clinic';

// ── helpers ──────────────────────────────────────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  AGENDA:               'Agenda',
  PATIENTS:             'Gestão de Pacientes',
  FINANCIAL_BASIC:      'Financeiro Básico',
  FINANCIAL_ADVANCED:   'Financeiro Avançado',
  PERINEAL_ASSESSMENT:  'Avaliação Perineal',
  TREATMENT_PACKAGES:   'Pacotes de Tratamento',
  ANAMNESIS:            'Avaliação (Anamnese)',
  EVOLUTIONS:           'Evoluções Clínicas',
  ROLES:                'Perfis de Acesso',
  MULTI_PROFESSIONAL:   'Multi-Profissional',
  MULTI_CLINIC:         'Multi-Clínica',
  PRIORITY_SUPPORT:     'Suporte Prioritário',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

const STATUS_LABEL: Record<string, string> = {
  TRIAL: 'Período de teste',
  ACTIVE: 'Ativo',
  PAST_DUE: 'Pagamento pendente',
  CANCELED: 'Cancelado',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'soft-success'> = {
  TRIAL: 'secondary',
  ACTIVE: 'soft-success',
  PAST_DUE: 'destructive',
  CANCELED: 'destructive',
};

// ── sub-components ────────────────────────────────────────────────────────────

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

function PlanCard({
  plan,
  isCurrent,
  onSelect,
  isLoading,
}: {
  plan: Plan;
  isCurrent: boolean;
  onSelect: () => void;
  isLoading: boolean;
}) {
  const features = Array.isArray(plan.features) ? plan.features : [];

  return (
    <div
      className={`relative rounded-xl border p-5 flex flex-col gap-4 transition-colors ${
        isCurrent
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50'
      }`}
    >
      {isCurrent && (
        <span className="absolute top-3 right-3">
          <Badge variant="soft-success" className="text-xs">Plano atual</Badge>
        </span>
      )}

      <div>
        <p className="font-semibold text-base">{plan.name}</p>
        <p className="text-2xl font-bold mt-1">
          {formatCurrency(plan.priceMonthly)}
          <span className="text-sm font-normal text-muted-foreground">/mês</span>
        </p>
      </div>

      <ul className="space-y-1.5 text-sm text-muted-foreground flex-1">
        <li className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          {plan.maxPatients == null ? 'Pacientes ilimitados' : `Até ${plan.maxPatients} pacientes`}
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          {plan.maxUsers == null ? 'Usuários ilimitados' : `Até ${plan.maxUsers} usuários`}
        </li>
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            {FEATURE_LABELS[f] ?? f}
          </li>
        ))}
      </ul>

      {!isCurrent && (
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-1"
          onClick={onSelect}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Selecionar plano'}
        </Button>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function Settings() {
  const queryClient = useQueryClient();

  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const usageQuery = useQuery<PlanUsage>({
    queryKey: ['plan-usage'],
    queryFn: organizationApi.getPlanUsage,
  });

  const subscriptionQuery = useQuery<SubscriptionData>({
    queryKey: ['subscription'],
    queryFn: subscriptionApi.getCurrent,
    retry: false,
  });

  const plansQuery = useQuery<Plan[]>({
    queryKey: ['subscription-plans'],
    queryFn: subscriptionApi.getPlans,
    retry: false,
  });

  const changePlanMutation = useMutation({
    mutationFn: (planId: string) => subscriptionApi.changePlan(planId),
    onSuccess: (_, planId) => {
      const plan = plansQuery.data?.find((p) => p.id === planId);
      toast.success(`Plano alterado para ${plan?.name ?? 'novo plano'}`);
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['plan-usage'] });
      setPendingPlanId(null);
    },
    onError: () => {
      toast.error('Erro ao alterar plano. Tente novamente.');
      setPendingPlanId(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: subscriptionApi.cancel,
    onSuccess: (data) => {
      toast.success(`Assinatura cancelada. Acesso mantido até ${formatDate(data.endDate)}.`);
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      setShowCancelDialog(false);
    },
    onError: () => {
      toast.error('Erro ao cancelar assinatura. Tente novamente.');
    },
  });

  const usage = usageQuery.data;
  const sub = subscriptionQuery.data?.subscription ?? null;
  const plans = plansQuery.data ?? [];
  const isCanceled = sub?.status === 'CANCELED';
  const canManage = sub !== null && !isCanceled;

  const pendingPlan = plans.find((p) => p.id === pendingPlanId);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader
        title="Opções"
        description="Informações do contrato e limites do plano."
      />

      {/* ── Assinatura atual ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Assinatura
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {subscriptionQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando...
            </div>
          ) : sub ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={STATUS_VARIANT[sub.status] ?? 'secondary'}>
                  {STATUS_LABEL[sub.status] ?? sub.status}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Plano</span>
                <span className="font-medium">{sub.plan.name}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Valor</span>
                <span>{formatCurrency(sub.plan.priceMonthly)}/mês</span>
              </div>

              {sub.trialEndsAt && sub.status === 'TRIAL' && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Período de teste até</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {formatDate(sub.trialEndsAt)}
                  </span>
                </div>
              )}

              {sub.endDate && isCanceled && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Acesso até</span>
                  <span className="text-muted-foreground">{formatDate(sub.endDate)}</span>
                </div>
              )}

              {canManage && (
                <div className="pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 px-0"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Cancelar assinatura
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma assinatura encontrada. Entre em contato com o suporte.
            </p>
          )}

          {/* Uso do plano */}
          {usageQuery.data && (
            <>
              <div className="border-t pt-4 space-y-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Uso do plano
                </p>
                <UsageLine
                  icon={Users}
                  label="Pacientes"
                  current={usage?.currentPatients ?? 0}
                  max={usage?.planMaxPatients ?? null}
                />
                <UsageLine
                  icon={UserCog}
                  label="Usuários"
                  current={usage?.currentUsers ?? 0}
                  max={usage?.planMaxUsers ?? null}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Planos disponíveis ───────────────────────────────────────────── */}
      {canManage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Planos disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {plansQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando planos...
              </div>
            ) : plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum plano disponível no momento.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isCurrent={plan.id === sub?.plan.id}
                    onSelect={() => setPendingPlanId(plan.id)}
                    isLoading={changePlanMutation.isPending && pendingPlanId === plan.id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Dialog: confirmar mudança de plano ──────────────────────────── */}
      <Dialog open={pendingPlanId !== null} onOpenChange={() => setPendingPlanId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar mudança de plano</DialogTitle>
            <DialogDescription>
              Você está alterando para o plano{' '}
              <span className="font-semibold text-foreground">{pendingPlan?.name}</span>
              {pendingPlan && (
                <> por <span className="font-semibold text-foreground">{formatCurrency(pendingPlan.priceMonthly)}/mês</span></>
              )}
              . A mudança entra em vigor imediatamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPlanId(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => pendingPlanId && changePlanMutation.mutate(pendingPlanId)}
              disabled={changePlanMutation.isPending}
            >
              {changePlanMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: confirmar cancelamento ──────────────────────────────── */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Cancelar assinatura
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-1">
              <span className="block">
                Tem certeza que deseja cancelar sua assinatura? Você ainda terá acesso por{' '}
                <span className="font-semibold text-foreground">30 dias</span> após a confirmação.
              </span>
              <span className="block text-destructive/80">
                Após esse período, o acesso será suspenso pela equipe Pelvi.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Manter assinatura
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
