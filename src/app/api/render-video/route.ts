import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

export async function POST(request: Request) {
  try {
    const { content, style, styleIndex } = await request.json()

    // Validate: need either style object or valid styleIndex
    if (!style && (typeof styleIndex !== 'number' || styleIndex < 0 || styleIndex >= 200)) {
      return NextResponse.json({ error: 'Need style object or valid styleIndex' }, { status: 400 })
    }
    if (!content?.title || !content?.ctaLabel) {
      return NextResponse.json({ error: 'Missing required content fields' }, { status: 400 })
    }

    const outputDir = path.join(process.cwd(), 'public', 'renders')
    const filename = `${content.id || 'reel'}-${Date.now()}.mp4`
    const outputPath = path.join(outputDir, filename)

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Encode config as base64 for CLI arg
    const renderConfig = style
      ? { content, style }
      : { content, styleIndex }
    const configB64 = Buffer.from(JSON.stringify(renderConfig)).toString('base64')

    execSync(
      `npx tsx scripts/render-video.ts --config ${configB64} --output ${filename}`,
      {
        cwd: process.cwd(),
        timeout: 300_000,
        stdio: 'pipe',
      }
    )

    // Check both possible output locations
    const expectedInOutputDir = path.join(process.cwd(), 'output', 'videos', filename)
    if (fs.existsSync(expectedInOutputDir) && !fs.existsSync(outputPath)) {
      fs.renameSync(expectedInOutputDir, outputPath)
    }

    if (!fs.existsSync(outputPath)) {
      return NextResponse.json({ error: 'Render completed but file not found' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      videoUrl: `/renders/${filename}`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Render failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
