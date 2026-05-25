import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCog,
  ClipboardList,
  DollarSign,
  FileText,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import type { User, PlanFeature } from '@/types/clinic';
import { appVersion } from '@/lib/version';

const AVATAR_COLORS = [
  ['hsl(296 30% 94%)', 'hsl(296 28% 26%)'], // plum (brand)
  ['hsl(142 55% 93%)', 'hsl(142 60% 22%)'], // green
  ['hsl(199 75% 93%)', 'hsl(199 70% 28%)'], // info
  ['hsl(38 80% 93%)',  'hsl(30 75% 30%)'],  // amber
  ['hsl(285 50% 94%)', 'hsl(285 50% 32%)'], // violet
  ['hsl(290 8% 92%)',  'hsl(290 18% 28%)'], // neutral
] as const;

function hashColor(name: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31 + name.charCodeAt(i)) >>> 0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  PROFESSIONAL: 'Profissional',
  RECEPTIONIST: 'Recepcionista',
};

type Role = User['role'];

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
  feature?: PlanFeature;
}

const navigation: NavItem[] = [
  { name: 'Dashboard',     href: '/dashboard',    icon: LayoutDashboard },
  { name: 'Agenda',        href: '/agenda',        icon: Calendar,      feature: 'AGENDA' },
  { name: 'Pacientes',     href: '/patients',      icon: Users,         feature: 'PATIENTS' },
  { name: 'Profissionais', href: '/professionals', icon: UserCog,       roles: ['ADMIN'], feature: 'MULTI_PROFESSIONAL' },
  { name: 'Procedimentos', href: '/procedures',    icon: ClipboardList, roles: ['ADMIN', 'PROFESSIONAL'] },
  { name: 'Financeiro',    href: '/financial',     icon: DollarSign,    roles: ['ADMIN'], feature: 'FINANCIAL_BASIC' },
  { name: 'Documentos',   href: '/documents',     icon: FileText,      feature: 'DOCUMENTS' },
];

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ mobile, onNavigate }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { hasFeature } = useSubscription();

  const visibleNavigation = navigation.filter(
    (item) =>
      (!item.roles || (user && item.roles.includes(user.role))) &&
      (!item.feature || hasFeature(item.feature)),
  );

  return (
    <aside
      className={cn(
        'flex flex-col w-60 h-full bg-sidebar transition-all duration-300',
        !mobile && 'border-r border-sidebar-border',
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-[18px] border-b border-sidebar-border">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg text-white font-bold text-sm shrink-0"
          style={{
            background: 'hsl(var(--primary))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.02em',
          }}
        >
          P
        </div>
        <div className="flex flex-col leading-none">
          <span
            className="font-semibold text-[15px] text-sidebar-foreground leading-5"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.012em' }}
          >
            <span className="opacity-50">Sou</span>{' '}
            <span className="text-primary">Pelvi</span>
          </span>
          <span
            className="text-[10.5px] mt-0.5 font-medium uppercase tracking-[0.06em]"
            style={{ color: 'hsl(var(--sidebar-muted, 280 6% 64%))' }}
          >
            v{appVersion}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 pt-4 pb-2 overflow-y-auto scrollbar-thin">
        <p
          className="text-[10.5px] font-medium uppercase px-3 mb-1.5"
          style={{ letterSpacing: '0.08em', color: 'hsl(var(--sidebar-muted, 280 6% 64%))' }}
        >
          Principal
        </p>
        <div className="flex flex-col gap-px">
          {visibleNavigation.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href !== '/dashboard' && location.pathname.startsWith(item.href));

            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium transition-colors duration-75',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                    : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground',
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Opções — só para ADMIN */}
      {user?.role === 'ADMIN' && (
        <div className="px-2.5 pb-2">
          <p
            className="text-[10.5px] font-medium uppercase px-3 mb-1.5 pt-3 border-t border-sidebar-border"
            style={{ letterSpacing: '0.08em', color: 'hsl(var(--sidebar-muted, 280 6% 64%))' }}
          >
            Opções
          </p>
          <NavLink
            to="/settings"
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium transition-colors duration-75',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                  : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground',
              )
            }
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Configurações</span>
          </NavLink>
        </div>
      )}

      {/* User footer */}
      {user && (
        <div className="border-t border-sidebar-border p-3 flex items-center gap-2.5">
          <div
            className="rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
            style={{
              width: 32,
              height: 32,
              background: hashColor(user.name)[0],
              color: hashColor(user.name)[1],
            }}
          >
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-[12.5px] font-medium leading-4 truncate"
              style={{ color: 'hsl(var(--sidebar-foreground))' }}
            >
              {user.name}
            </p>
            <p
              className="text-[10px] uppercase tracking-[0.05em] font-medium mt-0.5"
              style={{ color: 'hsl(var(--sidebar-muted, 280 6% 64%))' }}
            >
              {ROLE_LABELS[user.role] ?? user.role}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
