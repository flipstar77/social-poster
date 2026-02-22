'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// --- Types ---

interface UploadedPhoto {
  id: string
  file: File
  preview: string
  description: string
}

interface CaptionVariant {
  caption: string
  hashtags: string[]
}

interface GeneratedPost {
  id: string
  photoId: string
  preview: string
  caption: string
  hashtags: string[]
  platform: string
  scheduledDate: string
  scheduledTime: string
  status: 'draft' | 'scheduled' | 'posted'
}

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', bestTime: '11:00', color: '#E1306C' },
  { id: 'tiktok', label: 'TikTok', bestTime: '18:00', color: '#00f2ea' },
  { id: 'facebook', label: 'Facebook', bestTime: '12:00', color: '#1877F2' },
  { id: 'linkedin', label: 'LinkedIn', bestTime: '09:00', color: '#0A66C2' },
  { id: 'x', label: 'X', bestTime: '12:00', color: '#e7e7e7' },
  { id: 'threads', label: 'Threads', bestTime: '11:00', color: '#aaaaaa' },
  { id: 'pinterest', label: 'Pinterest', bestTime: '20:00', color: '#E60023' },
  { id: 'bluesky', label: 'Bluesky', bestTime: '12:00', color: '#0085ff' },
  { id: 'reddit', label: 'Reddit', bestTime: '10:00', color: '#FF4500' },
] as const

type PlatformId = typeof PLATFORMS[number]['id']

function getPlatform(id: string) {
  return PLATFORMS.find(p => p.id === id) ?? { id, label: id, bestTime: '12:00', color: '#888' }
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

/** Distribute posts evenly: all platforms for same photo on same day, each at its best time */
function autoDistribute(posts: GeneratedPost[]): GeneratedPost[] {
  const today = toDateStr(new Date())
  const startDate = addDays(today, 1)

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
        scheduledTime: getPlatform(p.platform).bestTime,
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

function PlatformIcon({ platform, size = 14 }: { platform: string; size?: number }) {
  const s = size
  if (platform === 'instagram') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
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
  if (platform === 'tiktok') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M9 12a4 4 0 1 0 4 4V3c1.5 2 4 3 6 3" stroke="#00f2ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 12a4 4 0 1 0 4 4V3c1.5 2 4 3 6 3" stroke="#ff0050" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="translate(-0.5 -0.5)" opacity="0.5"/>
    </svg>
  )
  if (platform === 'facebook') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.885v2.27h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
  )
  if (platform === 'linkedin') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
  if (platform === 'x') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#e7e7e7">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
  if (platform === 'threads') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#aaaaaa">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.365-.89h-.056c-.72 0-1.979.198-2.975 1.243l-1.437-1.469C8.3 3.538 9.931 3.018 11.974 3h.06c3.756.04 5.94 2.149 6.154 5.89.17.28.32.57.458.87 1.019 2.298.744 5.21-1.03 6.956-1.667 1.641-3.85 2.333-6.44 2.27L12.186 24zm-.022-12.574c-.161 0-.323.006-.484.018-1.152.07-2.047.382-2.59.904-.43.4-.63.895-.595 1.479.048.838.69 1.54 1.865 1.813.817.19 1.86.11 2.7-.635.55-.488.94-1.312 1.056-2.425a11.674 11.674 0 0 0-1.952-.154z"/>
    </svg>
  )
  if (platform === 'pinterest') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#E60023">
      <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
    </svg>
  )
  if (platform === 'bluesky') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#0085ff">
      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.204-.659-.299-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/>
    </svg>
  )
  if (platform === 'reddit') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#FF4500">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  )
  // Fallback: colored circle with initial
  const p = getPlatform(platform)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: s, height: s, borderRadius: '50%', background: p.color, fontSize: s * 0.5, color: '#fff', fontWeight: 700, lineHeight: 1 }}>
      {p.label[0]}
    </span>
  )
}

// --- Calendar View ---

