import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://eu-assets.i.posthog.com https://eu.i.posthog.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://crests.football-data.org https://eu.i.posthog.com",
      "media-src 'self' blob: https://*.supabase.co https://*.supabase.in",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.stripe.com https://football-data.org https://eu.i.posthog.com https://eu-assets.i.posthog.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "worker-src 'self'",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  /*
   * Client Router Cache: reuse already-visited route segments on client-side
   * navigation (bottom-nav / back) instead of remounting the page and re-firing
   * its useEffect data loads. Without this, every tab switch re-runs the full
   * query waterfall (the home feed alone fires ~31 queries on every mount).
   * dynamic=180s keeps revisited screens instant for 3 min; realtime
   * subscriptions still push live updates, so staleness stays bounded.
   */
  experimental: {
    staleTimes: {
      dynamic: 180,
      static: 300,
    },
  },
  async headers() {
    return [
      {
        /* Security headers on all routes */
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        /* Service Worker — NEVER cache, always fetch latest */
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        /* App pages — no cache + noindex */
        source: '/app/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        /* Auth pages — no cache + noindex */
        source: '/auth/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        /* Card images — short cache so new card designs load quickly */
        source: '/cards/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, must-revalidate' },
        ],
      },
      {
        /* Other static images — long cache */
        source: '/:path*.(png|jpg|jpeg|svg|ico)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
};

export default withSentryConfig(nextConfig, {
  org: "comms-connect-gmbh",
  project: "dealbuddy",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
