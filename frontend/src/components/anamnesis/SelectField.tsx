export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  id, label, value, onChange, options, allowEmpty = true, placeholder = 'Selecione',
}: {
  id: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[12.5px] font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-md border border-input bg-background text-[13.5px] outline-none focus:ring-2 focus:ring-primary/20"
      >
        {allowEmpty && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
