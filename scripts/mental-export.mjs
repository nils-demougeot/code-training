// Prints, as JSON, many random questions of every mental-arithmetic level (text, answer, Python
// expression), plus problems found on the JS side. validate_content.py recomputes each answer in Python.
import { build } from 'esbuild'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const bundle = await build({
  entryPoints: [join(root, 'src/mental/generators.ts')],
  bundle: true, write: false, format: 'esm', platform: 'node', alias: { '@': join(root, 'src') },
})
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const { rng } = await import('data:text/javascript;base64,' + Buffer.from((await build({
  entryPoints: [join(root, 'src/maths/core.ts')], bundle: true, write: false, format: 'esm', platform: 'node', alias: { '@': join(root, 'src') },
})).outputFiles[0].text).toString('base64'))

const N = Number(process.argv[2] ?? 2000)
const out = { levels: M.LEVELS.map((l) => l.id), samples: [], problems: [] }
for (const l of M.LEVELS) {
  for (let seed = 0; seed < N; seed++) {
    const p = l.gen(rng(seed))
    if (/undefined|NaN|Infinity/.test(p.text)) out.problems.push(`level ${l.id}: bad text ${p.text}`)
    if (!M.TIPS[p.kind]) out.problems.push(`level ${l.id}: no tip for ${p.kind}`)
    // What the player types on the keypad (digits, "," and "-") must be accepted.
    const typed = M.fr(p.answer).replace(/ /g, '').replace('−', '-')
    if (!M.isRight(typed, p.answer)) out.problems.push(`level ${l.id}: typing ${typed} is not accepted for ${p.text}`)
    if (seed < 400) out.samples.push({ level: l.id, text: p.text, answer: p.answer, expr: p.expr })
  }
}
console.log(JSON.stringify(out))
