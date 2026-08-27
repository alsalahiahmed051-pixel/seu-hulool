import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request) {
  // Require a logged-in user before proxying any file.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('يجب تسجيل الدخول', { status: 401 })

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
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.public.blob.vercel-storage.com')) {
    return new Response('Invalid file host', { status: 400 })
  }
  const url = parsed.toString()

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    })
    if (!res.ok) return new Response('File not found', { status: 404 })

    const rawName = url.split('/').pop()?.split('?')[0] || 'file.pdf'
    // strip timestamp prefix like "1748123456789-filename.pdf"
    const filename = rawName.replace(/^\d{13}-/, '')

    const disposition = forceDownload
      ? `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      : `inline; filename*=UTF-8''${encodeURIComponent(filename)}`

    return new Response(res.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=3600',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    })
  } catch (err) {
    return new Response('Error: ' + err.message, { status: 500 })
  }
}
