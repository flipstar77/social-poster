import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

export interface BlogSlide {
  heading: string
  subtext: string
  voiceover: string
  imageUrl: string
}

export interface BlogVideoProps {
  slides: BlogSlide[]
  audioFile: string  // filename under public/audio/, e.g. "restaurant-marketing.mp3"
  title: string
  category: string
  framesPerSlide: number
}

const CATEGORY_COLORS: Record<string, string> = {
  'Instagram': '#E1306C',
  'TikTok': '#00f2ea',
  'Google Maps': '#4285F4',
  'SEO': '#0F9D58',
  'Strategie': '#FF6B35',
  'TikTok & Reels': '#00f2ea',
}

export const BlogVideoSlides: React.FC<BlogVideoProps> = ({
  slides,
  audioFile,
  category,
  framesPerSlide,
}) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const totalSlides = slides.length
  const currentSlideIndex = Math.min(
    Math.floor(frame / framesPerSlide),
    totalSlides - 1
  )
  const frameWithinSlide = frame - currentSlideIndex * framesPerSlide

  const slide = slides[currentSlideIndex]
  const accent = CATEGORY_COLORS[category] || '#FF6B35'

  const FADE_FRAMES = 12

  // Slide opacity: fade in, hold, fade out
  const opacity = interpolate(
    frameWithinSlide,
    [0, FADE_FRAMES, framesPerSlide - FADE_FRAMES, framesPerSlide],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  // Text slide up
  const textY = interpolate(
    frameWithinSlide,
    [0, FADE_FRAMES + 8],
    [24, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  // Ken Burns — each slide resets the zoom from 1 to 1.07
  const imageScale = interpolate(
    frameWithinSlide,
    [0, framesPerSlide],
    [1, 1.07],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  // Progress bar
  const progress = frame / durationInFrames

  const isIntro = currentSlideIndex === 0
  const isOutro = currentSlideIndex === totalSlides - 1

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>

      {/* Audio — plays from frame 0 */}
      {audioFile && (
        <Audio src={staticFile(`audio/${audioFile}`)} />
      )}

      {/* Background Image with Ken Burns */}
      <AbsoluteFill style={{ opacity: 0.5 }}>
        <Img
          src={slide.imageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${imageScale})`,
            transformOrigin: 'center center',
          }}
        />
      </AbsoluteFill>

      {/* Gradient overlay — heavier at bottom for text readability */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.82) 75%, rgba(0,0,0,0.95) 100%)',
        }}
      />

      {/* Main content — slides in/out */}
      <AbsoluteFill
        style={{
          opacity,
          padding: '72px 64px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          paddingBottom: 160,
        }}
      >
        {/* Badge: category (intro) or slide counter */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 20,
          transform: `translateY(${textY}px)`,
        }}>
          {isIntro ? (
            <div style={{
              backgroundColor: accent,
              borderRadius: 100,
              padding: '8px 22px',
              fontSize: 26,
              fontWeight: 700,
              color: 'white',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
              {category}
            </div>
          ) : isOutro ? (
            <div style={{ color: accent, fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>
              ✓ Zusammenfassung
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 28, fontWeight: 500, letterSpacing: 1 }}>
              {String(currentSlideIndex).padStart(2, '0')} / {String(totalSlides - 2).padStart(2, '0')}
            </div>
          )}
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: isIntro ? 70 : 62,
          fontWeight: 800,
          color: 'white',
          lineHeight: 1.15,
          margin: 0,
          marginBottom: 18,
          transform: `translateY(${textY}px)`,
          textShadow: '0 2px 24px rgba(0,0,0,0.6)',
          letterSpacing: -0.5,
        }}>
          {slide.heading}
        </h1>

        {/* Subtext */}
        {slide.subtext && (
          <p style={{
            fontSize: 34,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.55,
            margin: 0,
            transform: `translateY(${textY * 1.4}px)`,
          }}>
            {slide.subtext}
          </p>
        )}

        {/* Accent line */}
        <div style={{
          width: 72,
          height: 4,
          backgroundColor: accent,
          borderRadius: 2,
          marginTop: 28,
          transform: `translateY(${textY}px)`,
        }} />
      </AbsoluteFill>

      {/* Top branding */}
      <AbsoluteFill style={{
        padding: '52px 64px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
      }}>
        <div style={{
          color: 'rgba(255,255,255,0.65)',
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: 0.5,
        }}>
          flowingpost.com
        </div>
      </AbsoluteFill>

      {/* Progress bar */}
      <AbsoluteFill style={{
        display: 'flex',
        alignItems: 'flex-end',
        padding: '0 64px 52px',
      }}>
        <div style={{
          width: '100%',
          height: 3,
          backgroundColor: 'rgba(255,255,255,0.18)',
          borderRadius: 2,
        }}>
          <div style={{
            width: `${progress * 100}%`,
            height: '100%',
            backgroundColor: accent,
            borderRadius: 2,
          }} />
        </div>
      </AbsoluteFill>

    </AbsoluteFill>
  )
}
