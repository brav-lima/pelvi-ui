import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_FULL_PATIENT_SESSION } from '../decorators/require-full-patient-session.decorator';
import { PatientJwtPayload } from '../strategies/patient-jwt.strategy';

@Injectable()
export class PatientScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresFullSession = this.reflector.getAllAndOverride<boolean>(REQUIRE_FULL_PATIENT_SESSION, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiresFullSession) return true;

    const { user } = context.switchToHttp().getRequest();
    const payload = user as PatientJwtPayload;

    if (payload.scope !== 'patient') {
      throw new ForbiddenException('Sessão de consentimento não pode acessar este recurso');
    }

    return true;
  }
}
