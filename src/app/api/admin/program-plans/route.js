import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/** Every plan on file, for the editor. */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const db = createAdminClient()
  const { data, error } = await db
    .from('program_plans')
    .select('program, levels, updated_at')
    .order('program')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ plans: data || [] })
}

/**
 * Save one programme's plan.
 *
 * The whole plan is replaced in one write rather than patched level by level:
 * the editor holds the entire thing on screen, so a partial update would be a
 * way for two open tabs to interleave into a plan neither person typed.
 */
export async function POST(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  const program = String(body.program || '').trim().slice(0, 120)
  if (!program) return Response.json({ error: 'اختر التخصص' }, { status: 400 })

  if (!Array.isArray(body.levels)) {
    return Response.json({ error: 'الخطة غير صالحة' }, { status: 400 })
  }
  // Normalise here, not in the browser: this is what every student will read.
  const levels = body.levels
    .map(l => ({
      label: String(l?.label || '').trim().slice(0, 60),
      courses: Array.isArray(l?.courses)
        ? [...new Set(l.courses.map(c => String(c || '').trim().toUpperCase().slice(0, 20)).filter(Boolean))]
        : [],
    }))
    .filter(l => l.label)
  if (levels.length > 20) return Response.json({ error: 'عدد المستويات كبير' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('program_plans').upsert(
    { program, levels, updated_at: new Date().toISOString() },
    { onConflict: 'program' }
  )
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, program, levels })
}

/** Remove a programme's plan entirely (it falls back to no plan shown). */
export async function DELETE(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const program = new URL(request.url).searchParams.get('program')
  if (!program) return Response.json({ error: 'اختر التخصص' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('program_plans').delete().eq('program', program)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
