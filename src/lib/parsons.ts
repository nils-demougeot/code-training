// Parsons problems: a solution cut into shuffled blocks that the learner puts back in order
// (and re-indents). Grading runs the exercise's tests on the assembled program, so every
// valid ordering is accepted. scripts/parsons-export.mjs reuses this module so the validator
// checks exactly what the app shows.

export const INDENT = '    '
export const MAX_INDENT = 5

export interface ParsonsBlock {
  id: string
  /** First line without its indentation, then continuation lines relative to it. */
  lines: string[]
  /** Indentation level (units of 4 spaces) in the reference solution. */
  indent: number
  distractor?: boolean
}

export interface Distractor {
  /** The wrong line (a single logical line). */
  line: string
  /** First line (stripped) of the block it imitates. */
  replaces: string
}

/** Splits code into logical lines (open brackets, triple-quoted strings and backslashes keep a
 * statement together). Blank and comment-only lines are dropped. */
export function toBlocks(code: string, language: 'python' | 'sql' = 'python'): ParsonsBlock[] {
  const physical = code.replace(/\t/g, INDENT).split('\n')
  if (language === 'sql') {
    return physical
      .filter((l) => l.trim() !== '' && !l.trim().startsWith('--'))
      .map((l, i) => ({ id: `b${i}`, lines: [l.trim()], indent: 0 }))
  }
  const blocks: ParsonsBlock[] = []
  let current: string[] = []
  let depth = 0
  let quote: string | null = null // open string delimiter, kept across lines only for triple quotes

  for (const line of physical) {
    if (!current.length && (line.trim() === '' || line.trim().startsWith('#'))) continue
    current.push(line)
    let continued = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (quote) {
        if (c === '\\') i++
        else if (line.startsWith(quote, i)) {
          i += quote.length - 1
          quote = null
        }
        continue
      }
      if (c === '#') break
      if (c === '"' || c === "'") {
        quote = line.startsWith(c.repeat(3), i) ? c.repeat(3) : c
        if (quote.length === 3) i += 2
      } else if ('([{'.includes(c)) depth++
      else if (')]}'.includes(c)) depth = Math.max(0, depth - 1)
      else if (c === '\\' && i === line.trimEnd().length - 1) continued = true
    }
    // A single-quoted string never spans lines.
    if (quote && quote.length === 1) quote = null
    if (depth === 0 && !quote && !continued) {
      blocks.push(makeBlock(current, blocks.length))
      current = []
    }
  }
  if (current.length) blocks.push(makeBlock(current, blocks.length))
  return blocks
}

function leading(line: string): number {
  return line.length - line.trimStart().length
}

function makeBlock(lines: string[], index: number): ParsonsBlock {
  const base = leading(lines[0])
  return {
    id: `b${index}`,
    indent: Math.round(base / INDENT.length),
    lines: lines.map((l, i) => (i === 0 ? l.trim() : l.slice(Math.min(base, leading(l))).trimEnd())),
  }
}

export function distractorBlocks(blocks: ParsonsBlock[], distractors: Distractor[] = []): ParsonsBlock[] {
  return distractors.map((d, i) => {
    const twin = blocks.find((b) => b.lines[0].trim() === d.replaces.trim())
    return { id: `d${i}`, lines: [d.line.trim()], indent: twin?.indent ?? 0, distractor: true }
  })
}

/** Program text for blocks placed at the given indentation levels. */
export function assemble(placed: { block: ParsonsBlock; indent: number }[]): string {
  return placed
    .map(({ block, indent }) => block.lines.map((l) => INDENT.repeat(indent) + l).join('\n'))
    .join('\n')
}

/** Reference program rebuilt from the blocks (what a perfect answer submits). */
export function referenceProgram(blocks: ParsonsBlock[]): string {
  return assemble(blocks.map((block) => ({ block, indent: block.indent })))
}

/** Reference program with one block swapped for a distractor (the validator checks it fails). */
export function programWithDistractor(blocks: ParsonsBlock[], d: Distractor): string | null {
  const i = blocks.findIndex((b) => b.lines[0].trim() === d.replaces.trim())
  if (i < 0) return null
  const swapped = blocks.map((b, j) => (j === i ? { ...b, lines: [d.line.trim()] } : b))
  return referenceProgram(swapped)
}

/** Deterministic shuffle (mulberry32) that never returns the original order for n > 1. */
export function shuffled<T>(items: T[], seed: number): T[] {
  let s = seed >>> 0
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out = items.slice()
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    if (out.length < 2 || out.some((x, i) => x !== items[i])) break
  }
  return out
}

/** Exercises turned into Parsons problems: enough blocks to be interesting, not too many. */
export function parsonsEligible(blocks: ParsonsBlock[]): boolean {
  return blocks.length >= 3 && blocks.length <= 32
}
