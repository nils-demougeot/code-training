// Prints, as JSON, many random instances of every maths exercise (params, expected answers,
// choices), plus every KaTeX/Markdown problem found in lessons, statements, hints and solutions.
// Used by validate_content.py, which recomputes each answer independently (scripts/maths_check.py).
import { build } from 'esbuild'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

const root = fileURLToPath(new URL('..', import.meta.url))
const bundle = await build({ entryPoints: [join(root, 'src/maths/index.ts')], bundle: true, write: false, format: 'esm', platform: 'node' })
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))

const SEEDS = Number(process.argv[2] ?? 60)
const processor = unified().use(remarkParse).use(remarkMath).use(remarkRehype).use(rehypeKatex)
const problems = []

/** KaTeX errors (rendered as .katex-error) and leftover "undefined"/"NaN" in rendered text. */
function checkMarkdown(where, text) {
  if (typeof text !== 'string' || !text.trim()) return problems.push(`${where}: empty text`)
  if (/undefined|NaN|\[object Object\]|Infinity/.test(text)) problems.push(`${where}: suspicious value in ${JSON.stringify(text.slice(0, 160))}`)
  if (/\\`/.test(text)) problems.push(`${where}: escaped backtick`)
  const warnings = []
  const warn = console.warn
  console.warn = (...args) => warnings.push(args.join(' '))
  const tree = processor.runSync(processor.parse(M.displayMath(text)))
  console.warn = warn
  if (warnings.length) problems.push(`${where}: KaTeX warning ${warnings[0]}`)
  const html = JSON.stringify(tree)
  const m = /katex-error[^}]*?"title":"([^"]*)"/.exec(html) ?? (html.includes('katex-error') ? [null, 'katex error'] : null)
  if (m) problems.push(`${where}: ${m[1]}`)
}

const out = { chapters: [], instances: [], problems }
for (const ch of M.CHAPTERS) {
  out.chapters.push({ id: ch.id, exercises: ch.exercises.map((e) => e.id) })
  checkMarkdown(`${ch.id} lesson`, ch.lesson)
  for (const f of ch.formulas) checkMarkdown(`${ch.id} formula ${f.name}`, `$$${f.tex}$$`)
  for (const ex of ch.exercises) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const where = `${ex.id} #${seed}`
      let inst
      try {
        inst = ex.generate(M.rng(seed * 7919 + 13))
      } catch (e) {
        problems.push(`${where}: generate throws ${e}`)
        continue
      }
      // Each instance is fully checked for the first seeds, then only its numbers (faster).
      if (seed <= 12) {
        checkMarkdown(`${where} statement`, inst.statement)
        checkMarkdown(`${where} hint`, inst.hint)
        checkMarkdown(`${where} solution`, inst.solution)
        for (const f of inst.fields) checkMarkdown(`${where} label`, f.label)
        for (const o of inst.choice?.options ?? []) checkMarkdown(`${where} option`, o)
      }
      for (const f of inst.fields) {
        if (!Number.isFinite(f.answer)) problems.push(`${where}: non-finite answer for ${f.label}`)
        // The learner can type the exact answer, rounded to the required precision.
        const typed = f.answer.toFixed(f.decimals)
        const parsed = M.parseAnswer(typed.replace('.', ','))
        if (parsed === null || !M.isCorrect(parsed, f)) problems.push(`${where}: rounded answer ${typed} rejected for ${f.label}`)
        // A clearly wrong answer must be rejected.
        if (M.isCorrect(f.answer + Math.max(1, Math.abs(f.answer)) * 0.05 + 10 ** -f.decimals, f)) problems.push(`${where}: tolerance too loose for ${f.label}`)
      }
      if (!inst.fields.length && !inst.choice) problems.push(`${where}: nothing to answer`)
      if (inst.choice) {
        const { options, answer } = inst.choice
        if (answer < 0 || answer >= options.length || new Set(options).size !== options.length) problems.push(`${where}: bad choice`)
      }
      out.instances.push({
        id: ex.id,
        seed,
        params: inst.params,
        answers: inst.fields.map((f) => f.answer),
        decimals: inst.fields.map((f) => f.decimals),
        choice: inst.choice ? inst.choice.options[inst.choice.answer] : null,
      })
    }
  }
}
process.stdout.write(JSON.stringify(out))
