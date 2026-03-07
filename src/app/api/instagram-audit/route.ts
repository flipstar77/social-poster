import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scrapeProfile } from '@/lib/apify/client'
import { analyzeProfile, type CityStats } from '@/lib/insights/analyzer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { handle, city } = await req.json()

    if (!handle || !city) {
      return NextResponse.json({ error: 'handle and city are required' }, { status: 400 })
    }

    const cleanHandle = handle.replace('@', '').trim().toLowerCase()

    // 1. Get city stats for comparison
    const { data: cityRow } = await (supabase
      .from('gastro_city_stats') as any)
      .select('*')
      .eq('city', city.toLowerCase())
      .eq('platform', 'instagram')
      .single()

    if (!cityRow) {
      return NextResponse.json({ error: `No city data for ${city}` }, { status: 404 })
    }

    const cityStats: CityStats = {
      city: cityRow.city,
      platform: cityRow.platform,
      avgLikes: Number(cityRow.avg_likes) || 0,
      avgComments: Number(cityRow.avg_comments) || 0,
      avgEngagementRate: Number(cityRow.avg_engagement_rate) || 0,
      medianFollowers: cityRow.median_followers || 0,
      avgPostingFrequency: Number(cityRow.avg_posting_frequency) || 0,
      topHashtags: cityRow.top_hashtags ?? [],
      bestPostingHours: cityRow.best_posting_hours ?? [],
      topContentTypes: cityRow.top_content_types ?? [],
      sampleSize: cityRow.sample_size || 0,
    }

    // 2. Scrape the profile via Apify
    console.log(`[IG Audit] Scraping @${cleanHandle}...`)
    const profile = await scrapeProfile(cleanHandle, 30)

    if (!profile) {
      return NextResponse.json({ error: `Profile @${cleanHandle} not found` }, { status: 404 })
    }

    // 3. Analyze profile against city benchmarks
    const report = analyzeProfile(profile, cityStats, city)

    // 4. Save audit report to Supabase
    await (supabase.from('ig_audit_reports') as any).insert({
      instagram_handle: cleanHandle,
      city,
      report_data: report,
      score: report.score,
    })

    console.log(`[IG Audit] Report generated for @${cleanHandle}: ${report.score}/10`)

    return NextResponse.json({
      report,
      cityStats: {
        avgLikes: cityStats.avgLikes,
        avgComments: cityStats.avgComments,
        avgEngagementRate: cityStats.avgEngagementRate,
        topHashtags: cityStats.topHashtags.slice(0, 10),
        sampleSize: cityStats.sampleSize,
      },
    })
  } catch (err) {
    console.error('[IG Audit] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
