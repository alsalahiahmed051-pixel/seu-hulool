/**
 * Turning an uploaded file into text the assistant can actually answer from.
 *
 * Until now the assistant was handed a LIST OF FILE NAMES and told to «اعتمد
 * على التجميعات والملخصات المرفقة». Nothing was attached — so the model was
 * instructed to rely on material it had never seen, and it did the only thing
 * it could: invent something plausible. That is the "يجاوبني عشوائي" the owner
 * reported, and no amount of prompt wording fixes it. The fix is to send the
 * text.
 *
 * ── Two things make Arabic PDFs harder than they look ───────────────────
 *
 * 1. VISUAL ORDER. Many Arabic PDFs lay glyphs out right-to-left and write
 *    them into the content stream left-to-right, so extraction returns every
 *    word backwards: «إدارة» comes out «ةرادإ». Measured across the twelve
 *    curriculum PDFs the owner sent, this was true of ALL of them — zero
 *    readable words before the repair, and readable text after. Feeding the
 *    reversed form to a model is worse than sending nothing, because the model
 *    answers confidently about noise.
 *
 * 2. SUBSETTED FONTS WITH NO ToUnicode MAP. Those glyphs extract as private-use
 *    or control characters — text that looks like text and means nothing. No
 *    extractor can recover it. It can only be measured and refused.
 *
 * So this module does not just extract: it repairs what is repairable, and
 * REFUSES what is not, so a file that cannot be read is reported to the owner
 * instead of quietly poisoning every answer about that course.
 */

const ARABIC = '؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿'
const ARABIC_RUN = new RegExp(`[${ARABIC}][${ARABIC}\\sً-ْ]*`, 'g')

/**
 * Characters that carry no meaning: C0/C1 controls, the private use area, and
 * the replacement char. What a subsetted font leaves behind.
 */
const JUNK = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uE000-\uF8FF\uFFFD]/g

const reverse = (s) => [...s].reverse().join('')

/** Words common enough in SEU material to tell reading order from noise. */
const PROBE = [
  'المقرر', 'الساعات', 'الدراسية', 'الجامعة', 'المستوى', 'الأول', 'الثاني',
  'إدارة', 'خطة', 'بكالوريوس', 'الفصل', 'السؤال', 'الإجابة', 'الوحدة',
]

/**
 * Is this text stored backwards?
 *
 * Decided by evidence, not assumption: count how many known words appear as
 * written versus reversed. Only a clear win flips the text, so a document that
 * was already in logical order is never mangled by "fixing" it.
 */
export function looksReversed(text) {
  let forward = 0
  let backward = 0
  for (const w of PROBE) {
    if (text.includes(w)) forward++
    if (text.includes(reverse(w))) backward++
  }
  return backward > forward
}

/** Put visually-ordered Arabic back into reading order, run by run. */
export function fixArabicOrder(text) {
  return text.replace(ARABIC_RUN, reverse)
}

/**
 * How much of this text is real.
 *
 * Returns the share of characters that are letters, digits or ordinary
 * spacing. A scanned page with no text layer scores near zero; a page of
 * mojibake scores low; a real page scores high.
 */
export function readableRatio(text) {
  if (!text) return 0
  const total = text.length
  const junk = (text.match(JUNK) || []).length
  const meaningful = (text.match(new RegExp(`[${ARABIC}A-Za-z0-9]`, 'g')) || []).length
  if (!total) return 0
  // Junk counts against twice: its presence is evidence the rest is suspect.
  return Math.max(0, (meaningful - junk) / total)
}

