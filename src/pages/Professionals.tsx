import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Phone, 
  Mail, 
  Clock,
  Calendar
} from 'lucide-react';
import { mockProfessionals } from '@/data/mockData';
import { cn } from '@/lib/utils';

export default function Professionals() {
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
      admin: { label: 'Admin', className: 'bg-primary/10 text-primary border-primary/20' },
      professional: { label: 'Profissional', className: 'bg-info/10 text-info border-info/20' },
      receptionist: { label: 'Recepção', className: 'bg-warning/10 text-warning border-warning/20' },
    };
    return roleMap[role] || { label: role, className: '' };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Profissionais"
        description="Gerencie os profissionais da clínica"
        actions={
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Novo Profissional
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockProfessionals.map((professional) => {
          const role = getRoleBadge(professional.role);
          return (
            <Card
              key={professional.id}
              className={cn(
                'cursor-pointer hover:shadow-md hover:border-primary/20 transition-all',
                !professional.active && 'opacity-60'
              )}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="w-16 h-16 mb-3">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(professional.name)}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold text-foreground">{professional.name}</h3>
                  <p className="text-sm text-muted-foreground">{professional.specialty}</p>
                  <Badge variant="outline" className={cn('mt-2', role.className)}>
                    {role.label}
                  </Badge>
                </div>

                <div className="mt-4 pt-4 border-t border-border space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    <span>{professional.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{professional.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>
                      {professional.workingHours.start} - {professional.workingHours.end}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span className="truncate">{professional.workingDays.join(', ')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
