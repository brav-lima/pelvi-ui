import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));

import { useAuth } from '@/contexts/AuthContext';
import SelectClinic from './SelectClinic';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/select-clinic']}>
      <Routes>
        <Route path="/select-clinic" element={<SelectClinic />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const clinicA = { id: 'org-1', name: 'Clínica A' };
const clinicB = { id: 'org-2', name: 'Clínica B' };

describe('SelectClinic', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to /login when there is no user', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      selectedClinic: null,
      clinics: [],
      selectClinic: vi.fn(),
      switchClinic: vi.fn(),
    } as any);
    renderPage();
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('login mode (no selectedClinic yet): lists all clinics, calls selectClinic on pick', async () => {
    const selectClinic = vi.fn().mockResolvedValue(true);
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'p1', name: 'João' },
      selectedClinic: null,
      clinics: [clinicA, clinicB],
      selectClinic,
      switchClinic: vi.fn(),
    } as any);
    renderPage();

    expect(screen.getByText('Clínica A')).toBeInTheDocument();
    expect(screen.getByText('Clínica B')).toBeInTheDocument();

    screen.getByText('Clínica A').closest('button')!.click();

    await waitFor(() => expect(selectClinic).toHaveBeenCalledWith('org-1'));
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });

  it('switch mode (already has selectedClinic): excludes current clinic, calls switchClinic on pick', async () => {
    const switchClinic = vi.fn().mockResolvedValue(true);
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'p1', name: 'João' },
      selectedClinic: clinicA,
      clinics: [clinicA, clinicB],
      selectClinic: vi.fn(),
      switchClinic,
    } as any);
    renderPage();

    expect(screen.queryByText('Clínica A')).not.toBeInTheDocument();
    expect(screen.getByText('Clínica B')).toBeInTheDocument();

    screen.getByText('Clínica B').closest('button')!.click();

    await waitFor(() => expect(switchClinic).toHaveBeenCalledWith('org-2'));
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });
});
