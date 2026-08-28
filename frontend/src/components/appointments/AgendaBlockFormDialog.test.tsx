import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AgendaBlockFormDialog } from './AgendaBlockFormDialog';
import { agendaBlocksApi, professionalsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    agendaBlocksApi: { create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    professionalsApi: { list: vi.fn() },
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

function renderDialog(props: Partial<React.ComponentProps<typeof AgendaBlockFormDialog>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSuccess = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <AgendaBlockFormDialog
        open
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onSuccess, onOpenChange };
}

describe('AgendaBlockFormDialog', () => {
  beforeEach(() => {
    vi.mocked(professionalsApi.list).mockResolvedValue([
      { id: 'own-org-user', personId: 'user-1', active: true, role: 'PROFESSIONAL', person: { id: 'user-1', name: 'Dra. Ana', email: null, phone: null, cpf: '' } },
      { id: 'other-org-user', personId: 'user-2', active: true, role: 'PROFESSIONAL', person: { id: 'user-2', name: 'Dr. Bruno', email: null, phone: null, cpf: '' } },
    ] as any);
  });

  it('locks the professional field to the logged-in user when role is PROFESSIONAL', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1', role: 'PROFESSIONAL' } } as any);
    renderDialog();

    await waitFor(() => expect(screen.getByText('Dra. Ana')).toBeInTheDocument());
    expect(screen.queryByText('Dr. Bruno')).not.toBeInTheDocument();
  });

  it('submits a new block with the filled fields', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1', role: 'PROFESSIONAL' } } as any);
    vi.mocked(agendaBlocksApi.create).mockResolvedValue({} as any);
    const user = userEvent.setup();
    const { onSuccess } = renderDialog({ defaultDate: '2026-09-01', defaultTime: '14:00' });

    await waitFor(() => expect(screen.getByLabelText(/Título/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/Título/i), 'Consulta odontológica');
    await user.click(screen.getByRole('button', { name: /Bloquear/i }));

    await waitFor(() => expect(agendaBlocksApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        professionalId: 'own-org-user',
        title: 'Consulta odontológica',
      }),
    ));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('removes the block after confirming deletion in edit mode', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1', role: 'ADMIN' } } as any);
    vi.mocked(agendaBlocksApi.remove).mockResolvedValue(undefined as any);
    const user = userEvent.setup();
    const block = {
      id: 'block-1',
      organizationId: 'org-1',
      professionalId: 'own-org-user',
      title: 'Consulta odontológica',
      startAt: '2026-09-01T14:00:00.000Z',
      endAt: '2026-09-01T15:00:00.000Z',
      notes: '',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const { onSuccess } = renderDialog({ block: block as any });

    await waitFor(() => expect(screen.getByLabelText(/Título/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Remover bloqueio/i }));

    const confirmButton = await screen.findByRole('button', { name: 'Remover' });
    await user.click(confirmButton);

    await waitFor(() => expect(agendaBlocksApi.remove).toHaveBeenCalledWith('block-1'));
    expect(onSuccess).toHaveBeenCalled();
  });
});
