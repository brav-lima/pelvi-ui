import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Loader2, MoreHorizontal, Search } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { professionalsApi } from '@/lib/api';
import { formatPhone } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { useHasRole } from '@/components/auth/RoleGuard';
import { useAuth } from '@/contexts/AuthContext';
import { ProfessionalFormDialog } from '@/components/professionals/ProfessionalFormDialog';
import { ProfessionalEditDialog } from '@/components/professionals/ProfessionalEditDialog';
import { toast } from 'sonner';
import type { Professional } from '@/types/clinic';

const AVATAR_COLORS = [
  ['hsl(296 30% 94%)', 'hsl(296 28% 26%)'],
  ['hsl(142 55% 93%)', 'hsl(142 60% 22%)'],
  ['hsl(199 75% 93%)', 'hsl(199 70% 28%)'],
  ['hsl(38 80% 93%)',  'hsl(30 75% 30%)'],
  ['hsl(285 50% 94%)', 'hsl(285 50% 32%)'],
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

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  PROFESSIONAL: 'Profissional',
  RECEPTIONIST: 'Recepcionista',
};

const ROLE_PILL: Record<string, string> = {
  ADMIN: 'bg-primary/10 text-primary border border-primary/20',
  PROFESSIONAL: 'bg-info/10 text-info border border-info/20',
  RECEPTIONIST: 'bg-accent text-accent-foreground border border-primary/15',
};

export default function Professionals() {
  const queryClient = useQueryClient();
  const isAdmin = useHasRole('ADMIN');
  const { selectedClinic } = useAuth();

  const { data: professionals = [], isLoading } = useQuery({
    queryKey: ['professionals'],
    queryFn: professionalsApi.list,
  });

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | undefined>();

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      professionalsApi.update(id, { active }),
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      toast.success(active ? 'Profissional ativado' : 'Profissional desativado');
    },
    onError: () => toast.error('Erro ao alterar status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (prof: Professional) =>
      professionalsApi.removeFromOrg(selectedClinic!.id, prof.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      toast.success('Profissional removido com sucesso');
    },
    onError: () => toast.error('Erro ao remover profissional'),
  });

  const openEdit = (prof: Professional) => {
    setEditingProfessional(prof);
    setEditDialogOpen(true);
  };

  const filtered = professionals.filter(p =>
    p.person.name.toLowerCase().includes(search.toLowerCase()) ||
    p.person.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const activeCount = professionals.filter(p => p.active).length;
  const adminCount = professionals.filter(p => p.role === 'ADMIN').length;
  const profCount = professionals.filter(p => p.role === 'PROFESSIONAL').length;
  const recepCount = professionals.filter(p => p.role === 'RECEPTIONIST').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold leading-8" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}>
            Profissionais
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            <span className="tabular-nums">{activeCount}</span> ativos · plano permite até <span className="tabular-nums">10</span>
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Convidar profissional
          </Button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-card border border-border rounded-xl overflow-hidden">
        {[
          { label: 'Profissionais ativos', value: activeCount },
          { label: 'Administradores', value: adminCount },
          { label: 'Profissionais clínicos', value: profCount },
          { label: 'Recepcionistas', value: recepCount, last: true },
        ].map((kpi, i) => (
          <div key={i} className={cn('flex flex-col gap-1.5 p-4', !kpi.last && 'border-r border-border')}>
            <div className="text-[12px] font-medium text-muted-foreground">{kpi.label}</div>
            <div
              className="text-[28px] font-semibold leading-8 tabular-nums"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.022em' }}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 h-[34px] px-3 rounded-lg bg-card border border-border min-w-[300px] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            className="flex-1 bg-transparent text-[13.5px] text-foreground placeholder:text-muted-foreground/60 outline-none"
            placeholder="Buscar por nome ou e-mail…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Team table */}
      <Card className="p-0 overflow-hidden">
        <div className="grid text-[11px] font-medium text-muted-foreground uppercase tracking-[0.04em] px-4 py-2.5 bg-secondary border-b border-border" style={{ gridTemplateColumns: '2.2fr 1fr 1.2fr 0.7fr 60px' }}>
          <div>Profissional</div>
          <div>Função</div>
          <div>Contato</div>
          <div>Status</div>
          <div />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-[13.5px] text-muted-foreground">Nenhum profissional encontrado</p>
          </div>
        ) : (
          filtered.map((prof) => {
            const [bg, fg] = hashColor(prof.person.name);
            const roleClass = ROLE_PILL[prof.role] || 'bg-muted text-muted-foreground border';
            return (
              <div
                key={prof.id}
                className={cn(
                  'grid items-center gap-3 px-4 py-3 border-b border-border/60 last:border-0 hover:bg-muted/40 transition-colors',
                  !prof.active && 'opacity-55',
                )}
                style={{ gridTemplateColumns: '2.2fr 1fr 1.2fr 0.7fr 60px' }}
              >
                {/* Name + specialty */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                    style={{ width: 36, height: 36, background: bg, color: fg }}
                  >
                    {initials(prof.person.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{prof.person.name}</div>
                    {(prof.specialty || prof.professionalRegistration) ? (
                      <div className="text-[11.5px] text-muted-foreground mt-0.5 truncate">
                        {[prof.specialty, prof.professionalRegistration].filter(Boolean).join(' · ')}
                      </div>
                    ) : prof.person.phone ? (
                      <div className="text-[11.5px] text-muted-foreground mt-0.5 font-mono">
                        {formatPhone(prof.person.phone)}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Role pill */}
                <div>
                  <span className={cn('inline-flex items-center h-[22px] px-2.5 rounded-full text-[11.5px] font-medium', roleClass)}>
                    {ROLE_LABELS[prof.role] ?? prof.role}
                  </span>
                </div>

                {/* Contact */}
                <div className="text-[12px] text-muted-foreground truncate font-mono">
                  {prof.person.email || '—'}
                </div>

                {/* Status */}
                <div>
                  {isAdmin ? (
                    <Switch
                      checked={prof.active}
                      onCheckedChange={() => toggleMutation.mutate({ id: prof.id, active: !prof.active })}
                    />
                  ) : (
                    <span className={cn(
                      'inline-flex items-center h-[22px] px-2.5 rounded-full text-[11.5px] font-medium border',
                      prof.active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground',
                    )}>
                      {prof.active ? 'Ativo' : 'Inativo'}
                    </span>
                  )}
                </div>

                {/* Actions */}
                {isAdmin ? (
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openEdit(prof)}>
                          <Edit className="w-3.5 h-3.5 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={e => e.preventDefault()}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              Remover
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover Profissional</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover {prof.person.name} da clínica?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteMutation.mutate(prof)}
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : <div />}
              </div>
            );
          })
        )}
      </Card>

      <ProfessionalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['professionals'] })}
      />

      {editingProfessional && (
        <ProfessionalEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['professionals'] })}
          professional={editingProfessional}
        />
      )}
    </div>
  );
}
