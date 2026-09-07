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
 * How many generations of the index to keep.
 *
 * This used to be one: every write deleted every earlier copy the moment the
 * new one landed. That makes the whole library a single object with no history
 * — if the newest copy is unreadable for any reason, thirty-three uploads are
 * simply gone, with nothing to fall back to.
 *
 * And "for any reason" is not hypothetical. Blob listing is eventually
 * consistent, so a write can list the index, not yet see the copy the previous
 * write made a second earlier, and delete out from under a reader that is
 * mid-request. That window was narrow while the index was written once or twice
 * per action — and stopped being narrow when the indexer began driving nine
 * write cycles back to back to work through a library.
 *
 * Three generations cost a few kilobytes and turn that from "the library is
 * gone" into "one round was lost".
 */
const KEEP = 3

/** The index blobs, newest first. */
async function generations() {
  const { blobs } = await list({ prefix: META_PREFIX })
  return blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
}

/** One generation's contents, or null if it cannot be read. */
async function readOne(blob) {
  try {
    // The index is stored privately, so it must be read through the SDK — a
    // plain fetch of the URL is not authorised and used to fail silently.
    const res = await get(blob.url, { access: 'private' })
    if (!res) return null
    const parsed = JSON.parse(await new Response(res.stream).text())
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Reads the index. Returns [] only when there genuinely is no index yet;
 * throws when copies exist but none of them could be read.
 *
 * Falls back through the older generations rather than giving up on the first
 * failure — losing the last write is recoverable, losing the library is not.
 */
export async function readMeta() {
  if (!blobEnabled()) return []
  const blobs = await generations()
  if (!blobs.length) return []

  for (const blob of blobs) {
    const records = await readOne(blob)
    if (records) return records
  }
  throw new Error('files index not readable')
}

/** Replaces the index, then prunes all but the last few copies. */
export async function writeMeta(records) {
  if (!Array.isArray(records)) throw new Error('records must be an array')
  const previous = await generations().catch(() => [])

  await put(`${META_PREFIX}-${Date.now()}.json`, JSON.stringify(records), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
  })

  // Only after the new index is safely written — deleting first would leave no
  // index at all if the write then failed. And the copies pruned are counted
  // from the PRE-WRITE list, so the immediate predecessor always survives even
  // if listing has not caught up with what was just written.
  try {
    const stale = previous.slice(KEEP - 1)
    if (stale.length) await del(stale.map(b => b.url))
  } catch { /* stale copies are harmless; the newest one wins */ }
}

export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
