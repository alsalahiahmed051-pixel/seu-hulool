import { aiPerMinuteLimit, callerKey } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const GROQ_KEY = process.env.GROQ_API_KEY

/**
 * Speech to text for the browsers that cannot do it themselves.
 *
 * The assistant's microphone used to be `SpeechRecognition` and nothing else,
 * which Safari does not implement — so on an iPhone the button could only
 * apologise. That is most of the students. This is the other half: the browser
 * records audio with MediaRecorder, posts it here, and Groq's Whisper returns
 * the Arabic text.
 *
 * Groq is already the assistant's first free provider, so this needs no key the
 * site does not have.
 */

// A voice note for a question is seconds long. This is generous for that and
// still far under Groq's own 25MB ceiling.
const MAX_BYTES = 8 * 1024 * 1024

export async function POST(request) {
  // Same budget as a chat message: transcription is the front half of asking
  // one, and an unmetered upload endpoint is an invitation.
  const rl = await aiPerMinuteLimit.limit(callerKey(request))
  if (!rl.success) {
    return Response.json({ error: 'محاولات كثيرة — انتظر قليلاً' }, { status: 429 })
  }

  if (!GROQ_KEY || GROQ_KEY.includes('placeholder')) {
    return Response.json({ error: 'التفريغ الصوتي غير مفعّل على هذا الموقع' }, { status: 503 })
  }

  let form
  try { form = await request.formData() }
  catch { return Response.json({ error: 'تعذّر قراءة التسجيل' }, { status: 400 }) }

  const audio = form.get('audio')
  if (!audio || typeof audio.arrayBuffer !== 'function') {
    return Response.json({ error: 'لا يوجد تسجيل' }, { status: 400 })
  }
  if (audio.size > MAX_BYTES) {
    return Response.json({ error: 'التسجيل طويل جداً — سجّل مقطعاً أقصر' }, { status: 413 })
  }
  // An empty blob is what a mic that never actually opened produces; saying so
  // is more useful than a transcription of silence.
  if (!audio.size) {
    return Response.json({ error: 'التسجيل فارغ — تأكد من إذن الميكروفون' }, { status: 400 })
  }

  const out = new FormData()
  // Groq keys the decoder off the filename extension, so it has to look like
  // the container MediaRecorder actually produced.
  const type = String(audio.type || '')
  const ext = type.includes('mp4') || type.includes('m4a') ? 'm4a'
    : type.includes('ogg') ? 'ogg'
    : type.includes('wav') ? 'wav'
    : 'webm'
  out.append('file', audio, `voice.${ext}`)
  out.append('model', 'whisper-large-v3-turbo')
  // The students write and speak Arabic; naming it keeps Whisper from
  // "transcribing" Arabic speech into transliterated English.
  out.append('language', 'ar')
  out.append('response_format', 'json')

  try {
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_KEY}` },
      body: out,
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return Response.json({ error: 'تعذّر تحويل الصوت إلى نص — حاول مجدداً' }, { status: 502 })
    }
    const text = String(data.text || '').trim()
    if (!text) return Response.json({ error: 'لم أسمع كلاماً واضحاً — حاول مرة أخرى' }, { status: 422 })
    return Response.json({ text })
  } catch {
    return Response.json({ error: 'تعذّر الاتصال بخدمة التفريغ' }, { status: 502 })
  }
}
