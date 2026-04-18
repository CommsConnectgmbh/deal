import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { ThemeScript } from '@/hooks/useTheme'
import PostHogProvider from '@/components/PostHogProvider'
import ServiceWorkerUpdater from '@/components/ServiceWorkerUpdater'

export const metadata: Metadata = {
  title: { default: 'DealBuddy – Compete. Win. Reign.', template: '%s | DealBuddy' },
  description: 'Fordere Freunde heraus, kämpfe um Ehre und Status. Die App für Challenges, Tipps und Duelle. Erstelle Deals, gewinne Battle Cards und steige im Ranking auf.',
  keywords: ['DealBuddy', 'Challenge App', 'Duelle', 'Deals', 'Battle Cards', 'Freunde herausfordern', 'Social Competition', 'Tipping', 'Sporttipps'],
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'DealBuddy' },
  icons: { apple: '/icon-512.png', icon: '/icon-512.png' },
  metadataBase: new URL('https://app.deal-buddy.app'),
  alternates: { canonical: 'https://app.deal-buddy.app' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: 'https://app.deal-buddy.app',
    siteName: 'DealBuddy',
    title: 'DealBuddy – Compete. Win. Reign.',
    description: 'Fordere Freunde heraus, kämpfe um Ehre und Status. Die App für Challenges, Tipps und Duelle.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'DealBuddy – Compete. Win. Reign.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DealBuddy – Compete. Win. Reign.',
    description: 'Fordere Freunde heraus, kämpfe um Ehre und Status.',
    images: ['/opengraph-image'],
  },
}

export const viewport: Viewport = {
  themeColor: '#FBFBFD',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700;800&subset=latin&display=swap" rel="stylesheet" />
        <link rel="preload" href="/battle_card.webp" as="image" type="image/webp" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <ThemeScript />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'DealBuddy',
            url: 'https://app.deal-buddy.app',
            description: 'Fordere Freunde heraus, kämpfe um Ehre und Status. Die App für Challenges, Tipps und Duelle.',
            applicationCategory: 'SocialNetworkingApplication',
            operatingSystem: 'iOS, Android, Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
            author: { '@type': 'Organization', name: 'DealBuddy', url: 'https://deal-buddy.app' },
          })}}
        />
        <LanguageProvider>
          <AuthProvider>
            <PostHogProvider>
              <ServiceWorkerUpdater />
              {children}
            </PostHogProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
