const API_VERSION = 'v21.0'

function getConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!accessToken || !phoneNumberId) {
    throw new Error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID')
  }
  return { accessToken, phoneNumberId }
}

function getBaseUrl(phoneNumberId: string) {
  return `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`
}

export async function sendText(to: string, text: string): Promise<void> {
  const { accessToken, phoneNumberId } = getConfig()

  const res = await fetch(getBaseUrl(phoneNumberId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[WhatsApp Client] sendText failed:', err)
    throw new Error(`WhatsApp sendText failed: ${res.status}`)
  }
}

export async function markAsRead(messageId: string): Promise<void> {
  const { accessToken, phoneNumberId } = getConfig()

  const res = await fetch(getBaseUrl(phoneNumberId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  })

  if (!res.ok) {
    // Non-critical — don't throw
    console.error('[WhatsApp Client] markAsRead failed:', await res.text())
  }
}
