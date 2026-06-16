import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Search, Loader2, ChevronLeft, ChevronRight, Users, ChevronDown, Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { patientsApi, appointmentsApi, treatmentPackagesApi } from '@/lib/api';
import { formatCPFMasked, formatPhone } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, isAfter, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PatientFormDialog } from '@/components/patients/PatientFormDialog';
import { cn } from '@/lib/utils';
import type { Appointment, TreatmentPackage } from '@/types/clinic';

const AVATAR_COLORS = [
  ['hsl(296 30% 94%)', 'hsl(296 28% 26%)'],
  ['hsl(142 55% 93%)', 'hsl(142 60% 22%)'],
  ['hsl(199 75% 93%)', 'hsl(199 70% 28%)'],
  ['hsl(38 80% 93%)',  'hsl(30 75% 30%)'],
  ['hsl(265 60% 94%)', 'hsl(265 50% 32%)'],
  ['hsl(290 8% 92%)',  'hsl(290 18% 28%)'],
] as const;

function hashColor(name: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31 + name.charCodeAt(i)) >>> 0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
}

function calculateAge(birthDate: string) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function Patients() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'name_asc' | 'name_desc'>('name_asc');
  const [filterActivePackage, setFilterActivePackage] = useState(false);
  const [filterNoAppointment, setFilterNoAppointment] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [sortOrder, filterActivePackage, filterNoAppointment]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['patients', debouncedSearch, page, sortOrder, filterActivePackage, filterNoAppointment],
    queryFn: () => patientsApi.list({
      search: debouncedSearch,
      page,
      limit: 12,
      orderBy: sortOrder !== 'name_asc' ? sortOrder : undefined,
      hasActivePackage: filterActivePackage || undefined,
      hasNoUpcomingAppointment: filterNoAppointment || undefined,
    }),
  });

  const patients = data?.data ?? [];
  const meta = data?.meta;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const futureStr = format(addMonths(new Date(), 3), 'yyyy-MM-dd');

  const { data: upcomingAppointments = [] } = useQuery({
    queryKey: ['upcoming-appointments-patients-list', todayStr],
    queryFn: () => appointmentsApi.list({ startDate: todayStr, endDate: futureStr }),
    staleTime: 1000 * 60 * 5,
  });

  const { data: activePackages = [] } = useQuery({
    queryKey: ['active-packages-patients-list'],
    queryFn: () => treatmentPackagesApi.list({ status: 'ACTIVE' }),
    staleTime: 1000 * 60 * 5,
  });

  const nextApptByPatient = useMemo(() => {
    const now = new Date();
    const map = new Map<string, Appointment>();
    const sorted = [...upcomingAppointments]
      .filter(a => isAfter(new Date(a.startAt), now) && (a.status === 'SCHEDULED' || a.status === 'CONFIRMED'))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    for (const appt of sorted) {
      if (!map.has(appt.patientId)) map.set(appt.patientId, appt);
    }
    return map;
  }, [upcomingAppointments]);

  const activePackageByPatient = useMemo(() => {
    const map = new Map<string, TreatmentPackage>();
    for (const pkg of activePackages) {
      if (!map.has(pkg.patientId)) map.set(pkg.patientId, pkg);
    }
    return map;
  }, [activePackages]);

  // Pages to show in pagination (elided)
  const pageNumbers = (() => {
    if (!meta || meta.totalPages <= 1) return [];
    const total = meta.totalPages;
    const cur = page;
    const pages: (number | '…')[] = [];
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= cur - 1 && i <= cur + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '…') {
        pages.push('…');
      }
    }
    return pages;
  })();

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1
            className="text-[26px] font-semibold leading-8"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
          >
            Pacientes
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            <span className="tabular-nums">{meta?.total ?? '—'}</span> pacientes cadastrados
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* TODO: exportar pacientes (CSV) — ver docs/ui-funcoes-sem-implementacao.md */}
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Novo paciente
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 h-[34px] px-3 rounded-lg bg-card border border-border min-w-[320px] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            className="flex-1 bg-transparent text-[13.5px] text-foreground placeholder:text-muted-foreground/60 outline-none"
            placeholder="Buscar por nome, CPF ou telefone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className={cn(
          'inline-flex items-center h-[30px] px-3 rounded-full border text-[12.5px] font-medium cursor-default',
          !filterActivePackage && !filterNoAppointment
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'bg-card border-border text-muted-foreground',
        )}>
          Todos
          {meta && <span className={cn('ml-1.5 text-[11px] px-1.5 py-px rounded-full tabular-nums', !filterActivePackage && !filterNoAppointment ? 'bg-card text-primary' : 'bg-secondary text-muted-foreground')}>{meta.total}</span>}
        </div>
        {([
          {
            label: 'Com pacote',
            active: filterActivePackage,
            onToggle: () => setFilterActivePackage(v => !v),
          },
          {
            label: 'Sem agendamento',
            active: filterNoAppointment,
            onToggle: () => setFilterNoAppointment(v => !v),
          },
        ] as const).map(chip => (
          <button
            key={chip.label}
            onClick={chip.onToggle}
            className={cn(
              'inline-flex items-center h-[30px] px-3 rounded-full border text-[12.5px] font-medium transition-colors',
              chip.active
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {chip.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-lg bg-card border border-border text-[13px] text-foreground font-medium hover:bg-secondary transition-colors select-none">
                {sortOrder === 'name_desc' ? 'Nome Z→A' : 'Nome A→Z'}
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortOrder('name_asc')}>
                Nome A→Z
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('name_desc')}>
                Nome Z→A
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* TODO: filtro avançado (gênero, faixa etária) — ver docs/ui-funcoes-sem-implementacao.md */}
        </div>
      </div>

      {/* Patient list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : patients.length === 0 ? (
        <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-14 gap-3 text-center">
          <Users className="w-9 h-9 text-muted-foreground/40" />
          <p className="text-[13.5px] font-medium text-foreground/80">
            {debouncedSearch ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            {debouncedSearch ? 'Tente buscar por outro nome ou CPF.' : 'Cadastre o primeiro paciente da clínica.'}
          </p>
          {!debouncedSearch && (
            <Button size="sm" className="mt-1" onClick={() => setFormOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Novo paciente
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Table header */}
          <div
            className="grid text-[11px] font-medium text-muted-foreground uppercase tracking-[0.04em] px-4 py-2.5 bg-secondary border-b border-border"
            style={{ gridTemplateColumns: '2.2fr 1fr 1.2fr 1.4fr 1fr 40px' }}
          >
            <div>Paciente</div>
            <div>CPF</div>
            <div>Telefone</div>
            <div>Pacote</div>
            <div>Próxima consulta</div>
            <div />
          </div>

          {/* Rows */}
          {patients.map((patient) => {
            const [bg, fg] = hashColor(patient.name);
            const nextAppt = nextApptByPatient.get(patient.id);
            const activePkg = activePackageByPatient.get(patient.id);
            return (
              <div
                key={patient.id}
                className="grid items-center gap-3 px-4 py-3 border-b border-border/60 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                style={{ gridTemplateColumns: '2.2fr 1fr 1.2fr 1.4fr 1fr 40px' }}
                onClick={() => navigate(`/patients/${patient.id}`)}
              >
                {/* Avatar + name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                    style={{ width: 36, height: 36, background: bg, color: fg }}
                  >
                    {initials(patient.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{patient.name}</div>
                    <div className="text-[11.5px] text-muted-foreground mt-0.5">
                      {patient.birthDate
                        ? <span>{calculateAge(patient.birthDate)} anos{patient.gender === 'F' ? ' · feminino' : patient.gender === 'M' ? ' · masculino' : ''}</span>
                        : <span className="text-muted-foreground/50 italic">sem data de nasc.</span>
                      }
                    </div>
                  </div>
                </div>

                {/* CPF */}
                <div className="text-[12px] text-muted-foreground font-mono truncate">
                  {patient.cpf ? formatCPFMasked(patient.cpf) : '—'}
                </div>

                {/* Phone */}
                <div className="text-[12px] text-muted-foreground font-mono truncate">
                  {patient.phone ? formatPhone(patient.phone) : '—'}
                </div>

                {/* Package */}
                <div>
                  {activePkg ? (
                    <div>
                      <div className="text-[12.5px] font-medium text-foreground/80 truncate">{activePkg.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 max-w-[80px] h-1 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, (activePkg.usedSessions / activePkg.totalSessions) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {activePkg.usedSessions}/{activePkg.totalSessions}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/40 text-[12px]">—</span>
                  )}
                </div>

                {/* Next appointment */}
                <div>
                  {nextAppt ? (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="font-mono text-[12px] text-foreground/70">
                        {isToday(new Date(nextAppt.startAt))
                          ? `hoje ${format(new Date(nextAppt.startAt), 'HH:mm')}`
                          : format(new Date(nextAppt.startAt), "EEE dd/MM", { locale: ptBR })}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/40 text-[12px]">sem agendamento</span>
                  )}
                </div>

                {/* More */}
                <div />
              </div>
            );
          })}

          {/* Pagination footer */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary text-[12px] text-muted-foreground">
              <div>
                Mostrando{' '}
                <span className="text-foreground/80 font-medium tabular-nums">
                  {(page - 1) * 12 + 1}–{Math.min(page * 12, meta.total)}
                </span>
                {' '}de{' '}
                <span className="text-foreground/80 font-medium tabular-nums">{meta.total}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="flex items-center justify-center w-7 h-7 rounded-md border border-border bg-card hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {pageNumbers.map((n, i) =>
                  n === '…' ? (
                    <span key={i} className="w-7 text-center text-muted-foreground">…</span>
                  ) : (
                    <button
                      key={i}
                      className={cn(
                        'flex items-center justify-center w-7 h-7 rounded-md border text-[12px] font-medium tabular-nums transition-colors',
                        n === page
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border bg-card hover:bg-muted/60 text-foreground/80',
                      )}
                      onClick={() => setPage(n as number)}
                    >
                      {n}
                    </button>
                  )
                )}
                <button
                  className="flex items-center justify-center w-7 h-7 rounded-md border border-border bg-card hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <PatientFormDialog open={formOpen} onOpenChange={setFormOpen} onSuccess={() => refetch()} />
    </div>
  );
}
