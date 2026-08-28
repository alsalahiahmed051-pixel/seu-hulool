import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const ALLOWED_KEYS = ['links', 'theme', 'calendar']

export async function GET(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  if (!ALLOWED_KEYS.includes(key)) return Response.json({ error: 'مفتاح غير صحيح' }, { status: 400 })

  const db = createAdminClient()
  const { data, error } = await db.from('site_content').select('data').eq('key', key).maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: data?.data ?? null })
}

export async function PUT(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  const key = body.key
  if (!ALLOWED_KEYS.includes(key)) return Response.json({ error: 'مفتاح غير صحيح' }, { status: 400 })
  if (typeof body.data !== 'object' || body.data == null) {
    return Response.json({ error: 'محتوى غير صحيح' }, { status: 400 })
  }

  const db = createAdminClient()
  const { error } = await db.from('site_content')
    .upsert({ key, data: body.data, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
