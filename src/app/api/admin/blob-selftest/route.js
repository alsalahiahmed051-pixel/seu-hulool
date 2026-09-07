import { put, del, list } from '@vercel/blob'
import { requireAdmin } from '@/lib/admin-guard'
import { blobEnabled } from '@/lib/files-meta'
import { getPrivate } from '@/lib/blob-read'

export const runtime = 'nodejs'

/**
 * Can this deployment write a private object and read it back?
 *
 * Reading the library index has been failing with 403 on every route, while
 * listing the very same object succeeds. From outside the store there is no way
 * to tell the two possibilities apart:
 *
 *   • the STORE refuses private reads to this deployment — in which case a
 *     brand-new object will fail exactly the same way, and no amount of code
 *     will fix it; it is a token or a store setting;
 *   • or only THAT object is unreachable — in which case writing and reading a
 *     new one works, and the old records are the only casualty.
 *
 * Guessing between them has cost several rounds. This makes the store answer:
 * it writes a few bytes, reads them back through every route, deletes them, and
 * reports what each attempt said. It is the difference between "change a
 * setting in Vercel" and "the old index is gone" — and those need opposite
 * actions from the owner.
 */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  if (!blobEnabled()) {
    return Response.json({ ok: false, tokenPresent: false, steps: ['BLOB_READ_WRITE_TOKEN غير موجود'] })
  }

  const steps = []
  const pathname = `hulool-selftest/${Date.now()}.txt`
  const payload = 'hulool-selftest'
  let written = null

  try {
    written = await put(pathname, payload, {
      access: 'private',
      contentType: 'text/plain; charset=utf-8',
      addRandomSuffix: false,
    })
    steps.push('write: ok')
  } catch (e) {
    steps.push(`write: ${clean(e)}`)
    // A store that will not accept a write is not a code problem at all.
    return Response.json({ ok: false, tokenPresent: true, canWrite: false, canRead: false, steps })
  }

  // Listed as well as read: if listing shows it but every read refuses it, that
  // is the exact shape the library index is failing with, reproduced on an
  // object created seconds ago.
  try {
    const { blobs } = await list({ prefix: pathname })
    steps.push(`list: ${blobs.length} found`)
  } catch (e) {
    steps.push(`list: ${clean(e)}`)
  }

  const trace = []
  let canRead = false
  try {
    const res = await getPrivate({ pathname, url: written.url }, trace)
    if (res) {
      const text = await new Response(res.stream).text()
      canRead = text.trim() === payload
      steps.push(canRead ? 'read: ok' : 'read: content mismatch')
    } else {
      steps.push('read: no route succeeded')
    }
  } catch (e) {
    steps.push(`read: ${clean(e)}`)
  }
  steps.push(...trace)

  try {
    await del(written.url)
    steps.push('cleanup: ok')
  } catch (e) {
    steps.push(`cleanup: ${clean(e)}`)
  }

  return Response.json({
    ok: canRead,
    tokenPresent: true,
    canWrite: true,
    canRead,
    // The reading of it, in words, so the owner is not left to interpret a
    // trace: these two outcomes need opposite actions from him.
    verdict: canRead
      ? 'التخزين يكتب ويقرأ بشكل سليم — العطل خاصٌّ بالسجلّ القديم وحده'
      : 'التخزين يقبل الكتابة ويرفض القراءة — العطل في المخزن أو مفتاحه، لا في الموقع',
    steps,
  })
}

/** No URLs, no tokens — this is shown on a screen. */
function clean(e) {
  return String(e?.message || e || 'error')
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/vercel_blob_[A-Za-z0-9_-]+/g, '[token]')
    .slice(0, 140)
}