/** Collapse the whitespace a PDF's line boxes leave behind. */
export function tidy(text) {
  return String(text || '')
    .replace(JUNK, ' ')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Below this share of meaningful characters, the text is not worth sending. */
export const MIN_READABLE = 0.35
/** Below this many characters there is nothing to ground an answer in. */
export const MIN_CHARS = 200

/**
 * Formats there is no point attempting, each with the reason why.
 *
 * Everything else is attempted: PDF, the three OOXML formats, the pre-2007
 * binary ones (best effort — see `legacyOfficeText`), HTML, RTF and plain text.
 * The owner's library is not a pile of PDFs; it is whatever a lecturer happened
 * to send, and a file the indexer refuses unread is a file the assistant is
 * blind to with nothing anywhere saying why.
 */
const HOPELESS = {
  image: 'صورة — لا نصّ فيها تُقرأ منه (تحتاج OCR)',
  archive: 'ملف مضغوط — افتحه وارفع ما بداخله',
  media: 'ملف صوت أو فيديو — لا نصّ فيه',
}

/**
 * Invisible characters a filename picks up on its way here.
 *
 * A name mixing Arabic and Latin — «ملخص مهارات الاتصال.pdf» — comes out of the
 * file picker wrapped in bidi ISOLATES (U+2066‥U+2069), so the string does not
 * end at «.pdf», it ends at an invisible U+2069. Every extension test anchored
 * with `$` therefore failed, and thirty real uploads were reported as «نوع
 * الملف غير مدعوم» — a name the eye reads as a PDF and the regex does not.
 */
// Written as escapes on purpose: these characters are invisible, so spelled
// out literally they would look like an empty character class.
const BIDI = /[‎‏؜⁦-⁩‪-‮﻿]/g

/** A filename with the invisible marks taken out. */
export const cleanName = (name) => String(name || '').replace(BIDI, '').trim()

/**
 * What this file ACTUALLY is, decided by its bytes.
 *
 * Never by its name. Of the owner's first thirty-three uploads, most carried no
 * extension at all — «MATH001», «Acct101-Final-1st-2024-25» — and the rest
 * carried one hidden behind a bidi isolate. Not one of them was readable by
 * name, and all of them are ordinary PDFs. A filename is a label a person
 * typed; the first bytes of a file are what it is.
 *
 * The extension is consulted only as a tiebreaker for plain-text formats, which
 * have no signature to find.
 */
export function sniffKind(buffer, name = '') {
  // Not `Buffer.from(buffer)`: that copies, and these files run to tens of
  // megabytes inside a function with a fixed memory budget.
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const head = buf.toString('latin1', 0, 1024)

  // Some PDFs carry junk before the header; the spec allows it and readers
  // tolerate it, so look for the marker rather than requiring it at offset 0.
  if (head.includes('%PDF-')) return 'pdf'

  // OOXML is a ZIP. Its entry NAMES are stored uncompressed in the local file
  // headers, so which of the three it is can be read straight out of the bytes
  // — no need to inflate the whole archive twice.
  if (buf[0] === 0x50 && buf[1] === 0x4B) {
    // Searched as BYTES, not by decoding the archive into a string first: a
    // forty-megabyte deck would otherwise allocate a forty-megabyte string
    // just to answer «is this a pptx».
    const has = (s) => buf.indexOf(Buffer.from(s, 'latin1')) !== -1
    if (has('ppt/slides/')) return 'pptx'
    if (has('word/document.xml')) return 'docx'
    if (has('xl/workbook.xml')) return 'xlsx'
    return 'archive'
  }

  // OLE compound file: every pre-2007 Office document, and nothing else here.
  if (buf.length > 8 && buf.readUInt32BE(0) === 0xd0cf11e0 && buf.readUInt32BE(4) === 0xa1b11ae1) {
    return 'legacy'
  }

  if (head.startsWith('{\\rtf')) return 'rtf'

  const isImage = buf[0] === 0x89 && head.startsWith('\x89PNG')
    || (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)     // JPEG
    || head.startsWith('GIF8')
    || (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP')
    || head.startsWith('BM')                                        // BMP
    || (head.slice(4, 8) === 'ftyp' && /heic|heif|mif1/.test(head.slice(8, 20)))
  if (isImage) return 'image'

  const isMedia = head.slice(4, 8) === 'ftyp'                       // mp4/mov
    || head.startsWith('ID3') || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) // mp3
    || head.startsWith('OggS') || (head.startsWith('RIFF') && head.slice(8, 12) === 'WAVE')
    || head.startsWith('\x1aE\xdf\xa3')                             // matroska
  if (isMedia) return 'media'

  if (/^\s*(<!doctype html|<html)/i.test(head)) return 'html'

  // No signature left to find: it is text of some sort, and only now does the
  // name get a say — and only over which flavour of text.
  const clean = cleanName(name)
  if (/\.html?$/i.test(clean)) return 'html'
  if (/\.rtf$/i.test(clean)) return 'rtf'
  return 'text'
}

/** Decode the five XML entities. Enough for text content we never re-emit. */
const unentity = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&amp;/g, '&')

