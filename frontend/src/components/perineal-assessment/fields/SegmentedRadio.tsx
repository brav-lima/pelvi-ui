import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { useReadOnly } from '../ReadOnlyContext';

interface Option {
  value: string;
  label: string;
}

interface Props<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  options: Option[];
  label?: string;
  hint?: string;
  className?: string;
}

export function SegmentedRadio<TFieldValues extends FieldValues>({
  control,
  name,
  options,
  label,
  hint,
  className,
}: Props<TFieldValues>) {
  const readOnly = useReadOnly();

  return (
    <div className={className ?? 'space-y-1.5'}>
      {label && (
        <div className="flex items-baseline gap-2">
          <Label className="text-sm">{label}</Label>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      )}
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            className="justify-start flex-wrap"
            value={(field.value as string | undefined) ?? ''}
            disabled={readOnly}
            onValueChange={(v) => field.onChange(v === '' ? undefined : v)}
          >
            {options.map((opt) => (
              <ToggleGroupItem key={opt.value} value={opt.value} className="px-3">
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      />
    </div>
  );
}
