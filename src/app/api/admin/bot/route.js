import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'
import {
  botSystemPrompt, parseProposal, validateProposal, describeAction,
} from '@/lib/admin-bot'

export const runtime = 'nodejs'

const GROQ_KEY = process.env.GROQ_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

/**
 * Run the site by describing what you want.
 *
 * Two steps, always, and never one: POST without `confirm` returns what the
 * bot *would* do; POST with `confirm` and the actions performs it. The model
 * is not trusted with the write — it is only trusted to suggest, in a fixed
 * vocabulary that admin-bot.js checks before anything reaches the database.
 *
 * Both steps require an admin, so the confirm step re-validating the actions
 * is about correctness rather than privilege: everything here is something the
 * admin could already do by hand in the panel.
 */

async function ask(system, user) {
  if (GROQ_KEY && !GROQ_KEY.includes('placeholder')) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.1,
        max_tokens: 900,
      }),
    })
    const d = await r.json()
    if (r.ok) return d.choices?.[0]?.message?.content || ''
  }
  if (GEMINI_KEY && !GEMINI_KEY.includes('placeholder') && GEMINI_KEY.length > 20) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 900 },
        }),
      }
    )
    const d = await r.json()
    if (r.ok) return d.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }
  if (ANTHROPIC_KEY && !ANTHROPIC_KEY.includes('placeholder')) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY })
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      system,
      messages: [{ role: 'user', content: user }],
    })
    return res.content[0]?.text || ''
  }
  throw new Error('no provider configured')
}

/** Everything the bot can write, in one place. */
async function perform(action) {
  const db = createAdminClient()

  if (action.type === 'notification.add') {
    const base = {
      user_id: null, type: 'announcement',
      title: action.title, body: action.body, link_url: null,
    }
    // audience is a newer column; retry without it if the migration is behind,
    // exactly as /api/admin/notifications does.
    let { error } = await db.from('notifications').insert({ ...base, audience: action.audience })
    if (error && /audience/i.test(error.message || '')) {
      ({ error } = await db.from('notifications').insert(base))
    }
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  // calendar.add — the calendar is one JSON document, so this is a
  // read-modify-write. Two events added at the same instant could lose one;
  // that is acceptable here because a single admin is typing, and the
  // alternative is restructuring how the panel stores the calendar.
  const { data } = await db
    .from('site_content').select('data').eq('key', 'calendar').maybeSingle()
  const events = Array.isArray(data?.data?.events) ? data.data.events : []
  const next = [...events, {
    label: action.label, date: action.date,
    color: action.color, icon: action.icon,
    ...(action.audience && action.audience !== 'all' ? { audience: action.audience } : {}),
  }]
  const { error } = await db
    .from('site_content')
    .upsert({ key: 'calendar', data: { events: next }, updated_at: new Date().toISOString() },
      { onConflict: 'key' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function POST(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))

  // ── Step two: do it ────────────────────────────────────────────────
  if (body.confirm) {
    // Re-validated rather than trusted from the round trip. Not because the
    // caller is suspect — they are an admin — but because a stale or edited
    // payload should fail loudly here rather than write something malformed.
    const { actions, errors } = validateProposal(body.actions)
    if (actions.length === 0) {
      return Response.json({ error: errors[0] || 'لا شيء لتنفيذه' }, { status: 400 })
    }
    const done = []
    const failed = []
    for (const a of actions) {
      const r = await perform(a)
      if (r.ok) done.push(describeAction(a))
      else failed.push(`${describeAction(a)} — ${r.error}`)
    }
    return Response.json({ done, failed })
  }

  // ── Step one: what would you do? ───────────────────────────────────
  const text = String(body.text || '').trim().slice(0, 2000)
  if (!text) return Response.json({ error: 'اكتب ما تريد' }, { status: 400 })

  let raw
  try {
    raw = await ask(botSystemPrompt(new Date().toISOString().slice(0, 10)), text)
  } catch {
    return Response.json({ error: 'المساعد غير مفعّل — أضف مفتاح مزوّد أولاً.' }, { status: 503 })
  }

  const parsed = parseProposal(raw)
  if (!parsed) {
    return Response.json({ actions: [], errors: ['لم أفهم الطلب — جرّب صياغة أوضح.'] })
  }
  const { actions, errors } = validateProposal(parsed)
  return Response.json({
    actions,
    errors,
    preview: actions.map(describeAction),
  })
}
