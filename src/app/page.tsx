'use client'

import { useState, useRef, useCallback } from 'react'

// --- Types ---

interface UploadedPhoto {
  id: string
  file: File
  preview: string
  description: string
}

interface GeneratedPost {
  id: string
  photoId: string
  preview: string
  caption: string
  hashtags: string[]
  platform: 'instagram' | 'tiktok'
  scheduledDate: string
  scheduledTime: string
  status: 'draft' | 'scheduled' | 'posted'
}

// --- Helpers ---

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return { weekday: days[d.getDay()], day: d.getDate(), month: months[d.getMonth()] }
}

/** Distribute posts evenly: 1 post per platform per day, IG at 11:00, TT at 18:00 */
function autoDistribute(posts: GeneratedPost[]): GeneratedPost[] {
  const today = toDateStr(new Date())
  const startDate = addDays(today, 1)

  // Group by photo: pair IG + TikTok for same photo on same day
  const byPhoto = new Map<string, GeneratedPost[]>()
  for (const p of posts) {
    if (!byPhoto.has(p.photoId)) byPhoto.set(p.photoId, [])
    byPhoto.get(p.photoId)!.push(p)
  }

  const result: GeneratedPost[] = []
  let dayOffset = 0

  for (const photoPosts of byPhoto.values()) {
    const date = addDays(startDate, dayOffset)
    for (const p of photoPosts) {
      result.push({
        ...p,
        scheduledDate: date,
        scheduledTime: p.platform === 'instagram' ? '11:00' : '18:00',
      })
    }
    dayOffset++
  }

  return result
}

// --- Step Indicator ---

function StepIndicator({ current }: { current: number }) {
  const steps = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'AI Captions' },
    { num: 3, label: 'Schedule' },
    { num: 4, label: 'Post' },
  ]
  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
            current >= s.num
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--card)] text-[var(--text-muted)] border border-[var(--border)]'
          }`}>
            {current > s.num ? '✓' : s.num}
          </div>
          <span className={`text-sm hidden sm:block ${current >= s.num ? 'text-white' : 'text-[var(--text-muted)]'}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${current > s.num ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// --- Platform Icons ---

function IgIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="6" stroke="url(#ig)" strokeWidth="2"/>
      <circle cx="12" cy="12" r="5" stroke="url(#ig)" strokeWidth="2"/>
      <circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig)"/>
      <defs>
        <linearGradient id="ig" x1="2" y1="22" x2="22" y2="2">
          <stop stopColor="#F58529"/><stop offset=".5" stopColor="#DD2A7B"/><stop offset="1" stopColor="#8134AF"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function TtIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 12a4 4 0 1 0 4 4V3c1.5 2 4 3 6 3" stroke="#00f2ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 12a4 4 0 1 0 4 4V3c1.5 2 4 3 6 3" stroke="#ff0050" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="translate(-0.5 -0.5)" opacity="0.5"/>
    </svg>
  )
}

function PlatformIcon({ platform, size = 14 }: { platform: 'instagram' | 'tiktok'; size?: number }) {
  return platform === 'instagram' ? <IgIcon size={size} /> : <TtIcon size={size} />
}

// --- Calendar View ---

