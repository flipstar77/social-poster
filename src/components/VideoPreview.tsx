'use client'

import { Player } from '@remotion/player'
import { SocialReelRenderer } from '../../remotion/videos/SocialReelRenderer'
import type { ReelContentConfig } from '../../remotion/data/content-types'
import type { StyleConfig } from '../../remotion/styles/style-config'
import { FPS, REEL_DURATION_FRAMES, WIDTH, HEIGHT } from '../../remotion/constants'

interface VideoPreviewProps {
  styleIndex?: number
  style?: StyleConfig
  content: ReelContentConfig
  width?: number
  height?: number
  autoPlay?: boolean
  controls?: boolean
  aspectRatio?: '9:16' | '1:1' | '4:5'
}

const ASPECT_DIMS: Record<string, { w: number; h: number }> = {
  '9:16': { w: 1080, h: 1920 },
  '4:5':  { w: 1080, h: 1350 },
  '1:1':  { w: 1080, h: 1080 },
}

export default function VideoPreview({
  styleIndex,
  style,
  content,
  width = 360,
  height = 640,
  autoPlay = true,
  controls = true,
  aspectRatio = '9:16',
}: VideoPreviewProps) {
  const dims = ASPECT_DIMS[aspectRatio] ?? ASPECT_DIMS['9:16']
  return (
    <Player
      component={SocialReelRenderer}
      inputProps={{ styleIndex, style, content }}
      durationInFrames={REEL_DURATION_FRAMES}
      fps={FPS}
      compositionWidth={dims.w}
      compositionHeight={dims.h}
      style={{ width, height, borderRadius: 12, overflow: 'hidden' }}
      controls={controls}
      autoPlay={autoPlay}
      loop
    />
  )
}
