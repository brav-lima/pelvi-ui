import { Module } from '@nestjs/common';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { TreatmentPackageModule } from '../treatment-package/treatment-package.module';

@Module({
  imports: [TreatmentPackageModule],
  controllers: [AppointmentController],
  providers: [AppointmentService],
})
export class AppointmentModule {}
