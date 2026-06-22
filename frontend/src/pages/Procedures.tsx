import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Loader2, Search, Download } from 'lucide-react';
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
import { ProcedureFormDialog } from '@/components/procedures/ProcedureFormDialog';
import { useHasRole } from '@/components/auth/RoleGuard';
import { proceduresApi } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Procedure } from '@/types/clinic';

export default function Procedures() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | undefined>();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'name' | 'duration'>('price');
  const isAdmin = useHasRole('ADMIN');

  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ['procedures'],
    queryFn: proceduresApi.list,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      proceduresApi.update(id, { active }),
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      toast.success(active ? 'Procedimento ativado' : 'Procedimento desativado');
    },
    onError: () => toast.error('Erro ao alterar procedimento'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => proceduresApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      toast.success('Procedimento excluído com sucesso');
    },
    onError: () => toast.error('Erro ao excluir procedimento'),
  });

  const openCreate = () => { setEditingProcedure(undefined); setDialogOpen(true); };
  const openEdit = (p: Procedure) => { setEditingProcedure(p); setDialogOpen(true); };

  const filtered = procedures.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const activeCount = procedures.filter(p => p.active).length;
  const inactiveCount = procedures.filter(p => !p.active).length;

  const sorted = [...filtered].sort((a, b) => {
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'pt-BR');
    if (sortBy === 'duration') return b.durationMinutes - a.durationMinutes;
    return b.price - a.price;
  });

  const topProcedures = [...procedures]
    .filter(p => p.active)
    .sort((a, b) => b.price - a.price)
    .slice(0, 6);
  const maxPrice = topProcedures[0]?.price ?? 1;

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
            Procedimentos
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            <span className="tabular-nums">{activeCount}</span> ativos · <span className="tabular-nums">{inactiveCount}</span> inativos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Exportar
          </Button>
          {isAdmin && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" />
              Novo procedimento
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 h-[34px] px-3 rounded-lg bg-card border border-border min-w-[260px] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            className="flex-1 bg-transparent text-[13.5px] text-foreground placeholder:text-muted-foreground/60 outline-none"
            placeholder="Buscar procedimento…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 h-[34px] px-3 rounded-lg bg-card border border-border text-[13px] text-muted-foreground">
          <span className="shrink-0">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="bg-transparent text-[13px] text-foreground outline-none cursor-pointer"
          >
            <option value="price">Maior valor</option>
            <option value="name">Nome A–Z</option>
            <option value="duration">Duração</option>
          </select>
        </div>
      </div>

      {/* Main layout: cards + sidebar */}
      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr] items-start">
        {/* Procedure cards 2-column grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((p) => (
            <Card
              key={p.id}
              className={cn('p-4 transition-opacity', !p.active && 'opacity-55')}
            >
              <CardContent className="p-0">
                {/* Header: name + toggle */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className={cn(
                      'inline-flex items-center h-[20px] px-2 rounded-[5px] text-[11px] font-medium font-mono mb-2',
                      'bg-primary/8 text-primary border border-primary/15',
                    )}>
                      {p.durationMinutes}min
                    </span>
                    <div
                      className="text-[15px] font-semibold leading-[1.3] mt-1"
                      style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.012em' }}
                    >
                      {p.name}
                    </div>
                  </div>
                  {isAdmin && (
                    <Switch
                      checked={p.active}
                      onCheckedChange={() => toggleMutation.mutate({ id: p.id, active: !p.active })}
                      className="shrink-0 mt-0.5"
                    />
                  )}
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 mt-3.5 pt-3 border-t border-border">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11.5px] text-muted-foreground font-medium">Duração</span>
                    <span className="text-[13.5px] font-medium font-mono tabular-nums">{p.durationMinutes}min</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11.5px] text-muted-foreground font-medium">Valor</span>
                    <span className="text-[13.5px] font-medium font-mono tabular-nums">R$ {formatCurrency(p.price)}</span>
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Procedimento</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir "{p.name}"? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteMutation.mutate(p.id)}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary sidebar */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[14px]" style={{ fontFamily: 'var(--font-display)' }}>
                Procedimentos por valor
              </CardTitle>
              <p className="text-[12.5px] text-muted-foreground">ordenado por preço</p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col gap-1">
                {topProcedures.map((p) => (
                  <div key={p.id} className="grid items-center gap-3 py-1.5" style={{ gridTemplateColumns: '80px 1fr 56px' }}>
                    <span className="text-[12.5px] text-muted-foreground truncate">{p.name}</span>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(p.price / maxPrice) * 100}%` }}
                      />
                    </div>
                    <span className="text-right font-mono text-[11.5px] text-muted-foreground tabular-nums">
                      R${formatCurrency(p.price)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[14px]" style={{ fontFamily: 'var(--font-display)' }}>Resumo</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex flex-col gap-3">
              {[
                { label: 'Total de procedimentos', value: procedures.length },
                { label: 'Ativos', value: activeCount },
                { label: 'Inativos', value: inactiveCount },
                {
                  label: 'Ticket médio',
                  value: `R$ ${formatCurrency(
                    procedures.filter(p => p.active).reduce((s, p) => s + Number(p.price), 0) / Math.max(activeCount, 1),
                  )}`,
                },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium tabular-nums">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <ProcedureFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['procedures'] })}
        procedure={editingProcedure}
      />
    </div>
  );
}
