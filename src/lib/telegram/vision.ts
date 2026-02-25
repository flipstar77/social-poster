export async function describePhoto(base64: string): Promise<string> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) throw new Error('XAI_API_KEY not configured')

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-2-vision-1212',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}` },
            },
            {
              type: 'text',
              text: 'Beschreibe dieses Restaurant/Gastronomie-Foto in 1-2 prägnanten Sätzen für Social-Media-Captions. Fokussiere auf Gericht, sichtbare Zutaten, Präsentation und Atmosphäre. Schreibe direkt und appetitanregend auf Deutsch.',
            },
          ],
        },
      ],
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[Vision] Grok Vision error:', res.status, err)
    throw new Error(`Grok Vision error: ${res.status}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content as string | undefined
  return content?.trim() ?? 'Leckeres Gericht'
}

export async function downloadTelegramPhoto(fileId: string): Promise<Buffer> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured')

  // Get file path from Telegram
  const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`)
  if (!fileRes.ok) throw new Error('Failed to get file from Telegram')
  const fileData = await fileRes.json()
  const filePath = fileData.result?.file_path
  if (!filePath) throw new Error('No file path returned')

  // Download the actual file
  const downloadRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`)
  if (!downloadRes.ok) throw new Error('Failed to download file from Telegram')

  const arrayBuffer = await downloadRes.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
