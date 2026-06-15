import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/api', () => ({
  authApi: {
    forgotPassword: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { authApi } from '@/lib/api';
import ForgotPassword from '@/pages/ForgotPassword';

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ForgotPassword />
    </MemoryRouter>,
  );
}

describe('ForgotPassword page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza campo de e-mail e botão de envio', () => {
    renderPage();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument();
  });

  it('exibe mensagem de sucesso após envio', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue({ message: 'ok' } as any);
    renderPage();

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'usuario@email.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/verifique seu e-mail/i)).toBeInTheDocument();
    });
    expect(authApi.forgotPassword).toHaveBeenCalledWith('usuario@email.com');
  });

  it('exibe mensagem de erro genérica em caso de falha na API', async () => {
    vi.mocked(authApi.forgotPassword).mockRejectedValue(new Error('network error'));
    renderPage();

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'usuario@email.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('link "Voltar para o login" navega para /login', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /voltar para o login/i });
    expect(link).toHaveAttribute('href', '/login');
  });
});
