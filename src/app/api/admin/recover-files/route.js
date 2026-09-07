import { list } from '@vercel/blob'
import { requireAdmin } from '@/lib/admin-guard'
import { readMeta, writeMeta, blobEnabled, formatSize } from '@/lib/files-meta'
import { courseCodeIn, ALL_CATEGORY_IDS } from '@/lib/courses'
import { cleanName } from '@/lib/file-text'

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
 * Rebuild the index from what is actually in storage.
 *
 * Additive: anything the current index still holds is kept as it is, and only
 * files missing from it are added. So this cannot lose correct filing, and
 * running it twice changes nothing the second time.
 */
export async function POST(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  if (!blobEnabled()) return Response.json({ error: 'التخزين غير مُعدّ' }, { status: 503 })

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
  const known = new Set(existing.map(f => f.blobUrl))

  const pick = chosen
    ? new Map(chosen.map(f => [f.pathname, f]))
    : null

  const added = []
  for (const f of found) {
    if (known.has(f.url)) continue
    const override = pick ? pick.get(f.pathname) : null
    if (pick && !override) continue
    const category = ALL_CATEGORY_IDS.includes(override?.category || f.category)
      ? (override?.category || f.category) : 'slides'
    const course = String(override?.course ?? f.course ?? '').trim()
    if (!course) continue   // an unfiled record would be invisible to every page
    added.push({
      id: crypto.randomUUID(),
      name: String(override?.name || f.name).slice(0, 200),
      courseName: course,
      category,
      size: f.size,
      sizeLabel: f.sizeLabel,
      provider: 'vercel',
      blobUrl: f.url,
      uploadedAt: f.uploadedAt || new Date().toISOString(),
      downloads: 0,
      recovered: true,
    })
  }

  if (!added.length) {
    return Response.json({ added: 0, total: existing.length, note: 'لا جديد يُضاف' })
  }

  try {
    await writeMeta([...added, ...existing])
  } catch (e) {
    return Response.json({ error: 'تعذّر حفظ الفهرس: ' + clean(e) }, { status: 500 })
  }
  return Response.json({ added: added.length, total: existing.length + added.length })
}

function clean(e) {
  return String(e?.message || e || 'error')
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/vercel_blob_[A-Za-z0-9_-]+/g, '[token]')
    .slice(0, 140)
}
