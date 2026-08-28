import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import { withSerializationRetry } from './retry-transaction';

jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
}));

function serializationConflict(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Transaction failed due to a write conflict or a deadlock. Please retry your transaction.',
    { code: 'P2034', clientVersion: '7.0.0' },
  );
}

describe('withSerializationRetry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the result on first try when there is no conflict', async () => {
    const run = jest.fn().mockResolvedValue('ok');

    const result = await withSerializationRetry('test.op', run);

    expect(result).toBe('ok');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('retries on a P2034 serialization conflict and succeeds', async () => {
    const run = jest
      .fn()
      .mockRejectedValueOnce(serializationConflict())
      .mockRejectedValueOnce(serializationConflict())
      .mockResolvedValueOnce('ok');

    const result = await withSerializationRetry('test.op', run, 5, 1);

    expect(result).toBe('ok');
    expect(run).toHaveBeenCalledTimes(3);
    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxAttempts and reports to Sentry', async () => {
    const run = jest.fn().mockRejectedValue(serializationConflict());

    await expect(withSerializationRetry('test.op', run, 3, 1)).rejects.toThrow(
      /write conflict/,
    );

    expect(run).toHaveBeenCalledTimes(3);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-serialization errors', async () => {
    const other = new Error('boom');
    const run = jest.fn().mockRejectedValue(other);

    await expect(withSerializationRetry('test.op', run, 3, 1)).rejects.toThrow('boom');

    expect(run).toHaveBeenCalledTimes(1);
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('does not retry a Prisma error with a different code', async () => {
    const notFound = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.0.0',
    });
    const run = jest.fn().mockRejectedValue(notFound);

    await expect(withSerializationRetry('test.op', run, 3, 1)).rejects.toBe(notFound);

    expect(run).toHaveBeenCalledTimes(1);
  });
});
