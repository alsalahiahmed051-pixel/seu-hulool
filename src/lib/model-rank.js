/**
 * Which free model to try first.
 *
 * Both AI routes used to sort OpenRouter's free catalogue by `context_length`
 * — the one published property that says nothing at all about whether a model
 * can answer a study question in Arabic. Whichever experimental model happened
 * to advertise the biggest window went first, so the quality of a student's
 * answer was a lottery re-drawn on every question. That is the "يخبص في
 * الإجابات" the owner reported.
 *
 * This ranks by capability instead: the open families that actually hold up in
 * Arabic, best first. Nothing is excluded — a specialist still answers better
 * than nothing when it is all OpenRouter is serving that day — so the
 * assistant keeps working even if none of these are available.
 *
 * Shared by the chat and quiz routes on purpose: two copies of a ranking drift,
 * and then the same question gets a good answer in one place and a poor one in
 * the other.
 */

/** Families known to handle Arabic explanation well, best first. */
const MODEL_RANK = [
  [/deepseek.*(v3|r1|chat)/i, 100],
  [/llama-?3\.[13].*(405|70)b/i, 95],
  [/qwen.*(3|2\.5).*(72|110|235)b/i, 92],
  [/glm-4/i, 85],
  [/mistral-large|mixtral-8x22/i, 84],
  [/gemma-?3.*27b/i, 80],
  [/llama-?3\.[13]/i, 70],
  [/qwen/i, 65],
  [/gemma/i, 60],
  [/mistral|mixtral/i, 58],
]

/**
 * Models to keep away from the front of the queue.
 *
 * A code-completion or OCR model asked to explain a statistics concept in
 * Arabic produces exactly the kind of answer this change exists to stop, so it
 * must never be tried first — but it is demoted, not removed.
 */
const MODEL_PENALTY = [
  [/guard|moderation|embed|rerank/i, 90],
  [/coder|code-|-code/i, 40],
  [/\b(1|2|3|4)b\b/i, 30],
  [/vision|ocr|image/i, 25],
]

/**
 * Higher is better. Context length breaks ties and never sets the order.
 *
 * The tiebreak is logarithmic, not raw: a plain `min(ctx, 999)` clamp made
 * every model above about a thousand tokens score identically, so between two
 * equals the larger window counted for nothing. On a log scale 128k still
 * beats 8k, and the whole tiebreak range stays under one capability step, so
 * a bigger window can never promote a weaker model.
 */
export function modelScore(m) {
  const id = String(m?.id || '')
  let score = 0
  for (const [re, pts] of MODEL_RANK) { if (re.test(id)) { score = pts; break } }
  for (const [re, pts] of MODEL_PENALTY) { if (re.test(id)) score -= pts }
  const ctx = Math.max(0, Number(m?.context_length) || 0)
  const tiebreak = Math.min(999, Math.round(Math.log2(ctx + 1) * 40))
  return score * 1000 + tiebreak
}