/** Every `<tag>…</tag>` run's text content, in document order. */
const tagText = (xml, tag) =>
  (xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g')) || [])
    .map(m => unentity(m.replace(/<[^>]+>/g, '')))

/** Unzip an OOXML package once, decoded lazily part by part. */
async function openOoxml(buffer) {
  const { unzipSync } = await import('fflate')
  const zip = unzipSync(new Uint8Array(buffer))
  const dec = new TextDecoder('utf-8')
  return {
    names: Object.keys(zip),
    part: (name) => (zip[name] ? dec.decode(zip[name]) : ''),
  }
}

/**
 * The text of a Word document.
 *
 * `.docx` is the same shape as `.pptx`: a ZIP of XML. The body lives in
 * `word/document.xml`, and paragraph structure is worth keeping — a plan or a
 * question list flattened into one line retrieves badly, because a chunk then
 * spans three unrelated questions.
 *
 * Footnotes and endnotes are appended: in university material they routinely
 * carry the reference the question is actually about.
 */
async function docxText(buffer) {
  const { names, part } = await openOoxml(buffer)
  const body = part('word/document.xml')
  if (!body) return ''

  // Paragraph by paragraph, so line structure survives. A table cell ends up
  // as its own line, which reads correctly in a plan table.
  const paragraphs = (xml) => xml.split(/<\/w:p>/)
    .map(p => tagText(
      // Tabs and manual breaks are structure, not markup, and are the only
      // thing separating a course code from its name in many of these tables.
      p.replace(/<w:tab\s*\/>/g, ' \t ').replace(/<w:br\s*\/>/g, '\n'),
      'w:t',
    ).join(''))
    .map(s => s.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)

  const out = paragraphs(body)
  for (const n of ['word/footnotes.xml', 'word/endnotes.xml']) {
    if (!names.includes(n)) continue
    const extra = paragraphs(part(n)).filter(s => s.length > 1)
    if (extra.length) out.push('', '[الحواشي]', ...extra)
  }
  return out.join('\n')
}

/**
 * The text of an Excel workbook, sheet by sheet.
 *
 * Study plans and grade sheets arrive as spreadsheets more often than as
 * prose. Cells are joined with « | » so a row stays one retrievable line: a
 * row is the unit of meaning in a plan table, and splitting it across chunks
 * would separate a course code from its credit hours.
 *
 * Most cells hold an INDEX into `xl/sharedStrings.xml`, not the words
 * themselves — reading the sheets alone returns a grid of integers.
 */
async function xlsxText(buffer) {
  const { names, part } = await openOoxml(buffer)
  // <si> is one shared string; it may be split across several <t> runs when
  // part of it is styled differently, so the runs of one entry are joined.
  const shared = (part('xl/sharedStrings.xml').match(/<si>[\s\S]*?<\/si>/g) || [])
    .map(si => tagText(si, 't').join(''))

  // The sheet's own name is worth carrying: «المستوى الثالث» over a table of
  // codes tells the model what it is looking at.
  const sheetNames = [...part('xl/workbook.xml').matchAll(/<sheet[^>]*name="([^"]*)"/g)]
    .map(m => unentity(m[1]))

  const sheets = names.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]))

  const out = []
  sheets.forEach((name, i) => {
    const rows = (part(name).match(/<row[\s\S]*?<\/row>/g) || []).map(row => {
      const cells = (row.match(/<c[\s\S]*?(?:\/>|<\/c>)/g) || []).map(c => {
        const v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1]
        if (/t="s"/.test(c)) return shared[Number(v)] ?? ''
        if (/t="inlineStr"/.test(c)) return tagText(c, 't').join('')
        return v ? unentity(v) : ''
      })
      return cells.filter(x => String(x).trim()).join(' | ')
    }).filter(Boolean)
    if (!rows.length) return
    out.push(`— ورقة: ${sheetNames[i] || i + 1} —`, ...rows)
  })
  return out.join('\n')
}

/** A page saved from Blackboard or the web: drop the markup, keep the words. */
function htmlText(raw) {
  return unentity(
    raw
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|tr|li|h[1-6]|br)\s*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
}

/**
 * Rich text: strip the control words, keep the characters.
 *
 * Arabic in RTF is escaped as `\uNNNN` decimal code points followed by a
 * fallback character, so the fallback has to be dropped or every letter comes
 * out doubled.
 */
function rtfText(raw) {
  return raw
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\s?\??/g, (_, d) => {
      const n = Number(d)
      return String.fromCharCode(n < 0 ? n + 65536 : n)
    })
    .replace(/\{\\\*[\s\S]*?\}/g, ' ')      // ignorable destinations
    .replace(/\\par[d]?\b/g, '\n')
    .replace(/\\[a-z]+-?\d*\s?/gi, ' ')     // every other control word
    .replace(/[{}]/g, ' ')
}

