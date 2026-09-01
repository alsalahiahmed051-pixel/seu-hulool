import { del } from '@vercel/blob'
import { requireAdmin } from '@/lib/admin-guard'
import { readMeta, writeMeta, blobEnabled, formatSize } from '@/lib/files-meta'
import { courseMatches, canonicalCourse } from '@/lib/courses'
import { ACCOUNTS_ONLY } from '@/lib/auth-config'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const CATEGORIES = ['collections', 'plans', 'curriculum', 'programs']

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const course = searchParams.get('course')
  const category = searchParams.get('category')

  if (!blobEnabled()) return Response.json({ files: [], blobEnabled: false })

  let all
  try {
    all = await readMeta()
  } catch {
    // Report the failure rather than pretending the library is empty.
    return Response.json({ error: 'تعذّر قراءة قائمة الملفات', files: [] }, { status: 500 })
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
  const { blobUrl, courseName, category, name, size } = body
  if (!blobUrl || !courseName || !category) {
    return Response.json({ error: 'البيانات ناقصة' }, { status: 400 })
  }
  if (!CATEGORIES.includes(category)) {
    return Response.json({ error: 'تصنيف غير معروف' }, { status: 400 })
  }
  // Only accept URLs the store actually issued, so this can't be used to add
  // arbitrary links to the library. Parse rather than pattern-match the whole
  // string, so a crafted path or fragment can't fake the host.
  try {
    const u = new URL(blobUrl)
    if (u.protocol !== 'https:' || !/(^|\.)blob\.vercel-storage\.com$/.test(u.hostname)) {
      throw new Error('bad host')
    }
  } catch {
    return Response.json({ error: 'رابط الملف غير صالح' }, { status: 400 })
  }

  const bytes = Number(size) || 0
  const record = {
    id: crypto.randomUUID(),
    name: String(name || 'ملف').slice(0, 200),
    courseName: canonicalCourse(String(courseName).slice(0, 200)),
    category,
    size: bytes,
    sizeLabel: formatSize(bytes),
    blobUrl,
    uploadedAt: new Date().toISOString(),
    downloads: 0,
  }

  try {
    const all = await readMeta()
    all.unshift(record)
    await writeMeta(all)
  } catch (err) {
    // The blob is already stored; drop it so we don't leave an orphan the
    // library will never show.
    try { await del(blobUrl) } catch { /* best effort */ }
    return Response.json({ error: 'تعذّر حفظ بيانات الملف: ' + err.message }, { status: 500 })
  }

  return Response.json({ ok: true, file: record })
}

export async function DELETE(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  if (!blobEnabled()) return Response.json({ error: 'Blob not configured' }, { status: 503 })

  const { id, blobUrl } = await request.json().catch(() => ({}))
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  // Update the index first: if it can't be read, stop rather than delete the
  // file and lose track of every other record.
  let all
  try {
    all = await readMeta()
  } catch {
    return Response.json({ error: 'تعذّر قراءة قائمة الملفات — لم يُحذف شيء' }, { status: 500 })
  }
  await writeMeta(all.filter(f => f.id !== id))

  try { if (blobUrl) await del(blobUrl) } catch { /* index is already updated */ }
  return Response.json({ ok: true })
}
