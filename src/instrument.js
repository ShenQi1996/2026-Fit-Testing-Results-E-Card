import * as Sentry from '@sentry/react';

// Public browser DSN (ingest only). Override with SENTRY_DSN at build time if needed.
const DEFAULT_SENTRY_DSN =
  'https://610bca12123e868c8032b49fedd09037@o4512443366899712.ingest.us.sentry.io/4512443402420224';

const isStaging = process.env.APP_ENV === 'staging';
const environment = isStaging ? 'staging' : 'production';
const dsn = (process.env.SENTRY_DSN || DEFAULT_SENTRY_DSN).trim();

Sentry.init({
  dsn,
  environment,
  integrations: [
    Sentry.browserTracingIntegration(),
    // Fit-test forms hold PII — mask replay content by default.
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  enableLogs: true,
  // Full tracing on staging; sample in production.
  tracesSampleRate: isStaging ? 1.0 : 0.2,
  // Capture a few sessions on staging; errors always get a replay sample.
  replaysSessionSampleRate: isStaging ? 0.2 : 0.05,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: false,
});