/**
 * Legacy binary Office (.doc / .ppt / .xls), best effort.
 *
 * These pre-2007 formats are OLE compound files: a filesystem-in-a-file with
 * its own allocation tables, and parsing one properly is a library, not a
 * function. But the text inside is stored as plain UTF-16LE runs, so the words
 * can be recovered even when the structure cannot — and recovered words are
 * exactly what the assistant needs; the formatting is irrelevant to it.
 *
 * This is deliberately a salvage, not a parser. It can return interleaved junk,
 * which is precisely why the readability gate downstream exists: a salvage that
 * comes out unreadable is REFUSED with a reason, not indexed. The alternative
 * on the table was refusing the file unread, which helps nobody holding a .doc.
 */
function legacyOfficeText(buffer) {
  const buf = Buffer.from(buffer)
  const runs = []
  let run = ''
  // UTF-16LE: a readable character is a low byte with a zero (or Arabic-range)
  // high byte. Walking pairs directly is faster and far more predictable than
  // decoding the whole file and hunting through the result.
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const code = buf[i] | (buf[i + 1] << 8)
    const ch = String.fromCharCode(code)
    const readable = /[ؠ-ي٠-٩a-zA-Z0-9 ,.:;()\-\/%،؛؟]/.test(ch)
    if (readable) {
      run += ch
    } else {
      if (run.trim().length >= 6) runs.push(run.trim())
      run = ''
    }
  }
  if (run.trim().length >= 6) runs.push(run.trim())
  return runs.join('\n')
}

/**
 * The text of a PowerPoint deck, slide by slide.
 *
 * A .pptx is a ZIP of XML parts. The words live in `<a:t>` runs inside
 * `ppt/slides/slideN.xml`; the lecturer's own explanation — often the most
 * useful thing in the file — lives beside it in `ppt/notesSlides/notesSlideN.xml`.
 * Both are taken, and each slide is labelled, so a retrieved passage can say
 * which slide it came from instead of floating free.
 *
 * Slides are ordered NUMERICALLY, not by the alphabetical order the archive
 * lists them in: `slide10` sorts before `slide2` as a string, which would hand
 * the model the deck shuffled.
 */
