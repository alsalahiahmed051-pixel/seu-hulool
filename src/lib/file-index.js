import { put, list, get, del } from '@vercel/blob'
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
    const res = await get(blobs[0].url, { access: 'private' })
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
export async function indexFile(record) {
  const src = record?.blobUrl || record?.url
  if (!src) return { id: record?.id, ok: false, reason: 'لا رابط للملف' }

  let buf
  try {
    // Through the SDK: the store is private, so a plain fetch of the URL is
    // not authorised.
    const res = await get(src, { access: 'private' })
    if (!res) throw new Error('unreachable')
    buf = Buffer.from(await new Response(res.stream).arrayBuffer())
  } catch {
    try {
      const r = await fetch(src)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      buf = Buffer.from(await r.arrayBuffer())
    } catch (err) {
      return { id: record.id, ok: false, reason: `تعذّر تنزيل الملف: ${String(err?.message || err).slice(0, 80)}` }
    }
  }

  const out = await extractText(buf, record.name || '')
  if (out.ok) {
    try { await writeText(record.id, out.text) }
    catch (err) { return { id: record.id, ok: false, reason: `تعذّر حفظ النص: ${String(err?.message || err).slice(0, 80)}` } }
  }
  return { id: record.id, ok: out.ok, chars: out.chars, ratio: out.ratio, reason: out.reason }
}
