import { readMeta, blobEnabled } from '@/lib/files-meta'
import { readText } from '@/lib/file-index'
import { courseMatches, normalizeSearch, shelfOf } from '@/lib/courses'

/**
 * The passages from a course's own files that bear on a question.
 *
 * The assistant used to be handed a LIST OF FILE NAMES and told to rely on
 * «التجميعات والملخصات المرفقة» — with nothing attached. Asked to ground an
 * answer in material it had never seen, a model does the only thing it can and
 * invents one. This finds the actual text and sends it.
 *
 * ── Why keyword scoring and not embeddings ──────────────────────────────
 *
 * Embeddings would need a vector store, a model call per chunk on upload, and
 * a second one per question — real cost and real latency for a library that
 * today holds a handful of files per course. Scoring chunks by shared terms is
 * enough at this size, it is instant, it costs nothing, and it reuses
 * `normalizeSearch`, which already folds the alef/ya/ta-marbuta variants that
 * Arabic students type interchangeably. When a course grows past a few hundred
 * pages this is the piece to replace — and it can be replaced behind this same
 * function without touching either route.
 */

/** Roughly a page. Small enough to rank meaningfully, big enough to be self-contained. */
const CHUNK = 900
const OVERLAP = 150

/** Words too common to tell one passage from another. */
const STOP = new Set([
  'من', 'في', 'على', 'عن', 'الى', 'إلى', 'هو', 'هي', 'ما', 'هذا', 'هذه', 'التي', 'الذي',
  'مع', 'كل', 'او', 'أو', 'ثم', 'قد', 'لا', 'ان', 'أن', 'إن', 'كان', 'يكون', 'بين',
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'you', 'what',
])

function terms(s) {
  return String(s || '')
    .split(/[^\p{L}\p{N}]+/u)
    .map(w => normalizeSearch(w))
    .filter(w => w.length > 2 && !STOP.has(w))
}

function chunksOf(text) {
  const out = []
  for (let i = 0; i < text.length; i += CHUNK - OVERLAP) {
    const piece = text.slice(i, i + CHUNK).trim()
    if (piece.length > 80) out.push(piece)
    if (out.length >= 400) break
  }
  return out
}

/**
 * @returns {Promise<{context: string, sources: string[], hasFiles: boolean, indexed: number}>}
 *   `context` is the prompt block, '' when there is nothing to ground on.
 *   `hasFiles` distinguishes "no files uploaded" from "files uploaded but none
 *   readable" — two different things to tell a student.
 */
export async function contextFor(course, query, { maxChars = 6000, maxFiles = 12 } = {}) {
  const empty = { context: '', sources: [], hasFiles: false, indexed: 0 }
  if (!blobEnabled() || !course) return empty

  let all = []
  try { all = await readMeta() } catch { return empty }

  const mine = all.filter(f => courseMatches(f.courseName, course)).slice(0, maxFiles)
  if (mine.length === 0) return empty

  const texts = await Promise.all(mine.map(async f => ({ file: f, text: await readText(f.id) })))
  const usable = texts.filter(t => t.text && t.text.length > 100)
  if (usable.length === 0) return { ...empty, hasFiles: true }

  const q = new Set(terms(query))
  const scored = []
  for (const { file, text } of usable) {
    for (const piece of chunksOf(text)) {
      const words = terms(piece)
      let hits = 0
      const seen = new Set()
      for (const w of words) {
        if (q.has(w) && !seen.has(w)) { hits++; seen.add(w) }
      }
      // Length-normalised, so a long chunk does not win on volume alone.
      scored.push({ file, piece, score: hits / Math.sqrt(words.length || 1) })
    }
  }

  // With no overlap at all — a question in words the files never use — fall
  // back to the openings, which is where a summary states what it covers.
  const ranked = scored.some(s => s.score > 0)
    ? scored.sort((a, b) => b.score - a.score)
    : scored.slice(0, 4)

  const parts = []
  const sources = []
  let budget = maxChars
  for (const { file, piece } of ranked) {
    if (budget <= 0) break
    const label = `${file.name}${file.category ? ` — ${shelfLabel(file.category)}` : ''}`
    const body = piece.slice(0, budget)
    parts.push(`[من ملف: ${label}]\n${body}`)
    if (!sources.includes(file.name)) sources.push(file.name)
    budget -= body.length + label.length + 16
  }

  return {
    context: parts.join('\n\n---\n\n'),
    sources,
    hasFiles: true,
    indexed: usable.length,
  }
}

const SHELF_AR = {
  slides: 'السلايدات والكتب',
  summary: 'الملخصات',
  collections: 'التجميعات',
  solved: 'واجبات وحلول',
  plans: 'الخطط الدراسية',
  curriculum: 'المقررات الدراسية',
  programs: 'البرامج والتخصصات',
}
const shelfLabel = (cat) => SHELF_AR[shelfOf(cat)] || ''
