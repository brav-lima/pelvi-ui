import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const textareaVariants = cva(
  "flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
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

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  /** Atalho: quando true, aplica variant=error e aria-invalid sem precisar passar os dois manualmente. */
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, error, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const resolvedVariant = error ? "error" : variant;
    const resolvedAriaInvalid = error ? true : ariaInvalid;
    return (
      <textarea
        className={cn(textareaVariants({ variant: resolvedVariant, className }))}
        aria-invalid={resolvedAriaInvalid}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea, textareaVariants };
