import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const db = createAdminClient()
  const { data, error } = await db
    .from('colleges')
    .select('*')
    .order('sort_order')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ colleges: data || [] })
}

export async function POST(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  const id = (body.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  const name_ar = (body.name_ar || '').trim()
  if (!id) return Response.json({ error: 'معرّف الكلية (بالإنجليزي) مطلوب' }, { status: 400 })
  if (!name_ar) return Response.json({ error: 'اسم الكلية مطلوب' }, { status: 400 })

  const db = createAdminClient()
  const row = {
    id,
    name_ar,
    name_en: body.name_en?.trim() || null,
    icon: body.icon?.trim() || 'Building2',
    color: body.color?.trim() || '#1d4ed8',
    description: body.description?.trim() || null,
    sort_order: body.sort_order ? Number(body.sort_order) : 0,
  }
  const { data, error } = await db.from('colleges').insert(row).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, college: data })
}

export async function PATCH(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  if (!body.id) return Response.json({ error: 'id مطلوب' }, { status: 400 })

  const patch = {}
  for (const k of ['name_ar', 'name_en', 'icon', 'color', 'description', 'sort_order']) {
    if (k in body) patch[k] = body[k]
  }

  const db = createAdminClient()
  const { data, error } = await db.from('colleges').update(patch).eq('id', body.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, college: data })
}

export async function DELETE(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  if (!body.id) return Response.json({ error: 'id مطلوب' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('colleges').delete().eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
