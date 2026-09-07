import { indexFile } from '@/lib/file-index'
import { removeFileBytes } from '@/lib/file-storage'
import { cleanName } from '@/lib/file-text'
import { requireAdmin } from '@/lib/admin-guard'
import { readMeta, writeMeta, blobEnabled, formatSize } from '@/lib/files-meta'
import { courseMatches, canonicalCourse, ALL_CATEGORY_IDS } from '@/lib/courses'
import { ACCOUNTS_ONLY } from '@/lib/auth-config'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// The shelf a file can be filed on. Shared with the site and the panel so the
// three cannot drift — the drift between two hand-written course lists is what
// once made every upload invisible.
const CATEGORIES = ALL_CATEGORY_IDS

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const course = searchParams.get('course')
  const category = searchParams.get('category')

  if (!blobEnabled()) return Response.json({ files: [], blobEnabled: false })

  let all
  try {
    all = await readMeta()
  } catch {
    // Report the failure rather than pretending the library is empty — and say
    // that storage IS configured. Omitting the flag made the panel read
    // `blobEnabled: undefined` as false and print «Vercel Blob غير مضبوط»,
    // which sends the owner to add a token that is already there AND hides the
    // upload form, so a read failure silently took uploading away too.
    return Response.json(
      { error: 'تعذّر قراءة قائمة الملفات', files: [], blobEnabled: true, indexReadable: false },
      { status: 500 },
    )
  }

  let files = all
  // Match through the catalogue, so files stored under an old admin-panel
  // name ("حاسب", "رياضيات"…) still show up under the real course.
  if (course) files = files.filter(f => courseMatches(f.courseName, course))
  if (category) files = files.filter(f => f.category === category)

  // The real gate on downloading is here, not on /api/download: a visitor who
  // never receives `blobUrl` has nothing to fetch, while the listing itself
  // stays visible so browsing still shows what the library holds. Gating the
  // download route instead would be weaker and noisier — the URL would already
  // be in the page by then.
  //
  // Only enforced once ACCOUNTS_ONLY is on. Until then the gate is the
  // client's, and it is honestly advisory: the server cannot see a
  // device-local profile, so withholding here today would take downloads away
  // from every current student and give them no way to get them back.
  if (ACCOUNTS_ONLY) {
    let user = null
    try {
      const supabase = await createClient()
      user = (await supabase.auth.getUser()).data.user
    } catch { /* unreachable auth is not a reason to hand out storage URLs */ }
    if (!user) {
      files = files.map(({ blobUrl, url, ...rest }) => ({ ...rest, locked: true }))
    }
  }

  return Response.json({ files, blobEnabled: true })
}

/**
 * Records a file the browser has just uploaded straight to Blob storage.
 * The upload itself no longer passes through a function (see /api/upload),
 * so this is the step that puts it in the library index.
 */
export async function POST(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  if (!blobEnabled()) return Response.json({ error: 'Blob not configured' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const { storagePath, courseName, category, name, size } = body
  if (!storagePath || !courseName || !category) {
    return Response.json({ error: 'البيانات ناقصة' }, { status: 400 })
  }
  if (!CATEGORIES.includes(category)) {
    return Response.json({ error: 'تصنيف غير معروف' }, { status: 400 })
  }
  // A path this route issued, not an arbitrary one: the upload handshake builds
  // «<course>/<uuid><ext>», so anything else did not come from it. Without this
  // an admin request could point a record at any object in the bucket.
  if (!/^[^/]{1,80}\/[0-9a-f-]{36}(\.[A-Za-z0-9]{1,8})?$/u.test(storagePath)) {
    return Response.json({ error: 'مسار الملف غير صالح' }, { status: 400 })
  }

  const bytes = Number(size) || 0
  const record = {
    id: crypto.randomUUID(),
    // Stripped of the bidi isolates the file picker wraps a mixed Arabic/Latin
    // name in. They are invisible, so «ملخص.pdf» does not end at «.pdf» but at
    // a hidden U+2069 — which is how thirty real PDFs came to be reported as an
    // unsupported file type. The indexer no longer trusts names at all, but a
    // name stored clean is one that displays and searches correctly too.
    name: cleanName(String(name || 'ملف')).slice(0, 200) || 'ملف',
    courseName: canonicalCourse(String(courseName).slice(0, 200)),
    category,
    size: bytes,
    sizeLabel: formatSize(bytes),
    provider: 'supabase',
    storagePath,
    uploadedAt: new Date().toISOString(),
    downloads: 0,
  }

  try {
    const all = await readMeta()
    all.unshift(record)
    await writeMeta(all)
  } catch (err) {
    // The bytes are already stored; drop them so we do not leave an orphan the
    // library will never show.
    try { await removeFileBytes(record) } catch { /* best effort */ }
    return Response.json({ error: 'تعذّر حفظ بيانات الملف: ' + err.message }, { status: 500 })
  }

  // Make it searchable right away. Awaited rather than fired and forgotten:
  // a serverless function that returns is frozen, so a background promise here
  // would simply never finish. Its failure must not fail the upload, though —
  // the file is stored and visible either way, and the panel can retry the
  // indexing on its own.
  try {
    const out = await indexFile(record)
    const all2 = await readMeta()
    await writeMeta(all2.map(f => f.id === record.id
      ? { ...f, indexed: out.ok, indexedChars: out.chars || 0, indexedAt: new Date().toISOString(),
          ...(out.ok ? {} : { indexError: out.reason || 'تعذّرت الفهرسة' }) }
      : f))
    record.indexed = out.ok
  } catch { /* the upload stands; «فهرسة الملفات» in the panel will pick it up */ }

  return Response.json({ ok: true, file: record })
}

export async function DELETE(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  if (!blobEnabled()) return Response.json({ error: 'Blob not configured' }, { status: 503 })

  const { id } = await request.json().catch(() => ({}))
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  // Read the library first: if it can't be read, stop rather than delete the
  // file and lose track of every other record.
  let all
  try {
    all = await readMeta()
  } catch {
    return Response.json({ error: 'تعذّر قراءة قائمة الملفات — لم يُحذف شيء' }, { status: 500 })
  }
  const record = all.find(f => f.id === id)
  await writeMeta(all.filter(f => f.id !== id))

  // The bytes go after the record does — and the extracted text goes with the
  // row, so the assistant cannot keep quoting a file that no longer exists.
  // That is the worst kind of wrong answer: the student cannot open the source
  // to check it.
  if (record) { try { await removeFileBytes(record) } catch { /* record is already gone */ } }
  return Response.json({ ok: true })
}
