import { createAdminClient } from '@/lib/supabase/server'

/**
 * The uploaded-files library.
 *
 * ── Why this is a table and no longer a blob ─────────────────────────────
 *
 * It used to be a single JSON object in Vercel Blob. Two things followed from
 * that, and both happened:
 *
 * 1. ONE OBJECT, ALL OR NOTHING. When that object could not be read, a library
 *    of thirty-three files reported itself as zero — the site looked empty to
 *    its owner and to every student. There was no partial failure available.
 *
 * 2. IT SHARED A QUOTA WITH THE FILES. The blob store reached its plan's usage
 *    limit and was SUSPENDED for a month, taking the library offline with it.
 *
 * Rows in Postgres cost nothing on the same free project that already runs the
 * platform's database, have no separate quota to exhaust, and fail one row at a
 * time. The old `readMeta`/`writeMeta` shape is kept exactly so the rest of the
 * app did not have to change with the storage underneath it.
 */

/** Storage is configured when the database is — there is no separate token. */
export function blobEnabled() {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

/** A database row as the app's records have always looked. */
function toRecord(row) {
  return {
    id: row.id,
    name: row.name,
    courseName: row.course_name,
    category: row.category,
    provider: row.provider,
    storagePath: row.storage_path,
    blobUrl: row.blob_url,
    size: Number(row.size) || 0,
    sizeLabel: formatSize(Number(row.size) || 0),
    uploadedAt: row.uploaded_at,
    downloads: row.downloads || 0,
    // `indexed` is deliberately undefined rather than null when never attempted:
    // "not tried yet" and "tried and failed" drive different buttons in the
    // panel, and null would collapse them into one.
    ...(row.indexed === null ? {} : { indexed: row.indexed }),
    indexedChars: row.indexed_chars || 0,
    indexedAt: row.indexed_at || undefined,
    indexError: row.index_error || undefined,
    recovered: row.recovered || false,
  }
}

/** A record as a row. */
function toRow(rec) {
  return {
    id: rec.id,
    name: String(rec.name || 'ملف').slice(0, 200),
    course_name: String(rec.courseName || '').slice(0, 200),
    category: String(rec.category || ''),
    provider: rec.provider || (rec.blobUrl ? 'vercel' : 'supabase'),
    storage_path: rec.storagePath || null,
    blob_url: rec.blobUrl || null,
    size: Number(rec.size) || 0,
    uploaded_at: rec.uploadedAt || new Date().toISOString(),
    downloads: Number(rec.downloads) || 0,
    indexed: rec.indexed === undefined ? null : rec.indexed,
    indexed_chars: Number(rec.indexedChars) || 0,
    indexed_at: rec.indexedAt || null,
    index_error: rec.indexError || null,
    recovered: !!rec.recovered,
  }
}

/**
 * Reads the library. Returns [] when there is none yet; throws when there is
 * one that could not be read — callers refuse to write on a failed read, and a
 * silent [] would have them write emptiness over real records.
 */
export async function readMeta() {
  if (!blobEnabled()) return []
  const db = createAdminClient()
  const { data, error } = await db
    .from('library_files')
    .select('id,name,course_name,category,provider,storage_path,blob_url,size,uploaded_at,downloads,indexed,indexed_chars,indexed_at,index_error,recovered')
    .order('uploaded_at', { ascending: false })
  if (error) {
    const err = new Error('files index not readable')
    err.detail = { stage: 'read', generations: null, cause: String(error.message || error).slice(0, 160), message: 'تعذّرت قراءة سجلّ الملفات من قاعدة البيانات' }
    throw err
  }
  return (data || []).map(toRecord)
}

/**
 * Replaces the library with this list.
 *
 * Kept as a whole-list write because that is the shape every caller already
 * had. It is done as an upsert plus a delete of what is no longer present, so a
 * failure part-way leaves records in place rather than a half-erased library —
 * the previous implementation's delete-then-write had exactly that hazard.
 */
export async function writeMeta(records) {
  if (!Array.isArray(records)) throw new Error('records must be an array')
  if (!blobEnabled()) throw new Error('قاعدة البيانات غير مُعدّة')
  const db = createAdminClient()

  const rows = records.filter(r => r && r.id).map(toRow)
  if (rows.length) {
    const { error } = await db.from('library_files').upsert(rows, { onConflict: 'id' })
    if (error) throw new Error(`تعذّر حفظ سجلّ الملفات: ${String(error.message || error).slice(0, 120)}`)
  }

  // Anything not in the list is gone — but only ever deleted AFTER the upsert
  // above succeeded.
  const keep = rows.map(r => r.id)
  const del = db.from('library_files').delete()
  const { error: delErr } = keep.length
    ? await del.not('id', 'in', `(${keep.map(id => `"${id}"`).join(',')})`)
    : await del.neq('id', '00000000-0000-0000-0000-000000000000')
  if (delErr) throw new Error(`تعذّر تنظيف سجلّ الملفات: ${String(delErr.message || delErr).slice(0, 120)}`)
}

/** One file's extracted text, or '' when it has none. */
export async function readExtractedText(id) {
  if (!blobEnabled() || !id) return ''
  const db = createAdminClient()
  const { data, error } = await db.from('library_files').select('extracted_text').eq('id', id).maybeSingle()
  if (error || !data) return ''
  return data.extracted_text || ''
}

/** Store one file's extracted text beside its record. */
export async function writeExtractedText(id, text) {
  if (!blobEnabled() || !id) return
  const db = createAdminClient()
  const { error } = await db.from('library_files').update({ extracted_text: text || null }).eq('id', id)
  if (error) throw new Error(String(error.message || error).slice(0, 120))
}

export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
