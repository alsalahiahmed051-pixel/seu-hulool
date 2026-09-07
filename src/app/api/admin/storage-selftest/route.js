import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/server'
import { BUCKET, storageEnabled, signedDownloadUrl } from '@/lib/file-storage'

export const runtime = 'nodejs'

/**
 * Can this deployment write a file and read it back?
 *
 * The question this answers has already cost real time. When the library
 * stopped loading, from outside the store two very different situations looked
 * identical — and they need OPPOSITE actions:
 *
 *   • the STORE refuses this deployment, in which case a brand-new file fails
 *     exactly the same way and no amount of code will fix it;
 *   • or only one old object is unreachable, in which case writing and reading
 *     a new one works and only those records are affected.
 *
 * Guessing between them cost five rounds. This makes storage answer for itself:
 * it writes a few bytes, reads them back, deletes them, and reports each step.
 *
 * It now tests SUPABASE, which is where files live. The previous store reached
 * its plan's usage limit and was suspended for a month; that is the failure
 * this whole move exists to prevent, and testing the store we no longer use
 * would answer a question nobody is asking.
 */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  if (!storageEnabled()) {
    return Response.json({ ok: false, tokenPresent: false, steps: ['إعدادات Supabase ناقصة'] })
  }

  const steps = []
  const path = `hulool-selftest/${Date.now()}.txt`
  const payload = 'hulool-selftest'
  const db = createAdminClient()

  try {
    const { error } = await db.storage.from(BUCKET).upload(path, payload, {
      contentType: 'text/plain; charset=utf-8', upsert: true,
    })
    if (error) throw error
    steps.push('write: ok')
  } catch (e) {
    steps.push(`write: ${clean(e)}`)
    // A store that will not accept a write is not a code problem at all.
    return Response.json({ ok: false, tokenPresent: true, canWrite: false, canRead: false, steps })
  }

  // Listed as well as read: if listing shows it but the read refuses it, that
  // is the exact shape the old outage had, reproduced on a fresh object.
  try {
    const { data, error } = await db.storage.from(BUCKET).list('hulool-selftest')
    if (error) throw error
    steps.push(`list: ${(data || []).length} found`)
  } catch (e) {
    steps.push(`list: ${clean(e)}`)
  }

  let canRead = false
  try {
    const { data, error } = await db.storage.from(BUCKET).download(path)
    if (error) throw error
    canRead = (await data.text()).trim() === payload
    steps.push(canRead ? 'read: ok' : 'read: content mismatch')
  } catch (e) {
    steps.push(`read: ${clean(e)}`)
  }

  // The students' path is a signed URL, not a server-side download, so it is
  // worth its own line: minting one can fail on its own.
  try {
    await signedDownloadUrl(path, 60)
    steps.push('signed-url: ok')
  } catch (e) {
    steps.push(`signed-url: ${clean(e)}`)
  }

  try {
    const { error } = await db.storage.from(BUCKET).remove([path])
    if (error) throw error
    steps.push('cleanup: ok')
  } catch (e) {
    steps.push(`cleanup: ${clean(e)}`)
  }

  return Response.json({
    ok: canRead,
    tokenPresent: true,
    canWrite: true,
    canRead,
    // In words, because these two outcomes need opposite actions from the owner
    // and a trace alone leaves him to interpret infrastructure.
    verdict: canRead
      ? 'التخزين يكتب ويقرأ بشكل سليم'
      : 'التخزين يقبل الكتابة ويرفض القراءة — العطل في المخزن أو إعداده، لا في الموقع',
    steps,
  })
}

/** No URLs, no keys — this is shown on a screen. */
function clean(e) {
  return String(e?.message || e || 'error')
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/eyJ[A-Za-z0-9_.-]{20,}/g, '[key]')
    .slice(0, 140)
}
