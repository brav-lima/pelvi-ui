import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RefreshUser {
  personId: string;
  organizationId: string;
  role: string;
  jti: string;
}

export const CurrentRefreshUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RefreshUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as RefreshUser;
  },
);
