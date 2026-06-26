import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Settings from './Settings';

vi.mock('@/lib/api', () => ({
  organizationApi: {
    getProfile: vi.fn().mockResolvedValue({}),
    getPlanUsage: vi.fn().mockResolvedValue(null),
    update: vi.fn(),
  },
  subscriptionApi: {
    getCurrent: vi.fn().mockResolvedValue(null),
    getPlans: vi.fn().mockResolvedValue([]),
    changePlan: vi.fn(),
    cancel: vi.fn(),
  },
  professionalsApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

function renderSettings() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('removed non-functional nav items', () => {
  it('does not render Notificações nav button', () => {
    renderSettings();
    expect(screen.queryByRole('button', { name: /Notificações/i })).not.toBeInTheDocument();
  });

  it('does not render Integrações nav button', () => {
    renderSettings();
    expect(screen.queryByRole('button', { name: /Integrações/i })).not.toBeInTheDocument();
  });

  it('does not render Segurança nav button', () => {
    renderSettings();
    expect(screen.queryByRole('button', { name: /Segurança/i })).not.toBeInTheDocument();
  });
});

describe('removed non-functional section content', () => {
  it('does not render WhatsApp text anywhere on the page', () => {
    renderSettings();
    expect(screen.queryByText(/WhatsApp/i)).not.toBeInTheDocument();
  });

  it('does not render Em breve badges', () => {
    renderSettings();
    expect(screen.queryByText(/Em breve/i)).not.toBeInTheDocument();
  });

  it('does not render Encerrar conta button', () => {
    renderSettings();
    expect(screen.queryByRole('button', { name: /Encerrar conta/i })).not.toBeInTheDocument();
  });

  it('does not render Trocar logo button', () => {
    renderSettings();
    expect(screen.queryByRole('button', { name: /Trocar logo/i })).not.toBeInTheDocument();
  });

  it('does not render Adicionar exceção button', () => {
    renderSettings();
    expect(screen.queryByRole('button', { name: /Adicionar exceção/i })).not.toBeInTheDocument();
  });
});

describe('functional nav items still present', () => {
  it('renders Dados da clínica nav button', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: /Dados da clínica/i })).toBeInTheDocument();
  });

  it('renders Horário de funcionamento nav button', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: /Horário de funcionamento/i })).toBeInTheDocument();
  });

  it('renders Equipe e permissões nav button', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: /Equipe e permissões/i })).toBeInTheDocument();
  });

  it('renders Plano e cobrança nav button', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: /Plano e cobrança/i })).toBeInTheDocument();
  });
});

describe('inputs de horário de funcionamento', () => {
  it('atualiza valor do input "de" ao digitar', async () => {
    renderSettings();
    // Aguardar inputs renderizarem (há 7 linhas, primeira = Segunda-feira)
    const inputs = await screen.findAllByDisplayValue('08:00');
    const firstFromInput = inputs[0];
    fireEvent.change(firstFromInput, { target: { value: '09:00' } });
    expect(firstFromInput).toHaveValue('09:00');
  });

  it('atualiza valor do input "até" ao digitar', async () => {
    renderSettings();
    const inputs = await screen.findAllByDisplayValue('19:00');
    const firstToInput = inputs[0];
    fireEvent.change(firstToInput, { target: { value: '20:00' } });
    expect(firstToInput).toHaveValue('20:00');
  });
});
