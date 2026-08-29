import { list, del, put, get } from '@vercel/blob'

/**
 * The uploaded-files index, stored as a single JSON blob.
 *
 * Both /api/upload and /api/files used to carry their own copy of this logic,
 * and both swallowed read errors by returning [] — so a transient failure to
 * read the index made the next write persist that empty list and silently
 * erase every previous record. readMeta() now throws on a real failure and
 * callers refuse to write, so a bad read costs one request instead of the
 * whole library.
 */

const META_PREFIX = 'hulool-files-db'

export function blobEnabled() {
  const t = process.env.BLOB_READ_WRITE_TOKEN
  return !!t && !t.includes('placeholder')
}

/**
 * Reads the index. Returns [] only when there genuinely is no index yet;
 * throws when one exists but could not be read.
 */
export async function readMeta() {
  if (!blobEnabled()) return []
  const { blobs } = await list({ prefix: META_PREFIX })
  if (!blobs.length) return []
  const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0]

  // The index is stored privately, so it must be read through the SDK — a
  // plain fetch of the URL is not authorised and used to fail silently.
  const res = await get(latest.url, { access: 'private' })
  if (!res) throw new Error('files index not readable')
  const text = await new Response(res.stream).text()
  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed)) throw new Error('files index is malformed')
  return parsed
}

/** Replaces the index, then prunes the superseded copies. */
export async function writeMeta(records) {
  if (!Array.isArray(records)) throw new Error('records must be an array')
  const previous = await list({ prefix: META_PREFIX }).catch(() => ({ blobs: [] }))

  await put(`${META_PREFIX}-${Date.now()}.json`, JSON.stringify(records), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
  })

  // Only after the new index is safely written — deleting first would leave
  // no index at all if the write then failed.
  try {
    if (previous.blobs?.length) await del(previous.blobs.map(b => b.url))
  } catch { /* stale copies are harmless; the newest one wins */ }
}

export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
