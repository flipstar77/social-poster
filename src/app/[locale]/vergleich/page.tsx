import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import VergleichContent from './content'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'vergleich' })
  return {
    title: t('meta.title'),
    description: t('meta.description'),
  }
}

export default async function VergleichPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  return <VergleichContent />
}
