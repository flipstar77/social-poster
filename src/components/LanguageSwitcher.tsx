'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

const LABELS: Record<string, string> = {
  de: 'DE',
  en: 'EN',
}

export default function LanguageSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  function switchLocale(newLocale: string) {
    router.replace(pathname, { locale: newLocale })
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {routing.locales.map((loc) => (
        <button
          key={loc}
          onClick={() => switchLocale(loc)}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: locale === loc ? 700 : 400,
            background: locale === loc ? 'rgba(99,102,241,0.15)' : 'transparent',
            border: locale === loc ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
            color: locale === loc ? '#6366f1' : '#71717a',
            cursor: 'pointer',
          }}
        >
          {LABELS[loc]}
        </button>
      ))}
    </div>
  )
}
