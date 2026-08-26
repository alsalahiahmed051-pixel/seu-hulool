import { list, del, put } from '@vercel/blob'
import { isValidAdminSecret } from '@/lib/admin-auth'

export const runtime = 'nodejs'

const BLOB_ENABLED = !!process.env.BLOB_READ_WRITE_TOKEN &&
  !process.env.BLOB_READ_WRITE_TOKEN.includes('placeholder')

const META_PREFIX = 'hulool-files-db'

async function readMeta() {
  if (!BLOB_ENABLED) return []
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

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const course = searchParams.get('course')
  const category = searchParams.get('category')

  if (!BLOB_ENABLED) return Response.json({ files: [], blobEnabled: false })

  const all = await readMeta()
  let files = all
  if (course) files = files.filter(f => f.courseName === course)
  if (category) files = files.filter(f => f.category === category)

  return Response.json({ files, blobEnabled: true })
}

export async function DELETE(request) {
  const secret = request.headers.get('x-admin-secret')
  if (!isValidAdminSecret(secret))
    return Response.json({ error: 'غير مصرح' }, { status: 401 })
  if (!BLOB_ENABLED)
    return Response.json({ error: 'Blob not configured' }, { status: 503 })

  const { id, blobUrl } = await request.json()
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  try { if (blobUrl) await del(blobUrl) } catch { /* ignore */ }

  const all = await readMeta()
  await writeMeta(all.filter(f => f.id !== id))
  return Response.json({ ok: true })
}
