import { ConsoleLogger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { sanitize } from './sanitize';

export class SentryLogger extends ConsoleLogger {
  override log(message: unknown, context?: string) {
    const clean = sanitize(message);
    super.log(clean, context);
    Sentry.logger.info(clean, { context });
  }

  override warn(message: unknown, context?: string) {
    const clean = sanitize(message);
    super.warn(clean, context);
    Sentry.logger.warn(clean, { context });
  }

  // error() sends to Sentry Logs as context only — the exception itself is captured
  // in AllExceptionsFilter via Sentry.captureException to avoid double-counting.
  override error(message: unknown, stackOrContext?: string, context?: string) {
    const clean = sanitize(message);
    super.error(clean, stackOrContext, context);
    Sentry.logger.error(clean, { context: context ?? stackOrContext });
  }

  override debug(message: unknown, context?: string) {
    const clean = sanitize(message);
    super.debug(clean, context);
    Sentry.logger.debug(clean, { context });
  }

  override verbose(message: unknown, context?: string) {
    super.verbose(sanitize(message), context);
    // verbose skipped from Sentry — too noisy
  }
}
