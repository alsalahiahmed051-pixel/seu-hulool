import { requireAdmin } from '@/lib/admin-guard'
import { readMeta, writeMeta, blobEnabled } from '@/lib/files-meta'
import { indexFile, readText } from '@/lib/file-index'

export const runtime = 'nodejs'
// Reading and parsing PDFs is slow; the default 10s is not enough for a batch.
export const maxDuration = 60

/**
 * Make uploaded files searchable by the assistant.
 *
 * Runs in batches rather than over the whole library at once: extracting text
 * from a PDF is measured in seconds, and a request that tries to do two
 * hundred of them dies on the platform's time limit having saved nothing. Each
 * call takes the next few and reports what is left, so the panel can drive it
 * to completion and show progress while it goes.
 */
export async function POST(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  if (!blobEnabled()) return Response.json({ error: 'التخزين غير مُعدّ' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const size = Math.min(8, Math.max(1, Number(body.batch) || 4))
  const redo = body.redo === true

  let all
  try { all = await readMeta() } catch (e) {
    return Response.json({ error: 'تعذّرت قراءة فهرس الملفات' }, { status: 500 })
  }

  // `indexed` is undefined on every record written before this existed, which
  // is exactly the set that still needs doing. `redo` retries the failures too.
  const pending = all.filter(f => redo ? f.indexed !== true : f.indexed === undefined)
  const batch = pending.slice(0, size)

  const results = []
  for (const rec of batch) {
    const out = await indexFile(rec)
    results.push({ name: rec.name, ...out })
  }

  // Write the outcomes back onto the library records, so the panel can say per
  // file whether the assistant can use it — and so a second run skips what is
  // already done instead of re-parsing the whole library.
  const byId = new Map(results.map(r => [r.id, r]))
  const updated = all.map(f => {
    const r = byId.get(f.id)
    if (!r) return f
    return {
      ...f,
      indexed: r.ok,
      indexedChars: r.chars || 0,
      indexedAt: new Date().toISOString(),
      ...(r.ok ? { indexError: undefined } : { indexError: r.reason || 'تعذّرت الفهرسة' }),
    }
  })

  try { await writeMeta(updated) } catch {
    return Response.json({ error: 'تعذّر حفظ نتائج الفهرسة' }, { status: 500 })
  }

  return Response.json({
    done: results.length,
    ok: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).map(r => ({ name: r.name, reason: r.reason })),
    remaining: Math.max(0, pending.length - batch.length),
  })
}

/** What is indexed and what is not — for the panel's progress line. */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  if (!blobEnabled()) return Response.json({ total: 0, indexed: 0, failed: [], pending: 0, blobEnabled: false })

  let all = []
  try { all = await readMeta() } catch { /* report zeros rather than fail the panel */ }

  return Response.json({
    blobEnabled: true,
    total: all.length,
    indexed: all.filter(f => f.indexed === true).length,
    pending: all.filter(f => f.indexed === undefined).length,
    failed: all.filter(f => f.indexed === false)
      .map(f => ({ name: f.name, course: f.courseName, reason: f.indexError || '' }))
      .slice(0, 30),
  })
}
