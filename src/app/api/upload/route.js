import { put, list, del } from '@vercel/blob'
import { isValidAdminSecret } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const maxDuration = 60

const BLOB_ENABLED = !!process.env.BLOB_READ_WRITE_TOKEN &&
  !process.env.BLOB_READ_WRITE_TOKEN.includes('placeholder')

const META_PREFIX = 'hulool-files-db'
const MAX_SIZE = 20 * 1024 * 1024

async function readMeta() {
  try {
    const { blobs } = await list({ prefix: META_PREFIX })
    if (!blobs.length) return []
    const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0]
    const res = await fetch(latest.url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    })
    return await res.json()
  } catch { return [] }
}

async function writeMeta(records) {
  try {
    const { blobs } = await list({ prefix: META_PREFIX })
    if (blobs.length) await del(blobs.map(b => b.url))
  } catch { /* ignore */ }

  await put(`${META_PREFIX}-${Date.now()}.json`, JSON.stringify(records), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
  })
}

export async function POST(request) {
  const secret = request.headers.get('x-admin-secret')
  if (!isValidAdminSecret(secret)) {
    return Response.json({ error: 'غير مصرح' }, { status: 401 })
  }
  if (!BLOB_ENABLED) {
    return Response.json({ error: 'BLOB_READ_WRITE_TOKEN غير مضبوط' }, { status: 503 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const courseName = formData.get('courseName')
    const category = formData.get('category')
    const displayName = formData.get('displayName') || file?.name || 'ملف'

    if (!file || !courseName || !category)
      return Response.json({ error: 'البيانات ناقصة' }, { status: 400 })
    if (file.size > MAX_SIZE)
      return Response.json({ error: 'حجم الملف يتجاوز 20 ميجابايت' }, { status: 400 })

    const allowedExts = ['.pdf', '.PDF']
    if (!allowedExts.some(e => file.name.endsWith(e)) && file.type !== 'application/pdf')
      return Response.json({ error: 'فقط ملفات PDF مسموحة' }, { status: 400 })

    const safeName = file.name.replace(/[^a-zA-Z0-9.؀-ۿ_-]/g, '_')
    const blob = await put(`files/${Date.now()}-${safeName}`, file, {
      access: 'private',
      contentType: 'application/pdf',
      addRandomSuffix: false,
    })

    const id = crypto.randomUUID()
    const record = {
      id,
      name: displayName,
      courseName,
      category,
      size: file.size,
      sizeLabel: formatSize(file.size),
      blobUrl: blob.url,
      uploadedAt: new Date().toISOString(),
      downloads: 0,
    }

    const all = await readMeta()
    all.unshift(record)
    await writeMeta(all)

    return Response.json({ ok: true, file: record })
  } catch (err) {
    return Response.json({ error: 'خطأ في الرفع: ' + err.message }, { status: 500 })
  }
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
