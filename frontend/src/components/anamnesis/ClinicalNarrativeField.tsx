import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface ClinicalNarrativeFieldProps {
  id: string;
  title: string;
  placeholder?: string;
  /** Display-only orientation (e.g. "Investigar: ..."). Never merged into `value`. */
  guidance?: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  maxLength?: number;
  /** Keeps the accessible name but hides the label (when a section header already shows the title). */
  hideTitle?: boolean;
  disabled?: boolean;
}

export function ClinicalNarrativeField({
  id, title, placeholder, guidance, value, onChange, optional, maxLength, hideTitle, disabled,
}: ClinicalNarrativeFieldProps) {
  const guidanceId = `${id}-guidance`;
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className={cn('block text-[13.5px] font-semibold text-foreground', hideTitle && 'sr-only')}
      >
        {title}
        {optional && <span className="ml-2 text-[11px] font-normal text-muted-foreground">opcional</span>}
      </label>
      <Textarea
        id={id}
        rows={4}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        aria-describedby={guidance ? guidanceId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {guidance && (
        <p id={guidanceId} data-testid={guidanceId} className="text-[12px] leading-relaxed text-muted-foreground/80">
          {guidance}
        </p>
      )}
    </div>
  );
}
