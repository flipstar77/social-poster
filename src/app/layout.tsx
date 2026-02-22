import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FlowingPost — KI Social Media Posts für Restaurants',
  description: 'Bild hochladen, KI schreibt die Caption, direkt auf Instagram & Co. posten. Spart 2–3 Stunden pro Woche – ohne Agentur.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
