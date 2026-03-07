'use client'

import { useState } from 'react'

const CITIES = [
  { value: 'berlin', label: 'Berlin' },
  { value: 'muenchen', label: 'Muenchen' },
  { value: 'wien', label: 'Wien' },
  { value: 'zuerich', label: 'Zuerich' },
]

interface ScoreBreakdown {
  frequency: number
  engagement: number
  hashtags: number
  contentMix: number
  consistency: number
}

interface AuditReport {
  handle: string
  city: string
  score: number
  scoreBreakdown: ScoreBreakdown
  stats: {
    totalPosts: number
    avgLikes: number
    avgComments: number
    engagementRate: number
    postingFrequency: number
    avgHashtagsPerPost: number
    contentMix: Record<string, number>
    bestPostingHour: number
  }
  comparison: {
    engagementVsCity: number
    frequencyVsCity: number
    hashtagsVsCity: number
  }
  topPosts: { url: string; likes: number; comments: number; reason: string }[]
  bottomPosts: { url: string; likes: number; comments: number; issue: string }[]
  recommendations: string[]
}

interface CityStatsPreview {
  avgLikes: number
  avgComments: number
  avgEngagementRate: number
  topHashtags: { tag: string; count: number }[]
  sampleSize: number
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 10) * circumference
  const color = score >= 7 ? '#22c55e' : score >= 4 ? '#f59e0b' : '#ef4444'

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#27272a" strokeWidth="8" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${progress} ${circumference - progress}`}
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize={size / 3.5} fontWeight="bold"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
      >
        {score.toFixed(1)}
      </text>
    </svg>
  )
}

function ScoreBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = value >= 7 ? '#22c55e' : value >= 4 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
        <span style={{ color: '#a1a1aa' }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{value.toFixed(1)}/10</span>
      </div>
      <div style={{ background: '#27272a', borderRadius: 4, height: 6 }}>
        <div style={{ background: color, borderRadius: 4, height: 6, width: `${pct}%`, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

function ComparisonBadge({ value, label }: { value: number; label: string }) {
  const positive = value >= 0
  const color = positive ? '#22c55e' : '#ef4444'
  return (
    <div style={{ textAlign: 'center', padding: '12px 16px', background: '#18181b', borderRadius: 8, border: '1px solid #27272a' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{positive ? '+' : ''}{value}%</div>
      <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export default function InstagramAuditPage() {
  const [handle, setHandle] = useState('')
  const [city, setCity] = useState('berlin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<AuditReport | null>(null)
  const [cityStats, setCityStats] = useState<CityStatsPreview | null>(null)
  const [showEmailGate, setShowEmailGate] = useState(false)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  async function runAudit() {
    if (!handle.trim()) return
    setLoading(true)
    setError('')
    setReport(null)
    setCityStats(null)

    try {
      const res = await fetch('/api/instagram-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.trim(), city }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Fehler beim Audit')
        return
      }

      setReport(data.report)
      setCityStats(data.cityStats)
    } catch {
      setError('Netzwerkfehler — bitte erneut versuchen')
    } finally {
      setLoading(false)
    }
  }

  async function subscribeNewsletter() {
    if (!email.trim()) return

    await fetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        city,
        source: 'ig_audit',
      }),
    })

    setEmailSent(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: 'white' }}>
      {/* Header */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
        <a href="/" style={{ color: '#6366f1', fontSize: 14, textDecoration: 'none' }}>
          &larr; FlowingPost
        </a>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 16, lineHeight: 1.2 }}>
          Kostenloser Instagram-Audit fuer Restaurants
        </h1>
        <p style={{ color: '#a1a1aa', fontSize: 16, marginTop: 8, maxWidth: 600 }}>
          Finde heraus, wie dein Restaurant-Account im Vergleich zu anderen in deiner Stadt abschneidet.
          Basierend auf echten Daten von {CITIES.length * 100}+ Restaurant-Posts.
        </p>

        {/* Input Form */}
        <div style={{
          marginTop: 32, padding: 24, background: '#18181b', borderRadius: 12,
          border: '1px solid #27272a',
        }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 250px' }}>
              <label style={{ fontSize: 13, color: '#a1a1aa', display: 'block', marginBottom: 6 }}>
                Instagram-Handle
              </label>
              <input
                type="text"
                placeholder="@dein_restaurant"
                value={handle}
                onChange={e => setHandle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runAudit()}
                style={{
                  width: '100%', padding: '10px 14px', background: '#09090b',
                  border: '1px solid #3f3f46', borderRadius: 8, color: 'white',
                  fontSize: 15, outline: 'none',
                }}
              />
            </div>
            <div style={{ flex: '0 0 180px' }}>
              <label style={{ fontSize: 13, color: '#a1a1aa', display: 'block', marginBottom: 6 }}>
                Stadt
              </label>
              <select
                value={city}
                onChange={e => setCity(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', background: '#09090b',
                  border: '1px solid #3f3f46', borderRadius: 8, color: 'white',
                  fontSize: 15, outline: 'none',
                }}
              >
                {CITIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={runAudit}
            disabled={loading || !handle.trim()}
            style={{
              marginTop: 16, width: '100%', padding: '12px 24px',
              background: loading ? '#3f3f46' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white', border: 'none', borderRadius: 8,
              fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Analyse laeuft... (30-60 Sekunden)' : 'Kostenlosen Audit starten'}
          </button>

          {error && (
            <div style={{ marginTop: 12, padding: 12, background: '#7f1d1d22', border: '1px solid #991b1b', borderRadius: 8, color: '#fca5a5', fontSize: 14 }}>
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {report && (
          <div style={{ marginTop: 32 }}>
            {/* Score Overview */}
            <div style={{
              padding: 32, background: '#18181b', borderRadius: 12,
              border: '1px solid #27272a', textAlign: 'center',
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                @{report.handle}
              </h2>
              <p style={{ color: '#71717a', fontSize: 14, marginBottom: 24 }}>
                vs. {report.city} Durchschnitt ({cityStats?.sampleSize ?? 0} Posts analysiert)
              </p>

              <ScoreRing score={report.score} />

              <div style={{ marginTop: 24, maxWidth: 400, margin: '24px auto 0' }}>
                <ScoreBar label="Posting-Frequenz" value={report.scoreBreakdown.frequency} />
                <ScoreBar label="Engagement" value={report.scoreBreakdown.engagement} />
                <ScoreBar label="Hashtags" value={report.scoreBreakdown.hashtags} />
                <ScoreBar label="Content-Mix" value={report.scoreBreakdown.contentMix} />
                <ScoreBar label="Konsistenz" value={report.scoreBreakdown.consistency} />
              </div>
            </div>

            {/* City Comparison */}
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <ComparisonBadge value={report.comparison.engagementVsCity} label="Engagement vs. Stadt" />
              <ComparisonBadge value={report.comparison.frequencyVsCity} label="Frequenz vs. Stadt" />
              <div style={{ textAlign: 'center', padding: '12px 16px', background: '#18181b', borderRadius: 8, border: '1px solid #27272a' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#a78bfa' }}>
                  {report.stats.postingFrequency.toFixed(1)}x
                </div>
                <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>Posts/Woche</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 16px', background: '#18181b', borderRadius: 8, border: '1px solid #27272a' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#a78bfa' }}>
                  {report.stats.engagementRate.toFixed(2)}%
                </div>
                <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>Engagement-Rate</div>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{
              marginTop: 16, padding: 24, background: '#18181b', borderRadius: 12,
              border: '1px solid #27272a',
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Deine Zahlen</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
                {[
                  { label: 'Avg. Likes', value: report.stats.avgLikes },
                  { label: 'Avg. Kommentare', value: report.stats.avgComments },
                  { label: 'Posts analysiert', value: report.stats.totalPosts },
                  { label: 'Hashtags/Post', value: report.stats.avgHashtagsPerPost },
                  { label: 'Beste Posting-Zeit', value: `${report.stats.bestPostingHour}:00` },
                ].map((item, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 12, color: '#71717a' }}>{item.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations — teaser (first 2) + email gate */}
            <div style={{
              marginTop: 16, padding: 24, background: '#18181b', borderRadius: 12,
              border: '1px solid #27272a',
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Empfehlungen</h3>

              {report.recommendations.slice(0, 2).map((rec, i) => (
                <div key={i} style={{
                  padding: '12px 16px', background: '#09090b', borderRadius: 8,
                  marginBottom: 8, fontSize: 14, lineHeight: 1.5, color: '#d4d4d8',
                  borderLeft: '3px solid #6366f1',
                }}>
                  {rec}
                </div>
              ))}

              {report.recommendations.length > 2 && !showEmailGate && !emailSent && (
                <button
                  onClick={() => setShowEmailGate(true)}
                  style={{
                    marginTop: 8, width: '100%', padding: '12px 24px',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white', border: 'none', borderRadius: 8,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  +{report.recommendations.length - 2} weitere Empfehlungen freischalten
                </button>
              )}

              {showEmailGate && !emailSent && (
                <div style={{ marginTop: 12, padding: 16, background: '#09090b', borderRadius: 8 }}>
                  <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 8 }}>
                    Gib deine Email ein, um den kompletten Report mit allen Empfehlungen zu erhalten.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="email"
                      placeholder="deine@email.de"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && subscribeNewsletter()}
                      style={{
                        flex: 1, padding: '10px 14px', background: '#18181b',
                        border: '1px solid #3f3f46', borderRadius: 8, color: 'white',
                        fontSize: 14, outline: 'none',
                      }}
                    />
                    <button
                      onClick={subscribeNewsletter}
                      style={{
                        padding: '10px 20px', background: '#6366f1', color: 'white',
                        border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      Freischalten
                    </button>
                  </div>
                </div>
              )}

              {emailSent && report.recommendations.slice(2).map((rec, i) => (
                <div key={i + 2} style={{
                  padding: '12px 16px', background: '#09090b', borderRadius: 8,
                  marginBottom: 8, fontSize: 14, lineHeight: 1.5, color: '#d4d4d8',
                  borderLeft: '3px solid #6366f1',
                }}>
                  {rec}
                </div>
              ))}
            </div>

            {/* Top Posts */}
            {report.topPosts.length > 0 && (
              <div style={{
                marginTop: 16, padding: 24, background: '#18181b', borderRadius: 12,
                border: '1px solid #27272a',
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Deine besten Posts</h3>
                {report.topPosts.map((post, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: i < report.topPosts.length - 1 ? '1px solid #27272a' : 'none',
                  }}>
                    <div>
                      <a href={post.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#a78bfa', fontSize: 14, textDecoration: 'none' }}>
                        Post #{i + 1}
                      </a>
                      <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>{post.reason}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 13 }}>
                      <span style={{ color: '#f472b6' }}>{post.likes} Likes</span>
                      {' / '}
                      <span style={{ color: '#60a5fa' }}>{post.comments} Kommentare</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <div style={{
              marginTop: 24, padding: 32, background: 'linear-gradient(135deg, #312e81, #1e1b4b)',
              borderRadius: 12, textAlign: 'center',
            }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                Automatisiere dein Restaurant Social Media
              </h3>
              <p style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 16 }}>
                FlowingPost generiert perfekte Captions und postet automatisch auf 9 Plattformen.
              </p>
              <a
                href="/de/login"
                style={{
                  display: 'inline-block', padding: '12px 32px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white', borderRadius: 8, textDecoration: 'none',
                  fontSize: 15, fontWeight: 600,
                }}
              >
                Jetzt kostenlos testen
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
