import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

const TINA_IMAGES_ROOT = path.join(process.cwd(), '..', 'tina-idle', 'public', 'images')

interface TinaImage {
  id: string
  path: string       // relative to tina-idle/public
  filename: string
  category: string
  url: string        // served URL
}

export async function GET() {
  try {
    const shootsDir = path.join(TINA_IMAGES_ROOT, 'shoots')
    const testDir = path.join(TINA_IMAGES_ROOT, 'test')
    const generatedDir = path.join(TINA_IMAGES_ROOT, 'generated', 'cards')

    const images: TinaImage[] = []

    // Scan shoots directory
    if (fs.existsSync(shootsDir)) {
      for (const category of fs.readdirSync(shootsDir)) {
        const catDir = path.join(shootsDir, category)
        if (!fs.statSync(catDir).isDirectory()) continue
        for (const file of fs.readdirSync(catDir)) {
          if (!/\.(png|jpg|jpeg|webp)$/i.test(file)) continue
          images.push({
            id: `shoots_${category}_${file}`,
            path: `/images/shoots/${category}/${file}`,
            filename: file,
            category,
            url: `/api/tina/images/shoots/${category}/${file}`,
          })
        }
      }
    }

    // Scan test/batch and test/fullbody
    for (const sub of ['batch', 'fullbody']) {
      const dir = path.join(testDir, sub)
      if (!fs.existsSync(dir)) continue
      for (const file of fs.readdirSync(dir)) {
        if (!/\.(png|jpg|jpeg|webp)$/i.test(file)) continue
        const category = file.replace(/^\d+_/, '').replace(/\.(png|jpg|jpeg|webp)$/i, '').replace(/_full$/, '')
        images.push({
          id: `test_${sub}_${file}`,
          path: `/images/test/${sub}/${file}`,
          filename: file,
          category,
          url: `/api/tina/images/test/${sub}/${file}`,
        })
      }
    }

    // Scan generated cards
    if (fs.existsSync(generatedDir)) {
      for (const file of fs.readdirSync(generatedDir)) {
        if (!/\.(png|jpg|jpeg|webp)$/i.test(file)) continue
        const category = file.replace(/^card_/, '').replace(/_\d+\.(png|jpg|jpeg|webp)$/i, '')
        images.push({
          id: `generated_${file}`,
          path: `/images/generated/cards/${file}`,
          filename: file,
          category,
          url: `/api/tina/images/generated/cards/${file}`,
        })
      }
    }

    return NextResponse.json({ images, total: images.length })
  } catch (err) {
    console.error('[Tina Images] Error:', err)
    return NextResponse.json({ error: 'Failed to scan images', images: [] }, { status: 500 })
  }
}
