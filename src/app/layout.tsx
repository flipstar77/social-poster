import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Social Poster AI — Instagram-Posts für Restaurants, automatisch',
  description: 'Bild hochladen, KI schreibt die Caption, direkt auf Instagram posten. Spart 2–3 Stunden pro Woche – ohne Agentur.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
