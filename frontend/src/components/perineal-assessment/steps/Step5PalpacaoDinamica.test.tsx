import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Step5PalpacaoDinamica } from './Step5PalpacaoDinamica';
import { perinealAssessmentSchema } from '../schema';
import type { PerinealAssessmentFormData } from '../schema';

function Wrapper() {
  const form = useForm<PerinealAssessmentFormData>({
    resolver: zodResolver(perinealAssessmentSchema),
    defaultValues: {},
  });
  return <Step5PalpacaoDinamica form={form} />;
}

describe('Step5PalpacaoDinamica', () => {
  it('does not render "(Oxford modificada)" in the Força label', () => {
    render(<Wrapper />);
    expect(screen.queryByText(/Oxford modificada/i)).not.toBeInTheDocument();
  });

  it('still renders the Força field', () => {
    render(<Wrapper />);
    expect(screen.getByText(/^Força$/i)).toBeInTheDocument();
  });
});
