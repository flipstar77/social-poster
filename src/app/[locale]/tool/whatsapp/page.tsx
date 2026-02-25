'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface WaMessage {
  id: string
  direction: 'inbound' | 'outbound'
  from_number: string
  to_number: string
  content: string
  status: string
  created_at: string
}

export default function WhatsAppDashboard() {
  const t = useTranslations('tool.whatsapp')

  const [greeting, setGreeting] = useState('')
  const [openingHours, setOpeningHours] = useState('')
  const [menuUrl, setMenuUrl] = useState('')
  const [keywords, setKeywords] = useState<Record<string, string>>({})
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true)
  const [messages, setMessages] = useState<WaMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  // New keyword form
  const [newKeyword, setNewKeyword] = useState('')
  const [newResponse, setNewResponse] = useState('')

  // Load profile + messages
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('wa_greeting, wa_opening_hours, wa_menu_url, wa_keywords, wa_auto_reply_enabled')
        .eq('id', user.id)
        .single()

      if (profile) {
        if (profile.wa_greeting) setGreeting(profile.wa_greeting)
        if (profile.wa_opening_hours) setOpeningHours(profile.wa_opening_hours)
        if (profile.wa_menu_url) setMenuUrl(profile.wa_menu_url)
        if (profile.wa_keywords) setKeywords(profile.wa_keywords as Record<string, string>)
        if (profile.wa_auto_reply_enabled !== null) setAutoReplyEnabled(profile.wa_auto_reply_enabled)
      }

      // Load messages
      try {
        const res = await fetch('/api/whatsapp/messages')
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages || [])
        }
      } catch {}

      setLoading(false)
    }
    load()
  }, [])

  const saveField = useCallback(async (fields: Record<string, unknown>) => {
    setSaveStatus(t('saved'))
    try {
      await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
    } catch {}
    setTimeout(() => setSaveStatus(null), 2000)
  }, [t])

  const addKeyword = useCallback(() => {
    if (!newKeyword.trim() || !newResponse.trim()) return
    const updated = { ...keywords, [newKeyword.trim().toLowerCase()]: newResponse.trim() }
    setKeywords(updated)
    setNewKeyword('')
    setNewResponse('')
    saveField({ wa_keywords: updated })
  }, [newKeyword, newResponse, keywords, saveField])

  const removeKeyword = useCallback((key: string) => {
    const updated = { ...keywords }
    delete updated[key]
    setKeywords(updated)
    saveField({ wa_keywords: updated })
  }, [keywords, saveField])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: '#25D366', borderRadius: '50%' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <Link href="/tool" style={{ color: 'var(--text-muted)', fontSize: 14, textDecoration: 'none' }}>
              {t('backToTool')}
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{t('title')}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 2 }}>{t('description')}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {saveStatus && (
              <span style={{ color: '#25D366', fontSize: 13, fontWeight: 500 }}>{saveStatus}</span>
            )}
            <span style={{
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              background: 'rgba(234, 179, 8, 0.15)',
              color: '#eab308',
            }}>
              {t('testMode')}
            </span>
          </div>
        </div>

        {/* Auto-Reply Toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          marginBottom: '1.5rem',
        }}>
          <span style={{ fontWeight: 600 }}>{t('autoReply')}</span>
          <button
            onClick={() => {
              const next = !autoReplyEnabled
              setAutoReplyEnabled(next)
              saveField({ wa_auto_reply_enabled: next })
            }}
            style={{
              width: 48,
              height: 26,
              borderRadius: 13,
              border: 'none',
              cursor: 'pointer',
              background: autoReplyEnabled ? '#25D366' : 'var(--border)',
              position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute',
              top: 3,
              left: autoReplyEnabled ? 25 : 3,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>

        {/* Greeting */}
        <Section label={t('greeting')}>
          <textarea
            value={greeting}
            onChange={e => setGreeting(e.target.value)}
            onBlur={() => saveField({ wa_greeting: greeting || null })}
            placeholder={t('greetingPlaceholder')}
            rows={3}
            style={inputStyle}
          />
        </Section>

        {/* Opening Hours */}
        <Section label={t('openingHours')}>
          <textarea
            value={openingHours}
            onChange={e => setOpeningHours(e.target.value)}
            onBlur={() => saveField({ wa_opening_hours: openingHours || null })}
            placeholder={t('openingHoursPlaceholder')}
            rows={2}
            style={inputStyle}
          />
        </Section>

        {/* Menu URL */}
        <Section label={t('menuUrl')}>
          <input
            type="url"
            value={menuUrl}
            onChange={e => setMenuUrl(e.target.value)}
            onBlur={() => saveField({ wa_menu_url: menuUrl || null })}
            placeholder={t('menuUrlPlaceholder')}
            style={inputStyle}
          />
        </Section>

        {/* Keywords */}
        <Section label={t('keywords')}>
          {Object.entries(keywords).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{
                padding: '6px 12px',
                background: 'rgba(37, 211, 102, 0.1)',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#25D366',
                whiteSpace: 'nowrap',
              }}>
                {key}
              </span>
              <span style={{ flex: 1, fontSize: 14, color: 'var(--text-muted)' }}>{val}</span>
              <button
                onClick={() => removeKeyword(key)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 18,
                  padding: '0 4px',
                }}
              >
                &times;
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              placeholder={t('keywordPlaceholder')}
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              value={newResponse}
              onChange={e => setNewResponse(e.target.value)}
              placeholder={t('responsePlaceholder')}
              onKeyDown={e => e.key === 'Enter' && addKeyword()}
              style={{ ...inputStyle, flex: 2 }}
            />
            <button
              onClick={addKeyword}
              disabled={!newKeyword.trim() || !newResponse.trim()}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#25D366',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                opacity: (!newKeyword.trim() || !newResponse.trim()) ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              +
            </button>
          </div>
        </Section>

        {/* Message Log */}
        <Section label={t('messageLog')}>
          {messages.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '2rem 0' }}>
              {t('noMessages')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: msg.direction === 'inbound' ? 'rgba(37, 211, 102, 0.05)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: msg.direction === 'inbound' ? '#25D366' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    minWidth: 70,
                  }}>
                    {msg.direction === 'inbound' ? t('inbound') : t('outbound')}
                  </span>
                  <span style={{ flex: 1, fontSize: 14 }}>{msg.content}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(msg.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: '1.5rem',
      padding: '1rem',
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
    }}>
      <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 14,
  fontFamily: 'inherit',
  resize: 'vertical' as const,
  boxSizing: 'border-box',
}
