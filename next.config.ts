import type { NextConfig } from "next";

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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://crests.football-data.org",
      "media-src 'self' blob: https://*.supabase.co https://*.supabase.in",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.stripe.com https://football-data.org",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "worker-src 'self'",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
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

export default nextConfig;
