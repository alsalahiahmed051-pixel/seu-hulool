import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'
import { postMessage, MAX_BODY } from '@/lib/messages'

export const runtime = 'nodejs'

/** Every conversation, the ones waiting on a reply first. */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const db = createAdminClient()
  const { data: threads, error } = await db
    .from('message_threads')
    .select('id, device_id, student_name, student_id, email, kind, topic, subject, status, admin_unread, student_unread, last_message_at, created_at')
    .order('admin_unread', { ascending: false })
    .order('last_message_at', { ascending: false })
    .limit(100)

  if (error) {
    // Tell the panel the difference between "no messages" and "no table yet",
    // so a missing migration reads as a setup step and not as silence.
    return Response.json({ threads: [], tableReady: false, error: error.message })
  }

  const ids = (threads || []).map(t => t.id)
  const byThread = {}
  if (ids.length) {
    const { data: msgs } = await db
      .from('messages')
      .select('id, thread_id, sender, body, created_at')
      .in('thread_id', ids)
      .order('created_at', { ascending: true })
    for (const m of msgs || []) (byThread[m.thread_id] ||= []).push(m)
  }

  return Response.json({
    threads: (threads || []).map(t => ({ ...t, messages: byThread[t.id] || [] })),
    tableReady: true,
    waiting: (threads || []).filter(t => t.admin_unread > 0).length,
  })
}

/** Reply to a student. */
export async function POST(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const b = await request.json().catch(() => ({}))
  const body = String(b.body || '').trim().slice(0, MAX_BODY)
  if (!b.threadId) return Response.json({ error: 'threadId مطلوب' }, { status: 400 })
  if (!body) return Response.json({ error: 'اكتب ردّك' }, { status: 400 })

  const db = createAdminClient()
  const r = await postMessage(db, { threadId: b.threadId, sender: 'admin', body })
  if (!r.ok) return Response.json({ error: r.error }, { status: 500 })

  // Reading the thread is what answering it means; leaving it unread would
  // keep it at the top of the queue forever.
  await db.from('message_threads').update({ admin_unread: 0 }).eq('id', b.threadId)
  return Response.json({ ok: true })
}

/** Mark read, or close a finished conversation. */
export async function PATCH(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const b = await request.json().catch(() => ({}))
  if (!b.threadId) return Response.json({ error: 'threadId مطلوب' }, { status: 400 })

  const patch = { admin_unread: 0 }
  if (b.status === 'closed' || b.status === 'open') patch.status = b.status

  const db = createAdminClient()
  const { error } = await db.from('message_threads').update(patch).eq('id', b.threadId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

/** Delete a conversation and everything in it. */
export async function DELETE(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id مطلوب' }, { status: 400 })

  const db = createAdminClient()
  // messages carry ON DELETE CASCADE, so the thread takes them with it.
  const { error } = await db.from('message_threads').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
