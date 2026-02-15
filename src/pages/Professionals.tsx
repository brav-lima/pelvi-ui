import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Loader2, LayoutGrid, List } from 'lucide-react';
import { professionalsApi } from '@/lib/api';
import { formatPhone } from '@/lib/formatters';
import { cn } from '@/lib/utils';

type ViewMode = 'card' | 'list';

export default function Professionals() {
  const { data: professionals = [], isLoading } = useQuery({
    queryKey: ['professionals'],
    queryFn: professionalsApi.list,
  });

  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('professionals-view') as ViewMode) || 'card',
  );

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('professionals-view', mode);
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
