import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Job } from 'bullmq';
import { TOKEN_CLEANUP_QUEUE } from '../jobs/token-cleanup.job';
import { PrismaService } from '../../prisma/prisma.service';

const REVOKED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

@Processor(TOKEN_CLEANUP_QUEUE)
export class TokenCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(TokenCleanupProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<{ deleted: number }> {
    try {
      // Deleta tokens expirados OU revogados há mais de 30 dias
      const now = new Date();
      const revokedCutoff = new Date(Date.now() - REVOKED_RETENTION_MS);

      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { revokedAt: { lt: revokedCutoff } },
          ],
        },
      });

      this.logger.log({ msg: 'Tokens purgados', count: result.count, jobId: job.id });
      return { deleted: result.count };
    } catch (err) {
      Sentry.addBreadcrumb({
        category: 'queue',
        message: 'token-cleanup processing failed',
        level: 'error',
        data: { jobId: job.id },
      });
      Sentry.captureException(err);
      throw err;
    }
  }
}
