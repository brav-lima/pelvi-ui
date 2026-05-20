import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { TreatmentPackageModule } from '../treatment-package/treatment-package.module';
import { REMINDER_QUEUE } from '../queue/jobs/reminder.job';

@Module({
  imports: [
    TreatmentPackageModule,
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService],
})
export class AppointmentModule {}