function CalendarScheduler({
  posts,
  onUpdatePost,
  onAutoDistribute,
}: {
  posts: GeneratedPost[]
  onUpdatePost: (id: string, updates: Partial<GeneratedPost>) => void
  onAutoDistribute: () => void
}) {
  // Show 30 days starting from tomorrow
  const today = toDateStr(new Date())
  const startDate = addDays(today, 1)
  const days = Array.from({ length: 30 }, (_, i) => addDays(startDate, i))

  const [draggedPost, setDraggedPost] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  // Unscheduled posts (no date or date before start)
  const unscheduled = posts.filter(p => !p.scheduledDate || p.scheduledDate <= today)

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-[var(--text-muted)]">
          Drag posts to dates or use auto-distribute
        </span>
        <button
          onClick={onAutoDistribute}
          className="px-4 py-2 rounded-lg bg-[var(--accent)]/20 text-[var(--accent-hover)] text-sm font-medium hover:bg-[var(--accent)]/30 transition-colors"
        >
          Auto-Distribute Evenly
        </button>
      </div>

      {/* Unscheduled pool */}
      {unscheduled.length > 0 && (
        <div className="mb-4 p-3 rounded-xl border border-dashed border-[var(--border)] bg-white/[0.02]">
          <p className="text-xs text-[var(--text-muted)] mb-2">Unscheduled ({unscheduled.length})</p>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map(post => (
              <div
                key={post.id}
                draggable
                onDragStart={() => setDraggedPost(post.id)}
                onDragEnd={() => { setDraggedPost(null); setDropTarget(null) }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] cursor-grab active:cursor-grabbing text-xs hover:border-[var(--accent)]/50 transition-colors"
              >
                <img src={post.preview} alt="" className="w-6 h-6 rounded object-cover" />
                <PlatformIcon platform={post.platform} size={12} />
                <span className="max-w-[100px] truncate">{post.caption.slice(0, 20)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar header — weekdays */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="text-center text-[10px] uppercase tracking-wide text-[var(--text-muted)] py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid — 30 days in 7-column weeks */}
      <div className="grid grid-cols-7 gap-1">
        {/* Leading empty cells to align first day to correct weekday */}
        {(() => {
          const firstDay = new Date(days[0] + 'T12:00:00').getDay()
          const offset = firstDay === 0 ? 6 : firstDay - 1 // Mon=0, Sun=6
          return Array.from({ length: offset }, (_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px]" />
          ))
        })()}
        {days.map(dateStr => {
          const { day, month } = formatDay(dateStr)
          const weekday = new Date(dateStr + 'T12:00:00').getDay()
          const dayPosts = posts.filter(p => p.scheduledDate === dateStr)
          const isDropping = dropTarget === dateStr
          const isWeekend = weekday === 0 || weekday === 6
          const isFirstOfMonth = day === 1

          return (
            <div
              key={dateStr}
              className={`min-h-[100px] rounded-lg p-1 transition-all ${
                isDropping
                  ? 'bg-[var(--accent)]/15 border-2 border-[var(--accent)]'
                  : isWeekend
                    ? 'bg-white/[0.02] border border-[var(--border)]/50'
                    : 'bg-[var(--card)] border border-[var(--border)]'
              }`}
              onDragOver={e => { e.preventDefault(); setDropTarget(dateStr) }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={e => {
                e.preventDefault()
                setDropTarget(null)
                if (draggedPost) {
                  onUpdatePost(draggedPost, { scheduledDate: dateStr })
                  setDraggedPost(null)
                }
              }}
            >
              {/* Day number */}
              <div className={`text-xs font-medium mb-1 px-0.5 ${isWeekend ? 'text-[var(--text-muted)]' : ''}`}>
                {isFirstOfMonth ? `${day} ${month}` : day}
              </div>

              {/* Posts in this day */}
              <div className="space-y-1">
                {dayPosts.map(post => (
                  <div
                    key={post.id}
                    draggable
                    onDragStart={() => setDraggedPost(post.id)}
                    onDragEnd={() => { setDraggedPost(null); setDropTarget(null) }}
                    className={`group relative rounded overflow-hidden cursor-grab active:cursor-grabbing transition-all hover:ring-1 hover:ring-[var(--accent)]/50 ${
                      draggedPost === post.id ? 'opacity-30' : ''
                    }`}
                  >
                    <img src={post.preview} alt="" className="w-full aspect-square object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                    {/* Platform icon */}
                    <div className="absolute top-0.5 left-0.5">
                      <PlatformIcon platform={post.platform} size={12} />
                    </div>

                    {/* Time picker */}
                    <div className="absolute bottom-0 left-0 right-0 px-0.5 pb-0.5">
                      <input
                        type="time"
                        value={post.scheduledTime}
                        onChange={e => onUpdatePost(post.id, { scheduledTime: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        className="w-full text-[9px] bg-black/60 border-none text-white text-center rounded px-0 py-0 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] [color-scheme:dark]"
                      />
                    </div>

                    {/* Remove from day */}
                    <button
                      onClick={() => onUpdatePost(post.id, { scheduledDate: '' })}
                      className="absolute top-0 right-0 w-3.5 h-3.5 bg-black/60 text-[7px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Main App ---

export default function Home() {
  const [step, setStep] = useState(1)
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [posts, setPosts] = useState<GeneratedPost[]>([])
  const [generating, setGenerating] = useState<Set<string>>(new Set())
  const [businessType, setBusinessType] = useState('ice cream shop')
  const [tone, setTone] = useState('friendly and fun')
  const [exampleCaptions, setExampleCaptions] = useState('')
  const [igAccount, setIgAccount] = useState('')
  const [ttAccount, setTtAccount] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishProgress, setPublishProgress] = useState(0)
  const [publishErrors, setPublishErrors] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- Upload handlers ---

  const addFiles = useCallback((files: FileList) => {
    const newPhotos: UploadedPhoto[] = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({
        id: crypto.randomUUID(),
        file: f,
        preview: URL.createObjectURL(f),
        description: '',
      }))
    setPhotos(prev => [...prev, ...newPhotos])
  }, [])

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  const updateDescription = (id: string, desc: string) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, description: desc } : p))
  }

  // --- AI Generation ---

  const generateCaption = async (photo: UploadedPhoto, platform: 'instagram' | 'tiktok') => {
    const key = `${photo.id}-${platform}`
    setGenerating(prev => new Set(prev).add(key))

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: photo.description || photo.file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
          businessType,
          tone,
          platform,
          exampleCaptions,
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const newPost: GeneratedPost = {
        id: crypto.randomUUID(),
        photoId: photo.id,
        preview: photo.preview,
        caption: data.caption,
        hashtags: data.hashtags || [],
        platform,
        scheduledDate: '', // unscheduled — calendar will distribute
        scheduledTime: platform === 'instagram' ? '11:00' : '18:00',
        status: 'draft',
      }

      setPosts(prev => [...prev, newPost])
    } catch (err) {
      console.error('Generation failed:', err)
    } finally {
      setGenerating(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const generateAll = async () => {
    for (const photo of photos) {
      await generateCaption(photo, 'instagram')
      await generateCaption(photo, 'tiktok')
    }
  }

  // --- Schedule ---

  const updatePost = (id: string, updates: Partial<GeneratedPost>) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  const handleAutoDistribute = () => {
    setPosts(prev => autoDistribute(prev))
  }

  const scheduleAll = () => {
    setPosts(prev => prev.map(p => ({ ...p, status: 'scheduled' as const })))
    setStep(4)
  }

  const publishAll = async () => {
    setPublishing(true)
    setPublishProgress(0)
    setPublishErrors([])

    let completed = 0
    for (const post of posts) {
      const photo = photos.find(p => p.id === post.photoId)
      if (!photo) {
        setPublishErrors(prev => [...prev, `Photo not found for post ${post.id}`])
        completed++
        setPublishProgress(completed)
        continue
      }

      const account = post.platform === 'instagram' ? igAccount : ttAccount
      if (!account) {
        setPublishErrors(prev => [...prev, `No ${post.platform} account configured`])
        completed++
        setPublishProgress(completed)
        continue
      }

      const formData = new FormData()
      formData.append('photo', photo.file)
      formData.append('caption', post.caption)
      formData.append('hashtags', post.hashtags.join(','))
      formData.append('platform', post.platform)
      formData.append('scheduledDate', post.scheduledDate)
      formData.append('scheduledTime', post.scheduledTime)
      formData.append('account', account)

      try {
        const res = await fetch('/api/publish', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.success) {
          setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'posted' as const } : p))
        } else {
          setPublishErrors(prev => [...prev, `${post.platform}: ${data.error || 'Failed'}`])
        }
      } catch (err) {
        setPublishErrors(prev => [...prev, `${post.platform}: Network error`])
      }

      completed++
      setPublishProgress(completed)
    }

    setPublishing(false)
  }

  const allScheduled = posts.length > 0 && posts.every(p => p.scheduledDate)

  // --- Render ---

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Social Poster <span className="text-[var(--accent)]">AI</span>
        </h1>
        <p className="text-[var(--text-muted)]">
          Upload photos &rarr; AI generates captions &rarr; Schedule &rarr; Post to IG & TikTok
        </p>
      </div>

      <StepIndicator current={step} />

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="fade-in">
          {/* Business config */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1.5">Business Type</label>
              <input
                value={businessType}
                onChange={e => setBusinessType(e.target.value)}
                placeholder="e.g. ice cream shop, bakery, restaurant..."
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1.5">Tone</label>
              <input
                value={tone}
                onChange={e => setTone(e.target.value)}
                placeholder="e.g. friendly, professional, playful..."
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Example captions */}
          <div className="mb-4">
            <label className="block text-sm text-[var(--text-muted)] mb-1.5">
              Example Captions <span className="text-[var(--text-muted)]/60">(optional — paste captions you like so the AI matches the style)</span>
            </label>
            <textarea
              value={exampleCaptions}
              onChange={e => setExampleCaptions(e.target.value)}
              placeholder={"Paste 2-3 example captions you've written before or found inspiring...\n\nExample:\n\"Sommerzeit ist Eiszeit! Unsere neue Mango-Sorbet Kreation wartet auf euch...\"\n\"Wer sagt, man kann kein Eis zum Frühstück essen? 🍦☀️\""}
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none transition-colors resize-y"
            />
          </div>

          {/* Connected accounts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm text-[var(--text-muted)] mb-1.5 flex items-center gap-1.5">
                <IgIcon size={14} /> Instagram Account
              </label>
              <input
                value={igAccount}
                onChange={e => setIgAccount(e.target.value)}
                placeholder="your@email.com (from upload-post.com)"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--text-muted)] mb-1.5 flex items-center gap-1.5">
                <TtIcon size={14} /> TikTok Account
              </label>
              <input
                value={ttAccount}
                onChange={e => setTtAccount(e.target.value)}
                placeholder="your@email.com (from upload-post.com)"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Drop zone */}
          <div
            className={`drop-zone rounded-2xl p-12 text-center cursor-pointer mb-6 ${dragOver ? 'drag-over' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
          >
            <div className="text-4xl mb-3">📸</div>
            <p className="text-lg font-medium mb-1">Drop photos here or click to upload</p>
            <p className="text-sm text-[var(--text-muted)]">Upload up to 20 photos at once. JPG, PNG, WebP supported.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => e.target.files && addFiles(e.target.files)}
            />
          </div>

          {/* Photo grid */}
          {photos.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
                {photos.map(photo => (
                  <div key={photo.id} className="post-card fade-in">
                    <div className="relative aspect-square">
                      <img
                        src={photo.preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removePhoto(photo.id)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-sm hover:bg-red-500/80 transition-colors"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="p-2">
                      <input
                        value={photo.description}
                        onChange={e => updateDescription(photo.id, e.target.value)}
                        placeholder="Describe this photo..."
                        className="w-full text-xs px-2 py-1.5 rounded-lg bg-transparent border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => setStep(2)}
                  className="px-8 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] font-medium transition-colors"
                >
                  Generate Captions for {photos.length} photo{photos.length > 1 ? 's' : ''} &rarr;
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 2: AI Captions */}
      {step === 2 && (
        <div className="fade-in">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setStep(1)} className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">
              &larr; Back to upload
            </button>
            <button
              onClick={generateAll}
              disabled={generating.size > 0}
              className="px-6 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] font-medium text-sm transition-colors disabled:opacity-50"
            >
              {generating.size > 0 ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full loading-spin" />
                  Generating...
                </span>
              ) : (
                `Generate All (${photos.length * 2} posts)`
              )}
            </button>
          </div>

          <div className="space-y-4">
            {photos.map(photo => (
              <div key={photo.id} className="post-card p-4 fade-in">
                <div className="flex gap-4">
                  <img src={photo.preview} alt="" className="w-24 h-24 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-2 truncate">{photo.description || photo.file.name}</p>

                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => generateCaption(photo, 'instagram')}
                        disabled={generating.has(`${photo.id}-instagram`)}
                        className="platform-badge flex items-center gap-1.5 disabled:opacity-50"
                        style={posts.some(p => p.photoId === photo.id && p.platform === 'instagram') ? { borderColor: 'var(--accent)', background: 'rgba(99,102,241,0.15)' } : {}}
                      >
                        {generating.has(`${photo.id}-instagram`) ? (
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full loading-spin" />
                        ) : (
                          <IgIcon size={14} />
                        )}
                        Instagram
                        {posts.some(p => p.photoId === photo.id && p.platform === 'instagram') && ' ✓'}
                      </button>

                      <button
                        onClick={() => generateCaption(photo, 'tiktok')}
                        disabled={generating.has(`${photo.id}-tiktok`)}
                        className="platform-badge flex items-center gap-1.5 disabled:opacity-50"
                        style={posts.some(p => p.photoId === photo.id && p.platform === 'tiktok') ? { borderColor: 'var(--accent)', background: 'rgba(99,102,241,0.15)' } : {}}
                      >
                        {generating.has(`${photo.id}-tiktok`) ? (
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full loading-spin" />
                        ) : (
                          <TtIcon size={14} />
                        )}
                        TikTok
                        {posts.some(p => p.photoId === photo.id && p.platform === 'tiktok') && ' ✓'}
                      </button>
                    </div>

                    {posts.filter(p => p.photoId === photo.id).map(post => (
                      <div key={post.id} className="text-xs bg-white/5 rounded-lg p-2.5 mb-2">
                        <div className="flex items-center gap-1.5 mb-1 text-[var(--text-muted)]">
                          <PlatformIcon platform={post.platform} size={12} /> {post.platform}
                        </div>
                        <p className="line-clamp-2">{post.caption}</p>
                        <p className="text-[var(--accent)] mt-1 truncate">
                          {post.hashtags.map(h => `#${h}`).join(' ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {posts.length > 0 && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => { handleAutoDistribute(); setStep(3) }}
                className="px-8 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] font-medium transition-colors"
              >
                Schedule {posts.length} posts &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Calendar Schedule */}
      {step === 3 && (
        <div className="fade-in">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setStep(2)} className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">
              &larr; Back to captions
            </button>
            <span className="text-sm text-[var(--text-muted)]">{posts.length} posts</span>
          </div>

          <CalendarScheduler
            posts={posts}
            onUpdatePost={updatePost}
            onAutoDistribute={handleAutoDistribute}
          />

          {allScheduled && (
            <div className="flex justify-center mt-6">
              <button
                onClick={scheduleAll}
                className="px-8 py-3 rounded-xl bg-[var(--success)] hover:brightness-110 font-medium transition-all"
              >
                Schedule All {posts.length} Posts ✓
              </button>
            </div>
          )}
          {!allScheduled && (
            <p className="text-center mt-4 text-sm text-[var(--text-muted)]">
              Drag all posts to calendar dates to continue
            </p>
          )}
        </div>
      )}

      {/* Step 4: Confirmation */}
      {step === 4 && (
        <div className="fade-in text-center">
          <div className="post-card max-w-lg mx-auto p-8">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2">
              {posts.every(p => p.status === 'posted') ? 'All Posts Published!' : 'Posts Scheduled!'}
            </h2>
            <p className="text-[var(--text-muted)] mb-6">
              {posts.filter(p => p.platform === 'instagram').length} Instagram + {posts.filter(p => p.platform === 'tiktok').length} TikTok posts
              {posts.every(p => p.status === 'posted') ? ' have been published.' : ' are queued and ready to go.'}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white/5 rounded-xl p-4">
                <div className="mb-1 flex justify-center"><IgIcon size={28} /></div>
                <div className="text-lg font-bold">{posts.filter(p => p.platform === 'instagram').length}</div>
                <div className="text-xs text-[var(--text-muted)]">Instagram Posts</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="mb-1 flex justify-center"><TtIcon size={28} /></div>
                <div className="text-lg font-bold">{posts.filter(p => p.platform === 'tiktok').length}</div>
                <div className="text-xs text-[var(--text-muted)]">TikTok Posts</div>
              </div>
            </div>

            <div className="text-left mb-6">
              <h3 className="text-sm font-medium mb-3 text-[var(--text-muted)]">Upcoming Schedule</h3>
              <div className="space-y-2">
                {[...posts].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.scheduledTime.localeCompare(b.scheduledTime)).map(post => (
                  <div key={post.id} className="flex items-center gap-3 text-sm">
                    <span className={`w-2 h-2 rounded-full ${post.status === 'posted' ? 'bg-[var(--success)]' : 'bg-[var(--accent)]'}`} />
                    <span className="text-[var(--text-muted)] w-24">{post.scheduledDate}</span>
                    <span className="w-12">{post.scheduledTime}</span>
                    <span><PlatformIcon platform={post.platform} size={12} /></span>
                    <span className="truncate flex-1">{post.caption.slice(0, 40)}...</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      post.status === 'posted' ? 'bg-[var(--success)]/20 text-[var(--success)]' :
                      post.status === 'scheduled' ? 'bg-[var(--accent)]/20 text-[var(--accent)]' :
                      'bg-white/10 text-[var(--text-muted)]'
                    }`}>
                      {post.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Publishing progress */}
            {publishing && (
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full loading-spin" />
                    Publishing...
                  </span>
                  <span>{publishProgress} / {posts.length}</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all"
                    style={{ width: `${(publishProgress / posts.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Publish errors */}
            {publishErrors.length > 0 && (
              <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-left">
                <p className="text-sm font-medium text-red-400 mb-1">Some posts failed:</p>
                {publishErrors.map((err, i) => (
                  <p key={i} className="text-xs text-red-300/80">{err}</p>
                ))}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              {!posts.every(p => p.status === 'posted') && (
                <button
                  onClick={publishAll}
                  disabled={publishing || (!igAccount && !ttAccount)}
                  className="px-6 py-2.5 rounded-xl bg-[var(--success)] hover:brightness-110 font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {publishing ? 'Publishing...' : 'Publish Now'}
                </button>
              )}
              <button
                onClick={() => { setStep(1); setPhotos([]); setPosts([]); setPublishErrors([]) }}
                disabled={publishing}
                className="px-6 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] font-medium text-sm transition-colors disabled:opacity-50"
              >
                New Batch
              </button>
            </div>

            {!igAccount && !ttAccount && !posts.every(p => p.status === 'posted') && (
              <p className="text-xs text-[var(--text-muted)] mt-3">
                Add your account info in Step 1 to enable publishing via upload-post.com
              </p>
            )}
          </div>
        </div>
      )}

      <div className="text-center mt-12 text-xs text-[var(--text-muted)]">
        Built with Next.js, Tailwind CSS & Grok AI
      </div>
    </div>
  )
}
