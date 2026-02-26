'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface TelegramAccount {
  chat_id: number
  username: string | null
  linked_at: string
}

export default function TelegramDashboard() {
  const t = useTranslations('tool.telegram')

  const [account, setAccount] = useState<TelegramAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [codeExpiry, setCodeExpiry] = useState<number | null>(null) // timestamp
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/telegram/link')
      .then(r => r.json())
      .then(d => setAccount(d.account ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Countdown timer for code expiry
  useEffect(() => {
    if (!codeExpiry) return
    const interval = setInterval(() => {
      if (Date.now() >= codeExpiry) {
        setLinkCode(null)
        setCodeExpiry(null)
        clearInterval(interval)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [codeExpiry])

  async function generateCode() {
    setGenerating(true)
    try {
      const res = await fetch('/api/telegram/link', { method: 'POST' })
      const data = await res.json()
      if (data.token) {
        setLinkCode(data.token)
        setCodeExpiry(Date.now() + 15 * 60 * 1000)
      }
    } catch {}
    setGenerating(false)
  }

  async function unlink() {
    if (!confirm(t('unlinkConfirm'))) return
    await fetch('/api/telegram/link', { method: 'DELETE' })
    setAccount(null)
  }

  async function copyCode() {
    if (!linkCode) return
    await navigator.clipboard.writeText(`/start ${linkCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const secondsLeft = codeExpiry ? Math.max(0, Math.round((codeExpiry - Date.now()) / 1000)) : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/tool" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            {t('backToTool')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{t('title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('description')}</p>
        </div>

        {/* Connection Card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
          {loading ? (
            <div className="text-gray-400 text-sm">Laden...</div>
          ) : account ? (
            /* Connected state */
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xl">
                    ✈️
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {t('linked')}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        ✓ Aktiv
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {account.username ? `@${account.username}` : `Chat ID: ${account.chat_id}`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={unlink}
                  className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                >
                  {t('unlink')}
                </button>
              </div>

              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                ✅ Dein Telegram-Account ist verknüpft. Sende dem Bot ein Foto, um loszulegen!
              </div>
            </div>
          ) : (
            /* Not connected state */
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl">
                  ✈️
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{t('linkTitle')}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{t('linkDescription')}</div>
                </div>
              </div>

              {!linkCode ? (
                <button
                  onClick={generateCode}
                  disabled={generating}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                >
                  {generating ? 'Generiere...' : t('generateCode')}
                </button>
              ) : (
                <div>
                  {/* One-click deep link — opens Telegram with /start CODE pre-filled */}
                  <a
                    href={`https://t.me/positivealerts_bot?start=${linkCode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors mb-3"
                  >
                    <span>✈️</span>
                    <span>In Telegram öffnen & verknüpfen</span>
                  </a>

                  <div className="text-xs text-gray-400 dark:text-gray-500 text-center mb-3">
                    Läuft ab in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                  </div>

                  <details className="text-sm">
                    <summary className="text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300">
                      Manuell verknüpfen
                    </summary>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 font-mono text-lg font-bold tracking-widest text-center py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white select-all">
                        {linkCode}
                      </div>
                      <button
                        onClick={copyCode}
                        className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium"
                      >
                        {copied ? '✓' : 'Kopieren'}
                      </button>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Sende <code className="font-mono">/start {linkCode}</code> im Bot
                    </div>
                  </details>

                  <button
                    onClick={generateCode}
                    className="mt-3 w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    Neuen Code generieren
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">{t('howItWorks')}</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { step: t('step1'), desc: t('step1Desc') },
              { step: t('step2'), desc: t('step2Desc') },
              { step: t('step3'), desc: t('step3Desc') },
              { step: t('step4'), desc: t('step4Desc') },
            ].map((item, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="font-medium text-gray-900 dark:text-white text-sm">{item.step}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Templates</h3>
            <div className="flex flex-wrap gap-2">
              {['🍽️ Tagesmenü', '🎉 Happy Hour', '✨ Neue Sorte', '💰 Angebot'].map(t => (
                <span
                  key={t}
                  className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
