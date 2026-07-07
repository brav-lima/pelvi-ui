import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Job } from 'bullmq';
import { REMINDER_QUEUE, ReminderJobData } from '../jobs/reminder.job';

@Processor(REMINDER_QUEUE)
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  async process(job: Job<ReminderJobData>): Promise<void> {
    const { appointmentId, patientId, organizationId, startAt } = job.data;

    try {
      this.logger.log(
        `Reminder: appointment=${appointmentId} patient=${patientId} org=${organizationId} startAt=${startAt}`,
      );

      // TODO: adicionar canais externos quando disponíveis:
      // - WhatsApp
      // - Email
      // - Push notification
    } catch (err) {
      Sentry.addBreadcrumb({
        category: 'queue',
        message: 'reminder processing failed',
        level: 'error',
        data: { appointmentId },
      });
      Sentry.captureException(err);
      throw err;
    }
  }
}
