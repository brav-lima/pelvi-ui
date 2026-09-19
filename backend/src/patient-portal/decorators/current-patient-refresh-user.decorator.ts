import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface PatientRefreshUser {
  accountId: string;
  linkId: string;
  jti: string;
}

export const CurrentPatientRefreshUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PatientRefreshUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as PatientRefreshUser;
  },
);
