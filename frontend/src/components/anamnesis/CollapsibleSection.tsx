import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CollapsibleSection({
  id, title, children, defaultOpen = true,
}: { id: string; title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `section-${id}-body`;
  return (
    <section id={`section-${id}`} className="border border-border rounded-lg">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <h3 className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h3>
        <ChevronDown
          className={cn('w-4 h-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      <div id={bodyId} hidden={!open} className="px-4 pb-4">
        {children}
      </div>
    </section>
  );
}
