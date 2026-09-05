import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';

// Postgres aborts a SERIALIZABLE transaction whenever it detects a conflicting
// concurrent transaction (40001) or a deadlock (40P01) — Prisma surfaces both
// as P2034. The abort is atomic (nothing was committed), so re-running the same
// transaction from scratch is safe and is exactly what Postgres' own docs
// prescribe for SERIALIZABLE clients.
const RETRYABLE_PRISMA_CODE = 'P2034';
// Raw SQLSTATE codes: serialization_failure + deadlock_detected. Postgres often
// only detects a SERIALIZABLE conflict at COMMIT time; with the Prisma 7 pg
// driver adapter that commit-time failure escapes `$transaction()` as an
// unconverted DriverAdapterError instead of a P2034 PrismaClientKnownRequestError,
// so we also match it here.
const RETRYABLE_PG_CODES = new Set(['40001', '40P01']);
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 30;

const logger = new Logger('PrismaRetry');

function isSerializationConflict(err: unknown): boolean {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === RETRYABLE_PRISMA_CODE
  ) {
    return true;
  }

  // DriverAdapterError from @prisma/driver-adapter-utils — duck-typed to avoid a
  // hard dependency on the adapter package. `cause` is the driver error payload.
  if (
    err instanceof Error &&
    err.name === 'DriverAdapterError' &&
    typeof (err as { cause?: unknown }).cause === 'object' &&
    (err as { cause?: unknown }).cause !== null
  ) {
    const cause = (err as { cause: { kind?: string; code?: string } }).cause;
    return (
      cause.kind === 'TransactionWriteConflict' ||
      (typeof cause.code === 'string' && RETRYABLE_PG_CODES.has(cause.code))
    );
  }

  return false;
}

function errorCode(err: unknown): string | undefined {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return err.code;
  const cause = (err as { cause?: { kind?: string; code?: string } })?.cause;
  return cause?.code ?? cause?.kind;
}

function backoffDelay(attempt: number, baseDelayMs: number): Promise<void> {
  const exponential = baseDelayMs * 2 ** (attempt - 1);
  const jitter = Math.random() * exponential * 0.5;
  return new Promise((resolve) => setTimeout(resolve, exponential + jitter));
}

/**
 * Retries `run` on Postgres serialization/deadlock conflicts — whether Prisma
 * surfaces them as P2034 or (for a commit-time abort under the pg driver adapter)
 * as a raw DriverAdapterError — with capped exponential backoff + jitter. Any
 * other error — including our
 * own ConflictException thrown from inside the transaction for a genuine
 * double-booking — propagates immediately, untouched.
 */
export async function withSerializationRetry<T>(
  operation: string,
  run: () => Promise<T>,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs: number = DEFAULT_BASE_DELAY_MS,
): Promise<T> {
  let attempt = 0;

  for (;;) {
    attempt += 1;
    try {
      return await run();
    } catch (err) {
      if (!isSerializationConflict(err) || attempt >= maxAttempts) {
        if (isSerializationConflict(err)) {
          logger.warn(
            `${operation}: giving up after ${attempt} attempts (serialization conflict)`,
          );
          Sentry.captureMessage(
            `Prisma serialization conflict exhausted retries: ${operation}`,
            { level: 'warning', extra: { attempt, code: errorCode(err) } },
          );
        }
        throw err;
      }

      logger.warn(
        `${operation}: serialization conflict, retrying (attempt ${attempt}/${maxAttempts})`,
      );
      Sentry.addBreadcrumb({
        category: 'db',
        message: 'prisma serialization conflict, retrying',
        level: 'warning',
        data: { operation, attempt, code: errorCode(err) },
      });

      await backoffDelay(attempt, baseDelayMs);
    }
  }
}
