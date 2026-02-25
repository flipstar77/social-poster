import { Bot, InlineKeyboard, type Context } from 'grammy'
import { createClient } from '@supabase/supabase-js'
import {
  getSession,
  setSession,
  clearSession,
  getProfileId,
  type BotSession,
} from './sessions'
import { POSTING_TEMPLATES, getTemplate } from './templates'
import { describePhoto, downloadTelegramPhoto } from './vision'
import { parseNaturalDate, getNextAvailableSlot, formatDateDE } from './scheduler'
import { publishPost, generateCaption } from './publisher'

const DEFAULT_PLATFORMS = ['instagram', 'tiktok', 'facebook']

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  x: 'X',
  threads: 'Threads',
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Inline Keyboards ──────────────────────────────────────────────────────────

function templateKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  POSTING_TEMPLATES.forEach((t, i) => {
    kb.text(`${t.emoji} ${t.name}`, `tpl:${t.id}`)
    if (i % 2 === 1) kb.row()
  })
  kb.row().text('⭕ Kein Template', 'tpl:0')
  return kb
}

function platformKeyboard(selected: string[]): InlineKeyboard {
  const platforms = ['instagram', 'tiktok', 'facebook', 'linkedin', 'x', 'threads']
  const kb = new InlineKeyboard()
  platforms.forEach((p, i) => {
    const label = `${selected.includes(p) ? '✅' : '⬜'} ${PLATFORM_LABELS[p]}`
    kb.text(label, `plt:${p}`)
    if (i % 2 === 1) kb.row()
  })
  if (platforms.length % 2 !== 0) kb.row()
  const count = selected.length
  kb.text(count > 0 ? `Weiter (${count}) →` : 'Bitte wählen...', 'plt:confirm')
  return kb
}

function descriptionKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Passt!', 'desc:ok')
    .text('✏️ Bearbeiten', 'desc:edit')
}

function captionKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Nehmen', 'cap:ok')
    .row()
    .text('🔄 Neu generieren', 'cap:regen')
    .text('✏️ Bearbeiten', 'cap:edit')
}

function scheduleKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⚡ Jetzt sofort', 'sch:now')
    .row()
    .text('📅 Nächster freier Slot', 'sch:next')
    .row()
    .text('📝 Datum eingeben', 'sch:input')
}

// ── Caption generation helper ─────────────────────────────────────────────────

async function generateAndShowCaption(ctx: Context, chatId: number, session: BotSession) {
  const template = session.data.template_id ? getTemplate(session.data.template_id) : null
  const tone = template?.tone ?? 'warm, friendly and inviting for a restaurant'
  const hashtagCount = template?.hashtagCount ?? 15

  const { caption, hashtags } = await generateCaption(
    session.data.description ?? '',
    tone,
    hashtagCount,
    'Restaurant'
  )

  const hashtagStr = hashtags.map(h => `#${h}`).join(' ')
  const preview = hashtagStr ? `${caption}\n\n${hashtagStr}` : caption

  const captionMsg = await ctx.reply(
    `📝 *Generierte Caption:*\n\n${preview}`,
    { parse_mode: 'Markdown', reply_markup: captionKeyboard() }
  )

  await setSession(chatId, {
    state: 'awaiting_caption_confirm',
    data: { ...session.data, caption, hashtags, caption_msg_id: captionMsg.message_id },
  })
}

// ── Publish + confirm ─────────────────────────────────────────────────────────

async function publishAndConfirm(
  ctx: Context,
  chatId: number,
  session: BotSession,
  scheduledAt: Date
): Promise<void> {
  const profileId = await getProfileId(chatId)
  if (!profileId) {
    await ctx.reply('❌ Account nicht verknüpft.')
    return
  }

  const thinkingMsg = await ctx.reply('⏳ Plane Post ein...')

  try {
    if (!session.data.photo_file_id) throw new Error('No photo in session')

    const buffer = await downloadTelegramPhoto(session.data.photo_file_id)
    const platforms = session.data.platforms ?? DEFAULT_PLATFORMS

    await publishPost({
      photoBuffer: buffer,
      caption: session.data.caption ?? '',
      hashtags: session.data.hashtags ?? [],
      platforms,
      scheduledAt,
      profileId,
    })

    await clearSession(chatId)
    await ctx.api.deleteMessage(chatId, thinkingMsg.message_id).catch(() => {})

    const platformStr = platforms.map(p => PLATFORM_LABELS[p] ?? p).join(', ')
    await ctx.reply(
      `✅ *Post eingeplant!*\n\n📅 ${formatDateDE(scheduledAt)}\n📱 ${platformStr}\n\nSende ein neues Foto für den nächsten Post. 🚀`,
      { parse_mode: 'Markdown' }
    )
  } catch (err) {
    console.error('[Bot] Publish error:', err)
    await ctx.api.deleteMessage(chatId, thinkingMsg.message_id).catch(() => {})
    await ctx.reply('❌ Fehler beim Einplanen. Bitte versuche es erneut oder tippe /cancel.')
  }
}

