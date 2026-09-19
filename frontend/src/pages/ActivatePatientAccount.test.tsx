import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/lib/api', () => ({
  patientPortalApi: { activate: vi.fn() },
}));

import { patientPortalApi } from '@/lib/api';
import ActivatePatientAccount from '@/pages/ActivatePatientAccount';

function renderPage(token = 'abc123token') {
  return render(
    <MemoryRouter
      initialEntries={[`/paciente/ativar-conta?token=${token}`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/paciente/ativar-conta" element={<ActivatePatientAccount />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ActivatePatientAccount page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza campos de senha e confirmação', () => {
    renderPage();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ativar conta/i })).toBeInTheDocument();
  });

  it('exibe erro se as senhas não coincidem', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'diferente' } });
    fireEvent.click(screen.getByRole('button', { name: /ativar conta/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/senhas não coincidem/i);
    });
    expect(patientPortalApi.activate).not.toHaveBeenCalled();
  });

  it('exibe erro se a senha tem menos de 6 caracteres', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'abc12' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'abc12' } });
    fireEvent.click(screen.getByRole('button', { name: /ativar conta/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no mínimo 6 caracteres/i);
    });
    expect(patientPortalApi.activate).not.toHaveBeenCalled();
  });

  it('chama patientPortalApi.activate com o token da URL e a senha', async () => {
    vi.mocked(patientPortalApi.activate).mockResolvedValue({ message: 'ok' } as any);
    renderPage('meu-token-valido');

    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'novaSenha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'novaSenha123' } });
    fireEvent.click(screen.getByRole('button', { name: /ativar conta/i }));

    await waitFor(() => {
      expect(patientPortalApi.activate).toHaveBeenCalledWith('meu-token-valido', 'novaSenha123');
    });
  });

  it('exibe a mensagem de sucesso pedindo para baixar o app', async () => {
    vi.mocked(patientPortalApi.activate).mockResolvedValue({ message: 'ok' } as any);
    renderPage();

    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'novaSenha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'novaSenha123' } });
    fireEvent.click(screen.getByRole('button', { name: /ativar conta/i }));

    await waitFor(() => {
      expect(screen.getByText(/conta ativada/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/baixe o app sou pelvi/i)).toBeInTheDocument();
  });

  it('exibe erro quando o token é inválido ou expirado (400 da API)', async () => {
    vi.mocked(patientPortalApi.activate).mockRejectedValue(
      Object.assign(new Error('Bad Request'), { status: 400 }),
    );
    renderPage();

    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'novaSenha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'novaSenha123' } });
    fireEvent.click(screen.getByRole('button', { name: /ativar conta/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/expirou/i);
    });
  });

  it('exibe aviso quando o token está ausente na URL', () => {
    render(
      <MemoryRouter
        initialEntries={['/paciente/ativar-conta']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/paciente/ativar-conta" element={<ActivatePatientAccount />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/link inválido/i)).toBeInTheDocument();
  });
});
