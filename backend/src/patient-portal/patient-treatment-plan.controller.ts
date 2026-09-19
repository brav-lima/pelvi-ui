import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequireFeature } from '../subscription/decorators/require-feature.decorator';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientTreatmentPlanService } from './patient-treatment-plan.service';
import { UpdatePatientTreatmentPlanDto } from './dto/update-patient-treatment-plan.dto';

@RequireFeature('PATIENT_PORTAL')
@ApiBearerAuth()
@ApiTags('Patient Portal - Plano de tratamento')
@Controller('patient-portal/patients')
export class PatientTreatmentPlanController {
  constructor(
    private readonly links: PatientAccountLinkService,
    private readonly plans: PatientTreatmentPlanService,
  ) {}

  @Get(':patientId/portal')
  @ApiOperation({ summary: 'Status do vínculo e plano de tratamento da paciente' })
  async getPortalStatus(@OrgId() orgId: string, @Param('patientId') patientId: string) {
    const rawLink = await this.links.findByPatientId(patientId);
    const link = rawLink && rawLink.organizationId === orgId ? rawLink : null;
    const features = await this.plans.getForPatient(orgId, patientId);
    return {
      linkId: link?.id ?? null,
      linkStatus: link?.status ?? null,
      invitedAt: link?.invitedAt ?? null,
      confirmedAt: link?.confirmedAt ?? null,
      features,
    };
  }

  @Put(':patientId/plan')
  @ApiOperation({ summary: 'Atualizar os recursos habilitados no plano de tratamento' })
  async updatePlan(
    @CurrentUser() user: JwtPayload,
    @OrgId() orgId: string,
    @Param('patientId') patientId: string,
    @Body() dto: UpdatePatientTreatmentPlanDto,
  ) {
    return this.plans.upsertFeatures(orgId, patientId, dto.features, user.sub);
  }
}
