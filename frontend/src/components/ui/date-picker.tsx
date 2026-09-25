import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, isValid, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { maskDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DatePickerProps {
  /** Data no formato yyyy-MM-dd (igual ao valor de um input type="date"). */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
  className?: string;
  /** Impede a seleção de dias anteriores a esta data. */
  minDate?: Date;
  /** Impede a seleção de dias posteriores a esta data. */
  maxDate?: Date;
}

const DATE_FORMAT = "yyyy-MM-dd";
const DISPLAY_FORMAT = "dd/MM/yyyy";

function toDisplay(value?: string): string {
  if (!value) return "";
  const parsed = parse(value, DATE_FORMAT, new Date());
  return isValid(parsed) ? format(parsed, DISPLAY_FORMAT) : "";
}

/** Parses a dd/MM/yyyy string typed by the user, rejecting impossible dates (e.g. 31/02) that date-fns would otherwise roll over into the next month. */
function parseTyped(typed: string): Date | null {
  const parsed = parse(typed, DISPLAY_FORMAT, new Date());
  if (!isValid(parsed) || format(parsed, DISPLAY_FORMAT) !== typed) return null;
  return parsed;
}

function DatePicker({
  value,
  onChange,
  placeholder = "Selecione uma data",
  disabled,
  error,
  id,
  className,
  minDate,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(() => toDisplay(value));

  React.useEffect(() => {
    setText(toDisplay(value));
  }, [value]);

  const selected = value ? parse(value, DATE_FORMAT, new Date()) : undefined;
  const dayDisabled = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  const handleTextChange = (typed: string) => {
    const masked = maskDate(typed);
    setText(masked);

    if (masked.length !== DISPLAY_FORMAT.length) return;
    const parsed = parseTyped(masked);
    if (!parsed) return;
    if (minDate && parsed < minDate) return;
    if (maxDate && parsed > maxDate) return;

    onChange(format(parsed, DATE_FORMAT));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("relative", className)}>
          <Input
            id={id}
            value={text}
            placeholder={placeholder}
            disabled={disabled}
            error={error}
            className="pr-10"
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={() => setText(toDisplay(value))}
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label="Abrir calendário"
              className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:bg-transparent"
            >
              <CalendarIcon className="size-4" />
            </Button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selected}
          defaultMonth={selected}
          disabled={dayDisabled}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, DATE_FORMAT));
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
DatePicker.displayName = "DatePicker";

export { DatePicker };
