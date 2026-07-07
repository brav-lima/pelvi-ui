import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.APP_VERSION,
  dist: process.env.GIT_SHA,
  environment: process.env.NODE_ENV,
  integrations: [
    nodeProfilingIntegration(),
    Sentry.prismaIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  profilesSampleRate: 1.0,
  enableLogs: true,
  ignoreTransactions: [/\/health$/],
});
