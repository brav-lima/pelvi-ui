import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Phone, Mail, Loader2, LayoutGrid, List, Plus, Edit, Trash2 } from 'lucide-react';
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
import { professionalsApi } from '@/lib/api';
import { formatPhone } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { useHasRole } from '@/components/auth/RoleGuard';
import { useAuth } from '@/contexts/AuthContext';
import { ProfessionalFormDialog } from '@/components/professionals/ProfessionalFormDialog';
import { ProfessionalEditDialog } from '@/components/professionals/ProfessionalEditDialog';
import { toast } from 'sonner';
import type { Professional } from '@/types/clinic';

type ViewMode = 'card' | 'list';

export default function Professionals() {
  const queryClient = useQueryClient();
  const isAdmin = useHasRole('ADMIN');
  const { selectedClinic } = useAuth();

  const { data: professionals = [], isLoading } = useQuery({
    queryKey: ['professionals'],
    queryFn: professionalsApi.list,
  });

  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('professionals-view') as ViewMode) || 'card',
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | undefined>();

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('professionals-view', mode);
  };

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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; className: string }> = {
      ADMIN: { label: 'Admin', className: 'bg-primary/10 text-primary border-primary/20' },
      PROFESSIONAL: { label: 'Profissional', className: 'bg-info/10 text-info border-info/20' },
      RECEPTIONIST: { label: 'Recepção', className: 'bg-warning/10 text-warning border-warning/20' },
    };
    return roleMap[role] || { label: role, className: '' };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Profissionais"
        description="Equipe da clínica"
        actions={
          isAdmin ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Profissional
            </Button>
          ) : undefined
        }
      />

      {/* View Toggle */}
      <div className="flex justify-end">
        <div className="flex items-center border border-border rounded-md">
          <Button
            variant={viewMode === 'card' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-9 w-9 rounded-r-none"
            onClick={() => handleViewChange('card')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-9 w-9 rounded-l-none"
            onClick={() => handleViewChange('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {viewMode === 'card' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((prof) => {
            const role = getRoleBadge(prof.role);
            return (
              <Card
                key={prof.id}
                className={cn(
                  'transition-all',
                  !prof.active && 'opacity-60',
                )}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center">
                    <Avatar className="w-16 h-16 mb-3">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {getInitials(prof.person.name)}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="font-semibold text-foreground">{prof.person.name}</h3>
                    <Badge variant="outline" className={cn('mt-2', role.className)}>
                      {role.label}
                    </Badge>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    {prof.person.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        <span>{formatPhone(prof.person.phone)}</span>
                      </div>
                    )}
                    {prof.person.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{prof.person.email}</span>
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                      <Switch
                        checked={prof.active}
                        onCheckedChange={() =>
                          toggleMutation.mutate({ id: prof.id, active: !prof.active })
                        }
                      />
                      <Button variant="ghost" size="sm" className="flex-1" onClick={() => openEdit(prof)}>
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover Profissional</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover {prof.person.name} da clínica?
                              Esta ação não pode ser desfeita.
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
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nome</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Cargo</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Telefone</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    {isAdmin && <th className="py-3 px-4 text-sm font-medium text-muted-foreground w-40" />}
                  </tr>
                </thead>
                <tbody>
                  {professionals.map((prof) => {
                    const role = getRoleBadge(prof.role);
                    return (
                      <tr
                        key={prof.id}
                        className={cn(
                          'border-b border-border last:border-0 hover:bg-muted/50 transition-colors',
                          !prof.active && 'opacity-60',
                        )}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-foreground">{prof.person.name}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={role.className}>
                            {role.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{formatPhone(prof.person.phone) || '-'}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{prof.person.email || '-'}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={prof.active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'}>
                            {prof.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <Switch
                                checked={prof.active}
                                onCheckedChange={() =>
                                  toggleMutation.mutate({ id: prof.id, active: !prof.active })
                                }
                              />
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(prof)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover Profissional</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja remover {prof.person.name} da clínica?
                                      Esta ação não pode ser desfeita.
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
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
