import { NextRequest, NextResponse } from 'next/server'

const TABLE = 'Leads'

function url(recordId?: string) {
  const base = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${TABLE}`
  return recordId ? `${base}/${recordId}` : base
}

function hdrs() {
  return {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    recordId,
    username, fullName, profileUrl, caption, likesCount, postUrl,
    score, reason, recommendation, status, notes,
    website, bio, followers, email, phone,
  } = body

  const fields: Record<string, unknown> = {}
  if (username)                    fields['Username']        = username
  if (fullName !== undefined)      fields['Full Name']       = fullName
  if (profileUrl)                  fields['Profile URL']     = profileUrl
  if (caption !== undefined)       fields['Caption']         = caption
  if (likesCount !== undefined)    fields['Likes']           = likesCount
  if (postUrl)                     fields['Post URL']        = postUrl
  if (score !== undefined)         fields['Score']           = score
  if (reason !== undefined)        fields['Reason']          = reason
  if (recommendation !== undefined) fields['Recommendation'] = recommendation
  if (status !== undefined)        fields['Status']          = status
  if (notes !== undefined)         fields['Notes']           = notes
  if (website !== undefined)       fields['Website']         = website
  if (bio !== undefined)           fields['Bio']             = bio
  if (followers !== undefined)     fields['Followers']       = followers
  if (email !== undefined)         fields['Email']           = email
  if (phone !== undefined)         fields['Phone']           = phone

  try {
    // Direct update if we have the record ID
    if (recordId) {
      const res = await fetch(url(recordId), {
        method: 'PATCH', headers: hdrs(),
        body: JSON.stringify({ fields }),
      })
      const data = await res.json()
      if (data.error) return NextResponse.json({ error: data.error }, { status: 400 })
      return NextResponse.json({ recordId: data.id })
    }

    // Search by username first
    const searchRes = await fetch(
      `${url()}?filterByFormula=${encodeURIComponent(`{Username}="${username}"`)}&maxRecords=1`,
      { headers: hdrs() }
    )
    const searchData = await searchRes.json()
    const existing = searchData.records?.[0]

    if (existing) {
      const res = await fetch(url(existing.id), {
        method: 'PATCH', headers: hdrs(),
        body: JSON.stringify({ fields }),
      })
      const data = await res.json()
      if (data.error) return NextResponse.json({ error: data.error }, { status: 400 })
      return NextResponse.json({ recordId: data.id })
    } else {
      if (!fields['Status']) fields['Status'] = 'Neu'
      const res = await fetch(url(), {
        method: 'POST', headers: hdrs(),
        body: JSON.stringify({ fields }),
      })
      const data = await res.json()
      if (data.error) return NextResponse.json({ error: data.error }, { status: 400 })
      return NextResponse.json({ recordId: data.id })
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
