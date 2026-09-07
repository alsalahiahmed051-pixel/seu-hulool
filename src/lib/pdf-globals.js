/**
 * The browser globals the PDF reader expects, supplied for Node.
 *
 * `pdf-parse` wraps pdf.js, which is written for browsers and reaches for
 * `DOMMatrix` on some documents — those with a transform, a pattern or a form
 * XObject. Node has no such global, so extraction dies with «DOMMatrix is not
 * defined» on exactly those files and works on every other one.
 *
 * That is why it was not caught earlier: the twelve PDFs tested against never
 * took that path, and the first upload after the storage move did. A missing
 * global is not a property of the platform, it is a property of the DOCUMENT.
 *
 * A native canvas package would supply this, but it is a compiled dependency
 * measured in tens of megabytes for a serverless function whose whole job is
 * reading text. This is the 2D affine matrix, which is all pdf.js asks of it
 * here — and it is small enough to be read and checked.
 */

/** The 2D affine matrix [a c e; b d f; 0 0 1]. */
class Mat2D {
  constructor(init) {
    let a = 1, b = 0, c = 0, d = 1, e = 0, f = 0
    if (Array.isArray(init) && init.length >= 6) {
      [a, b, c, d, e, f] = init
    } else if (typeof init === 'string' && init.trim()) {
      const nums = init.match(/-?\d*\.?\d+(e[-+]?\d+)?/gi)
      if (nums && nums.length >= 6) [a, b, c, d, e, f] = nums.map(Number)
    } else if (init && typeof init === 'object') {
      a = num(init.a ?? init.m11, 1); b = num(init.b ?? init.m12, 0)
      c = num(init.c ?? init.m21, 0); d = num(init.d ?? init.m22, 1)
      e = num(init.e ?? init.m41, 0); f = num(init.f ?? init.m42, 0)
    }
    this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f
  }

  // pdf.js reads both spellings, so both are real properties of the same value.
  get m11() { return this.a } set m11(v) { this.a = v }
  get m12() { return this.b } set m12(v) { this.b = v }
  get m21() { return this.c } set m21(v) { this.c = v }
  get m22() { return this.d } set m22(v) { this.d = v }
  get m41() { return this.e } set m41(v) { this.e = v }
  get m42() { return this.f } set m42(v) { this.f = v }
  get is2D() { return true }
  get isIdentity() {
    return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0
  }

  /** this × other, as a new matrix. */
  multiply(o) {
    const m = new Mat2D(o)
    return new Mat2D([
      this.a * m.a + this.c * m.b,
      this.b * m.a + this.d * m.b,
      this.a * m.c + this.c * m.d,
      this.b * m.c + this.d * m.d,
      this.a * m.e + this.c * m.f + this.e,
      this.b * m.e + this.d * m.f + this.f,
    ])
  }

  multiplySelf(o) { return this.#become(this.multiply(o)) }
  preMultiplySelf(o) { return this.#become(new Mat2D(o).multiply(this)) }

  translate(tx = 0, ty = 0) { return this.multiply([1, 0, 0, 1, tx, ty]) }
  translateSelf(tx, ty) { return this.#become(this.translate(tx, ty)) }

  scale(sx = 1, sy) { return this.multiply([sx, 0, 0, sy === undefined ? sx : sy, 0, 0]) }
  scaleSelf(sx, sy) { return this.#become(this.scale(sx, sy)) }

  rotate(deg = 0) {
    const r = (deg * Math.PI) / 180
    const cos = Math.cos(r), sin = Math.sin(r)
    return this.multiply([cos, sin, -sin, cos, 0, 0])
  }
  rotateSelf(deg) { return this.#become(this.rotate(deg)) }

  /**
   * The inverse, or a matrix of NaN when there is none — which is what the DOM
   * specifies for a singular matrix, and what pdf.js checks for. Throwing here
   * would turn an unreadable region into an unreadable FILE.
   */
  inverse() {
    const det = this.a * this.d - this.b * this.c
    if (!det || !Number.isFinite(det)) return new Mat2D([NaN, NaN, NaN, NaN, NaN, NaN])
    return new Mat2D([
      this.d / det,
      -this.b / det,
      -this.c / det,
      this.a / det,
      (this.c * this.f - this.d * this.e) / det,
      (this.b * this.e - this.a * this.f) / det,
    ])
  }
  invertSelf() { return this.#become(this.inverse()) }

  transformPoint(p = {}) {
    const x = num(p.x, 0), y = num(p.y, 0)
    return { x: this.a * x + this.c * y + this.e, y: this.b * x + this.d * y + this.f, z: 0, w: 1 }
  }

  toFloat32Array() { return new Float32Array([this.a, this.b, this.c, this.d, this.e, this.f]) }
  toFloat64Array() { return new Float64Array([this.a, this.b, this.c, this.d, this.e, this.f]) }
  toString() { return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})` }

  #become(m) {
    this.a = m.a; this.b = m.b; this.c = m.c; this.d = m.d; this.e = m.e; this.f = m.f
    return this
  }
}

Mat2D.fromMatrix = (m) => new Mat2D(m)
Mat2D.fromFloat32Array = (a) => new Mat2D(Array.from(a))
Mat2D.fromFloat64Array = (a) => new Mat2D(Array.from(a))

function num(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Install what is missing, and only what is missing.
 *
 * Guarded so a runtime that has its own real implementations keeps them: a
 * hand-written stand-in should never displace the genuine article.
 */
export function installPdfGlobals() {
  if (typeof globalThis.DOMMatrix === 'undefined') globalThis.DOMMatrix = Mat2D
  if (typeof globalThis.DOMMatrixReadOnly === 'undefined') globalThis.DOMMatrixReadOnly = Mat2D
  if (typeof globalThis.DOMPoint === 'undefined') {
    globalThis.DOMPoint = class DOMPoint {
      constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w }
    }
  }
}

export { Mat2D as DOMMatrixPolyfill }
