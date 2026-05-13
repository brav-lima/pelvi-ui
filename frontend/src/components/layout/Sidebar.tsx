import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCog,
  ClipboardList,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { User } from '@/types/clinic';
import { appVersion, versionTooltip } from '@/lib/version';

const AVATAR_COLORS = [
  ['hsl(16 55% 93%)', 'hsl(16 65% 28%)'],
  ['hsl(142 55% 93%)', 'hsl(142 60% 22%)'],
  ['hsl(199 75% 93%)', 'hsl(199 70% 28%)'],
  ['hsl(38 80% 93%)', 'hsl(30 75% 30%)'],
  ['hsl(285 50% 94%)', 'hsl(285 50% 32%)'],
  ['hsl(30 14% 92%)', 'hsl(220 14% 28%)'],
] as const;

function hashColor(name: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31 + name.charCodeAt(i)) >>> 0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
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
  roles?: Role[]; // undefined = all roles
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Agenda', href: '/agenda', icon: Calendar },
  { name: 'Pacientes', href: '/patients', icon: Users },
  { name: 'Profissionais', href: '/professionals', icon: UserCog, roles: ['ADMIN'] },
  { name: 'Procedimentos', href: '/procedures', icon: ClipboardList, roles: ['ADMIN', 'PROFESSIONAL'] },
  { name: 'Financeiro', href: '/financial', icon: DollarSign, roles: ['ADMIN'] },
];

interface SidebarProps {
  /** When true, renders for mobile (no collapse button, always expanded) */
  mobile?: boolean;
  /** Called when a nav item is clicked (used to close the mobile sheet) */
  onNavigate?: () => void;
}

export function Sidebar({ mobile, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const visibleNavigation = navigation.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  // In mobile mode, sidebar is always expanded (no collapse)
  const isCollapsed = mobile ? false : collapsed;

  return (
    <aside
      className={cn(
        'flex flex-col bg-sidebar transition-all duration-300 h-full',
        !mobile && 'border-r border-sidebar-border',
        isCollapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary">
            <Stethoscope className="w-5 h-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-sidebar-foreground text-lg">
              Pelvi
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
        {!isCollapsed && (
          <p className="text-[10.5px] font-medium text-sidebar-foreground/40 uppercase tracking-widest px-3 mb-1.5">
            Principal
          </p>
        )}
        <div className="space-y-1">
        {visibleNavigation.map((item) => {
          const isActive = location.pathname === item.href ||
            (item.href !== '/dashboard' && location.pathname.startsWith(item.href));

          return (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <item.icon className={cn('w-5 h-5 shrink-0', isActive && 'text-primary')} />
              {!isCollapsed && <span>{item.name}</span>}
            </NavLink>
          );
        })}
        </div>
      </nav>

      {/* Opções — só para ADMIN */}
      {user?.role === 'ADMIN' && (
        <div className="px-3 pb-2 border-t border-sidebar-border pt-3">
          {!isCollapsed && (
            <p className="text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-1">
              Opções
            </p>
          )}
          <NavLink
            to="/settings"
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
              )
            }
          >
            <Settings className={cn('w-5 h-5 shrink-0')} />
            {!isCollapsed && <span>Opções</span>}
          </NavLink>
        </div>
      )}

      {/* Collapse Button (desktop only) */}
      {!mobile && (
        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent',
              !collapsed && 'justify-start'
            )}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                <span>Recolher</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* User footer */}
      {user && (
        <div className="border-t border-sidebar-border p-3">
          {isCollapsed ? (
            <div
              className="mx-auto rounded-full flex items-center justify-center text-[10px] font-semibold"
              style={{
                width: 32, height: 32,
                background: hashColor(user.name)[0],
                color: hashColor(user.name)[1],
              }}
              title={`${user.name} — ${ROLE_LABELS[user.role] ?? user.role}`}
            >
              {user.name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()}
            </div>
          ) : (
            <div className="flex items-center gap-2.5" title={versionTooltip}>
              <div
                className="rounded-full flex items-center justify-center text-[10.5px] font-semibold shrink-0"
                style={{
                  width: 32, height: 32,
                  background: hashColor(user.name)[0],
                  color: hashColor(user.name)[1],
                }}
              >
                {user.name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-sidebar-foreground leading-4 truncate">
                  {user.name}
                </p>
                <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wide font-medium mt-0.5">
                  {ROLE_LABELS[user.role] ?? user.role}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
