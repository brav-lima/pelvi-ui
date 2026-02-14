import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Loader2 } from 'lucide-react';
import { professionalsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function Professionals() {
  const { data: professionals = [], isLoading } = useQuery({
    queryKey: ['professionals'],
    queryFn: professionalsApi.list,
  });

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
      RECEPTIONIST: { label: 'Recepcao', className: 'bg-warning/10 text-warning border-warning/20' },
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
        description="Equipe da clinica"
      />

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
                      <span>{prof.person.phone}</span>
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
    </div>
  );
}
