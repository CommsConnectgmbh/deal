import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://9bc56884ce05820cefc26ffcde9558dd@o4511507613089792.ingest.de.sentry.io/4511507635699792",
  tracesSampleRate: 0.1,
  // DSGVO: keine PII (IP/Cookies/Header) ohne expliziten Bedarf
  sendDefaultPii: false,
  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
