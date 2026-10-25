// Prints, as JSON, every multiple-choice question of the BCG X prep (client missions, Explain it
// simply, GenAI Academy concept quizzes) with the length of each option and which ones are right.
// validate_content.py uses it to make sure the right answer cannot be guessed from its length.
import { build } from 'esbuild'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const root = fileURLToPath(new URL('..', import.meta.url))
const questions = []
const add = (source, id, question, options) => questions.push({ source, id, question, options })

for (const f of readdirSync(join(root, 'content/missions')).filter((f) => f.endsWith('.yaml'))) {
  const m = parse(readFileSync(join(root, 'content/missions', f), 'utf8'))
  for (const c of m.framing) {
    if (!c.multi) add('mission', `${m.id}/${c.id}`, c.question, c.options.map((o) => ({ text: o.text, right: !!o.correct })))
  }
  for (const c of [m.approach, m.pitch]) add('mission', `${m.id}/${c.id}`, c.question, c.options.map((o) => ({ text: o.text, right: o.verdict === 'best' })))
}
for (const f of readdirSync(join(root, 'content/explain')).filter((f) => f.endsWith('.yaml'))) {
  const d = parse(readFileSync(join(root, 'content/explain', f), 'utf8'))
  for (const it of d.items) add('explain', `${d.id}/${it.id}`, it.prompt, it.options.map((o) => ({ text: o.text, right: o.verdict === 'best' })))
}

const bundle = await build({ entryPoints: [join(root, 'src/maths/exportEntry.ts')], bundle: true, write: false, format: 'esm', platform: 'node' })
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
for (const course of Object.values(M.COURSES)) {
  for (const ch of course.chapters) {
    for (const ex of ch.exercises) {
      const seen = new Set()
      for (let seed = 0; seed < 400; seed++) {
        const inst = ex.generate(M.rng(seed))
        if (!inst.choice || seen.has(inst.statement)) continue
        seen.add(inst.statement)
        add(course.id === 'genai' ? 'genai' : 'maths', `${ex.id}#${seen.size}`, inst.statement, inst.choice.options.map((t, i) => ({ text: t, right: i === inst.choice.answer })))
      }
    }
  }
}
console.log(JSON.stringify(questions))
