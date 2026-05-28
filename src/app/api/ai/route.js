import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

export async function POST(request) {
  const { subject, messages } = await request.json()

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('placeholder')) {
    return Response.json({
      text: `مرحباً! أنا مساعد ${subject} الذكي 🤖\n\nالمساعد الذكي يحتاج إلى مفتاح Anthropic API ليعمل.\n\nللتفعيل: أضف ANTHROPIC_API_KEY في ملف .env.local\nاحصل على المفتاح من: console.anthropic.com`,
    })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: `أنت مساعد أكاديمي متخصص في مادة "${subject}" بالجامعة السعودية الإلكترونية. أجب بشكل واضح ومفيد باللغة العربية. قدم نصائح عملية. استخدم التنسيق الجيد عند الحاجة.`,
      messages,
    })
    return Response.json({ text: response.content[0]?.text })
  } catch (err) {
    return Response.json({ error: 'تعذّر الاتصال بالمساعد الذكي: ' + err.message }, { status: 500 })
  }
}
