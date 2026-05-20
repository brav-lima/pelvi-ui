import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { REMINDER_QUEUE, ReminderJobData } from '../jobs/reminder.job';

@Processor(REMINDER_QUEUE)
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  async process(job: Job<ReminderJobData>): Promise<void> {
    const { appointmentId, patientId, organizationId, startAt } = job.data;

    this.logger.log(
      `Reminder: appointment=${appointmentId} patient=${patientId} org=${organizationId} startAt=${startAt}`,
    );

    // TODO: adicionar canais externos quando disponíveis:
    // - WhatsApp
    // - Email
    // - Push notification
  }
}
