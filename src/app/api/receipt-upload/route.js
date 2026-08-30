import { handleUpload } from '@vercel/blob/client'
import { receiptUploadLimit, remainingFor, callerKey } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const BLOB_ENABLED = !!process.env.BLOB_READ_WRITE_TOKEN &&
  !process.env.BLOB_READ_WRITE_TOKEN.includes('placeholder')

// A transfer receipt is a phone screenshot or a small PDF. Anything larger is
// not a receipt, and this endpoint is open to the public.
const MAX_SIZE = 5 * 1024 * 1024

// Phone galleries hand over a wider set of types than the obvious three:
// iOS sends HEIC/HEIF, some Android cameras send image/jpg, and a share sheet
// that loses the extension sends application/octet-stream. Rejecting those was
// invisible to the student — the upload simply refused — so accept what a
// phone actually produces and rely on the 5 MB cap plus admin review.
const ALLOWED = [
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'image/avif',
  'application/pdf', 'application/octet-stream',
]

/**
 * Lets a student attach a transfer receipt to a subscription request.
 *
 * Separate from /api/upload, which is admin-only and PDF-only: this one has to
 * be open to visitors, so it is tightly bounded instead — images and PDFs
 * only, 5 MB, rate limited, and stored privately under its own prefix so a
 * bank screenshot is never readable from a guessable URL.
 *
 * The file goes browser → Blob directly; only this small handshake touches the
 * function, so a slow phone upload can't hit the function timeout.
 */
export async function POST(request) {
  if (!BLOB_ENABLED) return Response.json({ error: 'رفع الملفات غير مهيّأ على الخادم' }, { status: 503 })

  // Its own budget. This used to share the track-change limiter — three per
  // hour per IP — which a student on shared campus/carrier NAT could exhaust
  // without ever having made a track request: the receipt then refused to
  // upload for an hour with no explanation.
  const rl = await receiptUploadLimit.limit(callerKey(request))
  if (!rl.success) return Response.json({ error: 'محاولات رفع كثيرة — انتظر قليلاً ثم أعد المحاولة' }, { status: 429 })

  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'صيغة الطلب غير صحيحة' }, { status: 400 })

  try {
    const result = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED,
        maximumSizeInBytes: MAX_SIZE,
        addRandomSuffix: true,
      }),
      // No completion callback: nothing is recorded here. The client sends the
      // resulting URL with the subscription request, and asking for a callback
      // adds a Vercel → function round-trip that can only fail.
    })
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: 'تعذّر بدء الرفع: ' + err.message }, { status: 500 })
  }
}

/**
 * Why an upload failed, in Arabic.
 *
 * The Blob SDK collapses every non-2xx from this route into the English
 * "Failed to retrieve the client token", so the student saw a meaningless
 * message and no reason. The client calls this after a failure to say what
 * actually went wrong.
 */
export async function GET(request) {
  if (!BLOB_ENABLED) {
    return Response.json({ ok: false, reason: 'رفع الملفات غير مهيّأ على الخادم — أرسل الطلب بملاحظة بدل الصورة' })
  }
  // Peeks at the budget instead of spending one: asking why you were blocked
  // must not itself block you.
  if ((await remainingFor(receiptUploadLimit, callerKey(request))) <= 0) {
    return Response.json({ ok: false, reason: 'حاولت الرفع مرات كثيرة — انتظر قليلاً ثم أعد المحاولة' })
  }
  return Response.json({ ok: true, maxSize: MAX_SIZE })
}
