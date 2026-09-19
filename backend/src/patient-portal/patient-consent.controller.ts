import { Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentPatient } from './decorators/current-patient.decorator';
import { PatientJwtAuthGuard } from './guards/patient-jwt-auth.guard';
import { PatientConsentService } from './patient-consent.service';
import type { PatientJwtPayload } from './strategies/patient-jwt.strategy';

@ApiBearerAuth()
@ApiTags('Patient Portal - Consentimento')
@Public()
@UseGuards(PatientJwtAuthGuard)
@Controller('patient-portal/consent')
export class PatientConsentController {
  constructor(private readonly consentService: PatientConsentService) {}

  @Post(':linkId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar o vínculo com uma nova clínica' })
  async accept(@CurrentPatient() patient: PatientJwtPayload, @Param('linkId') linkId: string) {
    await this.consentService.accept(patient.sub, linkId);
    return { message: 'Vínculo confirmado' };
  }

  @Post(':linkId/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recusar o vínculo com uma nova clínica' })
  async decline(@CurrentPatient() patient: PatientJwtPayload, @Param('linkId') linkId: string) {
    await this.consentService.decline(patient.sub, linkId);
    return { message: 'Vínculo recusado' };
  }
}
