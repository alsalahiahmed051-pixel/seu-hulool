import { get } from '@vercel/blob'

/**
 * Reading a PRIVATE blob, the way the store actually allows.
 *
 * `get` takes either a URL or a pathname, and the two are not equivalent here:
 * given a URL it fetches that URL directly, given a pathname it builds the URL
 * from the store id AND AUTHORISES IT with the token. Every file in this
 * platform is stored private, so a direct fetch of the raw URL is not
 * authorised — which is why the library's own example for `access: 'private'`
 * passes a pathname.
 *
 * Four places read private blobs — the files index, the extracted text, the
 * file being indexed, and the student's download — and all four passed a URL.
 * It worked for as long as the CDN had an authorised copy to serve; the first
 * read of anything newly written had nothing cached, fetched directly, and came
 * back empty. That is how a library of thirty-three files reported itself as
 * zero.
 *
 * So the pathname form is tried first, then the URL, then the URL through the
 * cache — a stale cached copy still beats nothing. Every path is attempted
 * before giving up, because these are the reads the whole platform stands on.
 */
export function pathnameOf(url) {
  try {
    // Blob URLs percent-encode the pathname, and these filenames are Arabic.
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))
  } catch {
    return ''
  }
}

/**
 * @param {string|{pathname?: string, url?: string}} ref
 *   A stored URL, a pathname, or a blob record carrying both. When a record is
 *   given BOTH forms are tried — knowing the pathname must not cost the URL
 *   fallback, which is the one that has been carrying these reads until now.
 * @param {string[]} [trace]  filled with what each attempt answered
 * @returns the SDK result, or null when nothing could read it
 */
export async function getPrivate(ref, trace) {
  let pathname = ''
  let url = ''
  if (typeof ref === 'string') {
    if (/^https?:\/\//.test(ref)) { url = ref; pathname = pathnameOf(ref) } else { pathname = ref }
  } else if (ref) {
    url = ref.url || ''
    pathname = ref.pathname || (url ? pathnameOf(url) : '')
  }

  const attempts = [
    ['pathname', pathname, { access: 'private', useCache: false }],
    ['url', url, { access: 'private', useCache: false }],
    ['url-cached', url, { access: 'private' }],
  ]
  for (const [how, target, options] of attempts) {
    if (!target) continue
    try {
      const res = await get(target, options)
      if (res) { trace?.push(`${how}: ok`); return res }
      trace?.push(`${how}: empty`)
    } catch (e) {
      trace?.push(`${how}: ${describe(e)}`)
    }
  }

  // A fourth route that does not go through the SDK at all: the store's own
  // HTTP API with the token in the header. The download endpoint has used
  // exactly this as its fallback all along, so it is a path known to work here
  // — and when the SDK's own reads are all failing, an independent one is worth
  // more than a fourth variation on the same call.
  if (url && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      })
      if (r.ok && r.body) {
        trace?.push('token-fetch: ok')
        return { stream: r.body, blob: { contentType: r.headers.get('content-type') } }
      }
      trace?.push(`token-fetch: HTTP ${r.status}`)
    } catch (e) {
      trace?.push(`token-fetch: ${describe(e)}`)
    }
  }
  return null
}

/**
 * An error as a line a person can read, carrying nothing secret.
 *
 * `e.name` is useless here: the store library's own error class extends Error
 * WITHOUT setting `name`, so every one of its errors — access denied, store
 * suspended, blob not found, rate limited — reports itself as plain "Error".
 * Recording the name and dropping the message threw away the entire diagnosis
 * and cost a round trip through a deploy to discover nothing. The message is
 * the diagnosis; it is the message that gets recorded, with any URL or token
 * stripped out of it.
 */
function describe(e) {
  const raw = String(e?.message || e || 'error')
  return raw
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/vercel_blob_[A-Za-z0-9_-]+/g, '[token]')
    .slice(0, 120)
}
