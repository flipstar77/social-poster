import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/content-db/stats — overview of scraped content
export async function GET() {
  const [totalResult, sourcesResult] = await Promise.all([
    supabase.from('scraped_articles').select('id', { count: 'exact', head: true }),
    supabase.from('blog_sources').select('source_id, name, language, rating'),
  ])

  // Count per source manually if RPC not available
  const { data: perSource } = await supabase
    .from('scraped_articles')
    .select('source_id')

  const sourceCounts: Record<string, number> = {}
  perSource?.forEach(row => {
    sourceCounts[row.source_id] = (sourceCounts[row.source_id] || 0) + 1
  })

  const sources = (sourcesResult.data || []).map(s => ({
    ...s,
    articleCount: sourceCounts[s.source_id] || 0,
  }))

  return NextResponse.json({
    totalArticles: totalResult.count || 0,
    sources,
  })
}
