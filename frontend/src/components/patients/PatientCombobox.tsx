import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { patientsApi } from '@/lib/api';
import type { Patient, PatientStatus } from '@/types/clinic';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusBadge } from '@/components/ui/status-badge';

/** Mínimo de caracteres antes de disparar a busca no servidor. */
const PATIENT_SEARCH_MIN_CHARS = 3;
const DEBOUNCE_MS = 300;
const RESULT_LIMIT = 20;

/** Só precisamos de id/nome/status para exibir o rótulo e o badge. */
type PatientLike = Pick<Patient, 'id' | 'name'> & { status?: PatientStatus };

interface PatientComboboxProps {
  /** patientId selecionado (string vazia = nenhum). */
  value: string;
  /** Recebe o id e o objeto do paciente escolhido (ou null ao limpar). */
  onChange: (patientId: string, patient: Patient | null) => void;
  /**
   * Paciente já vinculado ao valor atual — usado para renderizar o rótulo
   * quando ele não veio de uma busca (ex.: edição de um agendamento cujo
   * paciente está INATIVO, ou paciente recém-criado pelo "Novo paciente").
   */
  selectedPatient?: PatientLike | null;
  /** Inclui pacientes INATIVOS nos resultados. Padrão: só ATIVOS. */
  includeInactive?: boolean;
  error?: boolean;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  'aria-describedby'?: string;
}

/**
 * Seletor de paciente com busca server-side. Substitui o `<Select>` que
 * carregava os 100 primeiros pacientes (por nome) — clínicas com mais de 100
 * pacientes não conseguiam alcançar quem ficava depois na ordem alfabética.
 * A busca dispara a partir da 3ª letra (debounce de 300ms) e devolve no
 * máximo 20 sugestões.
 */
export function PatientCombobox({
  value,
  onChange,
  selectedPatient,
  includeInactive = false,
  error,
  disabled,
  id,
  placeholder = 'Digite o nome do paciente…',
  'aria-describedby': ariaDescribedBy,
}: PatientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // Zera a caixa de busca sempre que o popover fecha.
  useEffect(() => {
    if (!open) {
      setSearch('');
      setDebounced('');
      setActiveIndex(0);
    }
  }, [open]);

  const canSearch = debounced.length >= PATIENT_SEARCH_MIN_CHARS;

  const { data, isFetching } = useQuery({
    queryKey: ['patient-search', debounced, includeInactive],
    queryFn: () =>
      patientsApi.list({
        search: debounced,
        page: 1,
        limit: RESULT_LIMIT,
        status: includeInactive ? undefined : 'ACTIVE',
      }),
    enabled: open && canSearch,
    staleTime: 30_000,
  });

  const results = data?.data ?? [];

  useEffect(() => {
    setActiveIndex(0);
  }, [debounced, results.length]);

  const label = selectedPatient?.name ?? '';

  const pick = (patient: Patient) => {
    onChange(patient.id, patient);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const patient = results[activeIndex];
      if (patient) pick(patient);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-describedby={ariaDescribedBy}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-destructive' : 'border-input',
          )}
        >
          <span className={cn('truncate', !label && 'text-muted-foreground')}>
            {label || 'Selecione um paciente'}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          {isFetching && <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />}
        </div>
        <div id={listId} role="listbox" className="max-h-[240px] overflow-y-auto p-1">
          {!canSearch ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Digite ao menos {PATIENT_SEARCH_MIN_CHARS} letras para buscar
            </p>
          ) : isFetching && results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum paciente encontrado
            </p>
          ) : (
            results.map((patient, i) => (
              <button
                key={patient.id}
                type="button"
                role="option"
                aria-selected={patient.id === value}
                onClick={() => pick(patient)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                  i === activeIndex && 'bg-accent text-accent-foreground',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      patient.id === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">{patient.name}</span>
                </span>
                {patient.status === 'INACTIVE' && (
                  <StatusBadge status="INACTIVE" className="shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
