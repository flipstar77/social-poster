'use client'

import { useState, useEffect, useCallback } from 'react'

// --- Types ---

interface TinaImage {
  id: string
  path: string
  filename: string
  category: string
  url: string
}

interface CaptionVariant {
  caption: string
  hashtags: string[]
  vibe: string
}

interface PostDraft {
  imageId: string
  imageUrl: string
  category: string
  platform: 'instagram' | 'facebook'
  variants: CaptionVariant[]
  selectedVariant: number
  description: string
  scheduledDate: string
  scheduledTime: string
  status: 'draft' | 'generating' | 'ready' | 'publishing' | 'published' | 'error'
  error?: string
}

const DAILY_SLOTS = ['10:00', '14:00', '19:00'] as const
const PLATFORMS = ['instagram', 'facebook'] as const

const CATEGORY_LABELS: Record<string, string> = {
  cafe: 'Cafe', calendar: 'Calendar', fashion: 'Fashion', fitness: 'Fitness',
  home: 'Home', lingerie: 'Lingerie', luxury: 'Luxury', night: 'Night Out',
  outdoor: 'Outdoor', podcast: 'Podcast', selfie: 'Selfie', swimwear: 'Swimwear',
  travel: 'Travel', selfie2: 'Selfie', gym: 'Fitness', coffee: 'Cafe',
  street: 'Street', sunset: 'Outdoor', cozy: 'Home', beach: 'Beach',
  studio: 'Studio', penthouse: 'Luxury', leather: 'Fashion', pool: 'Pool',
  redcarpet: 'Red Carpet', casual2: 'Casual', closeup: 'Close-up',
  rooftop: 'Rooftop', magazine: 'Magazine',
}

function getCategoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)
}

const AUTO_DESCRIPTIONS: Record<string, string> = {
  cafe: 'Tina sitzt im Cafe, Cappuccino mit Hafermilch, warme Atmosphaere, goldenes Licht',
  calendar: 'Tina beim professionellen Kalender-Shooting, selbstbewusst, Studio-Setting',
  fashion: 'Tina im stylischen Outfit, Street-Style Look, modisch und lässig',
  fitness: 'Tina beim Workout, sportlich, aktiv, Gym-Vibes',
  home: 'Tina zuhause, gemuetlich, entspannt, authentischer Moment',
  lingerie: 'Tina im Dessous-Shooting, selbstbewusst, elegant, Body Positivity',
  luxury: 'Tina im luxurioesen Setting, glamouroes, besonderer Anlass',
  night: 'Tina beim Ausgehen, Abend-Look, Nightlife-Vibes',
  outdoor: 'Tina draussen in der Natur, frische Luft, goldene Stunde',
  podcast: 'Tina im Studio, Content-Creation, Behind-the-Scenes',
  selfie: 'Tina-Selfie, casual, authentisch, spontaner Moment',
  swimwear: 'Tina am Strand/Pool, Sommer-Vibes, Urlaub, Beach-Life',
  travel: 'Tina auf Reisen, neuer Ort, Wanderlust, Abenteuer',
  beach: 'Tina am Strand, Sommer, Meer, relaxte Vibes',
  street: 'Tina auf der Strasse, Urban Style, City-Vibes',
  sunset: 'Tina bei Sonnenuntergang, goldenes Licht, magischer Moment',
  cozy: 'Tina macht es sich gemuetlich, Decke, Tee, entspannt',
  studio: 'Tina im Fotostudio, professionelles Shooting',
  penthouse: 'Tina im Penthouse, Luxus-Vibes, Skyline-View',
  pool: 'Tina am Pool, Sommer, relaxt, Urlaubs-Feeling',
  rooftop: 'Tina auf dem Rooftop, City-View, Abendstimmung',
  closeup: 'Tina Close-up Portrait, intensive Augen, natuerliche Schoenheit',
  magazine: 'Tina im Magazine-Style Shooting, editorial, high-fashion',
  redcarpet: 'Tina auf dem Red Carpet, Glamour, Event-Look',
  leather: 'Tina im Leder-Outfit, edgy, selbstbewusst',
  casual2: 'Tina im lässigen Alltags-Look, casual und entspannt',
  coffee: 'Tina mit Kaffee, Cafe-Moment, gemuetlich',
  gym: 'Tina im Gym, Workout, sportlich und motiviert',
  selfie2: 'Tina-Selfie, spontan, natuerlich',
}

