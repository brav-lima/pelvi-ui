import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PatientJwtPayload } from '../strategies/patient-jwt.strategy';

export const CurrentPatient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PatientJwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as PatientJwtPayload;
  },
);
