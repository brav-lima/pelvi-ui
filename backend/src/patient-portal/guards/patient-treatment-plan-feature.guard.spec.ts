import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PatientTreatmentPlanFeatureGuard } from './patient-treatment-plan-feature.guard';
import { PatientTreatmentPlanService } from '../patient-treatment-plan.service';

describe('PatientTreatmentPlanFeatureGuard', () => {
  let guard: PatientTreatmentPlanFeatureGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let plans: { getForPatient: jest.Mock };

  const makeContext = (user: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    plans = { getForPatient: jest.fn() };
    guard = new PatientTreatmentPlanFeatureGuard(
      reflector as unknown as Reflector,
      plans as unknown as PatientTreatmentPlanService,
    );
  });

  it('permite quando a rota não exige nenhuma feature', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(makeContext({ organizationId: 'org-1', patientId: 'patient-1' }))).resolves.toBe(
      true,
    );
    expect(plans.getForPatient).not.toHaveBeenCalled();
  });

  it('permite quando a feature exigida está habilitada', async () => {
    reflector.getAllAndOverride.mockReturnValue('diarioMiccional');
    plans.getForPatient.mockResolvedValue({ diarioMiccional: true, diarioEvacuatorio: false, cronometros: false });

    await expect(guard.canActivate(makeContext({ organizationId: 'org-1', patientId: 'patient-1' }))).resolves.toBe(
      true,
    );
    expect(plans.getForPatient).toHaveBeenCalledWith('org-1', 'patient-1');
  });

  it('rejeita quando a feature exigida está desabilitada', async () => {
    reflector.getAllAndOverride.mockReturnValue('diarioMiccional');
    plans.getForPatient.mockResolvedValue({ diarioMiccional: false, diarioEvacuatorio: false, cronometros: false });

    await expect(guard.canActivate(makeContext({ organizationId: 'org-1', patientId: 'patient-1' }))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
