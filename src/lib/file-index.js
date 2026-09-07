import { put, list, del } from '@vercel/blob'
import { getPrivate } from '@/lib/blob-read'
import { extractText } from '@/lib/file-text'
import { blobEnabled } from '@/lib/files-meta'

/**
 * The searchable text of every uploaded file.
 *
 * Kept as one small blob per file rather than in the library index or a new
 * table. The index is read on every course page, so folding megabytes of
 * extracted prose into it would slow down the whole site to serve a feature
 * only the assistant uses; and a per-file blob needs no migration, is deleted
 * with its file, and costs nothing when unused.
 *
 * Storage is private, like the index itself — this text is the owner's
 * material, not something to leave on a public URL.
 */

const PREFIX = 'hulool-text'
const keyFor = (id) => `${PREFIX}/${id}.txt`

/** Text long enough to matter, short enough not to blow up a prompt. */
export const MAX_STORED_CHARS = 120_000

/** Read one file's indexed text, or '' when it has none. */
export async function readText(id) {
  if (!blobEnabled() || !id) return ''
  try {
    const { blobs } = await list({ prefix: keyFor(id) })
    if (!blobs.length) return ''
    // By pathname — see getPrivate. A private blob fetched by raw URL is not
    // authorised, and this text is written then read for the first time
    // minutes later, with nothing cached to cover for it.
    const res = await getPrivate(blobs[0])
    if (!res) return ''
    return await new Response(res.stream).text()
  } catch {
    return ''
  }
}

/** Replace one file's indexed text. */
export async function writeText(id, text) {
  await put(keyFor(id), String(text || '').slice(0, MAX_STORED_CHARS), {
    access: 'private',
    contentType: 'text/plain; charset=utf-8',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

/** Drop a file's text when the file itself is deleted. */
export async function removeText(id) {
  if (!blobEnabled() || !id) return
  try {
    const { blobs } = await list({ prefix: keyFor(id) })
    if (blobs.length) await del(blobs.map(b => b.url))
  } catch { /* an orphaned text blob is harmless */ }
}

/**
 * Fetch a stored file and index its text.
 *
 * Returns what happened, never throws: this runs across a whole library, and
 * one unreadable file must not stop the rest. The outcome is written back onto
 * the library record so the panel can show the owner exactly which uploads the
 * assistant can use and which it cannot — the alternative is a file that is
 * silently absent from every answer with nothing anywhere saying why.
 */
export async function indexFile(record, { force = false } = {}) {
  const src = record?.blobUrl || record?.url
  if (!src) return { id: record?.id, ok: false, reason: 'لا رابط للملف' }

  // Already extracted? Then do not download it again.
  //
  // This is not a micro-optimisation — it is what keeps the store inside its
  // allowance. Indexing downloads every file in full, and the owner's store hit
  // the Hobby plan's usage limit and was SUSPENDED for a month, taking the
  // whole library offline. A re-run used to pay that transfer over from the
  // start, and a retry loop that could not converge paid it several times.
  // Text already stored is the same text; reading the small extract instead of
  // the large original makes a second run nearly free.
  if (!force) {
    const already = await readText(record.id)
    if (already && already.length >= 200) {
      return { id: record.id, ok: true, chars: already.length, ratio: 1, reason: '', cached: true }
    }
  }

  let buf
  try {
    // Through the SDK, and by pathname: the store is private, so neither a
    // plain fetch of the URL nor the SDK's direct-URL form is authorised.
    // getPrivate already tries the token-authorised HTTP route as its last
    // resort, so there is no unauthenticated fetch to fall back to here — one
    // would only spend another request to be refused.
    const res = await getPrivate(src)
    if (!res) throw new Error('تعذّر الوصول إلى الملف في التخزين')
    buf = Buffer.from(await new Response(res.stream).arrayBuffer())
  } catch (err) {
    return { id: record.id, ok: false, reason: `تعذّر تنزيل الملف: ${String(err?.message || err).slice(0, 80)}` }
  }

  const out = await extractText(buf, record.name || '')
  if (out.ok) {
    try { await writeText(record.id, out.text) }
    catch (err) { return { id: record.id, ok: false, reason: `تعذّر حفظ النص: ${String(err?.message || err).slice(0, 80)}` } }
  }
  return { id: record.id, ok: out.ok, chars: out.chars, ratio: out.ratio, reason: out.reason }
}
