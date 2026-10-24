// Prints, as JSON, the Parsons problems the app builds (exercises + content/parsons): the program
// rebuilt from the blocks and one program per distractor. Used by validate_content.py.
import { build } from 'esbuild'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const root = fileURLToPath(new URL('..', import.meta.url))
const bundle = await build({ entryPoints: [join(root, 'src/lib/parsons.ts')], bundle: true, write: false, format: 'esm', platform: 'node' })
const P = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))

const yamlFiles = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? yamlFiles(p) : p.endsWith('.yaml') ? [p] : []
  })

const out = []
for (const [kind, dir] of [['exercise', 'content/exercises'], ['parsons', 'content/parsons']]) {
  let files = []
  try {
    files = yamlFiles(join(root, dir))
  } catch {
    continue
  }
  for (const file of files) {
    const item = parse(readFileSync(file, 'utf8'))
    if (kind === 'exercise' && (item.engine === 'local' || item.parsons?.skip)) continue
    const blocks = P.toBlocks(item.solution, item.language ?? 'python')
    const distractors = (kind === 'exercise' ? item.parsons?.distractors : item.distractors) ?? []
    out.push({
      kind,
      id: item.id,
      eligible: P.parsonsEligible(blocks),
      blocks: blocks.length,
      program: P.referenceProgram(blocks),
      distractors: distractors.map((d) => ({ line: d.line, program: P.programWithDistractor(blocks, d) })),
    })
  }
}
process.stdout.write(JSON.stringify(out))
