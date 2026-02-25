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

interface WaAccount {
  id: string
  phone_number_id: string
  display_phone_number: string | null
  business_name: string | null
  status: string
}

export default function WhatsAppDashboard() {
  const t = useTranslations('tool.whatsapp')

  // Connection state
  const [account, setAccount] = useState<WaAccount | null>(null)
  const [connectPhoneId, setConnectPhoneId] = useState('')
  const [connectToken, setConnectToken] = useState('')
  const [connectLoading, setConnectLoading] = useState(false)

  // Config state
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

  // Load account + profile + messages
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load WhatsApp account
      try {
        const res = await fetch('/api/whatsapp/connect')
        if (res.ok) {
          const data = await res.json()
          setAccount(data.account || null)
        }
      } catch {}

      // Load profile config
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

  const handleConnect = useCallback(async () => {
    if (!connectPhoneId.trim() || !connectToken.trim()) return
    setConnectLoading(true)
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: connectPhoneId.trim(),
          access_token: connectToken.trim(),
        }),
      })
      if (res.ok) {
        // Reload account
        const accountRes = await fetch('/api/whatsapp/connect')
        if (accountRes.ok) {
          const data = await accountRes.json()
          setAccount(data.account || null)
        }
        setConnectPhoneId('')
        setConnectToken('')
      }
    } catch {}
    setConnectLoading(false)
  }, [connectPhoneId, connectToken])

  const handleDisconnect = useCallback(async () => {
    if (!confirm(t('disconnectConfirm'))) return
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'DELETE' })
      if (res.ok) setAccount(null)
    } catch {}
  }, [t])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: '#25D366', borderRadius: '50%' }} />
      </div>
    )
  }

  const isConnected = !!account

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
              background: isConnected ? 'rgba(37, 211, 102, 0.15)' : 'rgba(234, 179, 8, 0.15)',
              color: isConnected ? '#25D366' : '#eab308',
            }}>
              {isConnected ? t('connected') : t('notConnected')}
            </span>
          </div>
        </div>

        {/* Connection Card */}
        {isConnected ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem',
            background: 'var(--card)',
            border: '1px solid rgba(37, 211, 102, 0.3)',
            borderRadius: 12,
            marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(37, 211, 102, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.75.75 0 00.917.918l4.462-1.496A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.388 0-4.593-.813-6.35-2.18l-.253-.2-2.627.881.881-2.626-.2-.253A9.946 9.946 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {account.display_phone_number || account.phone_number_id}
                </div>
                {account.business_name && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{account.business_name}</div>
                )}
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t('disconnect')}
            </button>
          </div>
        ) : (
          <div style={{
            padding: '1.5rem',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            marginBottom: '1.5rem',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t('connectTitle')}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{t('connectDescription')}</p>

            {/* Embedded Signup placeholder */}
            <button
              disabled
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text-muted)',
                fontSize: 14,
                cursor: 'not-allowed',
                marginBottom: 16,
                opacity: 0.6,
              }}
            >
              {t('connectComingSoon')}
            </button>

            {/* Manual connect */}
            <details>
              <summary style={{ fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', marginBottom: 12 }}>
                {t('connectManual')}
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>
                    {t('phoneNumberIdLabel')}
                  </label>
                  <input
                    value={connectPhoneId}
                    onChange={e => setConnectPhoneId(e.target.value)}
                    placeholder="e.g. 1070384556150866"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>
                    {t('accessTokenLabel')}
                  </label>
                  <input
                    type="password"
                    value={connectToken}
                    onChange={e => setConnectToken(e.target.value)}
                    placeholder="EAAUIvg..."
                    style={inputStyle}
                  />
                </div>
                <button
                  onClick={handleConnect}
                  disabled={!connectPhoneId.trim() || !connectToken.trim() || connectLoading}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#25D366',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                    opacity: (!connectPhoneId.trim() || !connectToken.trim() || connectLoading) ? 0.5 : 1,
                    marginTop: 4,
                  }}
                >
                  {connectLoading ? '...' : t('connect')}
                </button>
              </div>
            </details>
          </div>
        )}

        {/* Config sections — only show when connected */}
        {isConnected && (
          <>
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
          </>
        )}
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
