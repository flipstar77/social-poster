import React from 'react'
import { Composition } from 'remotion'
import { SocialReelRenderer } from './videos/SocialReelRenderer'
import { BlogVideoSlides } from './videos/BlogVideoSlides'
import type { BlogVideoProps } from './videos/BlogVideoSlides'
import { STYLE_COUNT } from './styles/style-generator'
import { FPS, REEL_DURATION_FRAMES, WIDTH, HEIGHT } from './constants'
import type { ReelContentConfig } from './data/content-types'
import { buildStyleConfig } from './styles/style-builder'

const BLOG_VIDEO_DEFAULT_PROPS: BlogVideoProps = {
  slides: [
    { heading: 'Blog Video Vorschau', subtext: 'Vorschau-Modus', imageUrl: 'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg', voiceover: '' },
    { heading: 'Schritt 1', subtext: 'Erster wichtiger Tipp', imageUrl: 'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg', voiceover: '' },
    { heading: 'Folg uns für mehr Tipps', subtext: 'flowingpost.com', imageUrl: 'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg', voiceover: '' },
  ],
  audioFile: '',
  title: 'Preview',
  category: 'Strategie',
  framesPerSlide: 270,
}

// Default preview content for Remotion Studio
const PREVIEW_CONTENT: ReelContentConfig = {
  id: 'preview',
  type: 'text-only',
  hook: 'TODAY ONLY',
  title: 'Homemade Pasta',
  description: 'Fresh ingredients,\ncooked with love\nevery single day.',
  ctaLabel: 'Reserve Now',
  ctaDetail: 'Link in Bio',
  businessName: 'FlowingPost Demo',
  locale: 'en',
}

export const RemotionRoot: React.FC = () => (
  <>
    {/* Register a composition for each of the 200 styles */}
    {Array.from({ length: STYLE_COUNT }, (_, i) => (
      <Composition
        key={`Reel-${String(i + 1).padStart(3, '0')}`}
        id={`Reel-${String(i + 1).padStart(3, '0')}`}
        component={SocialReelRenderer}
        durationInFrames={REEL_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          styleIndex: i,
          content: PREVIEW_CONTENT,
        }}
      />
    ))}

    {/* Custom-style composition for user-built styles */}
    <Composition
      id="Custom-Reel"
      component={SocialReelRenderer}
      durationInFrames={REEL_DURATION_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{
        style: buildStyleConfig({ paletteIndex: 0, fontIndex: 0, animation: 'fade-up', layout: 'center' }),
        content: PREVIEW_CONTENT,
      }}
    />

    {/* Blog article video — multi-slide narrated format */}
    <Composition
      id="Blog-Video"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component={BlogVideoSlides as any}
      durationInFrames={2700}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={BLOG_VIDEO_DEFAULT_PROPS}
    />
  </>
)
