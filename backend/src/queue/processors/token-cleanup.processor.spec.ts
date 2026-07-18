import * as Sentry from '@sentry/nestjs';
import { Job } from 'bullmq';
import { TokenCleanupProcessor } from './token-cleanup.processor';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

const makeJob = (overrides = {}): Job =>
  ({ id: 'test-job-id', ...overrides }) as unknown as Job;

describe('TokenCleanupProcessor', () => {
  let processor: TokenCleanupProcessor;
  let prisma: jest.Mocked<Pick<PrismaService, 'refreshToken'>>;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = {
      refreshToken: {
        deleteMany: jest.fn(),
      } as any,
    };

    processor = new TokenCleanupProcessor(prisma as unknown as PrismaService);
  });

  it('deleta tokens expirados e revogados e retorna a contagem', async () => {
    (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 42 });

    const result = await processor.process(makeJob());

    expect(result).toEqual({ deleted: 42 });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledTimes(1);

    const { where } = (prisma.refreshToken.deleteMany as jest.Mock).mock.calls[0][0];
    expect(where.OR).toHaveLength(2);
    expect(where.OR[0]).toHaveProperty('expiresAt.lt');
    expect(where.OR[1]).toHaveProperty('revokedAt.lt');

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('retorna deleted: 0 quando não há tokens para purgar', async () => {
    (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

    const result = await processor.process(makeJob());

    expect(result).toEqual({ deleted: 0 });
  });

  it('captura exceção no Sentry e relança quando o Prisma falha', async () => {
    const boom = new Error('db error');
    (prisma.refreshToken.deleteMany as jest.Mock).mockRejectedValue(boom);

    await expect(processor.process(makeJob())).rejects.toThrow('db error');

    expect(Sentry.captureException).toHaveBeenCalledWith(boom);
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'queue',
      message: 'token-cleanup processing failed',
      level: 'error',
      data: { jobId: 'test-job-id' },
    });
  });
});
