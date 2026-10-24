// Maths for data: chapters with a lesson, exercises whose numbers are drawn at random, and a boss.
// Every exercise's answers are recomputed independently in Python by scripts/maths_check.py.

export interface MathField {
  label: string
  answer: number
  /** Accepted when |x - answer| <= 0.5 * 10^-decimals (or within 0.5 % relative). */
  decimals: number
  unit?: string
}

export interface MathChoice {
  options: string[]
  answer: number
}

export interface MathInstance {
  statement: string
  fields: MathField[]
  choice?: MathChoice
  /** The formula(s) to use, shown on demand. */
  hint: string
  /** Step-by-step correction. */
  solution: string
  /** Numbers drawn for this instance, checked by the Python verifier. */
  params: Record<string, number | number[] | number[][] | string>
}

export interface MathExercise {
  id: string
  title: string
  /** Shown in the list: what the exercise trains. */
  skill: string
  level: 1 | 2 | 3
  generate: (r: Rng) => MathInstance
}

export interface Chapter {
  id: string
  title: string
  emoji: string
  summary: string
  /** Markdown with KaTeX. */
  lesson: string
  /** Key formulas, shown in the formula sheet (KaTeX, display math without $$). */
  formulas: { name: string; tex: string }[]
  exercises: MathExercise[]
}

// ---------------------------------------------------------------- random numbers

export interface Rng {
  next: () => number
  int: (lo: number, hi: number) => number
  pick: <T>(items: readonly T[]) => T
  /** k distinct items. */
  sample: <T>(items: readonly T[], k: number) => T[]
}

export function rng(seed: number): Rng {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1))
  const pick = <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)]
  const sample = <T,>(items: readonly T[], k: number) => {
    const pool = items.slice()
    const out: T[] = []
    while (out.length < k && pool.length) out.push(pool.splice(Math.floor(next() * pool.length), 1)[0])
    return out
  }
  return { next, int, pick, sample }
}

// ---------------------------------------------------------------- formatting

/** French number formatting for statements: 0.25 → "0{,}25" in math mode, "0,25" in text. */
export function num(x: number, decimals = 4): string {
  const r = Number(x.toFixed(decimals))
  return String(r).replace('.', '{,}').replace('-', '-')
}

export function txt(x: number, decimals = 4): string {
  return String(Number(x.toFixed(decimals))).replace('.', ',')
}

export const pct = (x: number, decimals = 2) => `${txt(x * 100, decimals)} %`

export function round(x: number, decimals: number) {
  const f = 10 ** decimals
  return Math.round(x * f) / f
}

export function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return Math.round(r)
}

export const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1))

export function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}

/** "a/b" reduced, as LaTeX. */
export function frac(a: number, b: number): string {
  const g = gcd(a, b) || 1
  const [p, q] = [a / g, b / g]
  return q === 1 ? String(p) : `\\frac{${p}}{${q}}`
}

// ---------------------------------------------------------------- answers

/** Parses what the learner typed: numbers (comma or dot), %, + - * / ^, parentheses,
 * implicit products (2pi, 3(1+2)), constants pi and e, and sqrt, ln, log, log2, exp. */
export function parseAnswer(input: string): number | null {
  const src = input.trim().replace(/\s+/g, '').replace(/,/g, '.').replace(/×|·/g, '*').replace(/÷/g, '/').replace(/√/g, 'sqrt').replace(/π/g, 'pi').replace(/−/g, '-')
  if (!src) return null
  let i = 0
  const peek = () => src[i]
  const fail = () => {
    throw new Error('parse')
  }
  const FUNCS: Record<string, (x: number) => number> = {
    sqrt: Math.sqrt, ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2, exp: Math.exp,
  }

  function expr(): number {
    let v = term()
    while (peek() === '+' || peek() === '-') v = src[i++] === '+' ? v + term() : v - term()
    return v
  }
  function term(): number {
    let v = unary()
    for (;;) {
      if (peek() === '*' || peek() === '/') v = src[i++] === '*' ? v * unary() : v / unary()
      else if (peek() !== undefined && /[0-9a-z(]/.test(peek())) v *= unary() // implicit product
      else return v
    }
  }
  function unary(): number {
    if (peek() === '-') {
      i++
      return -unary()
    }
    if (peek() === '+') {
      i++
      return unary()
    }
    return power()
  }
  function power(): number {
    let v = postfix()
    if (peek() === '^') {
      i++
      v = v ** unary()
    }
    return v
  }
  function postfix(): number {
    let v = atom()
    while (peek() === '%' || peek() === '!') {
      if (src[i++] === '%') v /= 100
      else {
        if (!Number.isInteger(v) || v < 0 || v > 170) fail()
        v = factorial(v)
      }
    }
    return v
  }
  function atom(): number {
    const c = peek()
    if (c === '(') {
      i++
      const v = expr()
      if (peek() !== ')') fail()
      i++
      return v
    }
    const n = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(src.slice(i))
    if (n && !/^e[a-z(]/.test(src.slice(i + n[1].length))) {
      // "2e-3" is scientific notation; "2e" alone is 2 × e.
      const m = n[2] ? n[0] : n[1]
      i += m.length
      return parseFloat(m)
    }
    if (n) {
      i += n[1].length
      return parseFloat(n[1])
    }
    for (const name of ['sqrt', 'log10', 'log2', 'log', 'ln', 'exp']) {
      if (src.startsWith(name, i)) {
        i += name.length
        return FUNCS[name](peek() === '(' ? atom() : postfix())
      }
    }
    if (src.startsWith('pi', i)) {
      i += 2
      return Math.PI
    }
    if (c === 'e') {
      i += 1
      return Math.E
    }
    return fail()
  }

  try {
    const v = expr()
    if (i !== src.length || !Number.isFinite(v)) return null
    return v
  } catch {
    return null
  }
}

export function isCorrect(value: number, field: MathField): boolean {
  const tol = 0.5 * 10 ** -field.decimals + 1e-9
  return Math.abs(value - field.answer) <= tol || Math.abs(value - field.answer) <= 0.005 * Math.abs(field.answer)
}

export const precisionLabel = (decimals: number) =>
  decimals <= 0 ? 'valeur exacte (entier)' : `à ${txt(10 ** -decimals, decimals)} près`

/** Field helper. */
export const field = (label: string, answer: number, decimals = 2, unit?: string): MathField => ({ label, answer, decimals, unit })

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, error < 1e-7). */
export function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y)
}
