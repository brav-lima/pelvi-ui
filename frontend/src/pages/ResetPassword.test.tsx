import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/lib/api', () => ({
  authApi: {
    resetPassword: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { authApi } from '@/lib/api';
import ResetPassword from '@/pages/ResetPassword';

function renderPage(token = 'abc123token') {
  return render(
    <MemoryRouter
      initialEntries={[`/redefinir-senha?token=${token}`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/redefinir-senha" element={<ResetPassword />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ResetPassword page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza campo de nova senha e confirmação', () => {
    renderPage();
    expect(screen.getByLabelText('Nova senha')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar nova senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /redefinir/i })).toBeInTheDocument();
  });

  it('exibe erro se senhas não coincidem', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'senha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'diferente' } });
    fireEvent.click(screen.getByRole('button', { name: /redefinir/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/senhas não coincidem/i);
    });
    expect(authApi.resetPassword).not.toHaveBeenCalled();
  });

  it('chama authApi.resetPassword com token da URL e nova senha', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue({ message: 'ok' } as any);
    renderPage('meu-token-valido');

    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'novaSenha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'novaSenha123' } });
    fireEvent.click(screen.getByRole('button', { name: /redefinir/i }));

    await waitFor(() => {
      expect(authApi.resetPassword).toHaveBeenCalledWith('meu-token-valido', 'novaSenha123');
    });
  });

  it('exibe mensagem de sucesso e botão para ir ao login', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue({ message: 'ok' } as any);
    renderPage();

    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'novaSenha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'novaSenha123' } });
    fireEvent.click(screen.getByRole('button', { name: /redefinir/i }));

    await waitFor(() => {
      expect(screen.getByText(/senha redefinida/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /ir para o login/i })).toBeInTheDocument();
  });

  it('exibe erro quando token inválido (400 da API)', async () => {
    vi.mocked(authApi.resetPassword).mockRejectedValue(
      Object.assign(new Error('Bad Request'), { status: 400 }),
    );
    renderPage();

    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'novaSenha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'novaSenha123' } });
    fireEvent.click(screen.getByRole('button', { name: /redefinir/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/link expirou/i);
    });
  });

  it('exibe aviso quando token ausente na URL', () => {
    render(
      <MemoryRouter
        initialEntries={['/redefinir-senha']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/redefinir-senha" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/link inválido/i)).toBeInTheDocument();
  });
});
