import { handleUpload } from '@vercel/blob/client'
import { requireAdmin } from '@/lib/admin-guard'

export const runtime = 'nodejs'

const BLOB_ENABLED = !!process.env.BLOB_READ_WRITE_TOKEN &&
  !process.env.BLOB_READ_WRITE_TOKEN.includes('placeholder')

const MAX_SIZE = 20 * 1024 * 1024

/**
 * Issues a short-lived token so the browser uploads straight to Blob storage.
 *
 * The file used to be POSTed through this function, which meant it crossed the
 * network twice (browser → function → Blob) while the function stayed open for
 * the whole transfer. On Vercel that also capped uploads at the ~4.5 MB
 * serverless request-body limit, and the metadata round-trips afterwards
 * pushed even small files past the function timeout — the "hangs, then fails"
 * report. Now only this tiny JSON handshake touches the function; the file
 * goes browser → Blob directly, so size and duration limits no longer apply.
 */
export async function POST(request) {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })
  if (!BLOB_ENABLED) return Response.json({ error: 'BLOB_READ_WRITE_TOKEN غير مضبوط' }, { status: 503 })

  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'صيغة الطلب غير صحيحة' }, { status: 400 })

  try {
    const result = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      // Admin identity is already verified above; constrain what the issued
      // token may store so it can't be repurposed for arbitrary content.
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['application/pdf'],
        maximumSizeInBytes: MAX_SIZE,
        addRandomSuffix: true,
      }),
      // Metadata is recorded by the client calling POST /api/files once the
      // upload resolves; nothing to do here.
      onUploadCompleted: async () => {},
    })
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: 'تعذّر بدء الرفع: ' + err.message }, { status: 500 })
  }
}
