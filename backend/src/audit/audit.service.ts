import { Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  organizationId: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        details: entry.details ? (entry.details as object) : undefined,
        ipAddress: entry.ipAddress,
      },
    });

    Sentry.addBreadcrumb({
      category: 'audit',
      message: `${entry.action} ${entry.entity}`,
      level: 'info',
      data: { entityId: entry.entityId, organizationId: entry.organizationId },
    });
    Sentry.logger.info(`${entry.action} ${entry.entity}`, {
      userId: entry.userId,
      organizationId: entry.organizationId,
      entityId: entry.entityId,
    });
  }
}
