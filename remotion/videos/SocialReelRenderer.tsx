// ============================================================================
// SOCIAL REEL RENDERER — Universal config-driven video renderer
// Ported from video-studio StylePreviewRenderer, adapted for restaurant content
// Supports both photo-reel and text-only reel types
// ============================================================================

import React from 'react'
import { AbsoluteFill, useCurrentFrame, interpolate, Img, OffthreadVideo, staticFile } from 'remotion'
import { STYLE_CONFIGS } from '../styles/style-generator'
import type { StyleConfig, TransitionType, TextAnimType, LayoutType } from '../styles/style-config'
import type { ReelContentConfig, StickerConfig, StickerAnimation } from '../data/content-types'
import { BgPatternSVG } from '../components/BgPatternSVG'
import { OverlayFX } from '../components/OverlayFX'

// ====== PHASE TIMING ======

const P_DUR = 150 // 5 seconds per phase at 30fps
const TR = 15     // 0.5 second transition

function phaseActivity(frame: number, start: number): number {
  return interpolate(
    frame,
    [start, start + TR, start + P_DUR - TR, start + P_DUR],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
}

function textEnterProgress(frame: number, phaseStart: number): number {
  return interpolate(
    frame,
    [phaseStart + TR, phaseStart + TR + 20],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
}

// For 'punch' animation: title grows from tiny to full size at frame 60→100 of phase 1
function punchGrowProgress(frame: number): number {
  const raw = interpolate(frame, [60, 100], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  // ease-out cubic
  return 1 - Math.pow(1 - raw, 3)
}

// ====== TRANSITION STYLES ======

function transStyle(t: number, type: TransitionType): React.CSSProperties {
  switch (type) {
    case 'fade':
      return { opacity: t }
    case 'slide-left':
      return { opacity: t, transform: `translateX(${(1 - t) * 200}px)` }
    case 'slide-right':
      return { opacity: t, transform: `translateX(${-(1 - t) * 200}px)` }
    case 'slide-up':
      return { opacity: t, transform: `translateY(${(1 - t) * 200}px)` }
    case 'slide-down':
      return { opacity: t, transform: `translateY(${-(1 - t) * 200}px)` }
    case 'scale':
      return { opacity: t, transform: `scale(${0.5 + t * 0.5})` }
    case 'blur':
      return { opacity: Math.min(1, t * 1.5), filter: `blur(${(1 - t) * 20}px)` }
    case 'wipe':
      return { clipPath: `inset(0 ${(1 - t) * 100}% 0 0)` }
    case 'glitch':
      return {
        opacity: t > 0.3 ? 1 : t * 3,
        transform: t < 0.5 ? `translateX(${Math.sin(t * 60) * 15}px) skewX(${(1 - t) * 5}deg)` : 'none',
      }
    case 'rotate':
      return { opacity: t, transform: `rotate(${(1 - t) * 12}deg) scale(${0.85 + t * 0.15})` }
    default:
      return { opacity: t }
  }
}

// ====== TEXT ANIMATION ======

function textAnimStyle(progress: number, type: TextAnimType): React.CSSProperties {
  switch (type) {
    case 'fade-up':
      return { opacity: progress, transform: `translateY(${(1 - progress) * 30}px)` }
    case 'instant':
      return { opacity: progress > 0.1 ? 1 : 0 }
    case 'typewriter':
      return { opacity: 1, clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }
    case 'blur-in':
      return { opacity: progress, filter: `blur(${(1 - progress) * 8}px)` }
    case 'slide-in':
      return { opacity: progress, transform: `translateX(${(1 - progress) * 60}px)` }
    case 'scale-in':
      return { opacity: progress, transform: `scale(${0.7 + progress * 0.3})` }
    default:
      return { opacity: progress }
  }
}

// ====== LAYOUT HELPERS ======

function layoutAlign(layout: LayoutType): React.CSSProperties {
  switch (layout) {
    case 'left': return { alignItems: 'flex-start', textAlign: 'left' }
    case 'right': return { alignItems: 'flex-end', textAlign: 'right' }
    case 'card': return { alignItems: 'center', textAlign: 'center' }
    case 'split': return { alignItems: 'center', textAlign: 'left' }
    default: return { alignItems: 'center', textAlign: 'center' }
  }
}

// ====== MEDIA LAYER (Photo or Video) ======

const MediaElement: React.FC<{
  src: string
  mediaType?: 'image' | 'video'
  style: React.CSSProperties
}> = ({ src, mediaType, style }) => {
  if (mediaType === 'video') {
    return <OffthreadVideo src={src} style={style} muted />
  }
  return <Img src={src} style={style} />
}

const MediaLayer: React.FC<{
  src: string
  mediaType?: 'image' | 'video'
  position: StyleConfig['photoPosition']
  overlayOpacity: number
}> = ({ src, mediaType, position, overlayOpacity }) => {
  const baseStyle: React.CSSProperties = { position: 'absolute', objectFit: 'cover' }

  switch (position) {
    case 'full-bleed':
      return (
        <>
          <MediaElement src={src} mediaType={mediaType} style={{ ...baseStyle, top: 0, left: 0, width: '100%', height: '100%' }} />
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            background: `rgba(0,0,0,${overlayOpacity})`,
          }} />
        </>
      )
    case 'top-half':
      return (
        <>
          <MediaElement src={src} mediaType={mediaType} style={{ ...baseStyle, top: 0, left: 0, width: '100%', height: '50%' }} />
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '50%',
            background: `linear-gradient(to bottom, transparent 40%, rgba(0,0,0,${overlayOpacity}) 100%)`,
          }} />
        </>
      )
    case 'left-half':
      return (
        <>
          <MediaElement src={src} mediaType={mediaType} style={{ ...baseStyle, top: 0, left: 0, width: '50%', height: '100%' }} />
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '50%', height: '100%',
            background: `linear-gradient(to right, transparent 40%, rgba(0,0,0,${overlayOpacity}) 100%)`,
          }} />
        </>
      )
    case 'circle-center':
      return (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 500, height: 500, borderRadius: '50%', overflow: 'hidden',
        }}>
          <MediaElement src={src} mediaType={mediaType} style={{ ...baseStyle, top: 0, left: 0, width: '100%', height: '100%' }} />
        </div>
      )
    default:
      return null
  }
}

