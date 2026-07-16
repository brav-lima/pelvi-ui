import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TOKEN_CLEANUP_QUEUE } from './jobs/token-cleanup.job';

const TOKEN_CLEANUP_JOB_NAME = 'daily-token-cleanup';
const TOKEN_CLEANUP_CRON = '0 4 * * *'; // 4h UTC, todo dia

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue(TOKEN_CLEANUP_QUEUE) private readonly tokenCleanupQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.scheduleTokenCleanupJob();
  }

  private async scheduleTokenCleanupJob() {
    // Remove agendamentos anteriores para evitar duplicação em redeploy
    await this.tokenCleanupQueue.removeRepeatable(TOKEN_CLEANUP_JOB_NAME, {
      pattern: TOKEN_CLEANUP_CRON,
    });

    await this.tokenCleanupQueue.add(
      TOKEN_CLEANUP_JOB_NAME,
      {},
      {
        repeat: { pattern: TOKEN_CLEANUP_CRON },
        jobId: TOKEN_CLEANUP_JOB_NAME, // idempotente em múltiplos pods
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );

    this.logger.log('Job de purga de tokens agendado: 04:00 UTC diariamente');
  }
}
