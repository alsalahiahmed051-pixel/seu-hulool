'use client'

/**
 * Calls /api/chat and streams the response.
 *
 * Usage:
 *   await streamChat({
 *     subject: 'الحاسب',
 *     messages: [...],
 *     courseId: 'uuid-or-null',
 *     onChunk: (text) => setReply(prev => prev + text),
 *     onDone: ({ remaining }) => setRemaining(remaining),
 *     onError: (err) => setError(err),
 *   })
 */
export async function streamChat({ subject, messages, courseId, onChunk, onDone, onError }) {
  let response
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, messages, courseId }),
    })
  } catch (err) {
    onError?.('تعذّر الاتصال بالخادم')
    return
  }

  if (!response.ok) {
    try {
      const data = await response.json()
      onError?.(data.error || `خطأ: ${response.status}`)
    } catch {
      onError?.(`خطأ: ${response.status}`)
    }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const data = JSON.parse(line.slice(6))
        if (data.error) { onError?.(data.error); return }
        if (data.done) { onDone?.(data); return }
        if (data.text) onChunk?.(data.text)
      } catch {}
    }
  }
}