// ====== STICKER LAYER ======

function stickerAnimStyle(frame: number, anim: StickerAnimation, phaseStart: number, delay: number): React.CSSProperties {
  const start = phaseStart + delay
  const dur = 20 // animation duration in frames

  // progress 0→1 with ease-out
  const raw = interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  // ease-out cubic
  const p = 1 - Math.pow(1 - raw, 3)

  switch (anim) {
    case 'fly-left':
      return { opacity: Math.min(1, raw * 2), transform: `translateX(${(1 - p) * -140}%)` }
    case 'fly-right':
      return { opacity: Math.min(1, raw * 2), transform: `translateX(${(1 - p) * 140}%)` }
    case 'fly-top':
      return { opacity: Math.min(1, raw * 2), transform: `translateY(${(1 - p) * -140}%)` }
    case 'fly-bottom':
      return { opacity: Math.min(1, raw * 2), transform: `translateY(${(1 - p) * 140}%)` }
    case 'pop': {
      const scale = p < 0.8
        ? interpolate(p, [0, 0.8], [0, 1.2])
        : interpolate(p, [0.8, 1], [1.2, 1.0])
      return { opacity: Math.min(1, raw * 3), transform: `scale(${scale})` }
    }
    case 'bounce': {
      // fly from top with overshoot
      const bounceP = p < 0.7
        ? interpolate(p, [0, 0.7], [-140, 10])
        : interpolate(p, [0.7, 1], [10, 0])
      return { opacity: Math.min(1, raw * 2), transform: `translateY(${bounceP}%)` }
    }
    case 'spin-pop': {
      const scale = p < 0.8
        ? interpolate(p, [0, 0.8], [0, 1.15])
        : interpolate(p, [0.8, 1], [1.15, 1.0])
      const rot = interpolate(p, [0, 1], [-180, 0])
      return { opacity: Math.min(1, raw * 3), transform: `scale(${scale}) rotate(${rot}deg)` }
    }
    default:
      return { opacity: p }
  }
}

const StickerLayer: React.FC<{
  stickers: StickerConfig[]
  frame: number
  canvasW: number
  canvasH: number
}> = ({ stickers, frame }) => {
  return (
    <>
      {stickers.map(sticker => {
        const phaseStart = ((sticker.phase ?? 1) - 1) * P_DUR
        const animStyle = stickerAnimStyle(frame, sticker.animation, phaseStart, sticker.delay ?? 0)

        // hide in wrong phase (fade out at phase end too)
        const phaseEnd = phaseStart + P_DUR
        const phaseOpacity = interpolate(
          frame,
          [phaseStart - 1, phaseStart, phaseEnd - TR, phaseEnd],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        )

        return (
          <div
            key={sticker.id}
            style={{
              position: 'absolute',
              left: `${sticker.x}%`,
              top: `${sticker.y}%`,
              width: `${sticker.size}%`,
              transform: `translate(-50%, -50%) rotate(${sticker.rotation ?? 0}deg)`,
              opacity: phaseOpacity,
              zIndex: 5,
            }}
          >
            <div style={{ ...animStyle, transformOrigin: 'center center' }}>
              <Img
                src={sticker.url}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          </div>
        )
      })}
    </>
  )
}

