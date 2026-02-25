'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'

type WidgetState = 'idle' | 'listening' | 'thinking' | 'speaking'

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor
    webkitSpeechRecognition: SpeechRecognitionConstructor
  }
}

const LOCALE_MAP: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
}

export default function VoiceFaqWidget() {
  const t = useTranslations('voiceFaq')
  const locale = useLocale()

  const [state, setState] = useState<WidgetState>('idle')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [showBubble, setShowBubble] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      if (recognitionRef.current) recognitionRef.current.abort()
    }
  }, [])

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
  }, [])

  const handleQuestion = useCallback(async (question: string) => {
    setState('thinking')
    setAnswer('')
    setError('')
    setShowBubble(true)

    try {
      // Get AI answer
      const chatRes = await fetch('/api/voice-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, locale }),
      })
      const chatData = await chatRes.json()

      if (!chatRes.ok || !chatData.answer) {
        setError(t('error'))
        setState('idle')
        return
      }

      setAnswer(chatData.answer)
      setState('speaking')

      // Get TTS audio
      try {
        const ttsRes = await fetch('/api/voice-faq/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chatData.answer, locale }),
        })

        if (ttsRes.ok) {
          const blob = await ttsRes.blob()
          stopAudio()
          const url = URL.createObjectURL(blob)
          audioUrlRef.current = url
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => setState('idle')
          audio.play().catch(() => setState('idle'))
        } else {
          setState('idle')
        }
      } catch {
        // TTS failed but answer is still shown as text
        setState('idle')
      }
    } catch {
      setError(t('error'))
      setState('idle')
    }
  }, [locale, t, stopAudio])

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError(t('unsupported'))
      setShowBubble(true)
      return
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = LOCALE_MAP[locale] || 'de-DE'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (transcript) handleQuestion(transcript)
    }

    recognition.onerror = () => {
      setError(t('error'))
      setShowBubble(true)
      setState('idle')
    }

    recognition.onend = () => {
      if (state === 'listening') setState('idle')
    }

    recognitionRef.current = recognition
    recognition.start()
    setState('listening')
    setError('')
    setShowBubble(true)
  }, [isSupported, locale, t, handleQuestion, state])

  const handleClick = useCallback(() => {
    if (state === 'listening') {
      recognitionRef.current?.stop()
      setState('idle')
      return
    }

    if (state === 'speaking') {
      stopAudio()
      setState('idle')
      return
    }

    if (state === 'idle') {
      startListening()
    }
  }, [state, stopAudio, startListening])

  const closeBubble = useCallback(() => {
    stopAudio()
    setShowBubble(false)
    setAnswer('')
    setError('')
    setState('idle')
  }, [stopAudio])

  // Button icon based on state
  const icon = state === 'listening' ? micIcon : state === 'thinking' ? spinnerIcon : state === 'speaking' ? speakerIcon : micIcon

  // Button color based on state
  const btnBg = state === 'listening' ? '#ef4444' : state === 'speaking' ? '#22c55e' : '#6366f1'

  // Status text
  const statusText = state === 'listening' ? t('listening')
    : state === 'thinking' ? t('thinking')
    : state === 'speaking' ? t('speaking')
    : ''

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes voicePulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)} 50%{box-shadow:0 0 0 12px rgba(239,68,68,0)} }
        @keyframes voiceSpin { to{transform:rotate(360deg)} }
        @keyframes voiceFadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}} />

      {/* Answer Bubble */}
      {showBubble && (
        <div style={{
          position: 'fixed', bottom: 96, right: 24, width: 320, maxWidth: 'calc(100vw - 48px)',
          background: '#fff', borderRadius: 16, padding: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '1px solid #e4e4e7',
          zIndex: 9998, animation: 'voiceFadeIn 0.2s ease-out',
          color: '#18181b', fontSize: 14, lineHeight: 1.6,
        }}>
          {/* Close button */}
          <button onClick={closeBubble} style={{
            position: 'absolute', top: 8, right: 8, background: 'none', border: 'none',
            cursor: 'pointer', color: '#a1a1aa', fontSize: 18, padding: '2px 6px',
          }} aria-label={t('close')}>×</button>

          {/* Status */}
          {statusText && (
            <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, marginBottom: 8 }}>
              {statusText}
            </div>
          )}

          {/* Error */}
          {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}

          {/* Answer text */}
          {answer && <div>{answer}</div>}

          {/* Idle hint */}
          {state === 'idle' && !answer && !error && (
            <div style={{ color: '#71717a', fontSize: 13 }}>{t('tapToAsk')}</div>
          )}
        </div>
      )}

      {/* Floating Mic Button */}
      <button
        onClick={handleClick}
        disabled={state === 'thinking'}
        aria-label={t('tooltip')}
        title={t('tooltip')}
        style={{
          position: 'fixed', bottom: 24, right: 24, width: 56, height: 56,
          borderRadius: '50%', border: 'none', cursor: state === 'thinking' ? 'wait' : 'pointer',
          background: btnBg, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
          transition: 'background 0.2s ease, transform 0.15s ease',
          zIndex: 9999,
          animation: state === 'listening' ? 'voicePulse 1.5s infinite' : 'none',
        }}
        onMouseEnter={e => { if (state !== 'thinking') (e.currentTarget.style.transform = 'scale(1.08)') }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        <span dangerouslySetInnerHTML={{ __html: icon }}
          style={state === 'thinking' ? { animation: 'voiceSpin 1s linear infinite', display: 'flex' } : { display: 'flex' }} />
      </button>
    </>
  )
}

// ── SVG Icons (inline to avoid deps) ──────────────────────────────────────────
const micIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`

const spinnerIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`

const speakerIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`