function CalendarScheduler({
  posts,
  onUpdatePost,
  onAutoDistribute,
  deleteConfirm,
  onDeleteConfirm,
  onDeletePost,
}: {
  posts: GeneratedPost[]
  onUpdatePost: (id: string, updates: Partial<GeneratedPost>) => void
  onAutoDistribute: () => void
  deleteConfirm: string | null
  onDeleteConfirm: (id: string | null) => void
  onDeletePost: (id: string) => void
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

                    {/* Delete post */}
                    <button
                      onClick={e => { e.stopPropagation(); onDeleteConfirm(post.id) }}
                      className="absolute top-0 right-0 w-3.5 h-3.5 bg-black/60 text-[7px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-red-500/80"
                    >
                      &times;
                    </button>

                    {/* Delete confirmation */}
                    {deleteConfirm === post.id && (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-1 rounded z-10">
                        <p className="text-[8px] text-white">Delete?</p>
                        <div className="flex gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); onDeletePost(post.id) }}
                            className="px-1.5 py-0.5 text-[8px] bg-red-500 rounded text-white"
                          >
                            Yes
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); onDeleteConfirm(null) }}
                            className="px-1.5 py-0.5 text-[8px] bg-white/20 rounded text-white"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    )}
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
  const [variants, setVariants] = useState<Record<string, CaptionVariant[]>>({})
  const [generating, setGenerating] = useState<Set<string>>(new Set())
  const [businessType, setBusinessType] = useState('ice cream shop')
  const [tone, setTone] = useState('friendly and fun')
  const [exampleCaptions, setExampleCaptions] = useState('')
  const [language, setLanguage] = useState('Deutsch')
  const [timezone, setTimezone] = useState('Europe/Berlin')
  const [publishing, setPublishing] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [publishProgress, setPublishProgress] = useState(0)
  const [publishErrors, setPublishErrors] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'tiktok'])

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  // Account setup
  const [accountUsername, setAccountUsername] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('fp_username')
    if (saved) setAccountUsername(saved)
  }, [])

  const handleConnect = async () => {
    if (!accountUsername.trim()) return
    setConnecting(true)
    setConnectError('')
    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: accountUsername.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.connectUrl) {
        setConnectError(data.error || 'Failed to generate connection link')
        return
      }
      localStorage.setItem('fp_username', accountUsername.trim())
      window.open(data.connectUrl, '_blank')
    } catch {
      setConnectError('Network error — please try again')
    } finally {
      setConnecting(false)
    }
  }

  const saveUsername = () => {
    if (accountUsername.trim()) {
      localStorage.setItem('fp_username', accountUsername.trim())
    }
  }

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

  const generateCaption = async (photo: UploadedPhoto, platform: string) => {
    const key = `${photo.id}-${platform}`
    setGenerating(prev => new Set(prev).add(key))

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: photo.description || 'a photo of the product/business',
          businessType,
          tone,
          platform,
          exampleCaptions,
          language,
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const newVariants: CaptionVariant[] = (data.variants || [{ caption: data.caption, hashtags: data.hashtags }])
        .filter((v: CaptionVariant) => v.caption)

      setVariants(prev => ({ ...prev, [key]: newVariants }))
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

  const selectVariant = (photo: UploadedPhoto, platform: string, variant: CaptionVariant) => {
    const key = `${photo.id}-${platform}`
    setPosts(prev => [
      ...prev.filter(p => !(p.photoId === photo.id && p.platform === platform)),
      {
        id: crypto.randomUUID(),
        photoId: photo.id,
        preview: photo.preview,
        caption: variant.caption,
        hashtags: variant.hashtags || [],
        platform,
        scheduledDate: '',
        scheduledTime: getPlatform(platform).bestTime,
        status: 'draft',
      },
    ])
    // Clear variants for this key (selection made)
    setVariants(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const generateAll = async () => {
    const tasks = photos.flatMap(photo =>
      selectedPlatforms.map(plat => generateCaption(photo, plat))
    )
    await Promise.all(tasks)
  }

  const acceptAllVariants = () => {
    // Auto-select variant #1 for all pending variant sets
    const newPosts: GeneratedPost[] = []
    const keysToRemove: string[] = []

    for (const [key, variantList] of Object.entries(variants)) {
      if (!variantList || variantList.length === 0) continue
      const [photoId, platform] = key.split('-') as [string, string]
      const photo = photos.find(p => p.id === photoId)
      if (!photo) continue

      keysToRemove.push(key)
      newPosts.push({
        id: crypto.randomUUID(),
        photoId: photo.id,
        preview: photo.preview,
        caption: variantList[0].caption,
        hashtags: variantList[0].hashtags || [],
        platform,
        scheduledDate: '',
        scheduledTime: getPlatform(platform).bestTime,
        status: 'draft',
      })
    }

    // Remove existing posts for these photo+platform combos, add new ones
    setPosts(prev => {
      const filtered = prev.filter(p => !newPosts.some(np => np.photoId === p.photoId && np.platform === p.platform))
      return [...filtered, ...newPosts]
    })

    // Clear accepted variants
    setVariants(prev => {
      const next = { ...prev }
      for (const k of keysToRemove) delete next[k]
      return next
    })
  }

  // --- Schedule ---

  const updatePost = (id: string, updates: Partial<GeneratedPost>) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  const deletePost = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id))
    setDeleteConfirm(null)
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

      const formData = new FormData()
      formData.append('photo', photo.file)
      formData.append('caption', post.caption)
      formData.append('hashtags', post.hashtags.join(','))
      formData.append('platform', post.platform)
      formData.append('scheduledDate', post.scheduledDate)
      formData.append('scheduledTime', post.scheduledTime)
      formData.append('timezone', timezone)
      if (accountUsername.trim()) formData.append('username', accountUsername.trim())

      try {
        const res = await fetch('/api/publish', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.success) {
          setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'posted' as const } : p))
        } else {
          const detail = data.details?.error || data.details?.message || data.details?.raw || JSON.stringify(data.details || '')
          setPublishErrors(prev => [...prev, `${post.platform}: ${data.error || 'Failed'} — ${detail}`])
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
          Flowing<span className="text-[var(--accent)]">Post</span>
        </h1>
        <p className="text-[var(--text-muted)]">
          Fotos hochladen &rarr; KI generiert Captions &rarr; Planen &rarr; Auf allen Plattformen posten
        </p>
      </div>

      {/* Account Setup */}
      <div className="max-w-xl mx-auto mb-8 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium mb-3">Dein Account</p>
        <div className="flex gap-2">
          <input
            value={accountUsername}
            onChange={e => setAccountUsername(e.target.value)}
            onBlur={saveUsername}
            placeholder="Dein Benutzername (von uns per E-Mail erhalten)"
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
          />
          <button
            onClick={handleConnect}
            disabled={connecting || !accountUsername.trim()}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {connecting ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full loading-spin" />
                Verbinde...
              </span>
            ) : (
              'Konten verbinden →'
            )}
          </button>
        </div>
        {connectError && (
          <p className="mt-2 text-xs text-red-400">{connectError}</p>
        )}
        {!connectError && accountUsername.trim() && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Klicke auf &ldquo;Konten verbinden&rdquo;, um Instagram oder TikTok zu verknüpfen. Der Link öffnet sich in einem neuen Tab.
          </p>
        )}
        {!accountUsername.trim() && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Du hast noch keinen Benutzernamen? Schreib uns an{' '}
            <a href="mailto:hello@flowingpost.com" className="text-[var(--accent)] hover:underline">hello@flowingpost.com</a>.
          </p>
        )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1.5">Language</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
              >
                <option value="Deutsch">Deutsch</option>
                <option value="English">English</option>
                <option value="Español">Español</option>
                <option value="Français">Français</option>
                <option value="Italiano">Italiano</option>
                <option value="Português">Português</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1.5">Timezone</label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
              >
                <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Europe/Paris">Europe/Paris (CET)</option>
                <option value="Europe/Madrid">Europe/Madrid (CET)</option>
                <option value="Europe/Rome">Europe/Rome (CET)</option>
                <option value="Europe/Zurich">Europe/Zurich (CET)</option>
                <option value="Europe/Vienna">Europe/Vienna (CET)</option>
                <option value="Asia/Kuala_Lumpur">Asia/Kuala Lumpur (MYT)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                <option value="Asia/Bangkok">Asia/Bangkok (ICT)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                <option value="America/New_York">US Eastern (EST)</option>
                <option value="America/Chicago">US Central (CST)</option>
                <option value="America/Denver">US Mountain (MST)</option>
                <option value="America/Los_Angeles">US Pacific (PST)</option>
                <option value="America/Sao_Paulo">America/Sao Paulo (BRT)</option>
              </select>
            </div>
          </div>

          {/* Platform selector */}
          <div className="mb-4">
            <label className="block text-sm text-[var(--text-muted)] mb-2">Plattformen</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => {
                const active = selectedPlatforms.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-white'
                        : 'border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    <PlatformIcon platform={p.id} size={13} />
                    {p.label}
                  </button>
                )
              })}
            </div>
            {selectedPlatforms.length === 0 && (
              <p className="mt-1.5 text-xs text-red-400">Wähle mindestens eine Plattform.</p>
            )}
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
                  disabled={selectedPlatforms.length === 0}
                  className="px-8 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Captions generieren — {photos.length} Foto{photos.length > 1 ? 's' : ''} × {selectedPlatforms.length} Plattform{selectedPlatforms.length > 1 ? 'en' : ''} &rarr;
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
                  Generiere...
                </span>
              ) : (
                `Alle generieren (${photos.length * selectedPlatforms.length} Posts)`
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

                    <div className="flex gap-2 flex-wrap mb-3">
                      {selectedPlatforms.map(plat => {
                        const key = `${photo.id}-${plat}`
                        const hasVariants = !!variants[key]
                        const hasPost = posts.some(p => p.photoId === photo.id && p.platform === plat)
                        const isGen = generating.has(key)
                        return (
                          <button
                            key={plat}
                            onClick={() => generateCaption(photo, plat)}
                            disabled={isGen}
                            className="platform-badge flex items-center gap-1.5 disabled:opacity-50"
                            style={(hasPost || hasVariants) ? { borderColor: 'var(--accent)', background: 'rgba(99,102,241,0.15)' } : {}}
                          >
                            {isGen ? (
                              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full loading-spin" />
                            ) : (
                              <PlatformIcon platform={plat} size={14} />
                            )}
                            {plat === 'instagram' ? 'Instagram' : 'TikTok'}
                            {hasPost && ' ✓'}
                            {hasVariants && !hasPost && ' ●'}
                          </button>
                        )
                      })}
                    </div>

                    {/* Variant selection */}
                    {selectedPlatforms.map(plat => {
                      const key = `${photo.id}-${plat}`
                      const variantList = variants[key]
                      const selectedPost = posts.find(p => p.photoId === photo.id && p.platform === plat)

                      if (!variantList && !selectedPost) return null

                      return (
                        <div key={plat} className="mb-3">
                          <div className="flex items-center gap-1.5 mb-1.5 text-[var(--text-muted)] text-xs">
                            <PlatformIcon platform={plat} size={12} /> {plat}
                            {selectedPost && <span className="text-[var(--success)] ml-1">&#10003; selected</span>}
                          </div>

                          {/* Show variants to pick from */}
                          {variantList && variantList.length > 0 && (
                            <div className="space-y-1.5">
                              {variantList.map((v, vi) => (
                                <button
                                  key={vi}
                                  onClick={() => selectVariant(photo, plat, v)}
                                  className="w-full text-left text-xs bg-white/5 hover:bg-white/10 rounded-lg p-2.5 border border-transparent hover:border-[var(--accent)]/50 transition-all"
                                >
                                  <div className="flex items-start gap-2">
                                    <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center text-[10px] font-bold mt-0.5">
                                      {vi + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="line-clamp-2">{v.caption}</p>
                                      <p className="text-[var(--accent)] mt-1 truncate">
                                        {(v.hashtags || []).slice(0, 5).map(h => `#${h}`).join(' ')}
                                        {(v.hashtags || []).length > 5 && ` +${v.hashtags.length - 5}`}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Show selected caption */}
                          {selectedPost && !variantList && (
                            <div className="text-xs bg-[var(--accent)]/10 rounded-lg p-2.5 border border-[var(--accent)]/30">
                              <p className="line-clamp-2">{selectedPost.caption}</p>
                              <p className="text-[var(--accent)] mt-1 truncate">
                                {selectedPost.hashtags.slice(0, 5).map(h => `#${h}`).join(' ')}
                                {selectedPost.hashtags.length > 5 && ` +${selectedPost.hashtags.length - 5}`}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(posts.length > 0 || Object.keys(variants).length > 0) && (
            <div className="flex flex-col items-center mt-6 gap-3">
              {Object.keys(variants).length > 0 && (
                <>
                  <p className="text-xs text-[var(--text-muted)]">
                    Pick your favorites or accept the first suggestion for all
                  </p>
                  <button
                    onClick={acceptAllVariants}
                    className="px-6 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] font-medium text-sm transition-colors"
                  >
                    Accept All (1st variant) &mdash; {Object.keys(variants).length} pending
                  </button>
                </>
              )}
              <button
                onClick={() => { handleAutoDistribute(); setStep(3) }}
                disabled={Object.keys(variants).length > 0 || posts.length === 0}
                className="px-8 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            deleteConfirm={deleteConfirm}
            onDeleteConfirm={setDeleteConfirm}
            onDeletePost={deletePost}
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
              {posts.length} Posts auf {selectedPlatforms.length} Plattform{selectedPlatforms.length > 1 ? 'en' : ''}
              {posts.every(p => p.status === 'posted') ? ' wurden veröffentlicht.' : ' — bereit zum Posten.'}
            </p>

            <div className={`grid gap-3 mb-6 ${selectedPlatforms.length <= 2 ? 'grid-cols-2' : selectedPlatforms.length <= 4 ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-5'}`}>
              {selectedPlatforms.map(plat => (
                <div key={plat} className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="mb-1 flex justify-center"><PlatformIcon platform={plat} size={24} /></div>
                  <div className="text-lg font-bold">{posts.filter(p => p.platform === plat).length}</div>
                  <div className="text-xs text-[var(--text-muted)]">{getPlatform(plat).label}</div>
                </div>
              ))}
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
                  disabled={publishing}
                  className="px-6 py-2.5 rounded-xl bg-[var(--success)] hover:brightness-110 font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {publishing ? 'Publishing...' : 'Publish Now'}
                </button>
              )}
              <button
                onClick={() => { setStep(1); setPhotos([]); setPosts([]); setVariants({}); setPublishErrors([]); setPublishProgress(0) }}
                disabled={publishing}
                className="px-6 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] font-medium text-sm transition-colors disabled:opacity-50"
              >
                New Batch
              </button>
            </div>

          </div>
        </div>
      )}

      <div className="text-center mt-12 text-xs text-[var(--text-muted)]">
        FlowingPost &mdash; powered by KI
      </div>
    </div>
  )
}