// ── Register all handlers ─────────────────────────────────────────────────────

function registerHandlers(bot: Bot) {
  // /start [token]
  bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id
    const token = ctx.match?.trim()

    if (!token) {
      const profileId = await getProfileId(chatId)
      if (profileId) {
        await ctx.reply('✅ Dein Account ist bereits verknüpft!\n\nSende ein Foto, um einen Post einzuplanen.')
      } else {
        await ctx.reply(
          '👋 *Willkommen bei FlowingPost!*\n\n' +
          'Um deinen Account zu verknüpfen:\n' +
          '1. Gehe zu flowingpost.com → Tool → Telegram\n' +
          '2. Klicke auf „Link-Code generieren"\n' +
          '3. Sende hier: `/start DEIN-CODE`\n\n' +
          'Danach kannst du Fotos senden und Posts direkt aus Telegram einplanen. 📱',
          { parse_mode: 'Markdown' }
        )
      }
      return
    }

    const admin = getAdmin()
    const { data: tokenRow } = await admin
      .from('telegram_link_tokens')
      .select('profile_id, expires_at, used')
      .eq('token', token.toUpperCase())
      .maybeSingle()

    if (!tokenRow) {
      await ctx.reply('❌ Ungültiger Code. Bitte generiere einen neuen Code im Dashboard.')
      return
    }
    if ((tokenRow as { used: boolean }).used) {
      await ctx.reply('❌ Dieser Code wurde bereits verwendet. Bitte generiere einen neuen Code.')
      return
    }
    if (new Date((tokenRow as { expires_at: string }).expires_at) < new Date()) {
      await ctx.reply('❌ Code abgelaufen (15 min). Bitte generiere einen neuen Code.')
      return
    }

    await admin.from('telegram_link_tokens').update({ used: true }).eq('token', token.toUpperCase())

    const username = ctx.from?.username ?? null
    await admin
      .from('telegram_accounts')
      .upsert(
        {
          profile_id: (tokenRow as { profile_id: string }).profile_id,
          chat_id: chatId,
          username,
          linked_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id' }
      )

    await ctx.reply(
      '✅ *Account erfolgreich verknüpft!*\n\n' +
      'So funktioniert der Bot:\n' +
      '1. 📷 Sende ein Foto (oder Video)\n' +
      '2. 🤖 KI beschreibt es automatisch\n' +
      '3. 🎨 Wähle Template + Plattformen\n' +
      '4. 📅 Lege den Zeitpunkt fest\n' +
      '5. 🚀 Post wird eingeplant!\n\n' +
      '/help für alle Befehle',
      { parse_mode: 'Markdown' }
    )
  })

  bot.command('cancel', async (ctx) => {
    await clearSession(ctx.chat.id)
    await ctx.reply('🔄 Abgebrochen. Sende ein Foto, um neu zu starten.')
  })

  bot.command('status', async (ctx) => {
    const profileId = await getProfileId(ctx.chat.id)
    if (profileId) {
      await ctx.reply('✅ Account verknüpft. Sende ein Foto, um einen Post einzuplanen.')
    } else {
      await ctx.reply('❌ Kein Account verknüpft. Nutze /start mit deinem Link-Code.')
    }
  })

  bot.command('help', async (ctx) => {
    await ctx.reply(
      '📖 *FlowingPost Bot*\n\n' +
      '• Foto senden → Post einplanen\n' +
      '• `/cancel` → Abbrechen\n' +
      '• `/status` → Account prüfen\n\n' +
      '*Templates:*\n' +
      '🍽️ Tagesmenü  🎉 Happy Hour\n' +
      '✨ Neue Sorte  💰 Angebot',
      { parse_mode: 'Markdown' }
    )
  })

  // ── Photo ──────────────────────────────────────────────────────────────────
  bot.on('message:photo', async (ctx) => {
    const chatId = ctx.chat.id
    const profileId = await getProfileId(chatId)
    if (!profileId) {
      await ctx.reply('❌ Kein Account verknüpft.\nNutze /start mit deinem Link-Code.')
      return
    }

    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id
    const photoCaption = ctx.message.caption?.trim()
    const thinkingMsg = await ctx.reply('🔍 Analysiere Foto...')

    try {
      let description: string
      if (photoCaption) {
        description = photoCaption
      } else {
        const buffer = await downloadTelegramPhoto(fileId)
        description = await describePhoto(buffer.toString('base64'))
      }

      await ctx.api.deleteMessage(chatId, thinkingMsg.message_id).catch(() => {})
      await setSession(chatId, {
        state: 'awaiting_description_confirm',
        data: { photo_file_id: fileId, description },
      })

      await ctx.reply(
        `📸 *Beschreibung:*\n_"${description}"_\n\nPasst das?`,
        { parse_mode: 'Markdown', reply_markup: descriptionKeyboard() }
      )
    } catch (err) {
      console.error('[Bot] Photo error:', err)
      await ctx.api.deleteMessage(chatId, thinkingMsg.message_id).catch(() => {})
      await ctx.reply('❌ Fehler beim Analysieren. Bitte versuche es erneut.')
    }
  })

  // ── Video/Document ─────────────────────────────────────────────────────────
  bot.on('message:video', async (ctx) => {
    const chatId = ctx.chat.id
    const profileId = await getProfileId(chatId)
    if (!profileId) {
      await ctx.reply('❌ Kein Account verknüpft.\nNutze /start mit deinem Link-Code.')
      return
    }

    const fileId = ctx.message.video.file_id
    await setSession(chatId, {
      state: 'awaiting_description_input',
      data: { photo_file_id: fileId, is_video: true },
    })
    await ctx.reply(
      '🎬 *Video erkannt!*\n\nBitte beschreibe kurz den Inhalt (z.B. "Happy Hour Ankündigung für Freitagabend"):',
      { parse_mode: 'Markdown' }
    )
  })

  // ── Callback queries ───────────────────────────────────────────────────────
  bot.on('callback_query:data', async (ctx) => {
    const chatId = ctx.chat?.id
    if (!chatId) return
    await ctx.answerCallbackQuery()

    const data = ctx.callbackQuery.data
    const session = await getSession(chatId)

    // Description
    if (data === 'desc:ok' && session.state === 'awaiting_description_confirm') {
      await setSession(chatId, { state: 'awaiting_template', data: session.data })
      await ctx.reply('Welches Template möchtest du verwenden?', { reply_markup: templateKeyboard() })
      return
    }

    if (data === 'desc:edit' && session.state === 'awaiting_description_confirm') {
      await setSession(chatId, { state: 'awaiting_description_input', data: session.data })
      await ctx.reply('✏️ Bitte gib eine neue Beschreibung ein:')
      return
    }

    // Template selection
    if (data.startsWith('tpl:') && session.state === 'awaiting_template') {
      const templateId = data === 'tpl:0' ? null : parseInt(data.split(':')[1])
      const newData = { ...session.data, template_id: templateId, platforms: DEFAULT_PLATFORMS }
      await setSession(chatId, { state: 'awaiting_platforms', data: newData })

      const templateName = templateId
        ? `${getTemplate(templateId)?.emoji ?? ''} ${getTemplate(templateId)?.name ?? ''}`
        : '⭕ Kein Template'

      await ctx.reply(
        `✅ Template: *${templateName}*\n\nFür welche Plattformen posten?`,
        { parse_mode: 'Markdown', reply_markup: platformKeyboard(DEFAULT_PLATFORMS) }
      )
      return
    }

    // Platform toggle
    if (data.startsWith('plt:') && data !== 'plt:confirm' && session.state === 'awaiting_platforms') {
      const platform = data.split(':')[1]
      const current = session.data.platforms ?? DEFAULT_PLATFORMS
      const updated = current.includes(platform)
        ? current.filter(p => p !== platform)
        : [...current, platform]

      await setSession(chatId, { state: 'awaiting_platforms', data: { ...session.data, platforms: updated } })
      await ctx.editMessageReplyMarkup({ reply_markup: platformKeyboard(updated) })
      return
    }

    // Platform confirm
    if (data === 'plt:confirm' && session.state === 'awaiting_platforms') {
      const platforms = session.data.platforms ?? DEFAULT_PLATFORMS
      if (platforms.length === 0) {
        await ctx.answerCallbackQuery({ text: 'Bitte wähle mindestens eine Plattform.' })
        return
      }

      const generatingMsg = await ctx.reply('⏳ Generiere Caption...')
      try {
        await generateAndShowCaption(ctx, chatId, session)
      } catch (err) {
        console.error('[Bot] Caption gen error:', err)
        await ctx.reply('❌ Fehler beim Generieren. Bitte /cancel und erneut versuchen.')
      } finally {
        await ctx.api.deleteMessage(chatId, generatingMsg.message_id).catch(() => {})
      }
      return
    }

    // Caption accept
    if (data === 'cap:ok' && session.state === 'awaiting_caption_confirm') {
      await setSession(chatId, { state: 'awaiting_schedule', data: session.data })
      const platformList = (session.data.platforms ?? DEFAULT_PLATFORMS)
        .map(p => PLATFORM_LABELS[p] ?? p)
        .join(', ')
      await ctx.reply(
        `🕐 *Wann posten?*\n_${platformList}_`,
        { parse_mode: 'Markdown', reply_markup: scheduleKeyboard() }
      )
      return
    }

    // Caption regenerate
    if (data === 'cap:regen' && session.state === 'awaiting_caption_confirm') {
      const regenMsg = await ctx.reply('🔄 Generiere neue Caption...')
      try {
        await generateAndShowCaption(ctx, chatId, session)
      } catch (err) {
        console.error('[Bot] Caption regen error:', err)
        await ctx.reply('❌ Fehler. Bitte erneut versuchen.')
      } finally {
        await ctx.api.deleteMessage(chatId, regenMsg.message_id).catch(() => {})
      }
      return
    }

    // Caption edit
    if (data === 'cap:edit' && session.state === 'awaiting_caption_confirm') {
      await setSession(chatId, { state: 'awaiting_caption_edit', data: session.data })
      await ctx.reply('✏️ Bitte gib deine Caption ein (Hashtags werden automatisch ergänzt):')
      return
    }

    // Schedule: now
    if (data === 'sch:now' && session.state === 'awaiting_schedule') {
      await publishAndConfirm(ctx, chatId, session, new Date(Date.now() + 90 * 1000))
      return
    }

    // Schedule: next slot
    if (data === 'sch:next' && session.state === 'awaiting_schedule') {
      const profileId = await getProfileId(chatId)
      if (!profileId) { await ctx.reply('❌ Account nicht verknüpft.'); return }
      const slot = await getNextAvailableSlot(profileId)
      await publishAndConfirm(ctx, chatId, session, slot)
      return
    }

    // Schedule: enter date
    if (data === 'sch:input' && session.state === 'awaiting_schedule') {
      await setSession(chatId, { state: 'awaiting_schedule_input', data: session.data })
      await ctx.reply(
        '📅 Wann soll der Post erscheinen?\n\nBeispiele:\n• nächsten Dienstag 18 Uhr\n• morgen 12:30\n• Freitag 19:00'
      )
      return
    }
  })

  // ── Text messages ──────────────────────────────────────────────────────────
  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id
    const text = ctx.message.text.trim()
    if (text.startsWith('/')) return

    const session = await getSession(chatId)

    if (session.state === 'awaiting_description_input') {
      await setSession(chatId, {
        state: 'awaiting_description_confirm',
        data: { ...session.data, description: text },
      })
      await ctx.reply(
        `📸 *Beschreibung:*\n_"${text}"_\n\nPasst das?`,
        { parse_mode: 'Markdown', reply_markup: descriptionKeyboard() }
      )
      return
    }

    if (session.state === 'awaiting_caption_edit') {
      const hashtags = session.data.hashtags ?? []
      const hashtagStr = hashtags.map(h => `#${h}`).join(' ')
      const preview = hashtagStr ? `${text}\n\n${hashtagStr}` : text
      const msg = await ctx.reply(
        `📝 *Deine Caption:*\n\n${preview}`,
        { parse_mode: 'Markdown', reply_markup: captionKeyboard() }
      )
      await setSession(chatId, {
        state: 'awaiting_caption_confirm',
        data: { ...session.data, caption: text, caption_msg_id: msg.message_id },
      })
      return
    }

    if (session.state === 'awaiting_schedule_input') {
      const parsed = parseNaturalDate(text)
      if (!parsed || parsed < new Date()) {
        await ctx.reply(
          '❌ Datum nicht erkannt oder in der Vergangenheit.\nVersuche z.B.: "morgen 18 Uhr" oder "nächsten Freitag 19:30"'
        )
        return
      }
      await publishAndConfirm(ctx, chatId, session, parsed)
      return
    }

    if (session.state === 'idle') {
      const profileId = await getProfileId(chatId)
      if (!profileId) {
        await ctx.reply('❌ Kein Account verknüpft. Nutze /start mit deinem Link-Code.')
      } else {
        await ctx.reply('📷 Sende ein Foto, um einen Post einzuplanen.')
      }
    }
  })
}

// ── Export ────────────────────────────────────────────────────────────────────

let _bot: Bot | null = null

export function getBot(): Bot {
  if (_bot) return _bot
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set')
  _bot = new Bot(token)
  registerHandlers(_bot)
  return _bot
}
