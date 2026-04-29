import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors",
  {
    variants: {
      variant: {
        default: "border-input focus-visible:ring-ring",
        error: "border-destructive text-destructive placeholder:text-destructive/60 focus-visible:ring-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface InputProps
  extends React.ComponentProps<"input">,
    VariantProps<typeof inputVariants> {
  /** Atalho: quando true, aplica variant=error e aria-invalid sem precisar passar os dois manualmente. */
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, error, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const resolvedVariant = error ? "error" : variant;
    const resolvedAriaInvalid = error ? true : ariaInvalid;
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant: resolvedVariant, className }))}
        aria-invalid={resolvedAriaInvalid}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input, inputVariants };
