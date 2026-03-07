// ============================================================================
// generate-style-thumbnails.ts — Render frame 75 of each style as PNG
// These thumbnails are used in the StylePicker UI
// Usage: npx tsx scripts/generate-style-thumbnails.ts
// ============================================================================

import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'
import path from 'path'
import fs from 'fs'

const ENTRY_POINT = path.join(process.cwd(), 'remotion', 'index.ts')
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'style-thumbnails')
const STYLE_COUNT = 200
const THUMBNAIL_FRAME = 75 // Midpoint of Phase 1 (title visible)
const CONCURRENCY = 3

const DEFAULT_CONTENT = {
  id: 'thumb',
  type: 'text-only' as const,
  hook: 'TODAY ONLY',
  title: 'Homemade Pasta',
  description: 'Fresh ingredients,\ncooked with love',
  ctaLabel: 'Reserve Now',
  ctaDetail: 'Link in Bio',
  businessName: 'FlowingPost',
  locale: 'en' as const,
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  console.log('Bundling...')
  const bundleLocation = await bundle({ entryPoint: ENTRY_POINT })

  console.log(`Rendering ${STYLE_COUNT} thumbnails (${CONCURRENCY} concurrent)...`)

  // Process in batches for concurrency control
  for (let batch = 0; batch < STYLE_COUNT; batch += CONCURRENCY) {
    const promises = []
    for (let j = 0; j < CONCURRENCY && batch + j < STYLE_COUNT; j++) {
      const i = batch + j
      const compositionId = `Reel-${String(i + 1).padStart(3, '0')}`
      const outputPath = path.join(OUTPUT_DIR, `style-${String(i + 1).padStart(3, '0')}.png`)

      if (fs.existsSync(outputPath)) {
        console.log(`  [${i + 1}/${STYLE_COUNT}] Skipping (exists)`)
        continue
      }

      promises.push(
        (async () => {
          const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: compositionId,
            inputProps: { styleIndex: i, content: DEFAULT_CONTENT },
          })

          await renderStill({
            composition,
            serveUrl: bundleLocation,
            output: outputPath,
            frame: THUMBNAIL_FRAME,
            inputProps: { styleIndex: i, content: DEFAULT_CONTENT },
          })

          console.log(`  [${i + 1}/${STYLE_COUNT}] Done`)
        })()
      )
    }
    await Promise.all(promises)
  }

  console.log(`All thumbnails saved to ${OUTPUT_DIR}`)
}

main().catch((err) => {
  console.error('Thumbnail generation failed:', err)
  process.exit(1)
})
