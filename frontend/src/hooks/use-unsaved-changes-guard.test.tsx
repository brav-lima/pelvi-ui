import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useUnsavedChangesGuard } from './use-unsaved-changes-guard';

function Harness({ dirty, onBlocked }: { dirty: boolean; onBlocked: (p: string) => void }) {
  useUnsavedChangesGuard(dirty, onBlocked);
  return (
    <div>
      <a href="/patients/1?tab=x#top">interno</a>
      <a href="https://example.com/fora">externo</a>
      <a href="/nova" target="_blank">nova aba</a>
    </div>
  );
}

afterEach(cleanup);

describe('useUnsavedChangesGuard', () => {
  it('com alterações pendentes, beforeunload pede confirmação', () => {
    render(<Harness dirty onBlocked={vi.fn()} />);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('sem alterações, beforeunload não interfere', () => {
    render(<Harness dirty={false} onBlocked={vi.fn()} />);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('intercepta clique em link interno e informa o destino', () => {
    const onBlocked = vi.fn();
    render(<Harness dirty onBlocked={onBlocked} />);
    const notPrevented = fireEvent.click(screen.getByText('interno'));
    expect(onBlocked).toHaveBeenCalledWith('/patients/1?tab=x#top');
    expect(notPrevented).toBe(false); // preventDefault foi chamado
  });

  it('não intercepta link externo, nova aba, nem clique com modificador', () => {
    const onBlocked = vi.fn();
    render(<Harness dirty onBlocked={onBlocked} />);
    // jsdom não implementa navegação; impede o default no bubble para manter a saída limpa
    const swallow = (e: Event) => e.preventDefault();
    document.addEventListener('click', swallow);
    fireEvent.click(screen.getByText('externo'));
    fireEvent.click(screen.getByText('nova aba'));
    fireEvent.click(screen.getByText('interno'), { ctrlKey: true });
    document.removeEventListener('click', swallow);
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('sem alterações não intercepta nada', () => {
    const onBlocked = vi.fn();
    render(<Harness dirty={false} onBlocked={onBlocked} />);
    const swallow = (e: Event) => e.preventDefault();
    document.addEventListener('click', swallow);
    fireEvent.click(screen.getByText('interno'));
    document.removeEventListener('click', swallow);
    expect(onBlocked).not.toHaveBeenCalled();
  });
});
