import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Search, User, Users, Loader2 } from 'lucide-react';
import { patientsApi, professionalsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const enabled = open && debouncedQuery.trim().length >= 2;

  const patientsQuery = useQuery({
    queryKey: ['search', 'patients', debouncedQuery],
    queryFn: () => patientsApi.list({ search: debouncedQuery, limit: 5 }),
    enabled,
    staleTime: 30_000,
  });

  const professionalsQuery = useQuery({
    queryKey: ['search', 'professionals', debouncedQuery],
    queryFn: () => professionalsApi.list({ search: debouncedQuery }),
    enabled,
    staleTime: 30_000,
  });

  const patients = patientsQuery.data?.data ?? [];
  const professionals = professionalsQuery.data ?? [];
  const isLoading = patientsQuery.isFetching || professionalsQuery.isFetching;
  const hasResults = patients.length > 0 || professionals.length > 0;
  const searched = debouncedQuery.trim().length >= 2;

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [open]);

  function go(path: string) {
    navigate(path);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 max-w-[560px] overflow-hidden"
        hideClose
      >
        {/* Input */}
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar pacientes, profissionais…"
            className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/60"
          />
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />}
          <kbd className="font-mono text-[10.5px] px-1.5 py-px rounded bg-muted border border-border text-muted-foreground shrink-0">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {!searched ? (
            <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              Digite ao menos 2 caracteres para buscar
            </div>
          ) : isLoading && !hasResults ? (
            <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              Buscando…
            </div>
          ) : !hasResults ? (
            <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              Nenhum resultado para <span className="font-medium text-foreground">"{debouncedQuery}"</span>
            </div>
          ) : (
            <>
              {patients.length > 0 && (
                <ResultGroup label="Pacientes" icon={User}>
                  {patients.map(p => (
                    <ResultItem
                      key={p.id}
                      title={p.name}
                      subtitle={p.cpf ? `CPF ${p.cpf}` : p.email ?? p.phone ?? ''}
                      onClick={() => go(`/patients/${p.id}`)}
                    />
                  ))}
                </ResultGroup>
              )}

              {professionals.length > 0 && (
                <ResultGroup
                  label="Profissionais"
                  icon={Users}
                  divider={patients.length > 0}
                >
                  {professionals.slice(0, 5).map(prof => (
                    <ResultItem
                      key={prof.id}
                      title={prof.person.name}
                      subtitle={
                        [prof.specialty, prof.professionalRegistration]
                          .filter(Boolean).join(' · ')
                        || prof.person.email
                        || ''
                      }
                      onClick={() => go('/professionals')}
                    />
                  ))}
                </ResultGroup>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        {hasResults && (
          <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-[11px] text-muted-foreground">
            <span><kbd className="font-mono bg-muted border border-border px-1 rounded">↵</kbd> abrir</span>
            <span><kbd className="font-mono bg-muted border border-border px-1 rounded">Esc</kbd> fechar</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultGroup({
  label, icon: Icon, divider = false, children,
}: {
  label: string;
  icon: typeof User;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('py-1', divider && 'border-t border-border')}>
      <div className="flex items-center gap-2 px-4 py-1.5">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function ResultItem({ title, subtitle, onClick }: {
  title: string; subtitle: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors text-left"
    >
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium truncate">{title}</div>
        {subtitle && (
          <div className="text-[12px] text-muted-foreground truncate mt-0.5">{subtitle}</div>
        )}
      </div>
    </button>
  );
}
