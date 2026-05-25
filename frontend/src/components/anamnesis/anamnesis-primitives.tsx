import { cn } from '@/lib/utils';

export type SD = Record<string, unknown>;
export type SS = (k: string, v: unknown) => void;

export function str(d: SD, k: string): string { return String(d[k] ?? ''); }
export function arr(d: SD, k: string): string[] { return Array.isArray(d[k]) ? (d[k] as string[]) : []; }
export function num(d: SD, k: string, def = 0): number { return typeof d[k] === 'number' ? (d[k] as number) : def; }

export function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-muted-foreground mb-2">{label}</label>
      {children}
    </div>
  );
}

export function FieldInput({
  value, onChange, placeholder = '', type = 'text',
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 px-3 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
    />
  );
}

export function FieldTextarea({
  value, onChange, placeholder = '', rows = 3,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-y"
    />
  );
}

export function ChipSelect({
  options, value, onChange,
}: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter(o => o !== opt) : [...value, opt]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={cn(
            'h-7 px-3 rounded-full text-[12.5px] font-medium border transition-colors',
            value.includes(opt)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function SegmentedControl({
  options, value, onChange,
}: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden">
      {options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'flex-1 h-8 text-[12px] font-medium transition-colors px-2',
            i > 0 && 'border-l border-border',
            value === opt
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-muted-foreground hover:text-foreground',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
