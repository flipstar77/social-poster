import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/content-db?q=instagram&source=dish&status=new&language=de&tag=social-media&limit=20&offset=0
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')
  const sourceId = searchParams.get('source')
  const status = searchParams.get('status')
  const language = searchParams.get('language')
  const tag = searchParams.get('tag')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = parseInt(searchParams.get('offset') || '0')

  let query = supabase
    .from('scraped_articles')
    .select('id, source_id, url, title, date, language, tags, status, notes, word_count, scraped_at', { count: 'exact' })

  // Full-text search
  if (q) {
    query = query.textSearch('fts', q, { type: 'websearch', config: 'german' })
  }

  if (sourceId) query = query.eq('source_id', sourceId)
  if (status) query = query.eq('status', status)
  if (language) query = query.eq('language', language)
  if (tag) query = query.contains('tags', [tag])

  query = query
    .order('scraped_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ articles: data, total: count })
}

// PATCH /api/content-db — update status, tags, notes
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, status, tags, notes } = body

  if (!id) {
    return NextResponse.json({ error: 'Missing article id' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (tags !== undefined) updates.tags = tags
  if (notes !== undefined) updates.notes = notes

  const { data, error } = await supabase
    .from('scraped_articles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ article: data })
}

// GET /api/content-db/article?id=xxx — get full article content
export async function POST(request: NextRequest) {
  const { id } = await request.json()

  if (!id) {
    return NextResponse.json({ error: 'Missing article id' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('scraped_articles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ article: data })
}
