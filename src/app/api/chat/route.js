import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { chatPerMinuteLimit, chatDailyLimit } from '@/lib/rate-limit'
import { scopeRules } from '@/lib/ai-scope'

export const runtime = 'nodejs'
export const maxDuration = 60 // seconds

// Pricing per 1M tokens (Claude Sonnet 4 — update if model changes)
const PRICE = { input: 3.0, output: 15.0 } // USD per 1M tokens

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * POST /api/chat
 * Body: { subject: string, messages: [{ role, content }] }
 *
 * - Validates auth
 * - Enforces rate limits
 * - Logs every conversation to DB for monitoring
 * - Returns Server-Sent Events (streaming)
 */
export async function POST(request) {
  // 1) Authenticate
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
  }

  // 2) Parse + validate body
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'صيغة الطلب غير صحيحة' }, { status: 400 })
  }

  const { subject, messages, courseId } = body

  if (!subject || typeof subject !== 'string' || subject.length > 200) {
    return Response.json({ error: 'مادة غير صحيحة' }, { status: 400 })
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
    return Response.json({ error: 'الرسائل غير صحيحة' }, { status: 400 })
  }
  for (const m of messages) {
    if (!['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 4000) {
      return Response.json({ error: 'محتوى رسالة غير صحيح' }, { status: 400 })
    }
  }

  // 3) Rate limit checks
  const minuteCheck = await chatPerMinuteLimit.limit(user.id)
  if (!minuteCheck.success) {
    return Response.json(
      {
        error: 'الرجاء الانتظار قليلاً قبل إرسال رسالة أخرى',
        retry_after: Math.ceil((minuteCheck.reset - Date.now()) / 1000),
      },
      { status: 429 }
    )
  }

  const dayCheck = await chatDailyLimit.limit(user.id)
  if (!dayCheck.success) {
    return Response.json(
      {
        error: 'لقد استنفدت رصيدك اليومي من رسائل المساعد الذكي',
        remaining: dayCheck.remaining,
        reset_at: new Date(dayCheck.reset).toISOString(),
      },
      { status: 429 }
    )
  }

  // 4) Build system prompt
  const systemPrompt = `${scopeRules(subject)}
- أجب بشكل واضح ومفيد باللغة العربية.
- قدّم نصائح عملية ومحددة.
- استخدم القوائم والعناوين عند الحاجة لتنظيم الإجابة.
- لا تخمن معلومات عن مناهج محددة لست متأكداً منها — اقترح على الطالب الرجوع لمدرس المادة بدلاً من ذلك.
- ركّز على أساليب المذاكرة، فهم المفاهيم، التحضير للاختبارات، وحل المسائل.`

  // 5) Save user message immediately
  const lastUserMsg = messages[messages.length - 1]
  if (lastUserMsg.role === 'user') {
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      course_id: courseId || null,
      role: 'user',
      content: lastUserMsg.content,
    })
  }

  // 6) Stream from Anthropic
  const encoder = new TextEncoder()
  let assistantText = ''
  let inputTokens = 0
  let outputTokens = 0

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        })

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            assistantText += event.delta.text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
          } else if (event.type === 'message_delta' && event.usage) {
            outputTokens = event.usage.output_tokens || 0
          } else if (event.type === 'message_start' && event.message?.usage) {
            inputTokens = event.message.usage.input_tokens || 0
          }
        }

        // Calculate cost
        const cost = (inputTokens / 1_000_000) * PRICE.input + (outputTokens / 1_000_000) * PRICE.output

        // Persist assistant reply
        await supabase.from('chat_messages').insert({
          user_id: user.id,
          course_id: courseId || null,
          role: 'assistant',
          content: assistantText,
          tokens_used: inputTokens + outputTokens,
          cost_usd: cost.toFixed(6),
        })

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, remaining: dayCheck.remaining - 1 })}\n\n`)
        )
        controller.close()
      } catch (err) {
        console.error('[chat API]', err)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'تعذّر الاتصال بالمساعد الذكي' })}\n\n`)
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  })
}
