import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClinicalNarrativeField } from './ClinicalNarrativeField';

const base = {
  id: 'field-chief',
  title: 'Queixa principal',
  placeholder: 'Descreva a principal queixa...',
  guidance: 'Investigar: motivo da consulta, sintomas predominantes.',
  value: '',
  onChange: vi.fn(),
};

describe('ClinicalNarrativeField', () => {
  it('mostra título, placeholder e orientação abaixo do campo', () => {
    render(<ClinicalNarrativeField {...base} />);
    expect(screen.getByLabelText('Queixa principal')).toHaveAttribute(
      'placeholder',
      'Descreva a principal queixa...',
    );
    expect(screen.getByTestId('field-chief-guidance')).toHaveTextContent(
      'Investigar: motivo da consulta, sintomas predominantes.',
    );
  });

  it('a orientação nunca entra no valor do campo', () => {
    const onChange = vi.fn();
    render(<ClinicalNarrativeField {...base} value="Dor há 2 meses" onChange={onChange} />);
    const textarea = screen.getByLabelText('Queixa principal') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Dor há 2 meses');
    expect(textarea.value).not.toContain('Investigar');

    fireEvent.change(textarea, { target: { value: 'Dor há 3 meses' } });
    expect(onChange).toHaveBeenCalledWith('Dor há 3 meses');
  });

  it('associa a orientação ao campo via aria-describedby', () => {
    render(<ClinicalNarrativeField {...base} />);
    expect(screen.getByLabelText('Queixa principal')).toHaveAttribute(
      'aria-describedby',
      'field-chief-guidance',
    );
  });

  it('sem orientação não renderiza o parágrafo nem aria-describedby', () => {
    render(<ClinicalNarrativeField {...base} guidance={undefined} />);
    expect(screen.queryByTestId('field-chief-guidance')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Queixa principal')).not.toHaveAttribute('aria-describedby');
  });

  it('hideTitle mantém o nome acessível, mas esconde o rótulo visualmente', () => {
    render(<ClinicalNarrativeField {...base} hideTitle />);
    expect(screen.getByLabelText('Queixa principal')).toBeInTheDocument();
    expect(screen.getByText('Queixa principal')).toHaveClass('sr-only');
  });

  it('repassa maxLength ao textarea', () => {
    render(<ClinicalNarrativeField {...base} maxLength={50} />);
    expect(screen.getByLabelText('Queixa principal')).toHaveAttribute('maxlength', '50');
  });
});
