import { list } from '@vercel/blob'
import { requireAdmin } from '@/lib/admin-guard'
import { readMeta, writeMeta, blobEnabled, formatSize } from '@/lib/files-meta'
import { courseCodeIn, ALL_CATEGORY_IDS } from '@/lib/courses'
import { cleanName } from '@/lib/file-text'
import { getPrivate } from '@/lib/blob-read'
import { pathFor, BUCKET, storageEnabled } from '@/lib/file-storage'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Finding the uploaded files again when the index cannot be read.
 *
 * The owner's question was the right one: where did my files go. They did not
 * go anywhere. Two different things live in storage — the FILES themselves, and
 * the INDEX, one small JSON object saying which course and shelf each file
 * belongs to. Only the index is failing to read, and an unreadable index makes
 * a full library look empty.
 *
 * And the listing still works — it is what reports "1 generation found". A
 * listing is enough to see every uploaded object and rebuild the index from it,
 * because the index needs only names, sizes and URLs, none of which requires
 * reading a single byte of content.
 *
 * What a rebuild cannot recover is the filing: which course, which shelf. That
 * lived in the index alone. But the owner's filenames carry their course codes
 * — «Acct101-Final-1st-2024-25», «LAW101 all slides» — so most of it can be
 * put back automatically, and whatever cannot is listed for him to file rather
 * than dropped.
 */

// NOTE: this route reads the OLD Vercel store, on purpose. Files uploaded
// before storage moved to Supabase still live there, and this is how they are
// found and put back into the library once that store is reachable again.

/** Objects this platform writes for itself, which are not uploads. */
const INTERNAL = /^(hulool-files-db|hulool-text\/|hulool-selftest\/)/

/** The shelf a filename is describing, when it says. */
function shelfFrom(name) {
  const n = String(name || '')
  if (/تجميع|اسئلة|أسئلة|final|mid|exam|بنك/i.test(n)) return 'collections'
  if (/ملخص|ملخّص|summary|review|مراجعة/i.test(n)) return 'summary'
  if (/واجب|حل|solution|assignment|نشاط/i.test(n)) return 'solved'
  if (/سلايد|slide|كتاب|book|شرح|محاضرة/i.test(n)) return 'slides'
  return ''
}

