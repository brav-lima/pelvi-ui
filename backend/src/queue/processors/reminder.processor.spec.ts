import * as Sentry from '@sentry/nestjs';
import { Job } from 'bullmq';
import { ReminderProcessor } from './reminder.processor';
import { ReminderJobData } from '../jobs/reminder.job';

jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

describe('ReminderProcessor', () => {
  let processor: ReminderProcessor;

  const makeJob = (data: ReminderJobData): Job<ReminderJobData> =>
    ({ data }) as Job<ReminderJobData>;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new ReminderProcessor();
  });

  it('processa o lembrete sem erro no caminho feliz', async () => {
    await processor.process(
      makeJob({
        appointmentId: 'apt-1',
        patientId: 'patient-1',
        organizationId: 'org-1',
        startAt: '2026-08-01T10:00:00Z',
      }),
    );

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('captura exceção no Sentry e relança quando o processamento falha', async () => {
    const job = makeJob({
      appointmentId: 'apt-1',
      patientId: 'patient-1',
      organizationId: 'org-1',
      startAt: '2026-08-01T10:00:00Z',
    });

    const originalLog = (processor as any).logger.log;
    (processor as any).logger.log = jest.fn(() => {
      throw new Error('boom');
    });

    await expect(processor.process(job)).rejects.toThrow('boom');

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'queue',
      message: 'reminder processing failed',
      level: 'error',
      data: { appointmentId: 'apt-1' },
    });

    (processor as any).logger.log = originalLog;
  });
});
