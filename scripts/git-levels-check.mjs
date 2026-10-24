// Replays every Git lesson: the starting repository must not already meet the goals, and the
// reference solution must meet all of them. Run by validate_content.py (and usable alone).
import { build } from 'esbuild'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const bundle = await build({ entryPoints: [join(root, 'src/git/levels.ts')], bundle: true, write: false, format: 'esm', platform: 'node' })
const { LEVELS, sandboxState } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const engine = await build({ entryPoints: [join(root, 'src/git/engine.ts')], bundle: true, write: false, format: 'esm', platform: 'node' })
const { exec } = await import('data:text/javascript;base64,' + Buffer.from(engine.outputFiles[0].text).toString('base64'))

const errors = []
const ids = new Set()
for (const level of LEVELS) {
  if (ids.has(level.id)) errors.push(`${level.id}: duplicate id`)
  ids.add(level.id)
  let state
  try {
    state = level.setup()
  } catch (err) {
    errors.push(`${level.id}: setup fails: ${err.message}`)
    continue
  }
  if (level.goals.every((g) => g.check(state))) errors.push(`${level.id}: goals already met before any command`)
  const transcript = []
  for (const cmd of level.solution) {
    const r = exec(state, cmd)
    state = r.state
    transcript.push(`$ ${cmd}`, ...r.lines.map((l) => `  ${l.tone === 'err' ? '✗ ' : ''}${l.text}`))
  }
  const failed = level.goals.filter((g) => !g.check(state))
  if (failed.length) errors.push(`${level.id}: the solution misses ${failed.map((g) => `« ${g.text} »`).join(', ')}\n${transcript.join('\n')}`)
}
try {
  sandboxState()
} catch (err) {
  errors.push(`sandbox: ${err.message}`)
}
console.log(JSON.stringify({ levels: LEVELS.length, errors }))
