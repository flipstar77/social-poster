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

// --- Main App ---

export default function Home() {
  const [step, setStep] = useState(1)
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [posts, setPosts] = useState<GeneratedPost[]>([])
  const [generating, setGenerating] = useState<Set<string>>(new Set())
  const [businessType, setBusinessType] = useState('ice cream shop')
  const [tone, setTone] = useState('friendly and fun')
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
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Schedule: spread posts across next days
      const existingCount = posts.length
      const schedDate = new Date()
      schedDate.setDate(schedDate.getDate() + Math.floor(existingCount / 2) + 1)
      const hour = platform === 'instagram' ? 11 : 18
      const timeStr = `${String(hour).padStart(2, '0')}:00`

      const newPost: GeneratedPost = {
        id: crypto.randomUUID(),
        photoId: photo.id,
        preview: photo.preview,
        caption: data.caption,
        hashtags: data.hashtags || [],
        platform,
        scheduledDate: schedDate.toISOString().split('T')[0],
        scheduledTime: timeStr,
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

  const scheduleAll = () => {
    setPosts(prev => prev.map(p => ({ ...p, status: 'scheduled' as const })))
    setStep(4)
  }

  const publishAll = () => {
    setPosts(prev => prev.map(p => ({ ...p, status: 'posted' as const })))
  }

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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
                      {/* IG button */}
                      <button
                        onClick={() => generateCaption(photo, 'instagram')}
                        disabled={generating.has(`${photo.id}-instagram`)}
                        className="platform-badge flex items-center gap-1.5 disabled:opacity-50"
                        style={posts.some(p => p.photoId === photo.id && p.platform === 'instagram') ? { borderColor: 'var(--accent)', background: 'rgba(99,102,241,0.15)' } : {}}
                      >
                        {generating.has(`${photo.id}-instagram`) ? (
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full loading-spin" />
                        ) : (
                          <span>📷</span>
                        )}
                        Instagram
                        {posts.some(p => p.photoId === photo.id && p.platform === 'instagram') && ' ✓'}
                      </button>

                      {/* TikTok button */}
                      <button
                        onClick={() => generateCaption(photo, 'tiktok')}
                        disabled={generating.has(`${photo.id}-tiktok`)}
                        className="platform-badge flex items-center gap-1.5 disabled:opacity-50"
                        style={posts.some(p => p.photoId === photo.id && p.platform === 'tiktok') ? { borderColor: 'var(--accent)', background: 'rgba(99,102,241,0.15)' } : {}}
                      >
                        {generating.has(`${photo.id}-tiktok`) ? (
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full loading-spin" />
                        ) : (
                          <span>🎵</span>
                        )}
                        TikTok
                        {posts.some(p => p.photoId === photo.id && p.platform === 'tiktok') && ' ✓'}
                      </button>
                    </div>

                    {/* Preview generated captions */}
                    {posts.filter(p => p.photoId === photo.id).map(post => (
                      <div key={post.id} className="text-xs bg-white/5 rounded-lg p-2.5 mb-2">
                        <div className="flex items-center gap-1.5 mb-1 text-[var(--text-muted)]">
                          {post.platform === 'instagram' ? '📷' : '🎵'} {post.platform}
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
                onClick={() => setStep(3)}
                className="px-8 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] font-medium transition-colors"
              >
                Schedule {posts.length} posts &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Schedule */}
      {step === 3 && (
        <div className="fade-in">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setStep(2)} className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">
              &larr; Back to captions
            </button>
            <span className="text-sm text-[var(--text-muted)]">{posts.length} posts ready</span>
          </div>

          <div className="space-y-3">
            {posts.map(post => (
              <div key={post.id} className="post-card p-4 fade-in">
                <div className="flex gap-4">
                  <img src={post.preview} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">{post.platform === 'instagram' ? '📷 Instagram' : '🎵 TikTok'}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-1 mb-2">{post.caption}</p>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={post.scheduledDate}
                        onChange={e => updatePost(post.id, { scheduledDate: e.target.value })}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
                      />
                      <input
                        type="time"
                        value={post.scheduledTime}
                        onChange={e => updatePost(post.id, { scheduledTime: e.target.value })}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                  </div>
                  {/* Edit caption */}
                  <button
                    onClick={() => {
                      const newCaption = prompt('Edit caption:', post.caption)
                      if (newCaption !== null) updatePost(post.id, { caption: newCaption })
                    }}
                    className="text-[var(--text-muted)] hover:text-white text-sm self-start"
                    title="Edit caption"
                  >
                    ✏️
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-6">
            <button
              onClick={scheduleAll}
              className="px-8 py-3 rounded-xl bg-[var(--success)] hover:brightness-110 font-medium transition-all"
            >
              Schedule All {posts.length} Posts ✓
            </button>
          </div>
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

            {/* Post summary */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl mb-1">📷</div>
                <div className="text-lg font-bold">{posts.filter(p => p.platform === 'instagram').length}</div>
                <div className="text-xs text-[var(--text-muted)]">Instagram Posts</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl mb-1">🎵</div>
                <div className="text-lg font-bold">{posts.filter(p => p.platform === 'tiktok').length}</div>
                <div className="text-xs text-[var(--text-muted)]">TikTok Posts</div>
              </div>
            </div>

            {/* Timeline preview */}
            <div className="text-left mb-6">
              <h3 className="text-sm font-medium mb-3 text-[var(--text-muted)]">Upcoming Schedule</h3>
              <div className="space-y-2">
                {posts.map(post => (
                  <div key={post.id} className="flex items-center gap-3 text-sm">
                    <span className={`w-2 h-2 rounded-full ${post.status === 'posted' ? 'bg-[var(--success)]' : 'bg-[var(--accent)]'}`} />
                    <span className="text-[var(--text-muted)] w-24">{post.scheduledDate}</span>
                    <span className="w-12">{post.scheduledTime}</span>
                    <span>{post.platform === 'instagram' ? '📷' : '🎵'}</span>
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

            <div className="flex gap-3 justify-center">
              {!posts.every(p => p.status === 'posted') && (
                <button
                  onClick={publishAll}
                  className="px-6 py-2.5 rounded-xl bg-[var(--success)] hover:brightness-110 font-medium text-sm transition-all"
                >
                  Publish Now
                </button>
              )}
              <button
                onClick={() => { setStep(1); setPhotos([]); setPosts([]) }}
                className="px-6 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] font-medium text-sm transition-colors"
              >
                New Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-12 text-xs text-[var(--text-muted)]">
        Built with Next.js, Tailwind CSS & Grok AI
      </div>
    </div>
  )
}
