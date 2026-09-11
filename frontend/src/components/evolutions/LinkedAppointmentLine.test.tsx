import { render, screen } from '@testing-library/react';
import { LinkedAppointmentLine } from './LinkedAppointmentLine';

it('mostra procedimento, data/hora e status da consulta', () => {
  render(
    <LinkedAppointmentLine
      appointment={{
        id: 'apt-1',
        startAt: '2026-03-10T13:00:00.000Z',
        endAt: '2026-03-10T14:00:00.000Z',
        status: 'DONE',
        procedure: { name: 'Fisioterapia Pélvica' },
      }}
    />,
  );

  expect(screen.getByText(/Fisioterapia Pélvica/)).toBeInTheDocument();
  expect(screen.getByText(/10\/03\/2026/)).toBeInTheDocument();
  expect(screen.getByText('Concluído')).toBeInTheDocument();
});

it('funciona sem procedimento', () => {
  render(
    <LinkedAppointmentLine
      appointment={{
        id: 'apt-2',
        startAt: '2026-03-10T13:00:00.000Z',
        endAt: '2026-03-10T14:00:00.000Z',
        status: 'SCHEDULED',
      }}
    />,
  );
  expect(screen.getByText(/Atendimento:/)).toBeInTheDocument();
});
