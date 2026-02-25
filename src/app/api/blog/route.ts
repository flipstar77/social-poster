import { NextRequest, NextResponse } from 'next/server'
import { getAllPosts, getPostBySlug } from '@/lib/blog'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const locale = searchParams.get('locale') || 'de'
  const slug = searchParams.get('slug')

  if (slug) {
    const post = getPostBySlug(slug)
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ post })
  }

  const posts = getAllPosts(locale)
  return NextResponse.json({ posts })
}
