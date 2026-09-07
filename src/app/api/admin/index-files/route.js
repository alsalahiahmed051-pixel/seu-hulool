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
/**
 * Stop taking on new files this far into the request.
 *
 * The platform kills the function at `maxDuration` and returns its own error
 * page — not JSON — so everything the run had already extracted was lost and
 * the panel could only say «تعذّرت الفهرسة» with nothing behind it. That is the
 * failure the owner reported. Returning early with partial progress SAVED is
 * strictly better: the panel simply asks for the next batch.
 */
const BUDGET_MS = 50_000
/** A file this big will not finish inside one invocation, whatever it holds. */
const MAX_BYTES = 40 * 1024 * 1024

export async function POST(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  if (!blobEnabled()) return Response.json({ error: 'التخزين غير مُعدّ' }, { status: 503 })

  const started = Date.now()
  const body = await request.json().catch(() => ({}))
  const size = Math.min(8, Math.max(1, Number(body.batch) || 4))
  const redo = body.redo === true
  // When the panel started this run. Only meaningful for `redo` — see below.
  const since = typeof body.since === 'string' ? body.since : ''

  let all
  try { all = await readMeta() } catch (e) {
    return Response.json({ error: 'تعذّرت قراءة فهرس الملفات' }, { status: 500 })
  }

  // `indexed` is undefined on every record written before this existed, which
  // is exactly the set that still needs doing. `redo` retries the failures too.
  //
  // A retry run must exclude what it has ALREADY retried, or it cannot finish:
  // a file that fails again is still `indexed !== true`, so it stays at the
  // head of the queue and every round hands back the same four files forever.
  // That is exactly what happened on the owner's thirty-three uploads — three
  // identical rounds, then the stall guard stopped it at «توقّف التقدّم عند 29».
  // `indexedAt` is stamped on every attempt, so comparing it against the run's
  // start time is what makes the queue drain.
  const pending = all.filter(f => redo
    ? f.indexed !== true && !(since && f.indexedAt && f.indexedAt >= since)
    : f.indexed === undefined)
  const batch = pending.slice(0, size)

  const results = []
  for (const rec of batch) {
    // Stop before the budget, not when it is already spent: a fixed cut-off
    // still lets a file STARTED just under it run past the limit and get the
    // whole request killed. So the decision is made on what the next file is
    // likely to cost — the average of this run's own files, which is the only
    // honest estimate available, with half again for a slow one.
    //
    // The first file always runs: a request that returns having indexed
    // nothing makes no progress, and the panel would loop on it forever.
    const elapsed = Date.now() - started
    if (results.length && elapsed + (elapsed / results.length) * 1.5 > BUDGET_MS) break
    if (Number(rec.size) > MAX_BYTES) {
      results.push({ name: rec.name, id: rec.id, ok: false, reason: 'الملف أكبر من أن يُفهرس — قسّمه إلى أجزاء' })
      continue
    }
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
    // Counted from what was actually PROCESSED, not from the batch that was
    // planned: the deadline can end a run early, and reporting the planned
    // figure would tell the panel it is finished while files remain untouched.
    remaining: Math.max(0, pending.length - results.length),
  })
}

/** What is indexed and what is not — for the panel's progress line. */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  if (!blobEnabled()) return Response.json({ total: 0, indexed: 0, failed: [], pending: 0, blobEnabled: false })

  let all = []
  // An index that cannot be READ is not an empty library, and reporting it as
  // «0 من 0 ملفاً مفهرس» is the worst possible answer: it looks like nothing was
  // ever uploaded. Say which of the two it is.
  let unreadable = false
  try { all = await readMeta() } catch { unreadable = true }

  return Response.json({
    blobEnabled: true,
    unreadable,
    total: all.length,
    indexed: all.filter(f => f.indexed === true).length,
    pending: all.filter(f => f.indexed === undefined).length,
    failed: all.filter(f => f.indexed === false)
      .map(f => ({ name: f.name, course: f.courseName, reason: f.indexError || '' }))
      .slice(0, 30),
  })
}
