/**
 * Enrich restaurant profiles with Google Places data.
 *
 * For each restaurant in Supabase (without google_place_id),
 * finds it on Google Places and stores: rating, review count, photos, website, hours.
 *
 * Usage:
 *   npx tsx scripts/research/enrich-google.ts
 *   npx tsx scripts/research/enrich-google.ts --limit 20   (test run)
 *
 * Requires: GOOGLE_PLACES_API_KEY in .env.local
 * Cost: ~$0 for <1000 requests/month (free tier covers this)
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getSupabase } from '../blog-pipeline/shared'

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY
const args = process.argv.slice(2)
const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : 500

interface PlacesTextSearchResult {
  place_id: string
  name: string
  rating?: number
  user_ratings_total?: number
  formatted_address?: string
}

interface PlacesDetailsResult {
  place_id: string
  rating?: number
  user_ratings_total?: number
  photos?: Array<{ photo_reference: string }>
  website?: string
  opening_hours?: { periods?: unknown[] }
  business_status?: string
}

async function findGooglePlace(name: string, city: string): Promise<PlacesTextSearchResult | null> {
  if (!GOOGLE_PLACES_KEY) return null

  const query = encodeURIComponent(`${name} Restaurant ${city}`)
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&language=de&key=${GOOGLE_PLACES_KEY}`

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json() as { status: string; results: PlacesTextSearchResult[] }
    if (data.status !== 'OK' || !data.results?.length) return null
    // Pick result with most reviews (most likely the right one)
    return data.results.sort((a, b) => (b.user_ratings_total ?? 0) - (a.user_ratings_total ?? 0))[0]
  } catch {
    return null
  }
}

async function getPlaceDetails(placeId: string): Promise<PlacesDetailsResult | null> {
  if (!GOOGLE_PLACES_KEY) return null

  const fields = 'place_id,rating,user_ratings_total,photos,website,opening_hours,business_status'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=de&key=${GOOGLE_PLACES_KEY}`

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json() as { status: string; result: PlacesDetailsResult }
    if (data.status !== 'OK') return null
    return data.result
  } catch {
    return null
  }
}

async function main() {
  if (!GOOGLE_PLACES_KEY) {
    console.error('❌ GOOGLE_PLACES_API_KEY not set in .env.local')
    console.error('   Get it at: https://console.cloud.google.com/apis/credentials')
    console.error('   Enable: Places API')
    process.exit(1)
  }

  console.log('🗺️  Google Places Enrichment\n')
  const supabase = getSupabase()

  // Load profiles without Google data yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles, error } = await (supabase.from('restaurant_profiles') as any)
    .select('id, handle, name, city')
    .is('google_place_id', null)
    .limit(limit)

  if (error) {
    console.error('Supabase error:', error.message)
    process.exit(1)
  }

  if (!profiles?.length) {
    console.log('No profiles without Google data found.')
    return
  }

  console.log(`Found ${profiles.length} profiles to enrich\n`)

  let enriched = 0
  let notFound = 0

  for (const profile of profiles as Array<{ id: string; handle: string; name: string | null; city: string }>) {
    const displayName = profile.name ?? profile.handle
    process.stdout.write(`   @${profile.handle} (${profile.city})... `)

    // Small delay to stay within rate limits
    await new Promise(r => setTimeout(r, 200))

    const place = await findGooglePlace(displayName, profile.city)
    if (!place) {
      console.log('not found')
      notFound++
      continue
    }

    const details = await getPlaceDetails(place.place_id)
    if (!details) {
      console.log('details failed')
      notFound++
      continue
    }

    const update = {
      google_place_id: place.place_id,
      google_rating: details.rating ?? null,
      google_review_count: details.user_ratings_total ?? null,
      google_photos_count: details.photos?.length ?? null,
      google_has_website: !!(details.website),
      google_hours_complete: !!(details.opening_hours?.periods?.length),
      google_raw: details as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from('restaurant_profiles') as any)
      .update(update)
      .eq('id', profile.id)

    if (updateError) {
      console.log(`error: ${updateError.message}`)
    } else {
      console.log(`✅ ${details.rating ?? '?'}⭐ (${details.user_ratings_total ?? 0} reviews)`)
      enriched++
    }
  }

  console.log(`\n✅ Done: ${enriched} enriched, ${notFound} not found on Google`)
  console.log(`\nNext step: npx tsx scripts/research/analyze.ts`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
