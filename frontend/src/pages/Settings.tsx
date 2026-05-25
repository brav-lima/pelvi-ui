import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Loader2, Users, UserCog, CheckCircle2, AlertTriangle,
  Building2, Clock, UsersRound, CreditCard, Bell, Plug, ShieldCheck,
} from 'lucide-react';
import { organizationApi, subscriptionApi, professionalsApi } from '@/lib/api';
import type { OrganizationProfile, Plan, PlanUsage, SubscriptionData } from '@/types/clinic';

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
  DOCUMENTS:            'Módulo de Documentos',
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

function UsageLine({ icon: Icon, label, current, max }: {
  icon: typeof Users; label: string; current: number; max: number | null;
}) {
  const unlimited = max === null;
  const pct = unlimited ? 0 : Math.min(Math.round((current / max) * 100), 100);
  const nearLimit = !unlimited && pct >= 80;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[13px]">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="w-3.5 h-3.5" />{label}
        </span>
        <span className={nearLimit ? 'text-destructive font-medium' : ''}>
          {current}{' / '}
          {unlimited ? <span className="text-muted-foreground">Ilimitado</span> : max}
        </span>
      </div>
      {!unlimited && (
        <Progress value={pct} className={`h-1.5 ${nearLimit ? '[&>div]:bg-destructive' : ''}`} />
      )}
    </div>
  );
}

function PlanCard({ plan, isCurrent, onSelect, isLoading }: {
  plan: Plan; isCurrent: boolean; onSelect: () => void; isLoading: boolean;
}) {
  const features = Array.isArray(plan.features) ? plan.features : [];
  return (
    <div className={`relative rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
      isCurrent ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
    }`}>
      {isCurrent && (
        <span className="absolute top-3 right-3">
          <Badge variant="soft-success" className="text-[11px]">Plano atual</Badge>
        </span>
      )}
      <div>
        <p className="font-semibold text-[13.5px]">{plan.name}</p>
        <p className="text-[22px] font-bold mt-0.5" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}>
          {formatCurrency(plan.priceMonthly)}
          <span className="text-[12px] font-normal text-muted-foreground">/mês</span>
        </p>
      </div>
      <ul className="space-y-1 text-[12.5px] text-muted-foreground flex-1">
        <li className="flex items-center gap-2">
          <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
          {plan.maxPatients == null ? 'Pacientes ilimitados' : `Até ${plan.maxPatients} pacientes`}
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
          {plan.maxUsers == null ? 'Usuários ilimitados' : `Até ${plan.maxUsers} usuários`}
        </li>
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
            {FEATURE_LABELS[f] ?? f}
          </li>
        ))}
      </ul>
      {!isCurrent && (
        <Button size="sm" variant="outline" className="w-full mt-1 h-8 text-[12.5px]" onClick={onSelect} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Selecionar plano'}
        </Button>
      )}
    </div>
  );
}

const NAV_SECTIONS = [
  { id: 'clinic',   label: 'Dados da clínica',         icon: Building2 },
  { id: 'hours',    label: 'Horário de funcionamento',  icon: Clock },
  { id: 'team',     label: 'Equipe e permissões',       icon: UsersRound },
  { id: 'plan',     label: 'Plano e cobrança',          icon: CreditCard },
  { id: 'notif',    label: 'Notificações',              icon: Bell },
  { id: 'integ',    label: 'Integrações',               icon: Plug },
  { id: 'security', label: 'Segurança',                 icon: ShieldCheck },
];

const DAYS_MAP = [
  { key: 'MONDAY',    label: 'Segunda-feira' },
  { key: 'TUESDAY',   label: 'Terça-feira' },
  { key: 'WEDNESDAY', label: 'Quarta-feira' },
  { key: 'THURSDAY',  label: 'Quinta-feira' },
  { key: 'FRIDAY',    label: 'Sexta-feira' },
  { key: 'SATURDAY',  label: 'Sábado' },
  { key: 'SUNDAY',    label: 'Domingo' },
];

const HOURS_DEFAULT = [
  { day: 'Segunda-feira', from: '08:00', to: '19:00', on: true },
  { day: 'Terça-feira',   from: '08:00', to: '19:00', on: true },
  { day: 'Quarta-feira',  from: '08:00', to: '19:00', on: true },
  { day: 'Quinta-feira',  from: '08:00', to: '19:00', on: true },
  { day: 'Sexta-feira',   from: '08:00', to: '17:00', on: true },
  { day: 'Sábado',        from: '09:00', to: '13:00', on: true },
  { day: 'Domingo',       from: '—',     to: '—',     on: false },
];

