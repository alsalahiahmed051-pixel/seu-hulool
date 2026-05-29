export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) return new Response('url required', { status: 400 })

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    })
    if (!res.ok) return new Response('File not found', { status: 404 })

    const filename = url.split('/').pop()?.split('?')[0] || 'file.pdf'

    return new Response(res.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    return new Response('Error: ' + err.message, { status: 500 })
  }
}
