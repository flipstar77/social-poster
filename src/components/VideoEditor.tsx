'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { ReelContentConfig, StickerConfig, StickerAnimation } from '../../remotion/data/content-types'
import type { StyleConfig, TextAnimType, LayoutType, BgPatternType, PhotoPosition } from '../../remotion/styles/style-config'
import { PALETTES, FONTS } from '../../remotion/styles/style-config'
import {
  buildStyleConfig,
  PALETTE_LABELS,
  FONT_LABELS,
  ANIMATION_LABELS,
  LAYOUT_LABELS,
  BG_PATTERN_LABELS,
  PHOTO_POSITION_LABELS,
} from '../../remotion/styles/style-builder'
import type { UserStyleChoices } from '../../remotion/styles/style-builder'
import { PRESET_TEMPLATES } from '../data/preset-templates'

const VideoPreview = dynamic(() => import('./VideoPreview'), { ssr: false })

interface SavedTemplate {
  name: string
  choices: UserStyleChoices
  createdAt: number
}

interface VideoEditorProps {
  locale: 'de' | 'en'
}

const L = {
  de: {
    photo: 'Foto / Video (optional)',
    photoHint: 'Bild oder Video reinziehen',
    photoChange: 'Ändern',
    text: 'Text',
    title: 'Titel',
    titlePh: 'z.B. Hausgemachte Pasta',
    desc: 'Beschreibung',
    descPh: 'z.B. Frische Zutaten,\nmit Liebe gekocht',
    cta: 'Call-to-Action',
    ctaPh: 'z.B. Jetzt reservieren',
    hook: 'Hook-Zeile',
    hookPh: 'z.B. NUR HEUTE',
    color: 'Farbe',
    font: 'Schrift',
    fontSize: 'Schriftgrösse',
    animation: 'Animation',
    layout: 'Layout',
    photoOverlay: 'Foto-Abdunklung',
    photoPosition: 'Foto-Position',
    bgPattern: 'Hintergrund-Muster',
    businessName: 'Restaurant-Name',
    businessNamePh: 'z.B. Ristorante Roma',
    ctaDetail: 'CTA Zusatz',
    ctaDetailPh: 'z.B. Link in Bio',
    render: 'Video rendern',
    rendering: 'Wird gerendert...',
    done: 'Fertig!',
    download: 'Herunterladen',
    error: 'Fehler',
    retry: 'Nochmal',
    preview: 'Vorschau',
    saveTemplate: 'Als Vorlage speichern',
    templates: 'Vorlagen',
    noTemplates: 'Noch keine Vorlagen',
    deleteTemplate: 'Löschen',
    loadTemplate: 'Laden',
    reset: 'Zurücksetzen',
    stickers: 'Sticker',
    stickerAdd: '+ Sticker hinzufügen',
    stickerAnim: 'Animation',
    stickerSize: 'Grösse',
    stickerPhase: 'Phase',
    stickerDelay: 'Verzögerung',
    stickerDelete: 'Entfernen',
  },
  en: {
    photo: 'Photo / Video (optional)',
    photoHint: 'Drop image or video',
    photoChange: 'Change',
    text: 'Text',
    hook: 'Hook Line',
    hookPh: 'e.g. TODAY ONLY',
    title: 'Title',
    titlePh: 'e.g. Homemade Pasta',
    desc: 'Description',
    descPh: 'e.g. Fresh ingredients,\ncooked with love',
    cta: 'Call-to-Action',
    ctaPh: 'e.g. Reserve Now',
    color: 'Color',
    font: 'Font',
    fontSize: 'Font Size',
    animation: 'Animation',
    layout: 'Layout',
    photoOverlay: 'Photo Overlay',
    photoPosition: 'Photo Position',
    bgPattern: 'Background Pattern',
    businessName: 'Business Name',
    businessNamePh: 'e.g. Ristorante Roma',
    ctaDetail: 'CTA Subtitle',
    ctaDetailPh: 'e.g. Link in Bio',
    render: 'Render Video',
    rendering: 'Rendering...',
    done: 'Ready!',
    download: 'Download',
    error: 'Error',
    retry: 'Retry',
    preview: 'Preview',
    saveTemplate: 'Save as Template',
    templates: 'Templates',
    noTemplates: 'No templates yet',
    deleteTemplate: 'Delete',
    loadTemplate: 'Load',
    reset: 'Reset',
    stickers: 'Stickers',
    stickerAdd: '+ Add Sticker',
    stickerAnim: 'Animation',
    stickerSize: 'Size',
    stickerPhase: 'Phase',
    stickerDelay: 'Delay',
    stickerDelete: 'Remove',
  },
}

