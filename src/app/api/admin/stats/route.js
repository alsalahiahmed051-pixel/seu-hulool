import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const db = createAdminClient()

  async function countOf(table, modify) {
    let q = db.from(table).select('*', { count: 'exact', head: true })
    if (modify) q = modify(q)
    const { count } = await q
    return count || 0
  }

  const [
    users, admins, courses, activeCourses, colleges,
    sessions, chatMessages, notifications, favorites, ratings,
  ] = await Promise.all([
    countOf('profiles'),
    countOf('profiles', q => q.in('role', ['admin', 'moderator'])),
    countOf('courses'),
    countOf('courses', q => q.eq('is_active', true)),
    countOf('colleges'),
    countOf('sessions'),
    countOf('chat_messages'),
    countOf('notifications'),
    countOf('favorites'),
    countOf('file_ratings'),
  ])

  // New signups in the last 7 days
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString()
  const newUsers = await countOf('profiles', q => q.gte('created_at', weekAgo))

  return Response.json({
    counts: {
      users, admins, newUsers, courses, activeCourses, colleges,
      sessions, chatMessages, notifications, favorites, ratings,
    },
  })
}
