/**
 * CURATOR Agent Helper — SEO Quality Check
 *
 * Scores a draft MDX article on SEO best practices.
 * Returns a JSON report with score + issues.
 *
 * Usage: npx tsx scripts/blog-agents/helpers/check-seo.ts
 * Input:  data/pipeline/draft.mdx
 * Output: data/pipeline/seo-report.json
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const PIPELINE_DIR = path.join(process.cwd(), 'data', 'pipeline')
const DRAFT_PATH = path.join(PIPELINE_DIR, 'draft.mdx')
const RESEARCH_PATH = path.join(PIPELINE_DIR, 'research.json')

interface SeoIssue {
  severity: 'error' | 'warning' | 'info'
  rule: string
  message: string
}

interface SeoReport {
  score: number
  issues: SeoIssue[]
  stats: {
    wordCount: number
    h2Count: number
    h3Count: number
    paragraphCount: number
    metaDescriptionLength: number
    hasKeywordInTitle: boolean
    hasKeywordInIntro: boolean
    hasKeywordInH2: boolean
    hasInternalLink: boolean
    hasSvgDiagram: boolean
    hasTable: boolean
  }
}

function main() {
  console.log('[SEO Check] Analyzing draft...\n')

  if (!fs.existsSync(DRAFT_PATH)) {
    console.error('[SEO Check] No draft found at data/pipeline/draft.mdx')
    process.exit(1)
  }

  const raw = fs.readFileSync(DRAFT_PATH, 'utf-8')
  const { data: frontmatter, content: body } = matter(raw)

  // Load research brief for keyword
  let keyword = ''
  if (fs.existsSync(RESEARCH_PATH)) {
    const research = JSON.parse(fs.readFileSync(RESEARCH_PATH, 'utf-8'))
    keyword = research.keyword?.text?.toLowerCase() || ''
  }

  const issues: SeoIssue[] = []
  const kwWords = keyword.split(/\s+/).filter(w => w.length > 3)

  // Stats
  const words = body.split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length
  const h2s = body.match(/^## .+$/gm) || []
  const h3s = body.match(/^### .+$/gm) || []
  const paragraphs = body.split(/\n\n+/).filter(p => p.trim().length > 50)
  const title = (frontmatter.title || '').toLowerCase()
  const description = frontmatter.description || ''
  const intro = body.slice(0, 500).toLowerCase()

  const hasKeywordInTitle = kwWords.length > 0 && kwWords.every(w => title.includes(w))
  const hasKeywordInIntro = kwWords.length > 0 && kwWords.some(w => intro.includes(w))
  const hasKeywordInH2 = kwWords.length > 0 && h2s.some(h => {
    const hLower = h.toLowerCase()
    return kwWords.some(w => hLower.includes(w))
  })
  const keywordInH2Count = kwWords.length > 0
    ? h2s.filter(h => kwWords.some(w => h.toLowerCase().includes(w))).length
    : 0
  const hasInternalLink = /\[.*?\]\(\/(de\/)?blog\//.test(body) || /flowingpost/i.test(body)
  const hasSvgDiagram = /<svg[\s>]/i.test(body)
  const hasTable = /\|.*\|.*\|/m.test(body)

  // --- Scoring rules ---

  // Title
  if (!frontmatter.title) {
    issues.push({ severity: 'error', rule: 'title-missing', message: 'Title is missing from frontmatter' })
  } else if (!hasKeywordInTitle && keyword) {
    issues.push({ severity: 'warning', rule: 'title-keyword', message: `Keyword "${keyword}" not fully in title` })
  }

  // Meta description
  if (!description) {
    issues.push({ severity: 'error', rule: 'meta-missing', message: 'Meta description is missing' })
  } else if (description.length < 130) {
    issues.push({ severity: 'warning', rule: 'meta-short', message: `Meta description too short (${description.length}/130-155 chars)` })
  } else if (description.length > 160) {
    issues.push({ severity: 'warning', rule: 'meta-long', message: `Meta description too long (${description.length}/155 chars max)` })
  }

  // Word count
  if (wordCount < 1800) {
    issues.push({ severity: 'error', rule: 'word-count', message: `Only ${wordCount} words (min 1800)` })
  } else if (wordCount < 2000) {
    issues.push({ severity: 'warning', rule: 'word-count', message: `${wordCount} words — good but 2000+ is ideal` })
  }

  // Structure
  if (h2s.length < 4) {
    issues.push({ severity: 'warning', rule: 'h2-count', message: `Only ${h2s.length} H2 headings (4+ recommended)` })
  }
  if (h3s.length < 2) {
    issues.push({ severity: 'info', rule: 'h3-count', message: `Only ${h3s.length} H3 sub-headings (2+ adds depth)` })
  }

  // Keyword in H2s
  if (!hasKeywordInH2 && keyword) {
    issues.push({ severity: 'warning', rule: 'h2-keyword', message: 'No H2 contains keyword words' })
  } else if (keywordInH2Count < 3 && keyword) {
    issues.push({ severity: 'info', rule: 'h2-keyword-count', message: `Keyword in ${keywordInH2Count}/3+ H2s` })
  }

  // Keyword in intro
  if (!hasKeywordInIntro && keyword) {
    issues.push({ severity: 'warning', rule: 'intro-keyword', message: 'Keyword not in first 500 chars' })
  }

  // Internal links
  if (!hasInternalLink) {
    issues.push({ severity: 'warning', rule: 'internal-link', message: 'No internal link to FlowingPost or other blog articles' })
  }

  // Rich content
  if (!hasSvgDiagram) {
    issues.push({ severity: 'info', rule: 'svg', message: 'No SVG diagram found — consider adding one' })
  }
  if (!hasTable) {
    issues.push({ severity: 'info', rule: 'table', message: 'No table found — tables help with scannability' })
  }

  // H1 in body (should not be there)
  if (/^# [^#]/m.test(body)) {
    issues.push({ severity: 'error', rule: 'h1-in-body', message: 'H1 found in body — only H2+ allowed (title is H1)' })
  }

  // "Sie" check (should use "du")
  if (/\bSie\b/.test(body) && !/\bsiehe\b/i.test(body)) {
    issues.push({ severity: 'warning', rule: 'du-form', message: 'Found "Sie" — article should use "du" form' })
  }

  // Calculate score (0-100)
  let score = 100
  for (const issue of issues) {
    if (issue.severity === 'error') score -= 15
    if (issue.severity === 'warning') score -= 5
    if (issue.severity === 'info') score -= 2
  }
  score = Math.max(0, Math.min(100, score))

  const report: SeoReport = {
    score,
    issues,
    stats: {
      wordCount,
      h2Count: h2s.length,
      h3Count: h3s.length,
      paragraphCount: paragraphs.length,
      metaDescriptionLength: description.length,
      hasKeywordInTitle,
      hasKeywordInIntro,
      hasKeywordInH2,
      hasInternalLink,
      hasSvgDiagram,
      hasTable,
    },
  }

  // Write report
  fs.writeFileSync(
    path.join(PIPELINE_DIR, 'seo-report.json'),
    JSON.stringify(report, null, 2),
    'utf-8'
  )

  // Print summary
  console.log(`[SEO Check] Score: ${score}/100`)
  console.log(`[SEO Check] Words: ${wordCount} | H2s: ${h2s.length} | H3s: ${h3s.length}`)
  if (issues.length > 0) {
    console.log('\nIssues:')
    for (const issue of issues) {
      const icon = issue.severity === 'error' ? 'X' : issue.severity === 'warning' ? '!' : 'i'
      console.log(`  [${icon}] ${issue.message}`)
    }
  } else {
    console.log('[SEO Check] No issues found — perfect!')
  }
}

main()