const STICKER_ANIM_LABELS: Record<StickerAnimation, string> = {
  'fly-left':  '← Links',
  'fly-right': '→ Rechts',
  'fly-top':   '↓ Oben',
  'fly-bottom':'↑ Unten',
  'pop':       '⊕ Pop',
  'bounce':    '↕ Bounce',
  'spin-pop':  '↻ Spin',
}
const STICKER_ANIMS: StickerAnimation[] = ['fly-left', 'fly-right', 'fly-top', 'fly-bottom', 'pop', 'bounce', 'spin-pop']

const FOOD_EMOJIS = ['🍕','🍔','🍟','🌮','🌯','🍣','🍱','🍜','🍝','🍛','🍲','🥗','🍩','🍪','🧁','🎂','🍰','🍨','🍦','🍧','🥤','🍷','🍸','🍹','🍺','☕','🧋','🔥','⭐','✨','💯','❤️']

function emojiToImage(emoji: string, size = 160): string {
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.font = `${size * 0.75}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, size / 2, size / 2)
  return canvas.toDataURL('image/png')
}

const ASPECT_RATIOS = [
  { key: '9:16' as const, label: '9:16', w: 1080, h: 1920 },
  { key: '4:5' as const, label: '4:5', w: 1080, h: 1350 },
  { key: '1:1' as const, label: '1:1', w: 1080, h: 1080 },
]

const TEXT_ANIM_KEYS: TextAnimType[] = ['fade-up', 'instant', 'typewriter', 'blur-in', 'slide-in', 'scale-in', 'punch', 'shake']
const LAYOUT_KEYS: LayoutType[] = ['center', 'left', 'right', 'card', 'split']
const BG_PATTERN_KEYS: BgPatternType[] = ['none', 'dots', 'grid', 'scanlines', 'diagonal', 'circles']
const PHOTO_POS_KEYS: PhotoPosition[] = ['full-bleed', 'top-half', 'left-half', 'circle-center']

const DEFAULT_CHOICES: UserStyleChoices = {
  paletteIndex: 0,
  fontIndex: 0,
  animation: 'fade-up',
  layout: 'center',
  titleSize: 80,
  photoOverlayOpacity: 0.5,
  bgPattern: 'dots',
  photoPosition: 'full-bleed',
}

export default function VideoEditor({ locale }: VideoEditorProps) {
  const l = L[locale]

  // Content state
  const [content, setContent] = useState<ReelContentConfig>({
    id: `reel-${Date.now()}`,
    type: 'text-only',
    hook: '',
    title: '',
    description: '',
    ctaLabel: '',
    locale,
  })

  // Style choices
  const [choices, setChoices] = useState<UserStyleChoices>({ ...DEFAULT_CHOICES })

  // Photo + preview refs
  const fileRef = useRef<HTMLInputElement>(null)
  const previewOverlayRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<{ startY: number; startSize: number } | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Render state
  const [renderState, setRenderState] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [renderError, setRenderError] = useState('')

  // Templates (localStorage)
  const [templates, setTemplates] = useState<SavedTemplate[]>([])
  const [templateName, setTemplateName] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fp-video-templates')
      if (saved) setTemplates(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  const saveTemplates = useCallback((tpls: SavedTemplate[]) => {
    setTemplates(tpls)
    localStorage.setItem('fp-video-templates', JSON.stringify(tpls))
  }, [])

  const handleSaveTemplate = () => {
    const name = templateName.trim() || `${l.templates} ${templates.length + 1}`
    const tpl: SavedTemplate = { name, choices, createdAt: Date.now() }
    saveTemplates([tpl, ...templates])
    setTemplateName('')
  }

  const handleLoadTemplate = (tpl: SavedTemplate) => {
    setChoices(tpl.choices)
    setShowTemplates(false)
  }

  const handleDeleteTemplate = (idx: number) => {
    saveTemplates(templates.filter((_, i) => i !== idx))
  }

  const handleReset = () => {
    setChoices({ ...DEFAULT_CHOICES })
    setRenderState('idle')
    setVideoUrl(null)
  }

  // Stickers
  const stickerFileRef = useRef<HTMLInputElement>(null)
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null)
  const stickerDragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  const addSticker = (file: File) => {
    const url = URL.createObjectURL(file)
    const s: StickerConfig = {
      id: `sticker-${Date.now()}`,
      url,
      x: 50, y: 30,
      size: 20,
      animation: 'fly-right',
      delay: 0,
      phase: 1,
    }
    update({ stickers: [...(content.stickers ?? []), s] })
    setSelectedStickerId(s.id)
  }

  const patchSticker = (id: string, patch: Partial<StickerConfig>) => {
    update({
      stickers: (content.stickers ?? []).map(s => s.id === id ? { ...s, ...patch } : s)
    })
  }

  const removeSticker = (id: string) => {
    update({ stickers: (content.stickers ?? []).filter(s => s.id !== id) })
    if (selectedStickerId === id) setSelectedStickerId(null)
  }

  // Background removal
  const [removingBgId, setRemovingBgId] = useState<string | null>(null)
  const stickerSlotFileRef = useRef<HTMLInputElement>(null)
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null)

  const removeBg = async (stickerId: string) => {
    const sticker = content.stickers?.find(s => s.id === stickerId)
    if (!sticker?.url) return
    setRemovingBgId(stickerId)
    try {
      const { removeBackground } = await import('@imgly/background-removal')
      const resp = await fetch(sticker.url)
      const blob = await resp.blob()
      const result = await removeBackground(blob)
      const newUrl = URL.createObjectURL(result)
      patchSticker(stickerId, { url: newUrl })
    } catch (err) {
      console.error('BG removal failed:', err)
    } finally {
      setRemovingBgId(null)
    }
  }

  // Upload image into an existing sticker slot (for preset slots with empty URLs)
  const uploadToSlot = (file: File, slotId: string) => {
    const url = URL.createObjectURL(file)
    patchSticker(slotId, { url })
  }

  const selectedSticker = content.stickers?.find(s => s.id === selectedStickerId) ?? null
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const addEmojiSticker = (emoji: string) => {
    const url = emojiToImage(emoji)
    const s: StickerConfig = {
      id: `emoji-${Date.now()}`,
      url,
      x: 30 + Math.random() * 40,
      y: 30 + Math.random() * 40,
      size: 15,
      animation: 'pop',
      delay: 0,
      phase: 1,
    }
    update({ stickers: [...(content.stickers ?? []), s] })
    setSelectedStickerId(s.id)
    setShowEmojiPicker(false)
  }

  // Scroll-to-resize on preview (non-passive listener to allow preventDefault)
  const choicesRef = useRef(choices)
  choicesRef.current = choices
  useEffect(() => {
    const el = previewOverlayRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -4 : 4
      const cur = choicesRef.current.titleSize ?? 80
      const next = Math.max(40, Math.min(120, cur + delta))
      setChoices(prev => ({ ...prev, titleSize: next }))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Build style from choices (memoized)
  const customStyle: StyleConfig = useMemo(() => buildStyleConfig(choices), [choices])

  const update = (patch: Partial<ReelContentConfig>) => setContent(prev => ({ ...prev, ...patch }))
  const pick = (patch: Partial<UserStyleChoices>) => setChoices(prev => ({ ...prev, ...patch }))

  const handleMedia = (file: File) => {
    const url = URL.createObjectURL(file)
    const isVideo = file.type.startsWith('video/')
    setPhotoPreview(url)
    update({
      type: 'photo-reel',
      mediaUrl: url,
      mediaType: isVideo ? 'video' : 'image',
    })
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleMedia(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/') || file?.type.startsWith('video/')) handleMedia(file)
  }

  const handleRender = async () => {
    setRenderState('rendering')
    setRenderError('')
    try {
      const res = await fetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, style: customStyle }),
      })
      const data = await res.json()
      if (data.success) {
        setVideoUrl(data.videoUrl)
        setRenderState('done')
      } else {
        setRenderError(data.error || 'Unknown error')
        setRenderState('error')
      }
    } catch (err) {
      setRenderError(String(err))
      setRenderState('error')
    }
  }

  const canRender = content.title && content.ctaLabel

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:justify-center">
      {/* LEFT: Controls */}
      <div className="flex-1 min-w-0 max-w-md space-y-6">

        {/* --- Starter Templates --- */}
        <Section title={locale === 'de' ? 'Starter-Vorlagen' : 'Starter Templates'}>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => {
                  setChoices({ ...tpl.choices })
                  setContent(prev => ({
                    ...prev,
                    hook: tpl.contentDefaults.hook ?? prev.hook,
                    title: tpl.contentDefaults.title ?? prev.title,
                    description: tpl.contentDefaults.description ?? prev.description,
                    ctaLabel: tpl.contentDefaults.ctaLabel ?? prev.ctaLabel,
                    ctaDetail: tpl.contentDefaults.ctaDetail ?? prev.ctaDetail,
                    // Pre-configure sticker positions (URLs empty — user uploads their images)
                    stickers: tpl.stickerDefaults
                      ? tpl.stickerDefaults.map(s => ({ ...s, url: '' } as StickerConfig))
                      : prev.stickers,
                  }))
                }}
                className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/5 transition-all text-left"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-base leading-none">{tpl.emoji}</span>
                  <span className="text-xs font-semibold text-white">{tpl.name[locale]}</span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] leading-tight">{tpl.description[locale]}</span>
                {tpl.stickerHint && (
                  <span className="text-[9px] text-[var(--accent)]/70 leading-tight mt-0.5">{tpl.stickerHint[locale]}</span>
                )}
              </button>
            ))}
          </div>
        </Section>

        {/* --- Photo --- */}
        <Section title={l.photo}>
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFileInput} className="hidden" />
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed cursor-pointer transition-all flex items-center justify-center ${
              dragOver ? 'border-[var(--accent)] bg-[var(--accent)]/5' :
              'border-[var(--border)] hover:border-[var(--accent)]/50'
            } ${photoPreview ? 'p-2' : 'py-8'}`}
          >
            {photoPreview ? (
              <div className="relative group">
                {content.mediaType === 'video' ? (
                  <video src={photoPreview} className="h-24 rounded-lg object-cover" muted />
                ) : (
                  <img src={photoPreview} alt="" className="h-24 rounded-lg object-cover" />
                )}
                <div className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-xs text-white">{l.photoChange}</span>
                </div>
              </div>
            ) : (
              <span className="text-sm text-[var(--text-muted)]">{l.photoHint}</span>
            )}
          </div>
        </Section>

        {/* --- Text --- */}
        <Section title={l.text}>
          <div className="space-y-3">
            <Input label={l.hook} value={content.hook} placeholder={l.hookPh}
              onChange={v => update({ hook: v })} />
            <Input label={l.title} value={content.title} placeholder={l.titlePh}
              onChange={v => update({ title: v })} />
            <Input label={l.desc} value={content.description} placeholder={l.descPh}
              onChange={v => update({ description: v })} multiline />
            <Input label={l.cta} value={content.ctaLabel} placeholder={l.ctaPh}
              onChange={v => update({ ctaLabel: v })} />
            <Input label={l.ctaDetail} value={content.ctaDetail ?? ''} placeholder={l.ctaDetailPh}
              onChange={v => update({ ctaDetail: v })} />
            <Input label={l.businessName} value={content.businessName ?? ''} placeholder={l.businessNamePh}
              onChange={v => update({ businessName: v })} />
          </div>
        </Section>

        {/* --- Color --- */}
        <Section title={l.color}>
          <div className="grid grid-cols-10 gap-1.5">
            {PALETTES.map((p, i) => (
              <button
                key={i}
                onClick={() => pick({ paletteIndex: i })}
                title={PALETTE_LABELS[i]?.[locale] ?? p[0]}
                className={`aspect-square rounded-lg relative transition-all hover:scale-110 ${
                  choices.paletteIndex === i
                    ? 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg)] scale-110'
                    : ''
                }`}
                style={{ background: `linear-gradient(135deg, ${p[1]}, ${p[2]})` }}
              >
                <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: p[5] }} />
              </button>
            ))}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1.5">
            {PALETTE_LABELS[choices.paletteIndex]?.[locale]}
          </div>
        </Section>

        {/* --- Font --- */}
        <Section title={l.font}>
          <div className="grid grid-cols-5 gap-1.5">
            {FONTS.map((font, i) => (
              <button
                key={i}
                onClick={() => pick({ fontIndex: i })}
                className={`px-2 py-2 rounded-lg text-sm transition-all truncate ${
                  choices.fontIndex === i
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--accent)]/50'
                }`}
                style={{ fontFamily: font }}
              >
                {FONT_LABELS[i]}
              </button>
            ))}
          </div>
        </Section>

        {/* --- Font Size --- */}
        <Section title={`${l.fontSize} — ${choices.titleSize}px`}>
          <input
            type="range"
            min={40}
            max={120}
            step={4}
            value={choices.titleSize}
            onChange={e => pick({ titleSize: Number(e.target.value) })}
            className="w-full accent-[var(--accent)] h-1.5 bg-[var(--card)] rounded-full cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
            <span>{locale === 'de' ? 'Klein' : 'Small'}</span>
            <span>{locale === 'de' ? 'Gross' : 'Large'}</span>
          </div>
        </Section>

        {/* --- Animation --- */}
        <Section title={l.animation}>
          <div className="flex flex-wrap gap-1.5">
            {TEXT_ANIM_KEYS.map(anim => (
              <button
                key={anim}
                onClick={() => pick({ animation: anim })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  choices.animation === anim
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--accent)]/50'
                }`}
              >
                {ANIMATION_LABELS[anim][locale]}
              </button>
            ))}
          </div>
        </Section>

        {/* --- Layout --- */}
        <Section title={l.layout}>
          <div className="flex gap-1.5">
            {LAYOUT_KEYS.map(lay => (
              <button
                key={lay}
                onClick={() => pick({ layout: lay })}
                className={`flex-1 py-2 rounded-lg text-center transition-all ${
                  choices.layout === lay
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--accent)]/50'
                }`}
              >
                <div className="text-lg leading-none">{LAYOUT_LABELS[lay].icon}</div>
                <div className="text-[10px] mt-0.5">{LAYOUT_LABELS[lay][locale]}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* --- Photo Overlay (only when photo uploaded) --- */}
        {photoPreview && (
          <>
            <Section title={`${l.photoOverlay} — ${Math.round((choices.photoOverlayOpacity ?? 0.5) * 100)}%`}>
              <input
                type="range"
                min={10}
                max={80}
                step={5}
                value={Math.round((choices.photoOverlayOpacity ?? 0.5) * 100)}
                onChange={e => pick({ photoOverlayOpacity: Number(e.target.value) / 100 })}
                className="w-full accent-[var(--accent)] h-1.5 bg-[var(--card)] rounded-full cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
                <span>{locale === 'de' ? 'Hell' : 'Light'}</span>
                <span>{locale === 'de' ? 'Dunkel' : 'Dark'}</span>
              </div>
            </Section>

            <Section title={l.photoPosition}>
              <div className="flex gap-1.5">
                {PHOTO_POS_KEYS.map(pos => (
                  <button
                    key={pos}
                    onClick={() => pick({ photoPosition: pos })}
                    className={`flex-1 py-2 rounded-lg text-center transition-all ${
                      (choices.photoPosition ?? 'full-bleed') === pos
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--card)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    <div className="text-lg leading-none">{PHOTO_POSITION_LABELS[pos].icon}</div>
                    <div className="text-[10px] mt-0.5">{PHOTO_POSITION_LABELS[pos][locale]}</div>
                  </button>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* --- Background Pattern (only for text-only) --- */}
        {!photoPreview && (
          <Section title={l.bgPattern}>
            <div className="flex flex-wrap gap-1.5">
              {BG_PATTERN_KEYS.map(pat => (
                <button
                  key={pat}
                  onClick={() => pick({ bgPattern: pat })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    (choices.bgPattern ?? 'dots') === pat
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--card)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--accent)]/50'
                  }`}
                >
                  {BG_PATTERN_LABELS[pat][locale]}
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* --- Effects (Stroke, Gradient, Progress Bar) --- */}
        <Section title={locale === 'de' ? 'Effekte' : 'Effects'}>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={choices.textStroke ?? false}
                onChange={e => pick({ textStroke: e.target.checked })}
                className="accent-[var(--accent)] w-3.5 h-3.5 rounded"
              />
              <span className="text-xs text-[var(--text-muted)]">
                {locale === 'de' ? 'Text Outline' : 'Text Stroke'}
              </span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={choices.gradientText ?? false}
                onChange={e => pick({ gradientText: e.target.checked })}
                className="accent-[var(--accent)] w-3.5 h-3.5 rounded"
              />
              <span className="text-xs text-[var(--text-muted)]">
                {locale === 'de' ? 'Verlauf-Text' : 'Gradient Text'}
              </span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={choices.progressBar !== false}
                onChange={e => pick({ progressBar: e.target.checked })}
                className="accent-[var(--accent)] w-3.5 h-3.5 rounded"
              />
              <span className="text-xs text-[var(--text-muted)]">
                {locale === 'de' ? 'Fortschritts-Balken' : 'Progress Bar'}
              </span>
            </label>
          </div>
        </Section>

        {/* --- Aspect Ratio --- */}
        <Section title={locale === 'de' ? 'Format' : 'Aspect Ratio'}>
          <div className="flex gap-1.5">
            {ASPECT_RATIOS.map(ar => (
              <button
                key={ar.key}
                onClick={() => pick({ aspectRatio: ar.key })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  (choices.aspectRatio ?? '9:16') === ar.key
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--accent)]/50'
                }`}
              >
                {ar.label}
              </button>
            ))}
          </div>
        </Section>

        {/* --- Stickers --- */}
        <Section title={l.stickers}>
          <input
            ref={stickerFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) addSticker(f); e.target.value = '' }}
          />
          {/* Hidden file input for uploading into a specific sticker slot */}
          <input
            ref={stickerSlotFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f && pendingSlotId) uploadToSlot(f, pendingSlotId)
              e.target.value = ''
              setPendingSlotId(null)
            }}
          />
          {/* Sticker list */}
          <div className="space-y-2">
            {(content.stickers ?? []).map((s, i) => (
              <div
                key={s.id}
                onClick={() => setSelectedStickerId(s.id === selectedStickerId ? null : s.id)}
                className={`rounded-lg border px-2 py-1.5 cursor-pointer transition-all ${
                  selectedStickerId === s.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--border)] bg-[var(--card)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {/* Thumbnail or upload button for empty slots */}
                  {s.url ? (
                    <img src={s.url} alt="" className="w-8 h-8 object-contain rounded" />
                  ) : (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setPendingSlotId(s.id)
                        stickerSlotFileRef.current?.click()
                      }}
                      className="w-8 h-8 rounded border border-dashed border-[var(--accent)]/50 flex items-center justify-center text-[var(--accent)] text-sm hover:bg-[var(--accent)]/10"
                    >+</button>
                  )}
                  <span className="text-xs text-white flex-1">Sticker {i + 1}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{STICKER_ANIM_LABELS[s.animation]}</span>
                  <button
                    onClick={e => { e.stopPropagation(); removeSticker(s.id) }}
                    className="text-[10px] text-[var(--text-muted)] hover:text-red-400"
                  >✕</button>
                </div>
                {/* Expanded controls when selected */}
                {selectedStickerId === s.id && (
                  <div className="mt-2 space-y-2 pt-2 border-t border-[var(--border)]">
                    {/* BG Remove + Re-upload row */}
                    {s.url && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={e => { e.stopPropagation(); removeBg(s.id) }}
                          disabled={removingBgId === s.id}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-medium border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-50 disabled:cursor-wait transition-all"
                        >
                          {removingBgId === s.id
                            ? (locale === 'de' ? 'Entferne BG...' : 'Removing BG...')
                            : (locale === 'de' ? 'BG entfernen' : 'Remove BG')}
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setPendingSlotId(s.id)
                            stickerSlotFileRef.current?.click()
                          }}
                          className="px-2 py-1.5 rounded-lg text-[10px] border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-white/30 transition-all"
                        >
                          {locale === 'de' ? 'Ersetzen' : 'Replace'}
                        </button>
                      </div>
                    )}
                    {/* Animation */}
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] mb-1">{l.stickerAnim}</div>
                      <div className="flex flex-wrap gap-1">
                        {STICKER_ANIMS.map(a => (
                          <button
                            key={a}
                            onClick={() => patchSticker(s.id, { animation: a })}
                            className={`px-2 py-1 rounded text-[10px] transition-all ${
                              s.animation === a
                                ? 'bg-[var(--accent)] text-white'
                                : 'bg-[var(--bg)] text-[var(--text-muted)] border border-[var(--border)]'
                            }`}
                          >
                            {STICKER_ANIM_LABELS[a]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Size */}
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] mb-1">{l.stickerSize} — {s.size}%</div>
                      <input
                        type="range" min={5} max={50} step={1} value={s.size}
                        onChange={e => patchSticker(s.id, { size: Number(e.target.value) })}
                        className="w-full accent-[var(--accent)] h-1.5 rounded-full cursor-pointer"
                      />
                    </div>
                    {/* Phase + Delay row */}
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <div className="text-[10px] text-[var(--text-muted)] mb-1">{l.stickerPhase}</div>
                        <div className="flex gap-1">
                          {([1, 2, 3] as const).map(ph => (
                            <button
                              key={ph}
                              onClick={() => patchSticker(s.id, { phase: ph })}
                              className={`flex-1 py-1 rounded text-[10px] transition-all ${
                                (s.phase ?? 1) === ph
                                  ? 'bg-[var(--accent)] text-white'
                                  : 'bg-[var(--bg)] text-[var(--text-muted)] border border-[var(--border)]'
                              }`}
                            >{ph}</button>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] text-[var(--text-muted)] mb-1">{l.stickerDelay} — {s.delay ?? 0}f</div>
                        <input
                          type="range" min={0} max={60} step={5} value={s.delay ?? 0}
                          onChange={e => patchSticker(s.id, { delay: Number(e.target.value) })}
                          className="w-full accent-[var(--accent)] h-1.5 rounded-full cursor-pointer"
                        />
                      </div>
                    </div>
                    {/* Hint */}
                    <div className="text-[10px] text-[var(--text-muted)]">
                      {locale === 'de' ? 'Auf Preview ziehen zum Positionieren' : 'Drag on preview to position'}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {(content.stickers?.length ?? 0) < 10 && (
              <div className="flex gap-1.5">
                <button
                  onClick={() => stickerFileRef.current?.click()}
                  className="flex-1 py-2 rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-white transition-all"
                >
                  {l.stickerAdd}
                </button>
                <button
                  onClick={() => setShowEmojiPicker(v => !v)}
                  className={`px-3 py-2 rounded-lg border text-xs transition-all ${
                    showEmojiPicker
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-white'
                  }`}
                >
                  {locale === 'de' ? 'Emoji' : 'Emoji'}
                </button>
              </div>
            )}
            {/* Emoji picker grid */}
            {showEmojiPicker && (
              <div className="grid grid-cols-8 gap-1 p-2 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                {FOOD_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => addEmojiSticker(e)}
                    className="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-[var(--accent)]/10 transition-colors"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* --- Templates --- */}
        <Section title={l.templates}>
          <div className="space-y-2">
            {/* Save */}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder={locale === 'de' ? 'Name (optional)' : 'Name (optional)'}
                className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-white placeholder-[var(--text-muted)]/50 focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                onClick={handleSaveTemplate}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:brightness-110 transition-all shrink-0"
              >
                {l.saveTemplate}
              </button>
            </div>
            {/* List */}
            {templates.length > 0 && (
              <div>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="text-xs text-[var(--text-muted)] hover:text-white transition-colors"
                >
                  {showTemplates ? '▾' : '▸'} {templates.length} {l.templates}
                </button>
                {showTemplates && (
                  <div className="mt-1.5 space-y-1">
                    {templates.map((tpl, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                        <div
                          className="w-4 h-4 rounded shrink-0"
                          style={{ background: `linear-gradient(135deg, ${PALETTES[tpl.choices.paletteIndex]?.[1] ?? '#333'}, ${PALETTES[tpl.choices.paletteIndex]?.[2] ?? '#666'})` }}
                        />
                        <span className="text-xs text-white flex-1 truncate">{tpl.name}</span>
                        <button
                          onClick={() => handleLoadTemplate(tpl)}
                          className="text-[10px] text-[var(--accent)] hover:underline shrink-0"
                        >
                          {l.loadTemplate}
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(i)}
                          className="text-[10px] text-[var(--text-muted)] hover:text-red-400 shrink-0"
                        >
                          {l.deleteTemplate}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* --- Render Button --- */}
        <div className="pt-2">
          {renderState === 'idle' && (
            <button
              onClick={handleRender}
              disabled={!canRender}
              className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {l.render}
            </button>
          )}
          {renderState === 'rendering' && (
            <div className="w-full py-3 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[var(--text-muted)]">{l.rendering}</span>
            </div>
          )}
          {renderState === 'done' && videoUrl && (
            <div className="space-y-2">
              <div className="text-sm text-green-400 font-medium text-center">{l.done}</div>
              <a
                href={videoUrl}
                download
                className="block w-full py-3 rounded-xl bg-green-600 text-white font-bold text-sm text-center hover:brightness-110 transition-all"
              >
                {l.download}
              </a>
            </div>
          )}
          {renderState === 'error' && (
            <div className="space-y-2 text-center">
              <div className="text-sm text-red-400">{l.error}: {renderError}</div>
              <button onClick={handleRender} className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm">
                {l.retry}
              </button>
            </div>
          )}
          {/* Reset */}
          <button
            onClick={handleReset}
            className="w-full py-2 rounded-lg text-xs text-[var(--text-muted)] hover:text-white transition-colors"
          >
            {l.reset}
          </button>
        </div>
      </div>

      {/* RIGHT: Live Preview */}
      <div className="lg:w-[300px] shrink-0">
        <div className="sticky top-8">
          <div className="text-xs text-[var(--text-muted)] mb-2 text-center">{l.preview}</div>
          <div className="relative">
            <VideoPreview
              style={customStyle}
              content={{ ...content, __progressBar: choices.progressBar !== false } as any}
              width={300}
              height={(() => {
                const ar = choices.aspectRatio ?? '9:16'
                if (ar === '1:1') return 300
                if (ar === '4:5') return 375
                return 533
              })()}
              aspectRatio={choices.aspectRatio}
            />
            {/* Drag overlay for text positioning + scroll to resize */}
            <div
              ref={previewOverlayRef}
              className="absolute inset-0 rounded-xl"
              style={{ zIndex: 10, cursor: selectedStickerId ? 'move' : 'crosshair' }}
              onMouseDown={e => {
                // If a sticker is selected, start dragging it
                if (selectedStickerId) {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const sticker = content.stickers?.find(s => s.id === selectedStickerId)
                  if (!sticker) return
                  stickerDragRef.current = {
                    id: selectedStickerId,
                    startX: e.clientX, startY: e.clientY,
                    origX: sticker.x, origY: sticker.y,
                  }
                  const onMove = (ev: MouseEvent) => {
                    if (!stickerDragRef.current) return
                    const dx = ((ev.clientX - stickerDragRef.current.startX) / rect.width) * 100
                    const dy = ((ev.clientY - stickerDragRef.current.startY) / rect.height) * 100
                    patchSticker(stickerDragRef.current.id, {
                      x: Math.round(Math.max(0, Math.min(100, stickerDragRef.current.origX + dx))),
                      y: Math.round(Math.max(0, Math.min(100, stickerDragRef.current.origY + dy))),
                    })
                  }
                  const onUp = () => {
                    stickerDragRef.current = null
                    window.removeEventListener('mousemove', onMove)
                    window.removeEventListener('mouseup', onUp)
                  }
                  window.addEventListener('mousemove', onMove)
                  window.addEventListener('mouseup', onUp)
                  return
                }
                // Otherwise position text
                const rect = e.currentTarget.getBoundingClientRect()
                const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
                const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
                update({ textPosition: { x, y } })
              }}
            />
            {/* Sticker position dots on preview */}
            {(content.stickers ?? []).map(s => (
              <div
                key={s.id}
                onClick={e => { e.stopPropagation(); setSelectedStickerId(s.id === selectedStickerId ? null : s.id) }}
                style={{
                  position: 'absolute',
                  left: `${s.x}%`, top: `${s.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 13,
                  width: 20, height: 20,
                  borderRadius: '50%',
                  border: `2px solid ${s.id === selectedStickerId ? 'var(--accent)' : 'rgba(255,255,255,0.8)'}`,
                  background: s.id === selectedStickerId ? 'var(--accent)' : 'rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                  boxShadow: '0 0 6px rgba(0,0,0,0.4)',
                }}
              >
                <img src={s.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
              </div>
            ))}
            {/* Resize handle — drag up/down to change font size */}
            {content.textPosition && (
              <div
                className="absolute flex items-center justify-center cursor-ns-resize select-none"
                style={{
                  left: `${content.textPosition.x}%`,
                  top: `${content.textPosition.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 12,
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: '2px solid rgba(255,255,255,0.9)',
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(4px)',
                  boxShadow: '0 0 8px rgba(0,0,0,0.4)',
                }}
                onMouseDown={e => {
                  e.stopPropagation()
                  resizeRef.current = { startY: e.clientY, startSize: choices.titleSize ?? 80 }
                  const onMove = (ev: MouseEvent) => {
                    if (!resizeRef.current) return
                    const delta = resizeRef.current.startY - ev.clientY
                    const next = Math.round(Math.max(40, Math.min(120, resizeRef.current.startSize + delta * 0.8)))
                    setChoices(prev => ({ ...prev, titleSize: next }))
                  }
                  const onUp = () => {
                    resizeRef.current = null
                    window.removeEventListener('mousemove', onMove)
                    window.removeEventListener('mouseup', onUp)
                  }
                  window.addEventListener('mousemove', onMove)
                  window.addEventListener('mouseup', onUp)
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.8 }}>
                  <path d="M6 1L3.5 3.5H8.5L6 1Z" fill="white" />
                  <path d="M6 11L3.5 8.5H8.5L6 11Z" fill="white" />
                  <rect x="5" y="4" width="2" height="4" rx="1" fill="white" />
                </svg>
              </div>
            )}
          </div>
          {/* Position info + reset */}
          {content.textPosition && (
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-[var(--text-muted)]">
                {content.textPosition.x}%, {content.textPosition.y}% · {choices.titleSize}px
              </span>
              <button
                onClick={() => update({ textPosition: undefined })}
                className="text-[10px] text-[var(--text-muted)] hover:text-white"
              >
                {locale === 'de' ? 'Zentrieren' : 'Center'}
              </button>
            </div>
          )}
          {!content.textPosition && (
            <div className="text-[10px] text-[var(--text-muted)] mt-1.5 text-center">
              {locale === 'de' ? 'Klick = positionieren · Ziehen = Grösse · Scrollen = Grösse' : 'Click = position · Drag = resize · Scroll = resize'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Helpers ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  )
}

function Input({ label, value, placeholder, onChange, multiline }: {
  label: string; value: string; placeholder: string
  onChange: (v: string) => void; multiline?: boolean
}) {
  const cls = "w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-white placeholder-[var(--text-muted)]/50 focus:border-[var(--accent)] focus:outline-none transition-colors"
  return multiline ? (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2} className={cls + ' resize-none'} />
  ) : (
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
  )
}