/** Everything in the store that looks like an upload, with a guess at filing. */
async function survey() {
  const { blobs } = await list()
  const found = blobs
    .filter(b => !INTERNAL.test(b.pathname))
    .map(b => {
      const name = cleanName(b.pathname.replace(/^.*\//, '').replace(/-[A-Za-z0-9]{20,}(?=\.|$)/, ''))
      const course = courseCodeIn(name)
      const category = shelfFrom(name)
      return {
        pathname: b.pathname,
        url: b.url,
        name: name.replace(/\.[^.]+$/, '') || 'ملف',
        size: b.size || 0,
        sizeLabel: formatSize(b.size || 0),
        uploadedAt: b.uploadedAt,
        course,
        category: category || 'slides',
        // Flagged rather than silently mis-shelved: a wrong guess the owner
        // cannot see is worse than one he is asked about.
        needsReview: !course || !category,
      }
    })
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
  return found
}

/** What is in storage, and how much of it can be filed automatically. */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  if (!blobEnabled()) return Response.json({ error: 'التخزين غير مُعدّ' }, { status: 503 })

  let found
  try {
    found = await survey()
  } catch (e) {
    return Response.json({ error: 'تعذّر سرد التخزين: ' + clean(e) }, { status: 500 })
  }

  // Whether the index is readable decides what the owner is even offered: with
  // a readable index this is a comparison, without one it is a rescue.
  let indexed = null
  try { indexed = (await readMeta()).length } catch { /* unreadable — that is the point */ }

  return Response.json({
    files: found.slice(0, 300),
    total: found.length,
    filed: found.filter(f => !f.needsReview).length,
    indexReadable: indexed !== null,
    indexedCount: indexed,
  })
}

/**
 * How long one round may take.
 *
 * Copying is bytes over the wire, twice each — down from the old store and up
 * to the new one — and the platform kills the function at sixty seconds. So a
 * round stops itself while there is still time to answer, reports what is left,
 * and the panel calls again. Thirty-three files across several rounds finishes;
 * one round that dies at second sixty finishes nothing and says nothing.
 */
const BUDGET_MS = 45_000

/**
 * MOVE the old files into the new storage — do not merely point at them again.
 *
 * The first version of this rebuilt the index with `provider: 'vercel'`, which
 * put the library back on screen while leaving every byte in the store that had
 * just been suspended for a month. That is not recovery, it is a rebuilt
 * dependency on the thing that failed: the next suspension takes the library
 * down again, and the owner asked for storage that is free and stays free.
 *
 * So each file is read from the old store and written to the new one, and only
 * then indexed — as `supabase`, with a real path. A file whose bytes cannot be
 * copied is NOT indexed: a record pointing into an unreachable store is a row
 * that looks like a file and behaves like a hole.
 *
 * Additive and resumable. Anything already in the library is skipped, so
 * running it twice moves nothing twice, and a round that stops on the clock is
 * continued by the next one.
 */
export async function POST(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  if (!blobEnabled()) return Response.json({ error: 'التخزين القديم غير مُعدّ' }, { status: 503 })
  if (!storageEnabled()) return Response.json({ error: 'التخزين الجديد غير مُعدّ' }, { status: 503 })

  const started = Date.now()
  const body = await request.json().catch(() => ({}))
  // Only what the owner confirmed, so a guess he disagreed with is not written.
  const chosen = Array.isArray(body.files) ? body.files : null

  let found
  try {
    found = await survey()
  } catch (e) {
    return Response.json({ error: 'تعذّر سرد التخزين: ' + clean(e) }, { status: 500 })
  }

  let existing = []
  try { existing = await readMeta() } catch { /* rebuilding is the whole point */ }
  // Both keys, because a file moved on an earlier round is stored by its new
  // path while still carrying the old URL that identifies it here.
  const known = new Set(existing.map(f => f.blobUrl).filter(Boolean))

  const pick = chosen ? new Map(chosen.map(f => [f.pathname, f])) : null
  const db = createAdminClient()

  const added = []
  const failed = []
  let skipped = 0, left = 0

  for (const f of found) {
    if (known.has(f.url)) { skipped++; continue }
    const override = pick ? pick.get(f.pathname) : null
    if (pick && !override) { skipped++; continue }

    const course = String(override?.course ?? f.course ?? '').trim()
    if (!course) { skipped++; continue }   // unfiled would be invisible anywhere

    // Stop while there is still time to reply, and predict the next one rather
    // than starting a copy that cannot finish — same reasoning as the indexer.
    const elapsed = Date.now() - started
    const perFile = added.length + failed.length ? elapsed / (added.length + failed.length) : 4000
    if (elapsed + perFile * 1.5 > BUDGET_MS) { left++; continue }

    const name = String(override?.name || f.name).slice(0, 200)
    const category = ALL_CATEGORY_IDS.includes(override?.category || f.category)
      ? (override?.category || f.category) : 'slides'

    try {
      const src = await getPrivate(f.url)
      if (!src) throw new Error('المخزن القديم لم يُعطِ الملف')
      const bytes = Buffer.from(await new Response(src.stream).arrayBuffer())
      if (!bytes.length) throw new Error('الملف فارغ')

      const path = pathFor(course, f.pathname)
      const { error } = await db.storage.from(BUCKET).upload(path, bytes, {
        // Both shapes: the SDK's result carries it one way and the
        // token-fetch fallback wraps it as `blob.contentType`.
        contentType: src.contentType || src.blob?.contentType || 'application/octet-stream',
        upsert: false,
      })
      if (error) throw new Error(String(error.message || error))

      added.push({
        id: crypto.randomUUID(),
        name,
        courseName: course,
        category,
        size: bytes.length,
        sizeLabel: formatSize(bytes.length),
        // Moved for good: the new store owns the bytes now.
        provider: 'supabase',
        storagePath: path,
        // Kept so a second run recognises this file and skips it.
        blobUrl: f.url,
        uploadedAt: f.uploadedAt || new Date().toISOString(),
        downloads: 0,
        recovered: true,
      })
    } catch (e) {
      failed.push({ name, reason: clean(e) })
    }
  }

  if (added.length) {
    try {
      await writeMeta([...added, ...existing])
    } catch (e) {
      return Response.json({ error: 'نُقلت الملفات لكن تعذّر حفظ الفهرس: ' + clean(e) }, { status: 500 })
    }
  }

  return Response.json({
    added: added.length,
    failed: failed.length,
    // The first few reasons, because thirty identical failures have one cause
    // and the owner needs to read it once, not thirty times.
    reasons: failed.slice(0, 3),
    remaining: left,
    skipped,
    total: existing.length + added.length,
    note: added.length ? '' : (failed.length ? 'لم يُنقل شيء' : 'لا جديد يُضاف'),
  })
}

function clean(e) {
  return String(e?.message || e || 'error')
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/vercel_blob_[A-Za-z0-9_-]+/g, '[token]')
    .slice(0, 140)
}
