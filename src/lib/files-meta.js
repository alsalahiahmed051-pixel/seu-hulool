import { list, del, put } from '@vercel/blob'
import { getPrivate } from '@/lib/blob-read'

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

/**
 * One generation's contents, or null if it cannot be read.
 *
 * BY PATHNAME FIRST, and that is the whole point. The SDK's `get` takes either:
 * given a URL it fetches that URL directly, given a pathname it builds the URL
 * from the store id **and authorises it with the token**. Every file here is
 * stored private, and a direct fetch of a private URL is not authorised — which
 * is why the library's own example for `access: 'private'` passes a pathname.
 *
 * This code passed `blob.url` from `list()`, and it worked for months: an
 * earlier authorised read had populated the CDN, and the cached copy kept being
 * served. It broke the moment a NEWLY written generation had to be read for the
 * first time — nothing cached, direct fetch, unauthorised, null. That is
 * exactly the shape of the failure: the store lists one generation and no read
 * of it succeeds. Three generations did not help because all three were new,
 * and `useCache: false` made it strictly worse by removing the cache that had
 * been carrying it.
 *
 * So: the authorised form first, the old form after it, and the cached form
 * last — because a stale cached copy of the index still beats no index at all.
 * Each attempt's outcome is reported, so this stops being guesswork.
 */
async function readOne(blob, trace) {
  const res = await getPrivate(blob, trace)
  if (!res) return null
  try {
    const parsed = JSON.parse(await new Response(res.stream).text())
    if (Array.isArray(parsed)) return parsed
    trace?.push('body: not an array')
  } catch (e) {
    trace?.push(`body: ${e?.name || 'Error'}`)
  }
  return null
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

  let blobs
  try {
    blobs = await generations()
  } catch (e) {
    // Listing failing is a different problem from reading failing — a token or
    // a store problem, not a missing object — and the two need different
    // answers. Without saying which, the panel can only report the same dead
    // end for both.
    throw indexError('تعذّر سرد نسخ الفهرس في التخزين', { stage: 'list', cause: e })
  }
  if (!blobs.length) return []

  // Every attempt on every generation, so a failure names itself instead of
  // costing another round trip through a deploy to find out what it was.
  const trace = []
  for (const blob of blobs) {
    const records = await readOne(blob, trace)
    if (records) return records
  }
  // The generation count is the fact that matters most when this happens: it
  // says whether the records still EXIST and only cannot be read — recoverable
  // — or whether there is nothing left in the store at all.
  throw indexError(`وُجدت ${blobs.length} نسخة من الفهرس ولم تُقرأ أيّ منها`, {
    stage: 'read', generations: blobs.length, trace: trace.slice(0, 9),
  })
}

/** An error the panel can show a person, carrying no URLs or credentials. */
function indexError(message, detail) {
  const err = new Error('files index not readable')
  const cause = detail.cause
  err.detail = {
    stage: detail.stage,
    generations: detail.generations ?? null,
    // The SDK puts blob URLs in some messages; those name the store, so only
    // the error's type and a short redacted message go out.
    // The message, not the name — the store library leaves `name` as plain
    // "Error" on every one of its errors, so the name says nothing at all.
    cause: cause ? String(cause.message || cause)
      .replace(/https?:\/\/\S+/g, '[url]')
      .replace(/vercel_blob_[A-Za-z0-9_-]+/g, '[token]')
      .slice(0, 160) : null,
    trace: detail.trace || null,
    message,
  }
  return err
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
