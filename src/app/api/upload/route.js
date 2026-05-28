import { put, list } from '@vercel/blob'

export const runtime = 'nodejs'
export const maxDuration = 60

const BLOB_ENABLED = !!process.env.BLOB_READ_WRITE_TOKEN &&
  !process.env.BLOB_READ_WRITE_TOKEN.includes('placeholder')

const META_KEY = 'hulool-files-db.json'
const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

async function readMeta() {
  try {
    const { blobs } = await list({ prefix: META_KEY })
    if (!blobs.length) return []
    const res = await fetch(blobs[0].url)
    return await res.json()
  } catch { return [] }
}

async function writeMeta(records) {
  await put(META_KEY, JSON.stringify(records), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
  })
}

export async function POST(request) {
  const secret = request.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'غير مصرح' }, { status: 401 })
  }

  if (!BLOB_ENABLED) {
    return Response.json({ error: 'BLOB_READ_WRITE_TOKEN غير مضبوط' }, { status: 503 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const courseName = formData.get('courseName')
  const category = formData.get('category')
  const displayName = formData.get('displayName') || file?.name || 'ملف'

  if (!file || !courseName || !category) {
    return Response.json({ error: 'البيانات ناقصة' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'حجم الملف يتجاوز 20 ميجابايت' }, { status: 400 })
  }

  const allowedTypes = ['application/pdf', 'application/octet-stream']
  const allowedExts = ['.pdf', '.PDF']
  const hasAllowedExt = allowedExts.some(ext => file.name.endsWith(ext))
  if (!allowedTypes.includes(file.type) && !hasAllowedExt) {
    return Response.json({ error: 'فقط ملفات PDF مسموحة' }, { status: 400 })
  }

  const safeFilename = `files/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.؀-ۿ_-]/g, '_')}`

  const blob = await put(safeFilename, file, {
    access: 'public',
    contentType: 'application/pdf',
  })

  const record = {
    id: crypto.randomUUID(),
    name: displayName,
    courseName,
    category,
    size: file.size,
    sizeLabel: formatSize(file.size),
    url: blob.url,
    blobUrl: blob.url,
    uploadedAt: new Date().toISOString(),
    downloads: 0,
    views: 0,
  }

  const all = await readMeta()
  all.unshift(record)
  await writeMeta(all)

  return Response.json({ ok: true, file: record })
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
