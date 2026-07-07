import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../strategies/jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const payload = user as JwtPayload;

    if (!requiredRoles.includes(payload.role as Role)) {
      Sentry.addBreadcrumb({
        category: 'authz',
        message: 'role denied',
        level: 'warning',
        data: { requiredRoles, role: payload.role },
      });
      Sentry.logger.warn('role denied', { requiredRoles, role: payload.role });
      throw new ForbiddenException('Acesso negado para este perfil');
    }

    return true;
  }
}