// ====== MAIN RENDERER ======

export const SocialReelRenderer: React.FC<{
  styleIndex?: number
  style?: StyleConfig
  content: ReelContentConfig
}> = ({ styleIndex, style: styleProp, content }) => {
  const frame = useCurrentFrame()
  const c = styleProp ?? STYLE_CONFIGS[styleIndex ?? 0]

  // Use content's accent color override if provided
  const accent = content.accentColor || c.accent

  const a1 = phaseActivity(frame, 0)
  const a2 = phaseActivity(frame, 150)
  const a3 = phaseActivity(frame, 300)

  const t1 = textEnterProgress(frame, 0)
  const t2 = textEnterProgress(frame, 150)
  const t3 = textEnterProgress(frame, 300)

  const s1 = transStyle(a1, c.transition)
  const s2 = transStyle(a2, c.transition)
  const s3 = transStyle(a3, c.transition)

  const ta1 = textAnimStyle(t1, c.textAnim)
  const ta2 = textAnimStyle(t2, c.textAnim)
  const ta3 = textAnimStyle(t3, c.textAnim)

  // Punch animation: separate styles for hook (instant) and title (grows at frame 60-100)
  const isPunch = c.textAnim === 'punch'
  const punch1 = punchGrowProgress(frame)
  const hookFadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const punchHookStyle: React.CSSProperties = { opacity: hookFadeIn }
  const punchTitleStyle: React.CSSProperties = {
    opacity: interpolate(frame, [5, 25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    transform: `scale(${0.2 + punch1 * 0.8})`,
    transformOrigin: 'center center',
    display: 'block',
  }

  const align = layoutAlign(c.layout)
  const isCard = c.layout === 'card'
  const isSplit = c.layout === 'split'
  const isPhotoReel = content.type === 'photo-reel' && content.mediaUrl
  const tp = content.textPosition

  // When photo is behind text, use white + shadow for readability
  const photoText = isPhotoReel && c.photoPosition === 'full-bleed'
  const primaryColor = photoText ? '#ffffff' : c.textPrimary
  const secondaryColor = photoText ? '#ffffffcc' : c.textSecondary
  const textShadow = photoText ? '0 2px 12px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.5)' : 'none'

  const cardStyle: React.CSSProperties = isCard ? {
    background: `${c.bg2}dd`,
    borderRadius: 24,
    padding: 48,
    border: `1px solid ${accent}30`,
    backdropFilter: 'blur(10px)',
    maxWidth: 900,
    width: '100%',
  } : {}

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(${c.gradAngle}deg, ${c.bg1}, ${c.bg2})`,
      fontFamily: c.font,
      overflow: 'hidden',
    }}>
      {/* Media background layer — spans ALL phases with Ken Burns zoom */}
      {isPhotoReel && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          transform: content.mediaType !== 'video'
            ? `scale(${interpolate(frame, [0, 450], [1, 1.15], { extrapolateRight: 'clamp' })})`
            : undefined,
        }}>
          <MediaLayer
            src={content.mediaUrl!}
            mediaType={content.mediaType}
            position={c.photoPosition}
            overlayOpacity={c.photoOverlayOpacity}
          />
        </div>
      )}

      {/* Background pattern (hidden when photo-reel with full-bleed) */}
      {!(isPhotoReel && c.photoPosition === 'full-bleed') && (
        <BgPatternSVG type={c.bgPattern} color={accent + '18'} id={`sr-${styleIndex}`} />
      )}

      {/* Phase 1: Hook + Title */}
      {frame < P_DUR + TR && (
        <AbsoluteFill style={{
          ...s1,
          ...(tp ? {} : { display: 'flex', flexDirection: 'column', justifyContent: 'center', ...align }),
          padding: isCard ? 80 : 60,
        }}>
          <div style={{
            ...(isCard ? cardStyle : {}),
            ...(tp ? {
              position: 'absolute' as const,
              left: `${tp.x}%`,
              top: `${tp.y}%`,
              transform: 'translate(-50%, -50%)',
              maxWidth: '80%',
            } : {}),
          }}>
            <div style={{
              ...(isPunch ? punchHookStyle : ta1),
              color: secondaryColor,
              fontSize: c.bodySize,
              fontWeight: 400,
              marginBottom: 16,
              letterSpacing: 2,
              textTransform: 'uppercase' as const,
              textShadow,
            }}>
              {content.hook}
            </div>
            <div style={{
              ...(isPunch ? punchTitleStyle : ta1),
              color: primaryColor,
              fontSize: c.titleSize,
              fontWeight: c.titleWeight,
              letterSpacing: c.letterSpacing,
              textTransform: c.textTransform as React.CSSProperties['textTransform'],
              lineHeight: 1.1,
              textShadow,
            }}>
              {content.title}
            </div>
            <div style={{
              ...ta1,
              marginTop: 24,
              width: 80,
              height: 4,
              background: accent,
              borderRadius: 2,
            }} />
          </div>
        </AbsoluteFill>
      )}

      {/* Phase 2: Visual + Description */}
      {frame >= P_DUR - TR && frame < 2 * P_DUR + TR && (
        <AbsoluteFill style={{
          ...s2,
          ...(tp ? {} : {
            display: 'flex',
            flexDirection: isSplit ? 'row' : 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }),
          padding: isCard ? 80 : 60,
          gap: isSplit ? 40 : 20,
        }}>
          {isCard ? (
            <div style={{
              ...cardStyle,
              ...(tp ? {
                position: 'absolute' as const,
                left: `${tp.x}%`,
                top: `${tp.y}%`,
                transform: 'translate(-50%, -50%)',
              } : {}),
            }}>
              <div style={{
                ...ta2,
                color: secondaryColor,
                fontSize: c.bodySize,
                lineHeight: 1.6,
                whiteSpace: 'pre-line',
                textShadow,
              }}>
                {content.description}
              </div>
            </div>
          ) : (
            <div style={{
              ...ta2,
              color: secondaryColor,
              fontSize: c.bodySize + 4,
              lineHeight: 1.6,
              whiteSpace: 'pre-line',
              ...(tp ? {} : align),
              flex: isSplit && !tp ? 1 : undefined,
              textShadow,
              maxWidth: 900,
              ...(tp ? {
                position: 'absolute' as const,
                left: `${tp.x}%`,
                top: `${tp.y}%`,
                transform: 'translate(-50%, -50%)',
              } : {}),
            }}>
              {content.description}
            </div>
          )}
        </AbsoluteFill>
      )}

      {/* Phase 3: CTA */}
      {frame >= 2 * P_DUR - TR && (
        <AbsoluteFill style={{
          ...s3,
          ...(tp ? {} : { display: 'flex', flexDirection: 'column', justifyContent: 'center', ...align }),
          padding: isCard ? 80 : 60,
        }}>
          <div style={{
            ...(isCard ? cardStyle : {}),
            ...(tp ? {
              position: 'absolute' as const,
              left: `${tp.x}%`,
              top: `${tp.y}%`,
              transform: 'translate(-50%, -50%)',
              maxWidth: '80%',
            } : {}),
          }}>
            {content.ctaDetail && (
              <div style={{
                ...ta3,
                color: photoText ? '#ffffffee' : accent,
                fontSize: c.bodySize - 4,
                fontWeight: 700,
                letterSpacing: 4,
                textTransform: 'uppercase' as const,
                marginBottom: 20,
                textShadow,
              }}>
                {content.ctaDetail}
              </div>
            )}
            <div style={{
              ...ta3,
              color: primaryColor,
              fontSize: Math.round(c.titleSize * 0.55),
              fontWeight: c.titleWeight,
              lineHeight: 1.3,
              letterSpacing: c.letterSpacing * 0.5,
              textTransform: c.textTransform as React.CSSProperties['textTransform'],
              marginBottom: 32,
              textShadow,
            }}>
              {content.ctaLabel}
            </div>
            <div style={{
              ...ta3,
              display: 'inline-flex',
              background: accent,
              color: c.bg1,
              padding: '14px 40px',
              borderRadius: 8,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 2,
            }}>
              {content.businessName || (content.locale === 'de' ? 'Jetzt besuchen' : 'Visit Us')}
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Sticker layer — product shots / decorations with fly-in animations */}
      {content.stickers && content.stickers.length > 0 && (
        <StickerLayer
          stickers={content.stickers}
          frame={frame}
          canvasW={1080}
          canvasH={1920}
        />
      )}

      {/* Overlay effects */}
      <OverlayFX type={c.overlay} accent={accent} />

      {/* Business name watermark (bottom-right) */}
      {content.businessName && (
        <div style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          color: c.textSecondary + '60',
          fontSize: 18,
          fontFamily: "'Consolas', monospace",
          letterSpacing: 1,
        }}>
          {content.businessName}
        </div>
      )}
    </AbsoluteFill>
  )
}
