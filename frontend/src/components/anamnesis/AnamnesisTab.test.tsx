import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AnamnesisTab } from './AnamnesisTab';
import type { Anamnesis } from '@/types/clinic';

const make = (over: Partial<Anamnesis>): Anamnesis => ({
  id: 'a1',
  organizationId: 'org',
  patientId: 'p1',
  professionalId: 'pr1',
  type: 'PELVIC_GENERAL',
  status: 'DRAFT',
  assessmentDate: '2026-06-10T00:00:00.000Z',
  completedAt: null,
  data: { sections: {} },
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
  professional: { id: 'pr1', person: { name: 'Dra. Ana' } },
  ...over,
});

const noop = { onCreate: vi.fn(), onOpen: vi.fn(), onDelete: vi.fn() };

describe('AnamnesisTab', () => {
  it('estado vazio', () => {
    render(<AnamnesisTab anamneses={[]} {...noop} />);
    expect(screen.getByText('Nenhuma avaliação registrada')).toBeInTheDocument();
  });

  it('botões criam cada tipo de anamnese', () => {
    const onCreate = vi.fn();
    render(<AnamnesisTab anamneses={[]} {...noop} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: /pélvica geral/i }));
    expect(onCreate).toHaveBeenLastCalledWith('PELVIC_GENERAL');
    fireEvent.click(screen.getByRole('button', { name: /gestacional/i }));
    expect(onCreate).toHaveBeenLastCalledWith('PREGNANCY');
  });

  it('lista tipo, status, profissional e só o conteúdo preenchido', () => {
    render(
      <AnamnesisTab
        {...noop}
        anamneses={[
          make({
            id: 'a1',
            status: 'COMPLETED',
            data: { sections: { chiefComplaint: 'Dor pélvica', urinarySymptoms: '' } },
          }),
        ]}
      />,
    );
    const card = screen.getByTestId('anamnesis-a1');
    expect(within(card).getByText('Anamnese Pélvica Geral')).toBeInTheDocument();
    expect(within(card).getByText('Finalizada')).toBeInTheDocument();
    expect(within(card).getByText(/Dra\. Ana/)).toBeInTheDocument();
    expect(within(card).getByText('Queixa principal')).toBeInTheDocument();
    expect(within(card).getByText('Dor pélvica')).toBeInTheDocument();
    expect(within(card).queryByText('Sintomas urinários')).not.toBeInTheDocument();
  });

  it('rascunho sem conteúdo informa que está vazio', () => {
    render(<AnamnesisTab {...noop} anamneses={[make({ id: 'a1' })]} />);
    expect(within(screen.getByTestId('anamnesis-a1')).getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByText('Nenhum conteúdo registrado')).toBeInTheDocument();
  });

  it('excluir só aparece para rascunho (finalizada não pode ser excluída)', () => {
    render(
      <AnamnesisTab
        {...noop}
        anamneses={[make({ id: 'draft', status: 'DRAFT' }), make({ id: 'done', status: 'COMPLETED' })]}
      />,
    );
    expect(within(screen.getByTestId('anamnesis-draft')).getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
    expect(within(screen.getByTestId('anamnesis-done')).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  });

  it('legado: "Formato anterior", botão Visualizar (não Editar), sem excluir quando finalizado', () => {
    const onOpen = vi.fn();
    render(
      <AnamnesisTab
        {...noop}
        onOpen={onOpen}
        anamneses={[
          make({
            id: 'old',
            type: null,
            status: 'COMPLETED',
            data: {
              queixaPrincipal: { texto: 'Queixa antiga', hipoteses: [] },
              impacto: { texto: '', hipoteses: [] },
              historiaAtual: { texto: '', hipoteses: [] },
              historiaPregressa: { texto: '', hipoteses: [] },
            },
          }),
        ]}
      />,
    );
    const card = screen.getByTestId('anamnesis-old');
    expect(within(card).getByText('Formato anterior')).toBeInTheDocument();
    expect(within(card).getByText('Queixa antiga')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Visualizar' }));
    expect(onOpen).toHaveBeenCalledWith('old');
  });

  it('legado ainda em rascunho continua tratado como legado (Visualizar) e pode ser excluído', () => {
    render(
      <AnamnesisTab
        {...noop}
        anamneses={[make({ id: 'old-draft', type: null, status: 'DRAFT', data: { queixa: 'x' } })]}
      />,
    );
    const card = screen.getByTestId('anamnesis-old-draft');
    expect(within(card).getByText('Formato anterior')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Visualizar' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
  });

  it('gestacional mostra o resumo obstétrico', () => {
    render(
      <AnamnesisTab
        {...noop}
        anamneses={[
          make({
            id: 'g1',
            type: 'PREGNANCY',
            data: { sections: { gestationalData: { dpp: '2027-01-18', obstetricRisk: 'HABITUAL' } } },
          }),
        ]}
      />,
    );
    const card = screen.getByTestId('anamnesis-g1');
    expect(within(card).getByText('Anamnese Gestacional')).toBeInTheDocument();
    expect(within(card).getByText('DPP')).toBeInTheDocument();
    expect(within(card).getByText('18/01/2027')).toBeInTheDocument();
  });

  it('Editar chama onOpen com o id', () => {
    const onOpen = vi.fn();
    render(<AnamnesisTab {...noop} onOpen={onOpen} anamneses={[make({ id: 'a1' })]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(onOpen).toHaveBeenCalledWith('a1');
  });
});
