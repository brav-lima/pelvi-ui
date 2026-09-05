import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renderiza "Ativo" para status ACTIVE', () => {
    render(<StatusBadge status="ACTIVE" />);
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('renderiza "Inativo" para status INACTIVE', () => {
    render(<StatusBadge status="INACTIVE" />);
    expect(screen.getByText('Inativo')).toBeInTheDocument();
  });

  it('não renderiza nada (e não quebra) para um status desconhecido', () => {
    const { container } = render(<StatusBadge status={'BOGUS' as never} />);
    expect(container).toBeEmptyDOMElement();
  });
});
