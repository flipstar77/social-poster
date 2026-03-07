// ============================================================================
// render-video.ts — Single video CLI renderer
// Usage: npx tsx scripts/render-video.ts --config <base64-json>
//   or:  npx tsx scripts/render-video.ts --style 42 --output my-video.mp4
// Config JSON can contain either { styleIndex, content } or { style, content }
// ============================================================================

import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import path from 'path'
import fs from 'fs'

const ENTRY_POINT = path.join(process.cwd(), 'remotion', 'index.ts')
const OUTPUT_DIR = path.join(process.cwd(), 'output', 'videos')

interface RenderConfig {
  content: {
    id: string
    type: 'text-only' | 'photo-reel'
    hook?: string
    title: string
    description?: string
    mediaUrl?: string
    ctaLabel: string
    ctaDetail?: string
    businessName?: string
    locale: 'de' | 'en'
    accentColor?: string
  }
  styleIndex?: number
  style?: Record<string, unknown> // StyleConfig object passed through
}

function parseArgs(): { config: RenderConfig; outputFile: string } {
  const args = process.argv.slice(2)

  // Mode 1: --config <base64-json>
  const configIdx = args.indexOf('--config')
  if (configIdx !== -1 && args[configIdx + 1]) {
    const config: RenderConfig = JSON.parse(
      Buffer.from(args[configIdx + 1], 'base64').toString('utf-8')
    )
    const outputIdx = args.indexOf('--output')
    const outputFile = outputIdx !== -1 && args[outputIdx + 1]
      ? args[outputIdx + 1]
      : `${config.content.id}-${Date.now()}.mp4`
    return { config, outputFile }
  }

  // Mode 2: --style <index> (uses default content for testing)
  const styleIdx = args.indexOf('--style')
  const styleIndex = styleIdx !== -1 ? parseInt(args[styleIdx + 1], 10) : 0
  const outputIdx = args.indexOf('--output')
  const outputFile = outputIdx !== -1 && args[outputIdx + 1]
    ? args[outputIdx + 1]
    : `test-style${styleIndex}.mp4`

  return {
    config: {
      styleIndex,
      content: {
        id: 'test',
        type: 'text-only',
        hook: 'TODAY ONLY',
        title: 'Homemade Pasta',
        description: 'Fresh ingredients,\ncooked with love\nevery single day.',
        ctaLabel: 'Reserve Now',
        ctaDetail: 'Link in Bio',
        businessName: 'Demo Restaurant',
        locale: 'en',
      },
    },
    outputFile,
  }
}

async function main() {
  const { config, outputFile } = parseArgs()
  const { content, styleIndex, style } = config

  // Use Custom-Reel composition for custom styles, indexed composition otherwise
  const compositionId = style
    ? 'Custom-Reel'
    : `Reel-${String((styleIndex ?? 0) + 1).padStart(3, '0')}`

  const inputProps = style
    ? { style, content }
    : { styleIndex, content }

  const outputPath = path.join(OUTPUT_DIR, outputFile)

  console.log(`Rendering ${compositionId} → ${outputPath}`)
  console.log(`  Mode: ${style ? 'custom style' : `preset #${styleIndex}`}, Type: ${content.type}`)

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  console.log('Bundling...')
  const bundleLocation = await bundle({ entryPoint: ENTRY_POINT })

  console.log('Selecting composition...')
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
  })

  console.log('Rendering...')
  const startTime = Date.now()

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
  })

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`Done! ${elapsed}s → ${outputPath}`)
}

main().catch((err) => {
  console.error('Render failed:', err)
  process.exit(1)
})
