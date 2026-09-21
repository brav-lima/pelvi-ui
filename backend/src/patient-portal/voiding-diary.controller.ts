import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentPatient } from './decorators/current-patient.decorator';
import { RequireFullPatientSession } from './decorators/require-full-patient-session.decorator';
import { RequirePatientTreatmentPlanFeature } from './decorators/require-patient-treatment-plan-feature.decorator';
import { PatientJwtAuthGuard } from './guards/patient-jwt-auth.guard';
import { PatientScopeGuard } from './guards/patient-scope.guard';
import { PatientTreatmentPlanFeatureGuard } from './guards/patient-treatment-plan-feature.guard';
import { CreateVoidingDiaryEntryDto } from './dto/create-voiding-diary-entry.dto';
import { QueryVoidingDiaryEntriesDto } from './dto/query-voiding-diary-entries.dto';
import { VoidingDiaryService } from './voiding-diary.service';
import type { PatientJwtPayload } from './strategies/patient-jwt.strategy';

@ApiBearerAuth()
@ApiTags('Patient Portal - Diário miccional')
@Public()
@UseGuards(PatientJwtAuthGuard, PatientScopeGuard, PatientTreatmentPlanFeatureGuard)
@RequireFullPatientSession()
@RequirePatientTreatmentPlanFeature('diarioMiccional')
@Controller('patient-portal/me/voiding-diary')
export class VoidingDiaryController {
  constructor(private readonly diary: VoidingDiaryService) {}

  @Post('entries')
  @ApiOperation({ summary: 'Registrar um evento do diário miccional' })
  async create(@CurrentPatient() patient: PatientJwtPayload, @Body() dto: CreateVoidingDiaryEntryDto) {
    return this.diary.create(patient.organizationId as string, patient.patientId as string, {
      recordedAt: dto.recordedAt,
      urineVolumeMl: dto.urineVolumeMl ?? null,
      voidingDurationSeconds: dto.voidingDurationSeconds ?? null,
      fluidIntakeMl: dto.fluidIntakeMl ?? null,
      hadLeakage: dto.hadLeakage,
      leakageAmount: dto.leakageAmount ?? null,
      changedPad: dto.changedPad,
    });
  }

  @Get('entries')
  @ApiOperation({ summary: 'Listar os registros do diário miccional da paciente' })
  async findAll(@CurrentPatient() patient: PatientJwtPayload, @Query() query: QueryVoidingDiaryEntriesDto) {
    return this.diary.findAllForPatient(
      patient.organizationId as string,
      patient.patientId as string,
      query.from,
      query.to,
    );
  }

  @Delete('entries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir um registro do diário miccional' })
  async remove(@CurrentPatient() patient: PatientJwtPayload, @Param('id') id: string) {
    await this.diary.softDelete(patient.organizationId as string, patient.patientId as string, id);
  }
}
