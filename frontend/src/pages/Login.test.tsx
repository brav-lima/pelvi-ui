import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock useAuth — Login only needs the `login` function from context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock useNavigate while keeping the rest of react-router-dom real
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { useAuth } from '@/contexts/AuthContext';
import Login from '@/pages/Login';

// ── Helper ────────────────────────────────────────────────────────────────────

function renderLogin(loginMock = vi.fn()) {
  vi.mocked(useAuth).mockReturnValue({ login: loginMock } as any);
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Login />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders CPF field, password field and submit button', () => {
    renderLogin();
    expect(screen.getByLabelText('CPF')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('applies CPF mask as user types', () => {
    renderLogin();
    const cpfInput = screen.getByLabelText('CPF');
    fireEvent.change(cpfInput, { target: { value: '11111111111' } });
    expect(cpfInput).toHaveValue('111.111.111-11');
  });

  it('toggles password visibility when eye button is clicked', () => {
    renderLogin();
    const passwordInput = screen.getByLabelText('Senha');
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Eye button is the only type="button" in the form
    const toggleButton = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('type') === 'button')!;

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('navigates to /dashboard after successful single-clinic login', async () => {
    const loginMock = vi.fn().mockResolvedValue({ success: true, multiClinic: false });
    renderLogin(loginMock);

    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '11111111111' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('navigates to /select-clinic after multi-clinic login', async () => {
    const loginMock = vi.fn().mockResolvedValue({ success: true, multiClinic: true });
    renderLogin(loginMock);

    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '11111111111' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/select-clinic');
    });
  });

  it('shows the error message returned by login() on failure', async () => {
    const loginMock = vi
      .fn()
      .mockResolvedValue({ success: false, multiClinic: false, error: 'CPF ou senha inválidos' });
    renderLogin(loginMock);

    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '00000000000' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(screen.getByText('CPF ou senha inválidos')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('calls login() with the unmasked CPF and plain password', async () => {
    const loginMock = vi.fn().mockResolvedValue({ success: true, multiClinic: false });
    renderLogin(loginMock);

    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '11111111111' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'mypassword' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      // The context receives the masked CPF; stripping is done inside AuthContext
      expect(loginMock).toHaveBeenCalledWith('111.111.111-11', 'mypassword');
    });
  });

  it('disables the submit button and shows "Entrando..." while waiting', async () => {
    let resolveLogin!: (v: any) => void;
    const loginMock = vi.fn().mockImplementation(
      () => new Promise((res) => { resolveLogin = res; }),
    );
    renderLogin(loginMock);

    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '11111111111' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: 'Entrando...' });
      expect(btn).toBeDisabled();
    });

    // Resolve so the component can clean up without warnings
    await act(async () => {
      resolveLogin({ success: true, multiClinic: false });
    });
  });
});
