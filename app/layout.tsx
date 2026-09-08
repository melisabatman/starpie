import type { Metadata } from 'next'
import './globals.css'
import AOSInit from '@/components/AOSInit'
import AppNavigation from '@/components/AppNavigation'
import { LanguageProvider } from '@/components/LanguageProvider'
import { PresenceProvider } from '@/lib/hooks/usePresence'

export const metadata: Metadata = {
  title: 'Starpie — Profilini Paylaş',
  description: 'Starpie ile profilini oluştur, kendini tanıt ve topluluğa katıl.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('starpie-theme')||'pink';document.documentElement.setAttribute('data-theme',t);var l=localStorage.getItem('starpie-lang')||'tr';document.documentElement.setAttribute('lang',l);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <LanguageProvider>
          <PresenceProvider>
            <AOSInit />
            <AppNavigation />
            {children}
          </PresenceProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
