import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Stratégie RSI 5s + Martingale — Simulateur Pocket Option',
  description: 'Simulateur et backtester de la stratégie RSI 5s confirmée par la mèche avec martingale.',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: 'black',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  )
}
