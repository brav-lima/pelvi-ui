import { useEffect, useRef } from 'react';

export function useAutosave({
  enabled,
  intervalMs = 30000,
  onSave,
}: {
  enabled: boolean;
  intervalMs?: number;
  onSave: () => void;
}): void {
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => saveRef.current(), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);
}
