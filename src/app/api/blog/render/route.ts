import { NextRequest, NextResponse } from 'next/server'
import { serialize } from 'next-mdx-remote/serialize'
import remarkGfm from 'remark-gfm'
import { getPostBySlug } from '@/lib/blog'

const PILLAR_BY_CATEGORY: Record<string, { slug: string; title: string }> = {
  'Instagram': { slug: 'instagram-marketing-restaurant', title: 'Instagram Marketing für Restaurants' },
  'TikTok': { slug: 'social-media-strategie-gastronomen', title: 'Social Media Strategie für Gastronomen' },
  'Google Maps': { slug: 'restaurant-google-marketing', title: 'Google Marketing für Restaurants' },
  'SEO': { slug: 'restaurant-google-marketing', title: 'Google Marketing für Restaurants' },
  'Strategie': { slug: 'social-media-strategie-gastronomen', title: 'Social Media Strategie für Gastronomen' },
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

  const post = getPostBySlug(slug)
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const mdxSource = await serialize(post.content, {
    mdxOptions: { remarkPlugins: [remarkGfm] },
  })

  const pillar = post.type !== 'pillar' ? (PILLAR_BY_CATEGORY[post.category] ?? null) : null

  return NextResponse.json({
    post: {
      slug: post.slug,
      title: post.title,
      description: post.description,
      date: post.date,
      category: post.category,
      type: post.type,
      readingTime: post.readingTime,
      image: post.image,
      imageCredit: post.imageCredit,
      imageCreditUrl: post.imageCreditUrl,
      pillarSlug: pillar?.slug ?? null,
      pillarTitle: pillar?.title ?? null,
      mdxSource,
    },
  })
}
