import { get } from '@vercel/blob'
import { downloadPerMinuteLimit, callerKey } from '@/lib/rate-limit'
import { safeContentType } from '@/lib/content-type'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request) {
  // The site is public and has no accounts, so this cannot require a login:
  // the old check rejected every visitor, which made every file undownloadable.
  // Abuse is bounded by a per-IP rate limit plus the host allow-list below.
  const rl = await downloadPerMinuteLimit.limit(callerKey(request))
  if (!rl.success) {
    return new Response('طلبات كثيرة — انتظر قليلاً ثم أعد المحاولة', {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))) },
    })
  }

  const { searchParams } = new URL(request.url)
  const rawUrl = searchParams.get('url')
  const forceDownload = searchParams.get('dl') === '1'

  if (!rawUrl) return new Response('url required', { status: 400 })

  // SSRF / secret-leak guard: `url` is attacker-controlled input, and we
  // attach our BLOB_READ_WRITE_TOKEN to whatever request we make with it.
  // Without this check, a caller could pass their own server's URL here
  // and have us hand our secret token straight to them. Only ever proxy
  // to our own Vercel Blob store's hostname.
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return new Response('Invalid url', { status: 400 })
  }
  // Accept either Blob hostname: the store used `.public.` historically, and
  // privately-stored blobs are addressed on the bare `blob.vercel-storage.com`
  // domain. Anything else is refused so our token is never sent elsewhere.
  if (parsed.protocol !== 'https:' || !/(^|\.)blob\.vercel-storage\.com$/.test(parsed.hostname)) {
    return new Response('Invalid file host', { status: 400 })
  }
  const url = parsed.toString()

  try {
    // Private blobs must be read through the SDK; a raw authorised fetch is
    // not sufficient for them. Fall back to fetch for older public objects.
    let body = null
    let contentType = null
    try {
      const got = await get(url, { access: 'private' })
      if (got?.stream) {
        body = got.stream
        contentType = got.blob?.contentType || null
      }
    } catch { /* fall through to the public path */ }

    if (!body) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      })
      if (!res.ok) return new Response('File not found', { status: 404 })
      body = res.body
      contentType = res.headers.get('content-type')
    }

    const rawName = url.split('/').pop()?.split('?')[0] || 'file.pdf'
    // strip timestamp prefix like "1748123456789-filename.pdf"
    let filename
    try { filename = decodeURIComponent(rawName) } catch { filename = rawName }
    filename = filename.replace(/^\d{13}-/, '')

    // This used to be hardcoded to application/pdf, which was fine while the
    // store held only course PDFs. Transfer receipts are photos, so a
    // hardcoded type made every one of them arrive as a broken PDF.
    const type = safeContentType(contentType, filename)
    // A type we don't recognise is never rendered — it is handed over as a
    // file, so nothing unknown can execute on our own origin.
    const inline = !forceDownload && type !== 'application/octet-stream'

    const disposition = inline
      ? `inline; filename*=UTF-8''${encodeURIComponent(filename)}`
      : `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`

    return new Response(body, {
      headers: {
        'Content-Type': type,
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=3600',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    return new Response('Error: ' + err.message, { status: 500 })
  }
}
