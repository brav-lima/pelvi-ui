import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentPatient } from './decorators/current-patient.decorator';
import { RequireFullPatientSession } from './decorators/require-full-patient-session.decorator';
import { PatientJwtAuthGuard } from './guards/patient-jwt-auth.guard';
import { PatientScopeGuard } from './guards/patient-scope.guard';
import { PatientMeService } from './patient-me.service';
import type { PatientJwtPayload } from './strategies/patient-jwt.strategy';

@ApiBearerAuth()
@ApiTags('Patient Portal - Minha conta')
@Public()
@UseGuards(PatientJwtAuthGuard, PatientScopeGuard)
@RequireFullPatientSession()
@Controller('patient-portal/me')
export class PatientMeController {
  constructor(private readonly meService: PatientMeService) {}

  @Get('ficha')
  @ApiOperation({ summary: 'Dados pessoais básicos da paciente logada' })
  async ficha(@CurrentPatient() patient: PatientJwtPayload) {
    return this.meService.getFicha(patient.sub, patient.patientId as string);
  }

  @Get('appointments')
  @ApiOperation({ summary: 'Consultas da paciente logada, na clínica ativa da sessão' })
  async appointments(@CurrentPatient() patient: PatientJwtPayload) {
    return this.meService.getAppointments(
      patient.organizationId as string,
      patient.patientId as string,
    );
  }
}
