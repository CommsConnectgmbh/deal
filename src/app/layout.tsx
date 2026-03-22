import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { ThemeScript } from '@/hooks/useTheme'
import PostHogProvider from '@/components/PostHogProvider'

export const metadata: Metadata = {
  title: { default: 'DealBuddy', template: '%s | DealBuddy' },
  description: 'Fordere Freunde heraus, wette um Ehre und Status. Die App f\u00fcr Challenges, Tipps und Wettbewerbe.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'DealBuddy' },
  icons: { apple: '/icon-512.png', icon: '/icon-512.png' },
  metadataBase: new URL('https://app.deal-buddy.app'),
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: 'https://app.deal-buddy.app',
    siteName: 'DealBuddy',
    title: 'DealBuddy \u2013 Compete. Win. Reign.',
    description: 'Fordere Freunde heraus, wette um Ehre und Status.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DealBuddy \u2013 Compete. Win. Reign.',
    description: 'Fordere Freunde heraus, wette um Ehre und Status.',
  },
}

export const viewport: Viewport = {
  themeColor: '#080808',
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
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="preload" href="/battle_card.webp" as="image" type="image/webp" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <ThemeScript />
      </head>
      <body>
        <LanguageProvider>
          <AuthProvider>
            <PostHogProvider>
              {children}
            </PostHogProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
