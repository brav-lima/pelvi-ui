import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ProfileDialog } from '@/components/profile/ProfileDialog';
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Building2, ChevronDown, LogOut, Moon, Sun, User, Bell, Menu, Calendar, DollarSign, CheckCheck, X, Search, CheckSquare } from 'lucide-react';
import { formatCNPJ, formatCurrency } from '@/lib/formatters';
import { appointmentsApi, financialApi, tasksApi } from '@/lib/api';
import { format } from 'date-fns';

interface TopBarProps {
  /** Called when the hamburger menu is clicked (mobile only). Undefined = no menu button. */
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user, selectedClinic, clinics, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const canSwitchClinic = clinics.some((c) => c.id !== selectedClinic?.id);
  const handleSwitchClinic = () => navigate('/select-clinic');

  // Notifications: today's appointments (shares 'appointments' prefix so invalidations from Agenda propagate)
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: todayAppointments = [] } = useQuery({
    queryKey: ['appointments', 'notifications', today],
    queryFn: () => appointmentsApi.list({ startDate: today, endDate: today }),
    refetchInterval: 5 * 60 * 1000,
  });

  // Notifications: pending payments this month (shares 'financial' prefix so invalidations propagate)
  const now = new Date();
  const { data: monthFinancialResult } = useQuery({
    queryKey: ['financial', 'notifications', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => financialApi.list({ month: now.getMonth() + 1, year: now.getFullYear() }),
    refetchInterval: 5 * 60 * 1000,
  });
  const monthFinancial = monthFinancialResult?.data ?? [];

  const { data: pendingTasks = [] } = useQuery({
    queryKey: ['tasks', 'my', 'bell'],
    queryFn: () => tasksApi.my('PENDING,IN_PROGRESS'),
    refetchInterval: 5 * 60 * 1000,
  });

  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K to open search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Dismissed notifications — persisted per day in localStorage
  const dismissedKey = `notifications-dismissed-${today}`;
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(dismissedKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Clean up old keys when the day changes
  useEffect(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('notifications-dismissed-') && k !== dismissedKey)
      .forEach((k) => localStorage.removeItem(k));
  }, [dismissedKey]);

  const dismissNotification = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev).add(id);
      localStorage.setItem(dismissedKey, JSON.stringify([...next]));
      return next;
    });
  }, [dismissedKey]);

  const dismissAll = useCallback(() => {
    const allIds = [
      ...todayAppointments
        .filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED')
        .map((a) => a.id),
      ...monthFinancial
        .filter((f) => f.type === 'INCOME' && f.status === 'PENDING')
        .map((f) => f.id),
    ];
    setDismissedIds(() => {
      const next = new Set(allIds);
      localStorage.setItem(dismissedKey, JSON.stringify([...next]));
      return next;
    });
  }, [dismissedKey, todayAppointments, monthFinancial]);

  const upcomingAppointments = todayAppointments.filter(
    (a) => (a.status === 'SCHEDULED' || a.status === 'CONFIRMED') && !dismissedIds.has(a.id),
  );
  const pendingPayments = monthFinancial.filter((f) => f.type === 'INCOME' && f.status === 'PENDING' && !dismissedIds.has(f.id));
  const notificationCount = upcomingAppointments.length + pendingPayments.length + pendingTasks.length;

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  return (
    <header className="flex items-center h-14 px-4 md:px-6 bg-card border-b border-border gap-3">
      {/* Left — clinic info */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Hamburger (mobile) */}
        {onMenuClick && (
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="shrink-0">
            <Menu className="w-5 h-5" />
          </Button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center justify-center w-[30px] h-[30px] rounded-lg bg-accent">
            <Building2 className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-foreground truncate max-w-[150px] sm:max-w-none">
              {selectedClinic?.name}
            </p>
            {selectedClinic?.cnpj && (
              <p className="text-[11px] text-muted-foreground hidden sm:block font-mono mt-px">
                CNPJ {formatCNPJ(selectedClinic.cnpj)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Center — global search */}
      <div className="hidden md:flex flex-1 justify-center px-4">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 h-8 px-3 rounded-lg bg-background border border-border text-[13px] text-muted-foreground min-w-[280px] max-w-md w-full hover:border-primary/50 transition-colors"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left">Buscar pacientes, profissionais…</span>
          <kbd className="font-mono text-[10.5px] px-1.5 py-px rounded bg-card border border-border text-muted-foreground shrink-0">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto md:ml-0">
        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <p className="font-semibold text-sm">Notificações</p>
              {notificationCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                  onClick={dismissAll}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar todas como lidas
                </Button>
              )}
            </div>
            {notificationCount === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma notificação pendente
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                {/* Today's appointments */}
                {upcomingAppointments.length > 0 && (
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Consultas de Hoje</p>
                    </div>
                    <div className="space-y-1">
                      {upcomingAppointments.slice(0, 5).map((apt) => (
                        <div key={apt.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm group">
                          <span className="truncate font-medium">{apt.patient?.name ?? 'Paciente'}</span>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <span className="text-muted-foreground">
                              {format(new Date(apt.startAt), 'HH:mm')}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); dismissNotification(apt.id); }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
                              title="Marcar como lida"
                            >
                              <X className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {upcomingAppointments.length > 5 && (
                      <button
                        onClick={() => navigate('/agenda')}
                        className="text-xs text-primary hover:underline mt-1 px-2"
                      >
                        Ver todas ({upcomingAppointments.length})
                      </button>
                    )}
                  </div>
                )}

                {/* Pending payments */}
                {pendingPayments.length > 0 && (
                  <div className={`p-3 ${upcomingAppointments.length > 0 ? 'border-t border-border' : ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-warning" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Pagamentos Pendentes</p>
                    </div>
                    <div className="space-y-1">
                      {pendingPayments.slice(0, 5).map((fin) => (
                        <div key={fin.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm group">
                          <span className="truncate font-medium">{fin.patient?.name ?? 'Paciente'}</span>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <span className="text-muted-foreground">
                              R$ {formatCurrency(fin.amount)}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); dismissNotification(fin.id); }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
                              title="Marcar como lida"
                            >
                              <X className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {pendingPayments.length > 5 && (
                      <button
                        onClick={() => navigate('/financial')}
                        className="text-xs text-primary hover:underline mt-1 px-2"
                      >
                        Ver todos ({pendingPayments.length})
                      </button>
                    )}
                  </div>
                )}

                {/* Pending tasks */}
                {pendingTasks.length > 0 && (
                  <div className={`p-3 ${(upcomingAppointments.length > 0 || pendingPayments.length > 0) ? 'border-t border-border' : ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckSquare className="w-4 h-4 text-primary" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Tarefas Pendentes</p>
                    </div>
                    <div className="space-y-1">
                      {pendingTasks.slice(0, 5).map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm cursor-pointer"
                          onClick={() => navigate('/tarefas')}
                        >
                          <span className="truncate font-medium">{task.title}</span>
                          <span className="text-muted-foreground shrink-0 ml-2 text-xs">
                            {task.priority === 'HIGH' ? 'Alta' : task.priority === 'MEDIUM' ? 'Média' : 'Baixa'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {pendingTasks.length > 5 && (
                      <button
                        onClick={() => navigate('/tarefas')}
                        className="text-xs text-primary hover:underline mt-1 px-2"
                      >
                        Ver todas ({pendingTasks.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === 'light' ? (
            <Moon className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Sun className="w-5 h-5 text-muted-foreground" />
          )}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role?.toLowerCase()}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <User className="w-4 h-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            {canSwitchClinic && (
              <DropdownMenuItem onClick={handleSwitchClinic}>
                <Building2 className="w-4 h-4 mr-2" />
                Trocar Clínica
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
