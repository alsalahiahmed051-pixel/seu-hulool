/**
 * Pointing the PDF reader at its own engine.
 *
 * pdf.js does its parsing in a worker, loaded at runtime from a separate
 * `pdf.worker.mjs` — an asset that nothing imports statically. A bundler
 * therefore never sees it: it rewrites the package into `.next/server/chunks/`
 * and leaves the worker behind, so the reader asks for a file that is not there
 * and every PDF dies with
 *
 *   Setting up fake worker failed: "Cannot find module
 *    '/var/task/.next/server/chunks/pdf.worker.mjs'"
 *
 * while the same code reads the same file perfectly in a local test, because
 * locally the package is never bundled and the worker sits beside it.
 *
 * That asymmetry is the whole trap: the tests could not have caught this. So
 * the fix is in three places that each cover the others —
 *
 *   • next.config keeps `pdf-parse` OUT of the server bundle, so the package
 *     stays a real package on disk with its files beside it;
 *   • next.config also names the worker explicitly in `outputFileTracingIncludes`,
 *     because tracing follows imports and this file is not imported;
 *   • and this module resolves it at runtime and CHECKS THAT IT EXISTS before
 *     handing it over, so a path that is merely plausible is never used.
 *
 * If none of the candidates is really there, the library's own default stands
 * and the failure is the one it would have had anyway — never a worse one
 * caused by pointing it at nothing.
 */

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

/**
 * Where the worker may be, best first.
 *
 * `pdfjs-dist` publishes no `exports` map, so its build directory is reachable
 * by subpath. `pdf-parse` does publish one, and it does NOT expose the worker
 * asset — the subpath is a resolution error, not a missing file — so that one
 * is reached from the package's own directory instead.
 */
function candidates(require) {
  const out = []

  const direct = (spec) => {
    try { out.push(require.resolve(spec)) } catch { /* not this way */ }
  }
  direct('pdfjs-dist/legacy/build/pdf.worker.mjs')
  direct('pdfjs-dist/build/pdf.worker.mjs')

  // `pdf-parse/dist/worker/pdf.worker.mjs` is blocked by the package's exports
  // map, so walk to it from an entry point that is not.
  try {
    const entry = require.resolve('pdf-parse')          // …/dist/pdf-parse/cjs/index.cjs
    const root = path.resolve(path.dirname(entry), '..', '..', '..')
    out.push(path.join(root, 'dist', 'worker', 'pdf.worker.mjs'))
  } catch { /* not this way either */ }

  return out
}

/** Build a resolver, from this module when possible and from the app root otherwise. */
function resolverFor() {
  try {
    if (typeof import.meta?.url === 'string') return createRequire(import.meta.url)
  } catch { /* bundled to CJS, where import.meta is not itself */ }
  return createRequire(path.join(process.cwd(), 'index.js'))
}

let resolved                     // undefined = not looked yet, '' = looked and found nothing

/** The worker file on disk, or '' when there is none. Looked up once. */
export function findPdfWorker() {
  if (resolved !== undefined) return resolved
  resolved = ''
  let require
  try { require = resolverFor() } catch { return resolved }
  for (const file of candidates(require)) {
    if (existsSync(file)) { resolved = file; break }
  }
  return resolved
}

/**
 * Tell the reader where its worker is, if we found one.
 *
 * @param {{ setWorker: (src: string) => unknown }} PDFParse
 * @returns {string} the path handed over, or '' when the default was left alone
 */
export function usePdfWorker(PDFParse) {
  const file = findPdfWorker()
  if (!file) return ''
  try { PDFParse.setWorker(file) } catch { return '' }
  return file
}

/** For tests: forget what was found, so a changed disk is looked at again. */
export function resetPdfWorkerLookup() {
  resolved = undefined
}
