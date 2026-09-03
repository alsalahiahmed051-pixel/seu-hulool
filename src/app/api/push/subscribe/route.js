import { createAdminClient } from '@/lib/supabase/server'
import { pushConfigured } from '@/lib/web-push-server'

export const runtime = 'nodejs'

// GET → tells the client whether push is configured on the server and hands
// it the public VAPID key it needs to subscribe.
export async function GET() {
  return Response.json({
    configured: pushConfigured(),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '',
  })
}

// POST → store (or refresh) a browser push subscription.
export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const sub = body.subscription
  const endpoint = sub?.endpoint
  const p256dh = sub?.keys?.p256dh
  const auth = sub?.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return Response.json({ error: 'اشتراك غير صالح' }, { status: 400 })
  }

  let db
  try { db = createAdminClient() } catch { return Response.json({ error: 'الخادم غير مهيّأ' }, { status: 503 }) }

  const row = {
    endpoint,
    p256dh,
    auth,
    track: body.track || null,
    plan: body.plan || null,
    code: body.code || null,
    student_name: body.name || null,
    user_agent: (request.headers.get('user-agent') || '').slice(0, 300),
    updated_at: new Date().toISOString(),
  }
  const { error } = await db.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

// DELETE → forget a subscription (user turned device notifications off).
export async function DELETE(request) {
  const body = await request.json().catch(() => ({}))
  if (!body.endpoint) return Response.json({ error: 'endpoint مطلوب' }, { status: 400 })
  let db
  try { db = createAdminClient() } catch { return Response.json({ ok: true }) }
  await db.from('push_subscriptions').delete().eq('endpoint', body.endpoint)
  return Response.json({ ok: true })
}
