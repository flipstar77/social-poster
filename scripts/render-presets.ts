// ============================================================================
// render-presets.ts — Render all curated presets as preview videos
// Usage: npx tsx scripts/render-presets.ts [--preset <id>] [--still]
// --still: render single frame as PNG instead of video (much faster)
// ============================================================================

import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import path from 'path'
import fs from 'fs'
import { CURATED_PRESETS } from '../remotion/data/curated-presets'
import { buildStyleConfig } from '../remotion/styles/style-builder'

const ENTRY_POINT = path.join(process.cwd(), 'remotion', 'index.ts')
const OUTPUT_DIR = path.join(process.cwd(), 'output', 'presets')

// Demo photo as base64 data URL — avoids Remotion serve path issues
const DEMO_PHOTO_PATH = path.join(process.cwd(), 'public', 'showcase', 'food.png')
const DEMO_PHOTO = `data:image/png;base64,${fs.readFileSync(DEMO_PHOTO_PATH).toString('base64')}`

async function main() {
  const args = process.argv.slice(2)
  const presetId = args.includes('--preset') ? args[args.indexOf('--preset') + 1] : null
  const stillMode = args.includes('--still')

  const presets = presetId
    ? CURATED_PRESETS.filter(p => p.id === presetId)
    : CURATED_PRESETS

  if (presets.length === 0) {
    console.error(`Preset "${presetId}" not found. Available:`, CURATED_PRESETS.map(p => p.id).join(', '))
    process.exit(1)
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  console.log(`Bundling Remotion...`)
  const bundleLocation = await bundle(ENTRY_POINT)
  console.log(`Bundle ready.\n`)

  for (const preset of presets) {
    const style = buildStyleConfig(preset.style)
    const content = {
      id: preset.id,
      type: preset.defaultContent.type || 'photo-reel',
      hook: preset.defaultContent.hook || '',
      title: preset.defaultContent.title || 'Title',
      description: preset.defaultContent.description || '',
      ctaLabel: preset.defaultContent.ctaLabel || 'CTA',
      ctaDetail: preset.defaultContent.ctaDetail || '',
      locale: preset.defaultContent.locale || 'de',
      businessName: 'Restaurant Demo',
      mediaUrl: DEMO_PHOTO,
    }

    const inputProps = { style, content }

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'Custom-Reel',
      inputProps: inputProps as unknown as Record<string, unknown>,
    })

    const ext = stillMode ? 'png' : 'mp4'
    const outputFile = path.join(OUTPUT_DIR, `${preset.id}.${ext}`)

    console.log(`Rendering ${preset.id} (${preset.name.de})...`)

    if (stillMode) {
      await renderStill({
        composition,
        serveUrl: bundleLocation,
        output: outputFile,
        inputProps: inputProps as unknown as Record<string, unknown>,
        frame: 30,
      })
    } else {
      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: 'h264',
        outputLocation: outputFile,
        inputProps: inputProps as unknown as Record<string, unknown>,
      })
    }

    console.log(`  -> ${outputFile}`)
  }

  console.log(`\nDone! ${presets.length} presets rendered.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
