import { handleUpload } from '@vercel/blob/client'
import { trackRequestLimit, callerKey } from '@/lib/rate-limit'
import { deviceIdentity } from '@/lib/ai-quota'

export const runtime = 'nodejs'

const BLOB_ENABLED = !!process.env.BLOB_READ_WRITE_TOKEN &&
  !process.env.BLOB_READ_WRITE_TOKEN.includes('placeholder')

// A transfer receipt is a phone screenshot or a small PDF. Anything larger is
// not a receipt, and this endpoint is open to the public.
const MAX_SIZE = 5 * 1024 * 1024

/**
 * Lets a student attach a transfer receipt to a subscription request.
 *
 * Separate from /api/upload, which is admin-only and PDF-only: this one has to
 * be open to visitors, so it is tightly bounded instead — images and PDFs
 * only, 5 MB, rate limited per caller, and stored under its own prefix so
 * receipts never mix with the course library.
 *
 * The file goes browser → Blob directly; only this small handshake touches the
 * function, so a slow phone upload can't hit the function timeout.
 */
export async function POST(request) {
  if (!BLOB_ENABLED) return Response.json({ error: 'رفع الملفات غير مهيّأ' }, { status: 503 })

  const rl = await trackRequestLimit.limit(callerKey(request))
  if (!rl.success) return Response.json({ error: 'محاولات كثيرة — انتظر قليلاً' }, { status: 429 })

  const { deviceId } = deviceIdentity(request)
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'صيغة الطلب غير صحيحة' }, { status: 400 })

  try {
    const result = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf'],
        maximumSizeInBytes: MAX_SIZE,
        addRandomSuffix: true,
        // Namespaced by device so a receipt is traceable to the request that
        // carried it, and kept well away from the course files.
        pathname: `receipts/${deviceId}`,
      }),
      onUploadCompleted: async () => {},
    })
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: 'تعذّر بدء الرفع: ' + err.message }, { status: 500 })
  }
}
