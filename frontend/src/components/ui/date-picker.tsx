import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const selected = value ? parse(value, DATE_FORMAT, new Date()) : undefined;
  const dayDisabled = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={error || undefined}
          className={cn(
            "h-10 w-full justify-start px-3 font-normal",
            !selected && "text-muted-foreground",
            error && "border-destructive text-destructive focus-visible:ring-destructive",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {selected ? format(selected, "dd/MM/yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
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