const NOTIF_KEYS = ['reminder24h', 'confirmationBefore1h', 'satisfactionSurvey', 'cancelNotifyPro'] as const;

const NOTIF_DEFAULT = [
  { title: 'Lembrete 24h antes da consulta',      sub: 'Pacientes recebem mensagem no WhatsApp.',   on: true },
  { title: 'Confirmação de presença (1h antes)',  sub: 'Permite confirmar ou cancelar.',            on: true },
  { title: 'Pesquisa de satisfação pós-sessão',   sub: 'Enviada 2h após o atendimento.',            on: false },
  { title: 'Notificar profissional sobre cancelamento', sub: 'E-mail + push.',                    on: true },
];

const EMPTY_FORM = {
  name: '', legalName: '', document: '', stateRegistration: '',
  email: '', phone: '',
  addressCep: '', addressStreet: '', addressNumber: '', addressComplement: '',
  addressNeighborhood: '', addressCity: '', addressState: '',
};

export default function Settings() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState('clinic');
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [hours, setHours] = useState(HOURS_DEFAULT);
  const [notifs, setNotifs] = useState(NOTIF_DEFAULT);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const profileQuery = useQuery<OrganizationProfile>({
    queryKey: ['organization-profile'],
    queryFn: organizationApi.getProfile,
  });

  useEffect(() => {
    const p = profileQuery.data;
    if (!p) return;
    setFormData({
      name: p.name ?? '',
      legalName: p.legalName ?? '',
      document: p.document ?? '',
      stateRegistration: p.stateRegistration ?? '',
      email: p.email ?? '',
      phone: p.phone ?? '',
      addressCep: p.addressCep ?? '',
      addressStreet: p.addressStreet ?? '',
      addressNumber: p.addressNumber ?? '',
      addressComplement: p.addressComplement ?? '',
      addressNeighborhood: p.addressNeighborhood ?? '',
      addressCity: p.addressCity ?? '',
      addressState: p.addressState ?? '',
    });
    const bh = p.settings?.businessHours;
    if (Array.isArray(bh)) {
      setHours(HOURS_DEFAULT.map((h, i) => {
        const s = (bh as { from?: string; to?: string; enabled?: boolean }[])[i];
        return s ? { ...h, from: s.from ?? h.from, to: s.to ?? h.to, on: s.enabled ?? h.on } : h;
      }));
    }
    const ns = p.settings?.notifications as Record<string, boolean> | undefined;
    if (ns) {
      setNotifs(NOTIF_DEFAULT.map((n, i) => ({ ...n, on: ns[NOTIF_KEYS[i]] ?? n.on })));
    }
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => organizationApi.update({
      name: formData.name || undefined,
      cnpj: formData.document || undefined,
      legalName: formData.legalName || undefined,
      stateRegistration: formData.stateRegistration || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      addressCep: formData.addressCep || undefined,
      addressStreet: formData.addressStreet || undefined,
      addressNumber: formData.addressNumber || undefined,
      addressComplement: formData.addressComplement || undefined,
      addressNeighborhood: formData.addressNeighborhood || undefined,
      addressCity: formData.addressCity || undefined,
      addressState: formData.addressState || undefined,
      settings: {
        businessHours: DAYS_MAP.map((d, i) => ({
          day: d.key,
          from: hours[i].from === '—' ? null : hours[i].from,
          to: hours[i].to === '—' ? null : hours[i].to,
          enabled: hours[i].on,
        })),
        notifications: Object.fromEntries(NOTIF_KEYS.map((k, i) => [k, notifs[i].on])),
      },
    }),
    onSuccess: () => {
      toast.success('Alterações salvas com sucesso');
      queryClient.invalidateQueries({ queryKey: ['organization-profile'] });
    },
    onError: () => toast.error('Erro ao salvar alterações. Tente novamente.'),
  });

  const field = (key: keyof typeof EMPTY_FORM) => ({
    value: formData[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData(prev => ({ ...prev, [key]: e.target.value })),
  });

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
    onError: () => toast.error('Erro ao cancelar assinatura. Tente novamente.'),
  });

  const professionalsQuery = useQuery({
    queryKey: ['professionals'],
    queryFn: professionalsApi.list,
  });

  const usage = usageQuery.data;
  const sub = subscriptionQuery.data?.subscription ?? null;
  const plans = plansQuery.data ?? [];
  const isCanceled = sub?.status === 'CANCELED';
  const canManage = sub !== null && !isCanceled;
  const pendingPlan = plans.find((p) => p.id === pendingPlanId);

  function scrollTo(id: string) {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setRef(id: string) {
    return (el: HTMLDivElement | null) => { sectionRefs.current[id] = el; };
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[26px] font-semibold leading-8" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}>
              Configurações
            </h1>
            {sub && (
              <span className="inline-flex items-center h-[22px] px-2.5 rounded-full text-[11.5px] font-medium bg-primary/10 text-primary border border-primary/20 translate-y-[-2px]">
                Plano · {sub.plan.name}
              </span>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground mt-1">Personalize sua clínica e equipe.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setFormData(EMPTY_FORM)}>Restaurar padrões</Button>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            Salvar alterações
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '220px 1fr' }}>
        {/* Sticky nav */}
        <Card className="p-1.5 sticky top-4">
          {NAV_SECTIONS.map((s) => {
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors text-left ${
                  active
                    ? 'bg-primary/8 text-primary'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                <s.icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                {s.label}
              </button>
            );
          })}
        </Card>

        {/* Content sections */}
        <div className="flex flex-col gap-4">
          {/* ── Dados da clínica ─────────────────────────────── */}
          <div ref={setRef('clinic')} />

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-[14px]" style={{ fontFamily: 'var(--font-display)' }}>Identidade</CardTitle>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">Como sua clínica aparece para pacientes e profissionais.</p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '120px 1fr' }}>
                <div>
                  <div
                    className="rounded-xl flex items-center justify-center text-white font-semibold text-[32px]"
                    style={{
                      width: 88, height: 88,
                      background: 'hsl(var(--primary))',
                      fontFamily: 'var(--font-display)',
                      boxShadow: 'var(--shadow-brand)',
                    }}
                  >
                    B
                  </div>
                  <Button variant="outline" size="sm" className="mt-2 h-7 text-[12px] w-[88px]">Trocar logo</Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { label: 'Nome fantasia',     fkey: 'name',              placeholder: 'Clínica Bem-Estar Pélvico' },
                    { label: 'Razão social',       fkey: 'legalName',         placeholder: 'Bem-Estar Saúde Integrada LTDA' },
                    { label: 'CNPJ',               fkey: 'document',          placeholder: '12.345.678/0001-90', mono: true },
                    { label: 'Inscrição estadual', fkey: 'stateRegistration', placeholder: '123.456.789.000', mono: true },
                    { label: 'E-mail principal',   fkey: 'email',             placeholder: 'contato@clinica.com.br' },
                    { label: 'Telefone',           fkey: 'phone',             placeholder: '(11) 4002-8922', mono: true },
                  ] as const).map(({ label, fkey, placeholder, mono }) => (
                    <div key={label}>
                      <label className="block text-[11.5px] font-medium text-muted-foreground mb-1.5">{label}</label>
                      <input
                        className={`w-full h-9 px-3 rounded-lg bg-background border border-border text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all ${mono ? 'font-mono' : ''}`}
                        placeholder={placeholder}
                        {...field(fkey)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-[14px]" style={{ fontFamily: 'var(--font-display)' }}>Endereço</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-4 gap-3">
                {([
                  { label: 'CEP',         fkey: 'addressCep',          col: 1, mono: true, placeholder: '01310-100' },
                  { label: 'Logradouro',  fkey: 'addressStreet',       col: 2, placeholder: 'Av. Paulista' },
                  { label: 'Bairro',      fkey: 'addressNeighborhood', col: 1, placeholder: 'Bela Vista' },
                  { label: 'Nº',          fkey: 'addressNumber',       col: 1, mono: true, placeholder: '1578' },
                  { label: 'Cidade',      fkey: 'addressCity',         col: 2, placeholder: 'São Paulo' },
                  { label: 'Estado',      fkey: 'addressState',        col: 1, placeholder: 'SP' },
                  { label: 'Complemento', fkey: 'addressComplement',   col: 2, placeholder: 'Sala 1204' },
                ] as const).map(({ label, fkey, placeholder, mono, col }) => (
                  <div key={label} style={{ gridColumn: `span ${col}` }}>
                    <label className="block text-[11.5px] font-medium text-muted-foreground mb-1.5">{label}</label>
                    <input
                      className={`w-full h-9 px-3 rounded-lg bg-background border border-border text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all ${mono ? 'font-mono' : ''}`}
                      placeholder={placeholder}
                      {...field(fkey)}
                    />
                  </div>
                ))}
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="block text-[11.5px] font-medium text-muted-foreground mb-1.5">País</label>
                  <input
                    disabled
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-[13px] outline-none disabled:opacity-50"
                    placeholder="Brasil"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Horário de funcionamento ──────────────────────── */}
          <div ref={setRef('hours')} />

          <Card>
            <CardHeader className="pb-0 flex-row items-center justify-between">
              <div>
                <CardTitle className="text-[14px]" style={{ fontFamily: 'var(--font-display)' }}>Horário de funcionamento</CardTitle>
                <p className="text-[12.5px] text-muted-foreground mt-0.5">Bloqueia agendamentos fora desses horários.</p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0 h-8 text-[12.5px]">Adicionar exceção</Button>
            </CardHeader>
            <CardContent className="pt-3 p-0">
              {hours.map((h, i) => (
                <div
                  key={h.day}
                  className={`grid items-center gap-3 px-5 py-3 ${i < hours.length - 1 ? 'border-b border-border/60' : ''}`}
                  style={{ gridTemplateColumns: '1fr 100px 100px 56px' }}
                >
                  <span className={`text-[13px] font-medium ${h.on ? '' : 'text-muted-foreground'}`}>{h.day}</span>
                  <input
                    className="h-8 px-2.5 rounded-lg bg-background border border-border text-[13px] font-mono outline-none focus:border-primary transition-all disabled:opacity-50 text-center"
                    defaultValue={h.from}
                    disabled={!h.on}
                  />
                  <input
                    className="h-8 px-2.5 rounded-lg bg-background border border-border text-[13px] font-mono outline-none focus:border-primary transition-all disabled:opacity-50 text-center"
                    defaultValue={h.to}
                    disabled={!h.on}
                  />
                  <div className="flex justify-end">
                    <Switch
                      checked={h.on}
                      onCheckedChange={(v) => setHours(prev => prev.map((d, j) => j === i ? { ...d, on: v } : d))}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Equipe e permissões ──────────────────────────── */}
          <div ref={setRef('team')} />

          <Card>
            <CardHeader className="pb-0 flex-row items-center justify-between">
              <div>
                <CardTitle className="text-[14px]" style={{ fontFamily: 'var(--font-display)' }}>Equipe e permissões</CardTitle>
                <p className="text-[12.5px] text-muted-foreground mt-0.5">Membros vinculados a esta clínica.</p>
              </div>
            </CardHeader>
            <CardContent className="pt-3 p-0">
              {professionalsQuery.isLoading ? (
                <div className="flex items-center gap-2 px-5 py-4 text-muted-foreground text-[13px]">
                  <Loader2 className="w-4 h-4 animate-spin" />Carregando...
                </div>
              ) : (professionalsQuery.data ?? []).length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-muted-foreground">Nenhum membro encontrado.</p>
              ) : (
                (professionalsQuery.data ?? []).map((prof, i, arr) => {
                  const roleLabel: Record<string, string> = {
                    ADMIN: 'Administrador',
                    PROFESSIONAL: 'Profissional',
                    RECEPTIONIST: 'Recepcionista',
                  };
                  const rolePill: Record<string, string> = {
                    ADMIN: 'bg-primary/10 text-primary border border-primary/20',
                    PROFESSIONAL: 'bg-info/10 text-info border border-info/20',
                    RECEPTIONIST: 'bg-accent text-accent-foreground border border-primary/15',
                  };
                  return (
                    <div
                      key={prof.id}
                      className={`flex items-center gap-3 px-5 py-3${i < arr.length - 1 ? ' border-b border-border/60' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-medium truncate">{prof.person.name}</p>
                        {prof.person.email && (
                          <p className="text-[11.5px] text-muted-foreground font-mono mt-0.5 truncate">{prof.person.email}</p>
                        )}
                      </div>
                      <span className={`inline-flex items-center h-[22px] px-2.5 rounded-full text-[11.5px] font-medium shrink-0 ${rolePill[prof.role] ?? 'bg-muted text-muted-foreground border'}`}>
                        {roleLabel[prof.role] ?? prof.role}
                      </span>
                      <span className={`inline-flex items-center h-[22px] px-2.5 rounded-full text-[11.5px] font-medium border shrink-0 ${prof.active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'}`}>
                        {prof.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* ── Plano e cobrança ──────────────────────────────── */}
          <div ref={setRef('plan')} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[14px]" style={{ fontFamily: 'var(--font-display)' }}>
                Assinatura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscriptionQuery.isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
                  <Loader2 className="w-4 h-4 animate-spin" />Carregando...
                </div>
              ) : sub ? (
                <>
                  {[
                    { label: 'Status', value: <Badge variant={STATUS_VARIANT[sub.status] ?? 'secondary'}>{STATUS_LABEL[sub.status] ?? sub.status}</Badge> },
                    { label: 'Plano', value: <span className="font-medium text-[13px]">{sub.plan.name}</span> },
                    { label: 'Valor', value: <span className="text-[13px]">{formatCurrency(sub.plan.priceMonthly)}/mês</span> },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">{label}</span>
                      {value}
                    </div>
                  ))}

                  {sub.trialEndsAt && sub.status === 'TRIAL' && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">Período de teste até</span>
                      <span className="text-amber-600 dark:text-amber-400 font-medium">{formatDate(sub.trialEndsAt)}</span>
                    </div>
                  )}
                  {sub.endDate && isCanceled && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">Acesso até</span>
                      <span className="text-muted-foreground">{formatDate(sub.endDate)}</span>
                    </div>
                  )}
                  {canManage && (
                    <div className="pt-1">
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 px-0 text-[13px]" onClick={() => setShowCancelDialog(true)}>
                        Cancelar assinatura
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-muted-foreground">Nenhuma assinatura encontrada. Entre em contato com o suporte.</p>
              )}

              {usageQuery.data && (
                <div className="border-t pt-4 space-y-4">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.06em]">Uso do plano</p>
                  <UsageLine icon={Users} label="Pacientes" current={usage?.currentPatients ?? 0} max={usage?.planMaxPatients ?? null} />
                  <UsageLine icon={UserCog} label="Usuários" current={usage?.currentUsers ?? 0} max={usage?.planMaxUsers ?? null} />
                </div>
              )}
            </CardContent>
          </Card>

          {canManage && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-[14px]" style={{ fontFamily: 'var(--font-display)' }}>Planos disponíveis</CardTitle>
              </CardHeader>
              <CardContent>
                {plansQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
                    <Loader2 className="w-4 h-4 animate-spin" />Carregando planos...
                  </div>
                ) : plans.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">Nenhum plano disponível no momento.</p>
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

          {/* ── Notificações ─────────────────────────────────── */}
          <div ref={setRef('notif')} />

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-[14px]" style={{ fontFamily: 'var(--font-display)' }}>Notificações</CardTitle>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">Mensagens automáticas para a paciente.</p>
            </CardHeader>
            <CardContent className="pt-3 p-0">
              {notifs.map((n, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-4 px-5 py-3.5 ${i < notifs.length - 1 ? 'border-b border-border/60' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium">{n.title}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{n.sub}</div>
                  </div>
                  <Switch
                    checked={n.on}
                    onCheckedChange={(v) => setNotifs(prev => prev.map((x, j) => j === i ? { ...x, on: v } : x))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Integrações ──────────────────────────────────── */}
          <div ref={setRef('integ')} />

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-[14px]" style={{ fontFamily: 'var(--font-display)' }}>Integrações</CardTitle>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">Conecte serviços externos à sua clínica.</p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { name: 'WhatsApp Business', desc: 'Envio de lembretes e confirmações via WhatsApp.', status: 'Em breve' },
                  { name: 'Google Agenda', desc: 'Sincronize agendamentos com o Google Calendar.', status: 'Em breve' },
                  { name: 'Asaas / Cobrança', desc: 'Geração de cobranças e boletos automáticos.', status: 'Em breve' },
                  { name: 'Nota fiscal (NFS-e)', desc: 'Emissão automática de notas fiscais de serviço.', status: 'Em breve' },
                ].map((integ) => (
                  <div
                    key={integ.name}
                    className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium">{integ.name}</div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">{integ.desc}</div>
                    </div>
                    <span className="shrink-0 inline-flex items-center h-[20px] px-2 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                      {integ.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Segurança / Zona de risco ─────────────────────── */}
          <div ref={setRef('security')} />

          <Card className="border-destructive/30">
            <CardHeader className="pb-0 border-b border-destructive/20">
              <CardTitle className="text-[14px] text-destructive" style={{ fontFamily: 'var(--font-display)' }}>Zona de risco</CardTitle>
              <p className="text-[12.5px] text-muted-foreground mt-0.5 pb-3">Ações irreversíveis. Recomendamos backup antes.</p>
            </CardHeader>
            <CardContent className="pt-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-[13.5px] font-medium">Encerrar conta da clínica</div>
                <div className="text-[12px] text-muted-foreground mt-1">
                  Todos os dados serão retidos por 30 dias antes da exclusão definitiva (LGPD).
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive/60"
              >
                Encerrar conta
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog: confirmar mudança de plano */}
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
            <Button variant="outline" onClick={() => setPendingPlanId(null)}>Cancelar</Button>
            <Button onClick={() => pendingPlanId && changePlanMutation.mutate(pendingPlanId)} disabled={changePlanMutation.isPending}>
              {changePlanMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar cancelamento */}
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
                Após esse período, o acesso será suspenso pela equipe Sou Pelvi.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Manter assinatura</Button>
            <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
