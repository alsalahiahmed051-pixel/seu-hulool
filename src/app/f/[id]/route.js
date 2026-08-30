import { readMeta } from '@/lib/files-meta'
import { downloadPerMinuteLimit, callerKey } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * A short, shareable link for one file: /f/<id>
 *
 * Sharing used to hand out
 * `…/api/download?url=https%3A%2F%2F…blob.vercel-storage.com%2F…` — a link so
 * long it wraps in every chat app, and one that publishes the storage URL
 * directly. This is short, lives on our own domain, and keeps the storage
 * location private: the id is looked up here and the file is served through
 * the existing download route.
 *
 * ?dl=1 forces a download instead of opening in the browser's viewer.
 */
export async function GET(request, { params }) {
  const rl = await downloadPerMinuteLimit.limit(callerKey(request))
  if (!rl.success) return new Response('طلبات كثيرة — انتظر قليلاً', { status: 429 })

  const { id } = await params
  if (!id) return new Response('غير موجود', { status: 404 })

  let all
  try {
    all = await readMeta()
  } catch {
    return new Response('تعذّر قراءة قائمة الملفات', { status: 500 })
  }

  const file = all.find(f => f.id === id)
  if (!file?.blobUrl) return new Response('الملف غير موجود', { status: 404 })

  const dl = new URL(request.url).searchParams.get('dl') === '1'
  const target = new URL('/api/download', request.url)
  target.searchParams.set('url', file.blobUrl)
  if (dl) target.searchParams.set('dl', '1')
  return Response.redirect(target.toString(), 302)
}