function getAutoDescription(category: string, filename: string): string {
  return AUTO_DESCRIPTIONS[category] || `Tina ${getCategoryLabel(category)} Foto — ${filename.replace(/\.(png|jpg|webp)$/i, '').replace(/[_-]/g, ' ')}`
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

// --- Step Indicator ---

function StepIndicator({ current }: { current: number }) {
  const steps = [
    { num: 1, label: 'Bilder' },
    { num: 2, label: 'Captions' },
    { num: 3, label: 'Schedule' },
  ]
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
            current >= s.num
              ? 'bg-amber-500 text-black'
              : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
          }`}>
            {current > s.num ? '\u2713' : s.num}
          </div>
          <span className={`text-xs hidden sm:block ${current >= s.num ? 'text-white' : 'text-zinc-500'}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className={`w-6 h-px ${current > s.num ? 'bg-amber-500' : 'bg-zinc-700'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// --- Main Page ---

export default function TinaPipeline() {
  const [step, setStep] = useState(1)
  const [images, setImages] = useState<TinaImage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [drafts, setDrafts] = useState<PostDraft[]>([])

  // Load images
  useEffect(() => {
    fetch('/api/tina/list-images')
      .then(r => r.json())
      .then(d => setImages(d.images || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Get unique categories
  const categories = [...new Set(images.map(i => i.category))].sort()

  const filteredImages = categoryFilter === 'all'
    ? images
    : images.filter(i => i.category === categoryFilter)

  const selectedImages = images.filter(i => selectedIds.has(i.id))

  // Toggle image selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Generate captions for all selected images
  const generateCaptions = useCallback(async () => {
    const newDrafts: PostDraft[] = []
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    let slotIndex = 0

    for (const img of selectedImages) {
      const desc = getAutoDescription(img.category, img.filename)
      const date = new Date(tomorrow)
      date.setDate(date.getDate() + Math.floor(slotIndex / 3))
      const time = DAILY_SLOTS[slotIndex % 3]

      for (const platform of PLATFORMS) {
        newDrafts.push({
          imageId: img.id,
          imageUrl: img.url,
          category: img.category,
          platform,
          variants: [],
          selectedVariant: 0,
          description: desc,
          scheduledDate: toDateStr(date),
          scheduledTime: time,
          status: 'generating',
        })
      }
      slotIndex++
    }

    setDrafts(newDrafts)
    setStep(2)

    // Generate captions in parallel (2 per image: IG + FB)
    for (let i = 0; i < newDrafts.length; i++) {
      const draft = newDrafts[i]
      try {
        const res = await fetch('/api/tina/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageDescription: draft.description,
            category: draft.category,
            platform: draft.platform,
          }),
        })
        const data = await res.json()
        if (data.variants) {
          setDrafts(prev => prev.map((d, idx) =>
            idx === i ? { ...d, variants: data.variants.map((v: CaptionVariant) => ({
              ...v,
              hashtags: v.hashtags.map(h => h.replace(/^#+/, '')),
            })), status: 'ready' } : d
          ))
        } else {
          setDrafts(prev => prev.map((d, idx) =>
            idx === i ? { ...d, status: 'error', error: data.error || 'Generation failed' } : d
          ))
        }
      } catch (err) {
        setDrafts(prev => prev.map((d, idx) =>
          idx === i ? { ...d, status: 'error', error: String(err) } : d
        ))
      }
    }
  }, [selectedImages])

  // Publish a single draft
  const publishDraft = useCallback(async (draftIndex: number) => {
    const draft = drafts[draftIndex]
    if (!draft || draft.status !== 'ready') return

    setDrafts(prev => prev.map((d, i) => i === draftIndex ? { ...d, status: 'publishing' } : d))

    try {
      const variant = draft.variants[draft.selectedVariant]

      // Fetch the image as blob
      const imgRes = await fetch(draft.imageUrl)
      const blob = await imgRes.blob()
      const file = new File([blob], 'tina.png', { type: blob.type })

      const formData = new FormData()
      formData.append('photo', file)
      formData.append('caption', variant.caption)
      formData.append('hashtags', variant.hashtags.join(','))
      formData.append('platform', draft.platform)
      formData.append('scheduledDate', draft.scheduledDate)
      formData.append('scheduledTime', draft.scheduledTime)

      const res = await fetch('/api/tina/publish', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (data.success) {
        setDrafts(prev => prev.map((d, i) => i === draftIndex ? { ...d, status: 'published' } : d))
      } else {
        setDrafts(prev => prev.map((d, i) => i === draftIndex ? { ...d, status: 'error', error: data.error } : d))
      }
    } catch (err) {
      setDrafts(prev => prev.map((d, i) => i === draftIndex ? { ...d, status: 'error', error: String(err) } : d))
    }
  }, [drafts])

  // Publish all ready drafts
  const publishAll = useCallback(async () => {
    for (let i = 0; i < drafts.length; i++) {
      if (drafts[i].status === 'ready') {
        await publishDraft(i)
      }
    }
  }, [drafts, publishDraft])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          <span className="text-amber-400">Tina Thunder</span> — Social Pipeline
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Kuratiere Bilder, generiere In-Character Captions, schedule auf IG + FB
        </p>
      </div>

      <StepIndicator current={step} />

      {/* STEP 1: Image Selection */}
      {step === 1 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Bilder auswaehlen</h2>
              <span className="text-sm text-zinc-400">
                {selectedIds.size} ausgewaehlt
              </span>
            </div>
            <button
              onClick={generateCaptions}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Captions generieren ({selectedIds.size})
            </button>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              Alle ({images.length})
            </button>
            {categories.map(cat => {
              const count = images.filter(i => i.category === cat).length
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    categoryFilter === cat
                      ? 'bg-amber-500 text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {getCategoryLabel(cat)} ({count})
                </button>
              )
            })}
          </div>

          {loading ? (
            <div className="text-center py-20 text-zinc-500">Lade Bilder...</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {filteredImages.map(img => {
                const selected = selectedIds.has(img.id)
                return (
                  <button
                    key={img.id}
                    onClick={() => toggleSelect(img.id)}
                    className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all group ${
                      selected
                        ? 'border-amber-500 ring-2 ring-amber-500/30'
                        : 'border-transparent hover:border-zinc-600'
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Selection indicator */}
                    <div className={`absolute inset-0 transition-colors ${
                      selected ? 'bg-amber-500/20' : 'group-hover:bg-white/5'
                    }`} />
                    {selected && (
                      <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-black text-xs font-bold">
                        {[...selectedIds].indexOf(img.id) + 1}
                      </div>
                    )}
                    {/* Category badge */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                      <span className="text-[10px] text-zinc-300">{getCategoryLabel(img.category)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Caption Review */}
      {step === 2 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Captions Review</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              >
                Zurueck
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={drafts.every(d => d.status === 'generating')}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-30"
              >
                Zum Schedule
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {drafts.map((draft, di) => (
              <div key={`${draft.imageId}-${draft.platform}`} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                <div className="flex gap-4 p-4">
                  <img
                    src={draft.imageUrl}
                    alt=""
                    className="w-20 h-28 object-cover rounded-lg shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        draft.platform === 'instagram'
                          ? 'bg-pink-900/50 text-pink-300'
                          : 'bg-blue-900/50 text-blue-300'
                      }`}>
                        {draft.platform === 'instagram' ? 'Instagram' : 'Facebook'}
                      </span>
                      <span className="text-xs text-zinc-500">{getCategoryLabel(draft.category)}</span>
                      {draft.status === 'generating' && (
                        <span className="text-xs text-amber-400 animate-pulse">Generiert...</span>
                      )}
                      {draft.status === 'error' && (
                        <span className="text-xs text-red-400">Fehler: {draft.error}</span>
                      )}
                    </div>

                    {draft.variants.length > 0 && (
                      <div className="space-y-2">
                        {/* Variant selector tabs */}
                        <div className="flex gap-1">
                          {draft.variants.map((v, vi) => (
                            <button
                              key={vi}
                              onClick={() => setDrafts(prev => prev.map((d, i) =>
                                i === di ? { ...d, selectedVariant: vi } : d
                              ))}
                              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                draft.selectedVariant === vi
                                  ? 'bg-amber-500 text-black'
                                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                              }`}
                            >
                              {v.vibe}
                            </button>
                          ))}
                        </div>

                        {/* Selected caption */}
                        <div className="bg-zinc-800 rounded-lg p-3">
                          <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                            {draft.variants[draft.selectedVariant]?.caption}
                          </p>
                          {draft.variants[draft.selectedVariant]?.hashtags?.length > 0 && (
                            <p className="text-xs text-amber-400/70 mt-2">
                              {draft.variants[draft.selectedVariant].hashtags.map(h => `#${h}`).join(' ')}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: Schedule & Publish */}
      {step === 3 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Schedule & Publish</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              >
                Zurueck
              </button>
              <button
                onClick={publishAll}
                disabled={!drafts.some(d => d.status === 'ready')}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-500 disabled:opacity-30"
              >
                Alle publishen ({drafts.filter(d => d.status === 'ready').length})
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {drafts.map((draft, di) => {
              const variant = draft.variants[draft.selectedVariant]
              return (
                <div key={`${draft.imageId}-${draft.platform}-sched`} className="flex items-center gap-4 bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                  <img
                    src={draft.imageUrl}
                    alt=""
                    className="w-14 h-18 object-cover rounded-lg shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        draft.platform === 'instagram'
                          ? 'bg-pink-900/50 text-pink-300'
                          : 'bg-blue-900/50 text-blue-300'
                      }`}>
                        {draft.platform === 'instagram' ? 'IG' : 'FB'}
                      </span>
                      <span className="text-xs text-zinc-400 truncate max-w-xs">
                        {variant?.caption?.substring(0, 80)}...
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="date"
                        value={draft.scheduledDate}
                        onChange={e => setDrafts(prev => prev.map((d, i) =>
                          i === di ? { ...d, scheduledDate: e.target.value } : d
                        ))}
                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                      <select
                        value={draft.scheduledTime}
                        onChange={e => setDrafts(prev => prev.map((d, i) =>
                          i === di ? { ...d, scheduledTime: e.target.value } : d
                        ))}
                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        {DAILY_SLOTS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {draft.status === 'ready' && (
                      <button
                        onClick={() => publishDraft(di)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-500"
                      >
                        Publish
                      </button>
                    )}
                    {draft.status === 'publishing' && (
                      <span className="text-xs text-amber-400 animate-pulse">Publishing...</span>
                    )}
                    {draft.status === 'published' && (
                      <span className="text-xs text-green-400 font-medium">Published</span>
                    )}
                    {draft.status === 'error' && (
                      <span className="text-xs text-red-400" title={draft.error}>Fehler</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {drafts.some(d => d.status === 'published') && (
            <div className="mt-6 p-4 bg-green-900/20 border border-green-800 rounded-xl text-center">
              <p className="text-green-300 font-medium">
                {drafts.filter(d => d.status === 'published').length} / {drafts.length} Posts geplant!
              </p>
              <p className="text-xs text-green-400/60 mt-1">
                Posts werden ueber upload-post.com zum geplanten Zeitpunkt veroeffentlicht.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
