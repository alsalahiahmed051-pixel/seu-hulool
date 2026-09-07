import { extractText } from '@/lib/file-text'
import { readExtractedText, writeExtractedText, blobEnabled } from '@/lib/files-meta'
import { readFileBytes } from '@/lib/file-storage'

/**
 * The searchable text of every uploaded file.
 *
 * It used to be one small blob per file, beside the library's own blob. Both
 * are now columns and rows in the database instead: the blob store reached its
 * plan's usage limit and was suspended for a month, and each of those objects
 * was another thing that could fail on its own while the record it belonged to
 * was fine.
 */

/** Text long enough to matter, short enough not to blow up a prompt. */
export const MAX_STORED_CHARS = 120_000

/** Read one file's indexed text, or '' when it has none. */
export async function readText(id) {
  if (!blobEnabled() || !id) return ''
  try {
    return await readExtractedText(id)
  } catch {
    return ''
  }
}

/** Replace one file's indexed text. */
export async function writeText(id, text) {
  await writeExtractedText(id, String(text || '').slice(0, MAX_STORED_CHARS))
}

/** Forget one file's text. The row carries it, so removing the row is enough. */
export async function removeText(id) {
  try { await writeExtractedText(id, '') } catch { /* the row may already be gone */ }
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
  if (!record?.id) return { id: record?.id, ok: false, reason: 'سجلّ الملف ناقص' }

  // Already extracted? Then do not download it again.
  //
  // This is not a micro-optimisation — it is what keeps a storage plan inside
  // its allowance. Indexing downloads every file in full, and the previous
  // store hit its plan's usage limit and was SUSPENDED for a month, taking the
  // whole library offline. A re-run used to pay that transfer over from the
  // start, and a retry loop that could not converge paid it several times.
  if (!force) {
    const already = await readText(record.id)
    if (already && already.length >= 200) {
      return { id: record.id, ok: true, chars: already.length, ratio: 1, reason: '', cached: true }
    }
  }

  let buf
  try {
    buf = await readFileBytes(record)
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
