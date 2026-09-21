import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PATIENT_TREATMENT_PLAN_FEATURE } from '../decorators/require-patient-treatment-plan-feature.decorator';
import { PatientTreatmentPlanFeatures, PatientTreatmentPlanService } from '../patient-treatment-plan.service';
import { PatientJwtPayload } from '../strategies/patient-jwt.strategy';

@Injectable()
export class PatientTreatmentPlanFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly plans: PatientTreatmentPlanService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<keyof PatientTreatmentPlanFeatures | undefined>(
      REQUIRE_PATIENT_TREATMENT_PLAN_FEATURE,
      [context.getHandler(), context.getClass()],
    );
    if (!feature) return true;

    const { user } = context.switchToHttp().getRequest();
    const payload = user as PatientJwtPayload;
    const features = await this.plans.getForPatient(
      payload.organizationId as string,
      payload.patientId as string,
    );

    if (!features[feature]) {
      throw new ForbiddenException('Este recurso não está habilitado para a paciente');
    }
    return true;
  }
}
