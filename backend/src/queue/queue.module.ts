import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { REMINDER_QUEUE } from './jobs/reminder.job';
import { TOKEN_CLEANUP_QUEUE } from './jobs/token-cleanup.job';
import { ReminderProcessor } from './processors/reminder.processor';
import { TokenCleanupProcessor } from './processors/token-cleanup.processor';
import { SchedulerService } from './scheduler.service';

const isTest = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow<string>('REDIS_URL'),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
    BullModule.registerQueue({ name: TOKEN_CLEANUP_QUEUE }),
  ],
  providers: isTest ? [] : [ReminderProcessor, TokenCleanupProcessor, SchedulerService],
  exports: [BullModule],
})
export class QueueModule {}
