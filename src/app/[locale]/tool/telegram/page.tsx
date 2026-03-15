'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

interface TelegramAccount {
  chat_id: number
  username: string | null
  linked_at: string
}

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'positivealerts_bot'

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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('title')}</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">{t('description')}</p>
        </div>

        {/* Connection Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
          {loading ? (
            <div className="text-zinc-400 text-sm">Laden...</div>
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
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {t('linked')}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        ✓ Aktiv
                      </span>
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
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
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl">
                  ✈️
                </div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white">{t('linkTitle')}</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('linkDescription')}</div>
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
                  {/* Two options: deep link (desktop) + QR code (mobile) */}
                  <div className="flex gap-3 mb-3">
                    {/* Deep link button */}
                    <a
                      href={`https://t.me/${BOT_USERNAME}?start=${linkCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
                    >
                      <span>✈️</span>
                      <span>In Telegram öffnen</span>
                    </a>

                    {/* QR code for mobile */}
                    <details className="relative">
                      <summary className="flex items-center justify-center gap-1.5 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg cursor-pointer transition-colors text-sm font-medium text-zinc-700 dark:text-zinc-300 list-none select-none">
                        📱 QR-Code
                      </summary>
                      <div className="absolute right-0 top-full mt-2 z-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 shadow-lg text-center">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(`https://t.me/${BOT_USERNAME}?start=${linkCode}`)}&size=160x160&margin=10`}
                          alt="QR Code"
                          width={160}
                          height={160}
                          className="rounded-lg"
                        />
                        <div className="text-xs text-zinc-400 mt-2">Mit Handy scannen</div>
                      </div>
                    </details>
                  </div>

                  <div className="text-xs text-zinc-400 dark:text-zinc-500 text-center mb-3">
                    Läuft ab in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                  </div>

                  <details className="text-sm">
                    <summary className="text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300">
                      Manuell verknüpfen
                    </summary>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 font-mono text-lg font-bold tracking-widest text-center py-2 px-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white select-all">
                        {linkCode}
                      </div>
                      <button
                        onClick={copyCode}
                        className="px-3 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-lg transition-colors text-sm font-medium"
                      >
                        {copied ? '✓' : 'Kopieren'}
                      </button>
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      Sende <code className="font-mono">/start {linkCode}</code> im Bot
                    </div>
                  </details>

                  <button
                    onClick={generateCode}
                    className="mt-3 w-full text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                  >
                    Neuen Code generieren
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="font-semibold text-zinc-900 dark:text-white mb-4">{t('howItWorks')}</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { step: t('step1'), desc: t('step1Desc') },
              { step: t('step2'), desc: t('step2Desc') },
              { step: t('step3'), desc: t('step3Desc') },
              { step: t('step4'), desc: t('step4Desc') },
            ].map((item, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="font-medium text-zinc-900 dark:text-white text-sm">{item.step}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{item.desc}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Templates</h3>
            <div className="flex flex-wrap gap-2">
              {['🍽️ Tagesmenü', '🎉 Happy Hour', '✨ Neue Sorte', '💰 Angebot'].map(t => (
                <span
                  key={t}
                  className="text-xs px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full"
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
