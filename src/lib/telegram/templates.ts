export interface PostingTemplate {
  id: number
  emoji: string
  name: string
  tone: string
  hashtagCount: number
}

export const POSTING_TEMPLATES: PostingTemplate[] = [
  {
    id: 1,
    emoji: '🍽️',
    name: 'Tagesmenü',
    tone: 'warm and appetizing, highlight ingredients and flavors, make people hungry, feel inviting',
    hashtagCount: 10,
  },
  {
    id: 2,
    emoji: '🎉',
    name: 'Happy Hour',
    tone: 'energetic, urgent, FOMO-driven, time-limited offer, exciting and fun',
    hashtagCount: 15,
  },
  {
    id: 3,
    emoji: '✨',
    name: 'Neue Sorte',
    tone: 'exciting new launch, premium feel, build curiosity and anticipation, celebrate the novelty',
    hashtagCount: 20,
  },
  {
    id: 4,
    emoji: '💰',
    name: 'Angebot',
    tone: 'deal-focused, clear value proposition, strong call-to-action, persuasive but not pushy',
    hashtagCount: 12,
  },
]

export function getTemplate(id: number): PostingTemplate | undefined {
  return POSTING_TEMPLATES.find(t => t.id === id)
}
