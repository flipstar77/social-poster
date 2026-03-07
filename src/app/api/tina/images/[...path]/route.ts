import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

const TINA_IMAGES_ROOT = path.join(process.cwd(), '..', 'tina-idle', 'public', 'images')

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = (await params).path
  const filePath = path.join(TINA_IMAGES_ROOT, ...segments)

  // Security: ensure we stay within the images directory
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(path.resolve(TINA_IMAGES_ROOT))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const ext = path.extname(resolved).toLowerCase()
  const mime = MIME_TYPES[ext] || 'application/octet-stream'
  const buffer = fs.readFileSync(resolved)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
