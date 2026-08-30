/**
 * What /api/download is willing to label a response as.
 *
 * The proxy used to hardcode application/pdf, which was fine while the store
 * held only course PDFs. Transfer receipts are phone photos, so every one of
 * them arrived as a broken PDF. Deriving the type is the fix — but the type
 * partly comes from a file someone uploaded, and the proxy serves from our own
 * origin, so it is an allow-list rather than a pass-through: anything not on
 * it is handed over as a download instead of being rendered.
 */

export const SERVABLE = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif',
  'image/heic', 'image/heif',
])

const BY_EXT = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', heic: 'image/heic', heif: 'image/heif',
}

/** The stored type when we trust it, the extension's when we don't. */
export function safeContentType(stored, filename) {
  const base = String(stored || '').split(';')[0].trim().toLowerCase()
  if (SERVABLE.has(base)) return base
  const ext = String(filename || '').split('.').pop()?.toLowerCase() || ''
  return BY_EXT[ext] || 'application/octet-stream'
}
