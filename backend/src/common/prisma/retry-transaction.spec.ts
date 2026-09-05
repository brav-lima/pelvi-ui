import { Prisma } from '@prisma/client';
import { DriverAdapterError } from '@prisma/driver-adapter-utils';
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

// Postgres often only detects a SERIALIZABLE conflict at COMMIT time. With the
// Prisma 7 pg driver adapter, that commit-time 40001 escapes `$transaction()`
// as a raw DriverAdapterError (kind "TransactionWriteConflict") — the client
// never wraps it as P2034.
function commitTimeWriteConflict(): DriverAdapterError {
  return new DriverAdapterError({ kind: 'TransactionWriteConflict' });
}

// A commit-time deadlock surfaces the same way but with the generic "postgres"
// payload kind and the raw SQLSTATE.
function commitTimeDeadlock(): DriverAdapterError {
  return new DriverAdapterError({
    kind: 'postgres',
    code: '40P01',
    severity: 'ERROR',
    message: 'deadlock detected',
  } as never);
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

  it('retries a commit-time DriverAdapterError write conflict and succeeds', async () => {
    const run = jest
      .fn()
      .mockRejectedValueOnce(commitTimeWriteConflict())
      .mockResolvedValueOnce('ok');

    const result = await withSerializationRetry('test.op', run, 5, 1);

    expect(result).toBe('ok');
    expect(run).toHaveBeenCalledTimes(2);
    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
  });

  it('retries a commit-time DriverAdapterError deadlock and succeeds', async () => {
    const run = jest
      .fn()
      .mockRejectedValueOnce(commitTimeDeadlock())
      .mockResolvedValueOnce('ok');

    const result = await withSerializationRetry('test.op', run, 5, 1);

    expect(result).toBe('ok');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('gives up on a persistent commit-time DriverAdapterError and reports to Sentry', async () => {
    const run = jest.fn().mockRejectedValue(commitTimeWriteConflict());

    await expect(withSerializationRetry('test.op', run, 3, 1)).rejects.toThrow(
      /TransactionWriteConflict/,
    );

    expect(run).toHaveBeenCalledTimes(3);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });

  it('does not retry a DriverAdapterError that is not a serialization conflict', async () => {
    const notNull = new DriverAdapterError({
      kind: 'postgres',
      code: '23502',
      severity: 'ERROR',
      message: 'null value violates not-null constraint',
    } as never);
    const run = jest.fn().mockRejectedValue(notNull);

    await expect(withSerializationRetry('test.op', run, 3, 1)).rejects.toBe(notNull);

    expect(run).toHaveBeenCalledTimes(1);
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
