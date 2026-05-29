export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  const forceDownload = searchParams.get('dl') === '1'

  if (!url) return new Response('url required', { status: 400 })

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
