import { getPrivate } from '@/lib/blob-read'
import { downloadPerMinuteLimit, callerKey } from '@/lib/rate-limit'
import { safeContentType } from '@/lib/content-type'
import { readMeta } from '@/lib/files-meta'
import { signedDownloadUrl } from '@/lib/file-storage'

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
  const id = searchParams.get('id')
  const forceDownload = searchParams.get('dl') === '1'

  // BY ID is the path for anything uploaded since storage moved to Supabase:
  // those files have no public URL at all, and which store holds a file is the
  // record's business rather than the link's. A signed URL is minted for the
  // moment of the download and expires; the object stays private.
  if (id) {
    let file = null
    try {
      file = (await readMeta()).find(f => f.id === id) || null
    } catch {
      return new Response('تعذّر قراءة قائمة الملفات', { status: 500 })
    }
    if (!file) return new Response('الملف غير موجود', { status: 404 })

    if (file.storagePath && file.provider !== 'vercel') {
      try {
        const signed = await signedDownloadUrl(file.storagePath, 120)
        const target = new URL(signed)
        if (forceDownload) target.searchParams.set('download', file.name || '1')
        return Response.redirect(target.toString(), 302)
      } catch (err) {
        return new Response('تعذّر فتح الملف: ' + String(err?.message || err).slice(0, 120), { status: 502 })
      }
    }
    // Uploaded before the move — served through the old store below.
    if (!file.blobUrl) return new Response('الملف غير موجود', { status: 404 })
    return servePrivateBlob(file.blobUrl, forceDownload)
  }

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
  return servePrivateBlob(parsed.toString(), forceDownload)
}

/**
 * Serve one object out of the OLD Vercel Blob store.
 *
 * Kept for everything uploaded before storage moved to Supabase, and for the
 * subscription receipts that still live there. New uploads never reach this —
 * they are redirected to a short-lived signed URL instead, which costs this
 * function nothing to stream.
 */
async function servePrivateBlob(url, forceDownload) {
  
  try {
    // Private blobs must be read through the SDK BY PATHNAME — see getPrivate.
    // The direct-URL form is not authorised for them, so this used to depend
    // on whatever the CDN happened to be holding. Fall back to fetch for older
    // public objects.
    let body = null
    let contentType = null
    try {
      const got = await getPrivate(url)
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
