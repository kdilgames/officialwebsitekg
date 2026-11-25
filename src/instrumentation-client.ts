import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

export const onRouterTransitionStart: typeof Sentry.captureRouterTransitionStart = (
  ...args
) => {
  if (!dsn) return;
  return Sentry.captureRouterTransitionStart(...args);
};
