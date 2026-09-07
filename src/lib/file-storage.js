import { createAdminClient } from '@/lib/supabase/server'
import { getPrivate } from '@/lib/blob-read'

/**
 * Where uploaded files live.
 *
 * Supabase Storage, on the same free project that already runs the platform's
 * database. The previous store hit its plan's usage limit and was SUSPENDED for
 * a month — the whole library offline, and the only ways out were paying or
 * waiting. This one is free and stays free, which is the requirement.
 *
 * Files uploaded before the move still sit in the old store, so reads fall back
 * to it by `provider`. Nothing has to move in one jump, and nothing that was
 * already uploaded stops working.
 */

/** Private: served through /api/download, never at a raw URL. */
export const BUCKET = 'course-files'

/**
 * The free plan's per-file ceiling.
 *
 * Not a number chosen here — it is the plan's, and pretending otherwise would
 * mean an upload that appears to start and then fails at the end. The picker
 * enforces the same figure so a file too large is refused before it is sent.
 */
export const MAX_FILE_BYTES = 50 * 1024 * 1024

export function storageEnabled() {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

/**
 * A storage path for an upload.
 *
 * Course first, so the bucket browses the way the library reads. The random
 * segment keeps two files of the same name apart, and the original name is
 * carried in the record rather than the path — Arabic filenames with spaces
 * and bidi marks make poor object keys.
 */
export function pathFor(courseName, fileName) {
  const ext = (String(fileName).match(/\.[A-Za-z0-9]{1,8}$/) || [''])[0].toLowerCase()
  const course = String(courseName || 'عام').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 60)
  return `${course}/${crypto.randomUUID()}${ext}`
}

/**
 * A short-lived URL the browser can upload one file to, directly.
 *
 * The bytes go browser → storage without passing through a function: a
 * serverless request body is capped at a few megabytes, and holding a function
 * open for a 40 MB transfer is what made uploads "hang, then fail" before.
 */
export async function signedUploadUrl(path) {
  const db = createAdminClient()
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error) throw new Error(String(error.message || error).slice(0, 160))
  return { url: data.signedUrl, token: data.token, path: data.path }
}

/** A short-lived URL for reading one file, for the download route to redirect to. */
export async function signedDownloadUrl(path, seconds = 120) {
  const db = createAdminClient()
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, seconds)
  if (error) throw new Error(String(error.message || error).slice(0, 160))
  return data.signedUrl
}

/**
 * One file's bytes, wherever it lives.
 *
 * Takes the record, not a path: which store holds it is the record's business,
 * and every caller that wants the content wants it regardless.
 */
export async function readFileBytes(record) {
  const path = record?.storagePath
  if (path && record?.provider !== 'vercel') {
    const db = createAdminClient()
    const { data, error } = await db.storage.from(BUCKET).download(path)
    if (error) throw new Error(String(error.message || error).slice(0, 160))
    return Buffer.from(await data.arrayBuffer())
  }

  // Uploaded before the move. Still readable — while that store is reachable.
  const src = record?.blobUrl || record?.url
  if (!src) throw new Error('لا مسار للملف')
  const res = await getPrivate(src)
  if (!res) throw new Error('تعذّر الوصول إلى الملف في التخزين القديم')
  return Buffer.from(await new Response(res.stream).arrayBuffer())
}

/** Remove a file's bytes. Missing is not an error — the record is going anyway. */
export async function removeFileBytes(record) {
  if (!record?.storagePath || record?.provider === 'vercel') return
  const db = createAdminClient()
  await db.storage.from(BUCKET).remove([record.storagePath]).catch(() => {})
}
