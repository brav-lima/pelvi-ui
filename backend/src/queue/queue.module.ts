import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { REMINDER_QUEUE } from './jobs/reminder.job';
import { ReminderProcessor } from './processors/reminder.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>('REDIS_URL') },
      }),
    }),
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
  ],
  providers: [ReminderProcessor],
  exports: [BullModule],
})
export class QueueModule {}
