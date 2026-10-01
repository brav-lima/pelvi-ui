import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GestationalDataFields } from './GestationalDataFields';
import { UltrasoundFields } from './UltrasoundFields';
import { ObstetricSummary } from './ObstetricSummary';

describe('GestationalDataFields', () => {
  const baseProps = { assessmentDate: '2026-06-10', ultrasound: {} };

  it('ao informar a DUM, preenche a DPP e a IG automaticamente', () => {
    const onChange = vi.fn();
    render(<GestationalDataFields {...baseProps} value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/DUM/), { target: { value: '2026-01-01' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dum: '2026-01-01',
        dpp: '2026-10-08',
        dppSource: 'DUM',
        gestationalAge: { weeks: 22, days: 6, manualOverride: false },
      }),
    );
  });

  it('mostra a IG calculada em semanas + dias e a fonte', () => {
    render(
      <GestationalDataFields
        {...baseProps}
        value={{ dum: '2026-01-01', dpp: '2026-10-08', gestationalAge: { weeks: 22, days: 6, manualOverride: false } }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gd-ga')).toHaveTextContent('22 semanas + 6 dias');
    expect(screen.getByLabelText('Fonte da idade gestacional')).toHaveValue('DUM');
  });

  it('mostra "—" quando não há IG calculável', () => {
    render(<GestationalDataFields {...baseProps} value={{ dum: '2026-02-30' }} onChange={vi.fn()} />);
    expect(screen.getByTestId('gd-ga')).toHaveTextContent('—');
  });

  it('editar a DPP marca como manual', () => {
    const onChange = vi.fn();
    render(<GestationalDataFields {...baseProps} value={{ dum: '2026-01-01' }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/DPP/), { target: { value: '2026-10-20' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ dpp: '2026-10-20', dppSource: 'MANUAL' }),
    );
  });

  it('DPP manual divergente mostra sugestão e o botão aplica a calculada', () => {
    const onChange = vi.fn();
    render(
      <GestationalDataFields
        {...baseProps}
        value={{ dum: '2026-01-01', dpp: '2026-10-20', dppSource: 'MANUAL' }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/DPP calculada: 08\/10\/2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar DPP calculada' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ dpp: '2026-10-08', dppSource: 'DUM' }),
    );
  });

  it('fonte Manual libera semanas/dias e registra override', () => {
    const onChange = vi.fn();
    render(
      <GestationalDataFields
        {...baseProps}
        value={{ gaSource: 'MANUAL', gestationalAge: { weeks: 20, days: 0, manualOverride: true } }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Semanas'), { target: { value: '21' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        gaSource: 'MANUAL',
        gestationalAge: { weeks: 21, days: 0, manualOverride: true },
      }),
    );
  });

  it('dias digitados acima de 6 são limitados a 6', () => {
    const onChange = vi.fn();
    render(
      <GestationalDataFields
        {...baseProps}
        value={{ gaSource: 'MANUAL', gestationalAge: { weeks: 20, days: 0, manualOverride: true } }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Dias'), { target: { value: '9' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ gestationalAge: { weeks: 20, days: 6, manualOverride: true } }),
    );
  });

  it('seleciona risco obstétrico, tipo de gestação e concepção', () => {
    const onChange = vi.fn();
    render(<GestationalDataFields {...baseProps} value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Risco obstétrico'), { target: { value: 'ALTO_RISCO' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ obstetricRisk: 'ALTO_RISCO' }));

    fireEvent.change(screen.getByLabelText('Tipo de gestação'), { target: { value: 'MULTIPLA' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ pregnancyType: 'MULTIPLA' }));

    fireEvent.change(screen.getByLabelText('Concepção'), { target: { value: 'REPRODUCAO_ASSISTIDA' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ conception: 'REPRODUCAO_ASSISTIDA' }));
  });
});

describe('UltrasoundFields', () => {
  it('campos são informados manualmente e sobem via onChange', () => {
    const onChange = vi.fn();
    render(<UltrasoundFields value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Data do exame'), { target: { value: '2026-06-10' } });
    expect(onChange).toHaveBeenLastCalledWith({ date: '2026-06-10' });

    fireEvent.change(screen.getByLabelText('IG no exame — semanas'), { target: { value: '22' } });
    expect(onChange).toHaveBeenLastCalledWith({ gaAtExam: { weeks: 22 } });

    fireEvent.change(screen.getByLabelText('Peso fetal estimado'), { target: { value: '2.450 g' } });
    expect(onChange).toHaveBeenLastCalledWith({ estimatedFetalWeight: '2.450 g' });
  });

  it('apresentação "Outro" libera entrada manual', () => {
    const onChange = vi.fn();
    const { rerender } = render(<UltrasoundFields value={{}} onChange={onChange} />);
    expect(screen.queryByLabelText('Descreva a apresentação')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Apresentação fetal'), { target: { value: 'OUTRO' } });
    expect(onChange).toHaveBeenLastCalledWith({ fetalPresentation: 'OUTRO' });

    rerender(<UltrasoundFields value={{ fetalPresentation: 'OUTRO' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Descreva a apresentação'), { target: { value: 'Córmica' } });
    expect(onChange).toHaveBeenLastCalledWith({ fetalPresentation: 'OUTRO', fetalPresentationOther: 'Córmica' });
  });

  it('limpar um número remove a chave em vez de gravar NaN', () => {
    const onChange = vi.fn();
    render(<UltrasoundFields value={{ gaAtExam: { weeks: 22, days: 3 } }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('IG no exame — semanas'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ gaAtExam: { days: 3 } });
  });
});

describe('ObstetricSummary', () => {
  it('mostra IG atual recalculada para hoje, DPP, apresentação (com data do exame) e risco', () => {
    render(
      <ObstetricSummary
        gestational={{ dpp: '2026-10-08', obstetricRisk: 'HABITUAL' }}
        ultrasound={{ fetalPresentation: 'CEFALICA', date: '2026-05-20' }}
        assessmentDate="2026-06-01"
        today="2026-06-10"
      />,
    );
    expect(screen.getByText('IG atual').nextSibling).toHaveTextContent('22s + 6d');
    expect(screen.getByText('DPP').nextSibling).toHaveTextContent('08/10/2026');
    expect(screen.getByText('Apresentação').nextSibling).toHaveTextContent('Cefálica');
    expect(screen.getByText(/ultrassonografia de 20\/05\/2026/)).toBeInTheDocument();
    expect(screen.getByText('Risco obstétrico').nextSibling).toHaveTextContent('Habitual');
  });

  it('IG manual avança pelos dias desde a avaliação', () => {
    render(
      <ObstetricSummary
        gestational={{ gaSource: 'MANUAL', gestationalAge: { weeks: 24, days: 0, manualOverride: true } }}
        ultrasound={{}}
        assessmentDate="2026-06-01"
        today="2026-06-10"
      />,
    );
    expect(screen.getByText('IG atual').nextSibling).toHaveTextContent('25s + 2d');
  });

  it('dados ausentes aparecem como "—" sem quebrar', () => {
    render(<ObstetricSummary gestational={{}} ultrasound={{}} assessmentDate="2026-06-10" today="2026-06-10" />);
    expect(screen.getByText('IG atual').nextSibling).toHaveTextContent('—');
    expect(screen.getByText('DPP').nextSibling).toHaveTextContent('—');
    expect(screen.getByText('Apresentação').nextSibling).toHaveTextContent('—');
    expect(screen.getByText('Risco obstétrico').nextSibling).toHaveTextContent('—');
  });

  it('apresentação "Outro" mostra o texto informado', () => {
    render(
      <ObstetricSummary
        gestational={{}}
        ultrasound={{ fetalPresentation: 'OUTRO', fetalPresentationOther: 'Córmica' }}
        assessmentDate="2026-06-10"
        today="2026-06-10"
      />,
    );
    expect(screen.getByText('Apresentação').nextSibling).toHaveTextContent('Córmica');
  });
});
