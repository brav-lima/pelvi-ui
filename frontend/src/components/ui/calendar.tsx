import * as React from "react";
import { ChevronDown } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  startMonth = new Date(new Date().getFullYear() - 100, 0),
  endMonth = new Date(new Date().getFullYear() + 10, 11),
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      startMonth={startMonth}
      endMonth={endMonth}
      locale={ptBR}
      labels={{
        labelMonthDropdown: () => "Selecionar o mês",
        labelYearDropdown: () => "Selecionar o ano",
      }}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 items-center w-full",
        caption_label: "inline-flex items-center gap-1 text-sm font-display font-medium",
        dropdowns: "inline-flex items-center gap-1",
        dropdown_root: "relative inline-flex items-center",
        dropdown: "absolute inset-0 z-10 w-full cursor-pointer opacity-0",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-9 p-0 font-normal aria-selected:opacity-100",
        ),
        range_start: "rounded-l-md",
        range_end: "rounded-r-md",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:focus:bg-primary [&>button]:focus:text-primary-foreground",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        // Prev/next buttons are redundant with the month/year dropdowns below
        // and were the source of a hard-to-hit click target; drop them.
        Nav: () => null,
        Chevron: () => <ChevronDown className="size-4 pointer-events-none" aria-hidden="true" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
