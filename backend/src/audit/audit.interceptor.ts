import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

const AUDITED_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

const ENTITY_MAP: Record<string, string> = {
  patients: 'Patient',
  appointments: 'Appointment',
  procedures: 'Procedure',
  professionals: 'Professional',
  anamneses: 'Anamnesis',
  evolutions: 'Evolution',
  financial: 'Financial',
  persons: 'Person',
  organizations: 'Organization',
};

function pathSegments(path: string): string[] {
  return path
    .split('?')[0]
    .replace(/^\/api\/(v\d+\/)?/, '')
    .split('/');
}

function extractEntity(path: string): string {
  const segments = pathSegments(path);
  return ENTITY_MAP[segments[0]] ?? segments[0];
}

function extractEntityId(path: string): string | undefined {
  const segments = pathSegments(path);
  // Pattern: entity/:id or entity/:id/action
  if (segments.length >= 2 && segments[1] && !ENTITY_MAP[segments[1]]) {
    return segments[1];
  }
  return undefined;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method: string = request.method;

    if (!AUDITED_METHODS.includes(method)) {
      return next.handle();
    }

    const user = request.user;
    if (!user?.sub || !user?.organizationId) {
      return next.handle();
    }

    const path: string = request.url ?? request.path;
    const entity = extractEntity(path);
    const entityId = extractEntityId(path);

    const actionMap: Record<string, string> = {
      POST: 'CREATE',
      PATCH: 'UPDATE',
      PUT: 'UPDATE',
      DELETE: 'DELETE',
    };
    const action = actionMap[method] ?? method;

    return next.handle().pipe(
      tap(() => {
        this.auditService
          .log({
            organizationId: user.organizationId,
            userId: user.sub,
            action,
            entity,
            entityId,
            ipAddress: request.ip,
          })
          .catch(() => {
            // Audit logging should not block requests
          });
      }),
    );
  }
}
