import { list, del, head, put } from '@vercel/blob'

export const runtime = 'nodejs'

const BLOB_ENABLED = !!process.env.BLOB_READ_WRITE_TOKEN &&
  !process.env.BLOB_READ_WRITE_TOKEN.includes('placeholder')

const META_KEY = 'hulool-files-db.json'

async function readMeta() {
  if (!BLOB_ENABLED) return []
  try {
    const { blobs } = await list({ prefix: META_KEY })
    if (!blobs.length) return []
    const res = await fetch(blobs[0].url)
    return await res.json()
  } catch { return [] }
}

async function writeMeta(records) {
  const body = JSON.stringify(records)
  await put(META_KEY, body, {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
  })
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const course = searchParams.get('course')
  const category = searchParams.get('category')

  if (!BLOB_ENABLED) {
    return Response.json({ files: [], blobEnabled: false })
  }

  const all = await readMeta()
  let files = all
  if (course) files = files.filter(f => f.courseName === course)
  if (category) files = files.filter(f => f.category === category)

  return Response.json({ files, blobEnabled: true })
}

export async function DELETE(request) {
  const secret = request.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'غير مصرح' }, { status: 401 })
  }

  if (!BLOB_ENABLED) {
    return Response.json({ error: 'Blob not configured' }, { status: 503 })
  }

  const { id, blobUrl } = await request.json()
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  try {
    if (blobUrl) await del(blobUrl)
  } catch { /* ignore if already deleted */ }

  const all = await readMeta()
  const updated = all.filter(f => f.id !== id)
  await writeMeta(updated)

  return Response.json({ ok: true })
}
