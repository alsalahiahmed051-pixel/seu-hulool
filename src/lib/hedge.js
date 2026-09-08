/**
 * Ask several providers for the same thing without waiting for each in turn.
 *
 * ── Why this exists ─────────────────────────────────────────────────────
 * The chat and the quiz both tried their providers strictly one after another,
 * and that single fact is the whole of «why is it so slow». On this site's
 * keys — Groq and Anthropic unset — the queue is Gemini then OpenRouter, so a
 * Gemini that is failing cost the student the full eighteen-second timeout
 * before OpenRouter was even asked, and the run then walked the free catalogue
 * until the deadline. The student waited out the SUM of the failures, and the
 * page ended on «تعذّر» having spent forty seconds to say nothing.
 *
 * ── Why not simply race them all ────────────────────────────────────────
 * Because on a normal day the first provider answers. Firing every provider at
 * once would spend every free quota on every question and throw all but one
 * reply away — buying speed on the bad day by wasting the good one, which on
 * free tiers eventually creates the outage it was meant to avoid.
 *
 * ── What this does instead: a head start, not a turn ────────────────────
 * The leader runs alone. The next provider starts when the leader has been
 * quiet for `stagger` milliseconds, OR the instant the leader fails — whichever
 * comes first. So a working leader is almost never overtaken and nothing is
 * wasted; a broken one costs `stagger`, not its timeout.
 *
 * The failures are still collected and reported, because «which provider said
 * what» is the only thing that turns «it says تعذّر» into a fixable fact.
 */

/** A flash model answers in 2–4s; a refusal comes back in well under one. */
export const HEDGE_MS = 4000

/**
 * The first provider to produce an acceptable result, others hedged behind it.
 *
 * @param {Array<{name: string, fn: () => Promise<any>}>} providers  tried in order
 * @param {string[]} errors     appended to: one readable line per failure
 * @param {object}   [opts]
 * @param {number}   [opts.stagger]  head start before the next one joins
 * @param {(v:any)=>boolean} [opts.isGood]  what counts as an answer
 * @returns {Promise<{provider: object, value: any} | null>}  null if all failed
 */
export function firstAnswer(providers, errors = [], opts = {}) {
  const { stagger = HEDGE_MS, isGood = (v) => !!v } = opts

  return new Promise(resolve => {
    let next = 0
    let live = 0
    let settled = false
    let timer = null

    const finish = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }

    const launch = () => {
      if (settled) return
      if (next >= providers.length) {
        // Nothing left to start — whoever is still running decides it.
        if (live === 0) finish(null)
        return
      }
      const p = providers[next++]
      live++
      // Arm the next one's head start. A failure below calls launch() sooner;
      // only ever one timer outstanding.
      if (next < providers.length) {
        clearTimeout(timer)
        timer = setTimeout(launch, stagger)
      }
      Promise.resolve()
        .then(() => p.fn())
        .then(value => {
          live--
          if (settled) return
          if (isGood(value)) return finish({ provider: p, value })
          errors.push(`${p.name}: ردٌّ فارغ`)
          launch()
        })
        .catch(err => {
          live--
          if (settled) return
          errors.push(`${p.name}: ${err?.message || err}`)
          launch()
        })
    }

    launch()
  })
}
