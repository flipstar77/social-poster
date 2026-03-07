'use client'

import { usePathname } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/tool', label: 'Photo Posts', icon: '📸' },
  { href: '/tool/video', label: 'Video Reels', icon: '🎬' },
  { href: '/tool/design', label: 'Design Editor', icon: '🎨' },
  { href: '/tool/keyword-research', label: 'Keywords', icon: '🔍' },
  { href: '/tool/telegram', label: 'Telegram Bot', icon: '✈️' },
  { href: '/tool/whatsapp', label: 'WhatsApp Bot', icon: '💬' },
  { href: '/tool/tina', label: 'Tina Thunder', icon: '⚡' },
] as const

function isActive(pathname: string, href: string): boolean {
  // Exact match for /tool, prefix match for sub-routes
  if (href === '/tool') return pathname.endsWith('/tool') || pathname.endsWith('/tool/')
  return pathname.includes(href)
}

export default function ToolLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-dvh">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-3 left-3 z-50 lg:hidden w-9 h-9 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-sm hover:border-[var(--accent)] transition-colors"
        aria-label="Toggle menu"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Backdrop on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-40 h-dvh w-56 shrink-0
        bg-[var(--card)] border-r border-[var(--border)]
        flex flex-col transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="px-4 py-4 border-b border-[var(--border)]">
          <Link href="/tool" className="text-lg font-bold block">
            Flowing<span className="text-[var(--accent)]">Post</span>
          </Link>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Internal Dashboard</p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors
                  ${active
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-r-2 border-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5'
                  }
                `}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--border)]">
          <Link
            href="/"
            className="text-xs text-[var(--text-muted)] hover:text-white transition-colors"
          >
            ← Back to Website
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
