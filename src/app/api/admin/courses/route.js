import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const TRACKS = ['preparatory', 'bachelor', 'diploma', 'graduate']

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^\w؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `course-${Date.now()}`
}

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const db = createAdminClient()
  const { data, error } = await db
    .from('courses')
    .select('id, slug, name_ar, name_en, track, college_id, plan, icon, color, credit_hours, is_active, view_count, created_at')
    .order('track')
    .order('name_ar')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ courses: data || [] })
}

export async function POST(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  const name_ar = (body.name_ar || '').trim()
  const track = body.track
  if (!name_ar) return Response.json({ error: 'اسم المادة مطلوب' }, { status: 400 })
  if (!TRACKS.includes(track)) return Response.json({ error: 'المسار غير صحيح' }, { status: 400 })

  const db = createAdminClient()
  const row = {
    slug: body.slug ? slugify(body.slug) : slugify(name_ar) + '-' + Math.random().toString(36).slice(2, 6),
    name_ar,
    name_en: body.name_en?.trim() || null,
    track,
    college_id: body.college_id || null,
    plan: body.plan || null,
    icon: body.icon?.trim() || 'BookOpen',
    color: body.color?.trim() || '#0a8a58',
    credit_hours: body.credit_hours ? Number(body.credit_hours) : null,
    is_active: body.is_active !== false,
  }
  const { data, error } = await db.from('courses').insert(row).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, course: data })
}

export async function PATCH(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  if (!body.id) return Response.json({ error: 'id مطلوب' }, { status: 400 })

  const patch = {}
  for (const k of ['name_ar', 'name_en', 'track', 'college_id', 'plan', 'icon', 'color', 'credit_hours', 'is_active']) {
    if (k in body) patch[k] = body[k]
  }
  if (patch.track && !TRACKS.includes(patch.track)) {
    return Response.json({ error: 'المسار غير صحيح' }, { status: 400 })
  }
  patch.updated_at = new Date().toISOString()

  const db = createAdminClient()
  const { data, error } = await db.from('courses').update(patch).eq('id', body.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, course: data })
}

export async function DELETE(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  if (!body.id) return Response.json({ error: 'id مطلوب' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('courses').delete().eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
