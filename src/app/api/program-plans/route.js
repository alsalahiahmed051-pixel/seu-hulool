import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * The study plans, for the student site.
 *
 * Public and read-only: a plan is a published timetable, not private data, and
 * the site needs it before anyone signs in to anything. A database that is
 * unreachable returns an empty map rather than an error, so the app falls back
 * to its built-in plan instead of showing a student nothing.
 */
export async function GET() {
  let db
  try { db = createAdminClient() } catch { return Response.json({ plans: {} }) }

  const { data, error } = await db
    .from('program_plans')
    .select('program, levels')
  if (error) return Response.json({ plans: {} })

  const plans = {}
  for (const row of data || []) {
    if (!row?.program || !Array.isArray(row.levels)) continue
    plans[row.program] = row.levels
      .filter(l => l && typeof l.label === 'string' && Array.isArray(l.courses))
      .map(l => ({ label: l.label, courses: l.courses.filter(c => typeof c === 'string') }))
  }
  return Response.json({ plans })
}
