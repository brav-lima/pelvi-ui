import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutosave } from './use-autosave';

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('chama onSave a cada intervalo enquanto habilitado', () => {
    const onSave = vi.fn();
    renderHook(() => useAutosave({ enabled: true, intervalMs: 30000, onSave }));
    vi.advanceTimersByTime(29999);
    expect(onSave).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30000);
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('não salva quando desabilitado', () => {
    const onSave = vi.fn();
    renderHook(() => useAutosave({ enabled: false, onSave }));
    vi.advanceTimersByTime(120000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('para ao ser desabilitado e ao desmontar', () => {
    const onSave = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useAutosave({ enabled, intervalMs: 1000, onSave }),
      { initialProps: { enabled: true } },
    );
    vi.advanceTimersByTime(1000);
    expect(onSave).toHaveBeenCalledTimes(1);
    rerender({ enabled: false });
    vi.advanceTimersByTime(5000);
    expect(onSave).toHaveBeenCalledTimes(1);
    rerender({ enabled: true });
    unmount();
    vi.advanceTimersByTime(5000);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('usa sempre a versão mais recente de onSave', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => useAutosave({ enabled: true, intervalMs: 1000, onSave: fn }), {
      initialProps: { fn: first },
    });
    rerender({ fn: second });
    vi.advanceTimersByTime(1000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
