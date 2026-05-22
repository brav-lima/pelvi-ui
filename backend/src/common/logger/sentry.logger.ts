import { ConsoleLogger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { sanitize } from './sanitize';

export class SentryLogger extends ConsoleLogger {
  override log(message: unknown, context?: string) {
    const clean = sanitize(message);
    super.log(clean, context);
    Sentry.addBreadcrumb({ message: clean, category: context, level: 'info' });
  }

  override warn(message: unknown, context?: string) {
    const clean = sanitize(message);
    super.warn(clean, context);
    Sentry.addBreadcrumb({ message: clean, category: context, level: 'warning' });
  }

  // error() logs context only as breadcrumb — the exception itself is captured
  // in AllExceptionsFilter via Sentry.captureException to avoid double-counting.
  override error(message: unknown, stackOrContext?: string, context?: string) {
    const clean = sanitize(message);
    super.error(clean, stackOrContext, context);
    Sentry.addBreadcrumb({
      message: clean,
      category: context ?? stackOrContext,
      level: 'error',
    });
  }

  override debug(message: unknown, context?: string) {
    const clean = sanitize(message);
    super.debug(clean, context);
    Sentry.addBreadcrumb({ message: clean, category: context, level: 'debug' });
  }

  override verbose(message: unknown, context?: string) {
    super.verbose(sanitize(message), context);
    // verbose skipped from Sentry — too noisy, no breadcrumb value
  }
}
