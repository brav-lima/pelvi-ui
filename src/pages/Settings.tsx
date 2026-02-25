import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, UserCog, FileText, Mail } from 'lucide-react';
import { organizationApi } from '@/lib/api';
import type { PlanUsage } from '@/types/clinic';

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
  const { data, isLoading } = useQuery<PlanUsage>({
    queryKey: ['plan-usage'],
    queryFn: organizationApi.getPlanUsage,
  });

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
                {data?.accessStatus === 'BLOCKED' ? (
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
                  current={data?.currentPatients ?? 0}
                  max={data?.planMaxPatients ?? null}
                />
                <UsageLine
                  icon={UserCog}
                  label="Usuários"
                  current={data?.currentUsers ?? 0}
                  max={data?.planMaxUsers ?? null}
                />
              </div>
            </CardContent>
          </Card>

          {/* Suporte */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Suporte e alteração de plano
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Para alterar seu plano ou obter suporte, entre em contato com a equipe CareFlow.
              </p>
              <a
                href="mailto:suporte@careflow.com.br"
                className="mt-3 inline-block text-sm text-primary hover:underline"
              >
                suporte@careflow.com.br
              </a>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
