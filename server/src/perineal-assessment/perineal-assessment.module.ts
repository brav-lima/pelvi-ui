import { Module } from '@nestjs/common';
import { PerinealAssessmentController } from './perineal-assessment.controller';
import { PerinealAssessmentService } from './perineal-assessment.service';

@Module({
  controllers: [PerinealAssessmentController],
  providers: [PerinealAssessmentService],
})
export class PerinealAssessmentModule {}
