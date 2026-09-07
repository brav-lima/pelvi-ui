import React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, patientsApi: { list: vi.fn() } };
});

import { patientsApi } from '@/lib/api';
import { PatientCombobox } from './PatientCombobox';

beforeAll(() => {
  // Radix Popover toca nessas APIs de ponteiro que o jsdom não implementa.
  Element.prototype.scrollIntoView = vi.fn();
  // @ts-expect-error jsdom stub
  Element.prototype.hasPointerCapture = vi.fn();
  // @ts-expect-error jsdom stub
  Element.prototype.releasePointerCapture = vi.fn();
});

const paged = (data: unknown[]) => ({
  data,
  meta: { total: data.length, page: 1, limit: 20, totalPages: 1 },
});

function renderCombobox(props: Partial<React.ComponentProps<typeof PatientCombobox>> = {}) {
  const onChange = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <PatientCombobox value="" onChange={onChange} {...props} />
    </QueryClientProvider>,
  );
  return { onChange };
}

async function openAndType(text: string) {
  fireEvent.click(screen.getByRole('button'));
  const input = await screen.findByRole('combobox');
  fireEvent.change(input, { target: { value: text } });
  return input;
}

describe('PatientCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patientsApi.list).mockResolvedValue(paged([]) as any);
  });

  it('mostra o rótulo do paciente já selecionado', () => {
    renderCombobox({ value: 'p9', selectedPatient: { id: 'p9', name: 'Zulmira Xavier' } });
    expect(screen.getByRole('button')).toHaveTextContent('Zulmira Xavier');
  });

  it('não busca antes da 3ª letra', async () => {
    renderCombobox();
    await openAndType('zu');
    expect(screen.getByText(/digite ao menos 3 letras/i)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 350));
    expect(patientsApi.list).not.toHaveBeenCalled();
  });

  it('busca no servidor a partir da 3ª letra (só ativos por padrão)', async () => {
    vi.mocked(patientsApi.list).mockResolvedValue(
      paged([{ id: 'p101', name: 'Zulmira Xavier', status: 'ACTIVE' }]) as any,
    );
    renderCombobox();
    await openAndType('zul');

    await waitFor(() =>
      expect(patientsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'zul', limit: 20, status: 'ACTIVE' }),
      ),
    );
    expect(await screen.findByText('Zulmira Xavier')).toBeInTheDocument();
  });

  it('encontra um paciente que ficaria fora dos 100 primeiros e o seleciona', async () => {
    vi.mocked(patientsApi.list).mockResolvedValue(
      paged([{ id: 'p137', name: 'Wanda Zuleika', status: 'ACTIVE' }]) as any,
    );
    const { onChange } = renderCombobox();
    await openAndType('wan');

    const option = await screen.findByRole('option', { name: /wanda zuleika/i });
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith('p137', expect.objectContaining({ id: 'p137' }));
  });

  it('com includeInactive busca sem filtro de status e marca o badge Inativo', async () => {
    vi.mocked(patientsApi.list).mockResolvedValue(
      paged([{ id: 'p50', name: 'Otávio Inativo', status: 'INACTIVE' }]) as any,
    );
    renderCombobox({ includeInactive: true });
    await openAndType('ota');

    await waitFor(() =>
      expect(patientsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'ota', status: undefined }),
      ),
    );
    expect(await screen.findByText('Inativo')).toBeInTheDocument();
  });

  it('mostra "Nenhum paciente encontrado" quando a busca não retorna nada', async () => {
    vi.mocked(patientsApi.list).mockResolvedValue(paged([]) as any);
    renderCombobox();
    await openAndType('xyz');
    expect(await screen.findByText(/nenhum paciente encontrado/i)).toBeInTheDocument();
  });
});
