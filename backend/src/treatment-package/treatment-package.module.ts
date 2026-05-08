import { Module } from '@nestjs/common';
import { TreatmentPackageController } from './treatment-package.controller';
import { TreatmentPackageService } from './treatment-package.service';

@Module({
  controllers: [TreatmentPackageController],
  providers: [TreatmentPackageService],
  exports: [TreatmentPackageService],
})
export class TreatmentPackageModule {}
