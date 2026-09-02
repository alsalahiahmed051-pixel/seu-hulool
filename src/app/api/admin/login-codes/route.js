import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'
import { looksLikeEmail } from '@/lib/ai-usage'
import { generateCode, hashCode, formatCode, CODE_TTL_DAYS } from '@/lib/login-codes'

export const runtime = 'nodejs'

/** Codes this admin has issued, without ever showing the codes themselves. */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const db = createAdminClient()
  const { data, error } = await db
    .from('login_codes')
    .select('id, email, label, created_at, expires_at, used_at, attempts')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return Response.json({ codes: [], tableReady: false, error: error.message })
  return Response.json({ codes: data || [], tableReady: true })
}

/**
 * Issue a code for one student.
 *
 * The code is returned exactly once, in this response, and never again — only
 * its hash is stored. That is not an inconvenience to work around: a list of
 * live codes an admin can re-read is a list an attacker can read too.
 */
export async function POST(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase().slice(0, 160)
  const label = String(body.label || '').trim().slice(0, 120) || null
  if (!looksLikeEmail(email)) return Response.json({ error: 'أدخل بريداً صحيحاً' }, { status: 400 })

  const code = generateCode()
  const db = createAdminClient()
  const { error } = await db.from('login_codes').insert({
    code_hash: hashCode(code),
    email,
    label,
    created_by: gate.admin.user.id,
    expires_at: new Date(Date.now() + CODE_TTL_DAYS * 86_400_000).toISOString(),
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ code: formatCode(code), email, expiresInDays: CODE_TTL_DAYS })
}

/** Revoke a code that has not been used. */
export async function DELETE(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id مطلوب' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('login_codes').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