async function pptxText(buffer) {
  // Imported lazily, like the PDF parser: a deployment that never sees a deck
  // should not pay to load it. `require` does not exist in this module — it is
  // ESM — so this must be a dynamic import, not a require.
  const { unzipSync } = await import('fflate')
  const zip = unzipSync(new Uint8Array(buffer))
  const dec = new TextDecoder('utf-8')

  const numberIn = (name) => {
    const m = name.match(/(\d+)\.xml$/)
    return m ? Number(m[1]) : 0
  }
  const pick = (re) => Object.keys(zip).filter(n => re.test(n)).sort((a, b) => numberIn(a) - numberIn(b))

  const slides = pick(/^ppt\/slides\/slide\d+\.xml$/)
  if (slides.length === 0) return ''
  const notes = new Map(
    pick(/^ppt\/notesSlides\/notesSlide\d+\.xml$/).map(n => [numberIn(n), n])
  )

  // `<a:t>` holds every visible run. Decoding the five XML entities by hand is
  // enough here: this is text content, not markup we re-emit anywhere.
  const runsOf = (xml) => (xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [])
    .map(m => m.replace(/<[^>]+>/g, ''))
    .map(t => t
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&'))
    .filter(t => t.trim())

  const out = []
  slides.forEach((name, i) => {
    const n = numberIn(name)
    const body = runsOf(dec.decode(zip[name])).join('\n').trim()
    // A slide of nothing but a picture contributes a heading and no text; skip
    // it rather than pad the context with empty labels.
    if (!body) return
    let block = `— شريحة ${n || i + 1} —\n${body}`
    const noteName = notes.get(n)
    if (noteName) {
      const noteBody = runsOf(dec.decode(zip[noteName])).join(' ').trim()
      // python-pptx and PowerPoint both put the slide number in the notes
      // part; it is not something the lecturer wrote.
      const cleaned = noteBody.replace(/^\s*\d+\s*/, '').trim()
      if (cleaned) block += `\n[ملاحظات المحاضر] ${cleaned}`
    }
    out.push(block)
  })
  return out.join('\n\n')
}

/**
 * Extract usable text from a file's bytes.
 *
 * Always resolves — never throws — because this runs over a whole library and
 * one unreadable file must not stop the rest. The refusal reason is part of
 * the result so the panel can tell the owner WHY a file is not searchable
 * rather than leaving it silently absent.
 *
 * @returns {Promise<{ok: boolean, text: string, chars: number, ratio: number, reason: string}>}
 */
export async function extractText(buffer, name = '') {
  const fail = (reason) => ({ ok: false, text: '', chars: 0, ratio: 0, reason })

  const kind = sniffKind(buffer, name)
  if (HOPELESS[kind]) return fail(HOPELESS[kind])

  let raw = ''
  try {
    if (kind === 'pdf') {
      // Before the parser loads: pdf.js reaches for browser globals on some
      // documents, and a missing one kills the whole file with «DOMMatrix is
      // not defined» rather than degrading. See pdf-globals.
      const { installPdfGlobals } = await import('@/lib/pdf-globals')
      installPdfGlobals()
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      try {
        const res = await parser.getText()
        raw = res?.text || ''
      } finally {
        await parser.destroy().catch(() => {})
      }
    } else if (kind === 'pptx') {
      raw = await pptxText(buffer)
      if (!raw.trim()) return fail('لا يوجد نص في الشرائح — الأرجح أنها صور')
    } else if (kind === 'docx') {
      raw = await docxText(buffer)
      if (!raw.trim()) return fail('لا يوجد نص في المستند — الأرجح أنه صور داخل ملف Word')
    } else if (kind === 'xlsx') {
      raw = await xlsxText(buffer)
      if (!raw.trim()) return fail('الجدول فارغ من النصّ')
    } else if (kind === 'legacy') {
      raw = legacyOfficeText(buffer)
      if (!raw.trim()) {
        return fail('صيغة Office القديمة لم يُستخرج منها نص — احفظ الملف بصيغة حديثة (docx/pptx/xlsx)')
      }
    } else if (kind === 'html') {
      raw = htmlText(Buffer.from(buffer).toString('utf8'))
    } else if (kind === 'rtf') {
      raw = rtfText(Buffer.from(buffer).toString('latin1'))
    } else {
      raw = Buffer.from(buffer).toString('utf8')
    }
  } catch (err) {
    return fail(`تعذّرت القراءة: ${String(err?.message || err).slice(0, 120)}`)
  }

  if (!raw.trim()) {
    // Almost always a scan: pages of images with no text layer at all.
    return fail('لا يوجد نص في الملف — الأرجح أنه صور ممسوحة ضوئياً')
  }

  // NFKC first, and this is not cosmetic.
  //
  // Some PDFs store Arabic as PRESENTATION FORMS (U+FExx) — the contextual
  // shapes a renderer picks, not letters. «الظرية» arrives as «ﺔﻳﺮﻈﻨﻟا». Those
  // are still Arabic characters, so a naive quality score rates such a file
  // HIGHEST while it is in fact the least readable, and the order probe below
  // cannot recognise a single word in it. Measured on the owner's own files,
  // the two documents that scored best (0.79, 0.83) were exactly these — the
  // gate was backwards for them. NFKC folds those shapes to base letters, and
  // everything downstream then works on real Arabic.
  const normalised = raw.normalize('NFKC')
  const ordered = looksReversed(normalised) ? fixArabicOrder(normalised) : normalised
  const text = tidy(ordered)
  // Scored on the text BEFORE tidy(), which replaces junk with spaces — after
  // it, there is no junk left to count and every file looks clean.
  const ratio = readableRatio(ordered)

  if (text.length < MIN_CHARS) return { ...fail('النص المستخرج قصير جداً'), chars: text.length, ratio }
  if (ratio < MIN_READABLE) {
    // Say what would actually fix it, and that differs by format: a PDF with no
    // ToUnicode map is unrecoverable by anyone, while a salvaged .doc just
    // needs re-saving. «الخطوط لا تحمل ترميزاً» on a .doc sends the owner
    // hunting for a problem that is not there.
    const why = kind === 'legacy'
      ? 'صيغة Office القديمة لم تُقرأ بوضوح — افتح الملف واحفظه بصيغة حديثة (docx/pptx/xlsx) وأعد رفعه'
      : 'النص المستخرج غير مقروء — خطوط الملف لا تحمل ترميزاً'
    return { ...fail(why), chars: text.length, ratio }
  }

  return { ok: true, text, chars: text.length, ratio, reason: '' }
}
