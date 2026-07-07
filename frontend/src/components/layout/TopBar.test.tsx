import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }));
vi.mock('@/components/profile/ProfileDialog', () => ({ ProfileDialog: () => null }));
vi.mock('@/components/layout/GlobalSearch', () => ({ GlobalSearch: () => null }));
vi.mock('@/lib/api', () => ({
  appointmentsApi: { list: vi.fn().mockResolvedValue([]) },
  financialApi: { list: vi.fn().mockResolvedValue({ data: [], meta: {} }) },
  tasksApi: { my: vi.fn().mockResolvedValue([]) },
}));

import { useAuth } from '@/contexts/AuthContext';
import { TopBar } from './TopBar';

function renderTopBar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<TopBar />} />
          <Route path="/select-clinic" element={<div>SelectClinicPage</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const clinicA = { id: 'org-1', name: 'Clínica A' };
const clinicB = { id: 'org-2', name: 'Clínica B' };

describe('TopBar — Trocar Clínica', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hides "Trocar Clínica" when user belongs to only one clinic', async () => {
    const user = userEvent.setup();
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'João', role: 'ADMIN' },
      selectedClinic: clinicA,
      clinics: [clinicA],
      logout: vi.fn(),
    } as any);
    renderTopBar();

    await user.click(screen.getByRole('button', { name: /João/i }));
    expect(screen.queryByText('Trocar Clínica')).not.toBeInTheDocument();
  });

  it('shows "Trocar Clínica" and navigates to /select-clinic without logging out', async () => {
    const user = userEvent.setup();
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'João', role: 'ADMIN' },
      selectedClinic: clinicA,
      clinics: [clinicA, clinicB],
      logout,
    } as any);
    renderTopBar();

    await user.click(screen.getByRole('button', { name: /João/i }));

    await waitFor(() => {
      expect(screen.getByText('Trocar Clínica')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Trocar Clínica'));

    await waitFor(() => {
      expect(screen.getByText('SelectClinicPage')).toBeInTheDocument();
    });
    expect(logout).not.toHaveBeenCalled();
  });
});
