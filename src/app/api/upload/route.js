import { requireAdmin } from '@/lib/admin-guard'
import { storageEnabled, signedUploadUrl, pathFor, MAX_FILE_BYTES } from '@/lib/file-storage'

export const runtime = 'nodejs'

/**
 * Hands the browser a short-lived URL to upload one file straight to storage.
 *
 * The file used to POST through this function, which meant it crossed the
 * network twice and held a serverless function open for the whole transfer —
 * capped at the ~4.5 MB request-body limit and timing out on anything real.
 * Only this small JSON handshake touches a function now.
 *
 * Storage moved from Vercel Blob to Supabase: the old store reached its plan's
 * usage limit and was suspended for a month, taking the library offline. The
 * handshake is the same shape; only the signer changed.
 */
export async function POST(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  if (!storageEnabled()) {
    return Response.json({ error: 'التخزين غير مُعدّ — راجع إعدادات Supabase' }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.name) return Response.json({ error: 'صيغة الطلب غير صحيحة' }, { status: 400 })

  // Refused here, before a byte is sent: a file that fails at the END of a long
  // upload wastes the whole transfer and reads as "upload is broken".
  const size = Number(body.size) || 0
  if (size > MAX_FILE_BYTES) {
    return Response.json({
      error: `الملف أكبر من الحد المسموح (${Math.round(MAX_FILE_BYTES / 1024 / 1024)} ميجابايت للملف الواحد)`,
    }, { status: 413 })
  }

  try {
    const path = pathFor(body.courseName, body.name)
    const signed = await signedUploadUrl(path)
    return Response.json({ ...signed, maxBytes: MAX_FILE_BYTES })
  } catch (err) {
    return Response.json({ error: 'تعذّر بدء الرفع: ' + String(err?.message || err).slice(0, 140) }, { status: 500 })
  }
}
