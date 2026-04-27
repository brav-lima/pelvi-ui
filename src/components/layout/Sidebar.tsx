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
        isCollapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
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
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
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

      {!isCollapsed && (
        <div className="px-4 pb-3 text-xs text-sidebar-foreground/40" title={versionTooltip}>
          {appVersion}
        </div>
      )}
    </aside>
  );
}
