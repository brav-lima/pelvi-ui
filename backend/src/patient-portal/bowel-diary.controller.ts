import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentPatient } from './decorators/current-patient.decorator';
import { RequireFullPatientSession } from './decorators/require-full-patient-session.decorator';
import { RequirePatientTreatmentPlanFeature } from './decorators/require-patient-treatment-plan-feature.decorator';
import { PatientJwtAuthGuard } from './guards/patient-jwt-auth.guard';
import { PatientScopeGuard } from './guards/patient-scope.guard';
import { PatientTreatmentPlanFeatureGuard } from './guards/patient-treatment-plan-feature.guard';
import { CreateBowelDiaryEntryDto } from './dto/create-bowel-diary-entry.dto';
import { QueryBowelDiaryEntriesDto } from './dto/query-bowel-diary-entries.dto';
import { BowelDiaryService } from './bowel-diary.service';
import type { PatientJwtPayload } from './strategies/patient-jwt.strategy';

@ApiBearerAuth()
@ApiTags('Patient Portal - Diário evacuatório')
@Public()
@UseGuards(PatientJwtAuthGuard, PatientScopeGuard, PatientTreatmentPlanFeatureGuard)
@RequireFullPatientSession()
@RequirePatientTreatmentPlanFeature('diarioEvacuatorio')
@Controller('patient-portal/me/bowel-diary')
export class BowelDiaryController {
  constructor(private readonly diary: BowelDiaryService) {}

  @Post('entries')
  @ApiOperation({ summary: 'Registrar um evento do diário evacuatório' })
  async create(@CurrentPatient() patient: PatientJwtPayload, @Body() dto: CreateBowelDiaryEntryDto) {
    return this.diary.create(patient.organizationId as string, patient.patientId as string, {
      recordedAt: dto.recordedAt,
      hadBowelMovement: dto.hadBowelMovement,
      bristolType: dto.bristolType ?? null,
      effort: dto.effort ?? null,
      sensation: dto.sensation ?? null,
      bowelMovementDurationSeconds: dto.bowelMovementDurationSeconds ?? null,
      hadLeakage: dto.hadLeakage,
      leakageType: dto.leakageType ?? null,
    });
  }

  @Get('entries')
  @ApiOperation({ summary: 'Listar os registros do diário evacuatório da paciente' })
  async findAll(@CurrentPatient() patient: PatientJwtPayload, @Query() query: QueryBowelDiaryEntriesDto) {
    return this.diary.findAllForPatient(
      patient.organizationId as string,
      patient.patientId as string,
      query.from,
      query.to,
    );
  }

  @Delete('entries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir um registro do diário evacuatório' })
  async remove(@CurrentPatient() patient: PatientJwtPayload, @Param('id') id: string) {
    await this.diary.softDelete(patient.organizationId as string, patient.patientId as string, id);
  }
}
