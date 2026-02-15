import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Social Poster AI — Automated Social Media Content',
  description: 'Upload photos, generate captions with AI, and schedule posts to Instagram & TikTok',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
