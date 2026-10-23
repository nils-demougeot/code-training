import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { CodeBlock } from '@/components/Markdown'
import { Control, Segmented } from './controls'

// ---------------------------------------------------------------- broadcasting

function parseShape(s: string): number[] | null {
  const cleaned = s.replace(/[()[\]\s]/g, '')
  if (cleaned === '') return []
  const parts = cleaned.split(',').filter((p) => p !== '')
  const dims = parts.map(Number)
  return dims.every((d) => Number.isInteger(d) && d >= 0) ? dims : null
}

function fmt(shape: number[]) {
  return shape.length === 1 ? `(${shape[0]},)` : `(${shape.join(', ')})`
}

interface BroadcastRow {
  a: number | null
  b: number | null
  out: number | null
  rule: 'equal' | 'stretch-a' | 'stretch-b' | 'missing-a' | 'missing-b' | 'error'
}

function broadcast(a: number[], b: number[]): { rows: BroadcastRow[]; result: number[] | null } {
  const n = Math.max(a.length, b.length)
  const rows: BroadcastRow[] = []
  let ok = true
  for (let i = 0; i < n; i++) {
    const da = a[a.length - n + i] ?? null
    const db = b[b.length - n + i] ?? null
    let rule: BroadcastRow['rule']
    let out: number | null
    if (da === null) {
      rule = 'missing-a'
      out = db
    } else if (db === null) {
      rule = 'missing-b'
      out = da
    } else if (da === db) {
      rule = 'equal'
      out = da
    } else if (da === 1) {
      rule = 'stretch-a'
      out = db
    } else if (db === 1) {
      rule = 'stretch-b'
      out = da
    } else {
      rule = 'error'
      out = null
      ok = false
    }
    rows.push({ a: da, b: db, out, rule })
  }
  return { rows, result: ok ? rows.map((r) => r.out!) : null }
}

const RULE_TEXT: Record<BroadcastRow['rule'], string> = {
  equal: 'dimensions égales ✓',
  'stretch-a': 'A vaut 1 → étiré',
  'stretch-b': 'B vaut 1 → étiré',
  'missing-a': 'A n’a pas cet axe → ajouté (taille 1) puis étiré',
  'missing-b': 'B n’a pas cet axe → ajouté (taille 1) puis étiré',
  error: 'tailles différentes et aucune ne vaut 1 ✗',
}

const EXAMPLES: { a: string; b: string; label: string }[] = [
  { a: '(100, 3)', b: '(3,)', label: 'X - X.mean(axis=0)' },
  { a: '(100, 3)', b: '(100,)', label: 'X - X.mean(axis=1)  ✗' },
  { a: '(100, 3)', b: '(100, 1)', label: 'keepdims=True' },
  { a: '(5, 1)', b: '(1, 4)', label: 'produit extérieur' },
  { a: '(32, 10, 64)', b: '(64,)', label: 'batch + biais' },
  { a: '(4, 3)', b: '(4,)', label: 'piège classique ✗' },
]

function Broadcasting({ initial }: { initial?: { a: string; b: string } }) {
  const [a, setA] = useState(initial?.a ?? '(100, 3)')
  const [b, setB] = useState(initial?.b ?? '(3,)')
  useEffect(() => {
    if (initial) {
      setA(initial.a)
      setB(initial.b)
    }
  }, [initial])
  const sa = parseShape(a)
  const sb = parseShape(b)
  const res = sa && sb ? broadcast(sa, sb) : null

  return (
    <div className="card space-y-4 p-5">
      <div>
        <div className="font-semibold">Broadcasting</div>
        <p className="text-xs text-muted">
          NumPy aligne les shapes <strong>par la droite</strong>, puis compare axe par axe : égales, ou l’une vaut 1.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Control label="Shape de A">
          <input className="input font-mono" value={a} onChange={(e) => setA(e.target.value)} />
        </Control>
        <Control label="Shape de B">
          <input className="input font-mono" value={b} onChange={(e) => setB(e.target.value)} />
        </Control>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button key={ex.label} className="chip hover:border-line-strong hover:text-fg" onClick={() => { setA(ex.a); setB(ex.b) }}>
            {ex.label}
          </button>
        ))}
      </div>
      {!res ? (
        <div className="text-sm text-bad">Shape invalide : écris par exemple (3, 4) ou (5,)</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-faint">
                <th className="py-1 font-medium">Axe (aligné à droite)</th>
                <th className="py-1 font-medium">A</th>
                <th className="py-1 font-medium">B</th>
                <th className="py-1 font-medium">Résultat</th>
                <th className="py-1 font-medium">Règle</th>
              </tr>
            </thead>
            <tbody>
              {res.rows.map((r, i) => (
                <tr key={i} className={clsx('border-t border-line', r.rule === 'error' && 'bg-bad/[0.07]')}>
                  <td className="py-1.5 font-mono text-xs text-faint">{i - res.rows.length}</td>
                  <td className={clsx('font-mono', r.a === null ? 'text-faint' : r.rule === 'stretch-a' ? 'text-warn' : '')}>{r.a ?? '–'}</td>
                  <td className={clsx('font-mono', r.b === null ? 'text-faint' : r.rule === 'stretch-b' ? 'text-warn' : '')}>{r.b ?? '–'}</td>
                  <td className="font-mono text-accent-2">{r.out ?? '✗'}</td>
                  <td className={clsx('text-xs', r.rule === 'error' ? 'text-bad' : 'text-muted')}>{RULE_TEXT[r.rule]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            className={clsx(
              'mt-3 rounded-xl border px-4 py-3 font-mono text-sm',
              res.result ? 'border-ok/30 bg-ok/[0.06] text-ok' : 'border-bad/30 bg-bad/[0.06] text-bad',
            )}
          >
            {res.result
              ? `(A op B).shape == ${fmt(res.result)}`
              : `ValueError: operands could not be broadcast together with shapes ${fmt(sa!)} ${fmt(sb!)}`}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- axis reductions

const MATRIX = [
  [3, 7, 1, 4],
  [8, 2, 6, 5],
  [0, 9, 4, 2],
]
type Op = 'sum' | 'mean' | 'max' | 'argmax'

function reduce(op: Op, xs: number[]) {
  if (op === 'sum') return xs.reduce((a, b) => a + b, 0)
  if (op === 'mean') return +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)
  if (op === 'max') return Math.max(...xs)
  return xs.indexOf(Math.max(...xs))
}

const GROUP_COLORS = ['#8b5cf6', '#22d3ee', '#34d399', '#fbbf24']

function Axes() {
  const [op, setOp] = useState<Op>('sum')
  const [axis, setAxis] = useState<'none' | 0 | 1>(0)
  const [keepdims, setKeepdims] = useState(false)
  const rows = MATRIX.length
  const cols = MATRIX[0].length
  const flat = MATRIX.flat()

  const result = useMemo(() => {
    if (axis === 'none') return [reduce(op, flat)]
    if (axis === 0) return Array.from({ length: cols }, (_, j) => reduce(op, MATRIX.map((r) => r[j])))
    return MATRIX.map((r) => reduce(op, r))
  }, [op, axis, flat, cols])

  const shape = axis === 'none' ? (keepdims ? '(1, 1)' : '()') : axis === 0 ? (keepdims ? `(1, ${cols})` : `(${cols},)`) : keepdims ? `(${rows}, 1)` : `(${rows},)`
  const color = (i: number, j: number) => (axis === 'none' ? GROUP_COLORS[0] : axis === 0 ? GROUP_COLORS[j % 4] : GROUP_COLORS[i % 4])

  return (
    <div className="card space-y-4 p-5">
      <div>
        <div className="font-semibold">Réductions selon un axe</div>
        <p className="text-xs text-muted">
          <code>axis=0</code> écrase les <strong>lignes</strong> (on descend le long des lignes : un résultat par colonne).{' '}
          <code>axis=1</code> écrase les <strong>colonnes</strong> (un résultat par ligne).
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Control label="Opération">
          <Segmented options={(['sum', 'mean', 'max', 'argmax'] as Op[]).map((o) => ({ value: o, label: o }))} value={op} onChange={setOp} />
        </Control>
        <Control label="axis">
          <Segmented options={[{ value: 'none' as const, label: 'None' }, { value: 0 as const, label: '0' }, { value: 1 as const, label: '1' }]} value={axis} onChange={setAxis} />
        </Control>
        <Control label="keepdims">
          <Segmented options={[{ value: 'no', label: 'False' }, { value: 'yes', label: 'True' }]} value={keepdims ? 'yes' : 'no'} onChange={(v) => setKeepdims(v === 'yes')} />
        </Control>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <div className="mb-1 text-[11px] text-faint">a, shape ({rows}, {cols})</div>
          <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 2.5rem)` }}>
            {MATRIX.map((r, i) =>
              r.map((v, j) => (
                <div
                  key={`${i}-${j}`}
                  className="flex h-10 items-center justify-center rounded-lg font-mono text-sm transition-colors"
                  style={{ background: `${color(i, j)}26`, border: `1px solid ${color(i, j)}55` }}
                >
                  {v}
                </div>
              )),
            )}
          </div>
        </div>
        <div className="text-2xl text-faint">→</div>
        <div>
          <div className="mb-1 text-[11px] text-faint">résultat, shape {shape}</div>
          <div
            className="inline-grid gap-1"
            style={{ gridTemplateColumns: `repeat(${axis === 0 ? cols : 1}, 2.5rem)` }}
          >
            {result.map((v, k) => (
              <div
                key={k}
                className="flex h-10 items-center justify-center rounded-lg font-mono text-sm animate-pop"
                style={{
                  background: `${axis === 'none' ? GROUP_COLORS[0] : GROUP_COLORS[k % 4]}40`,
                  border: `1px solid ${axis === 'none' ? GROUP_COLORS[0] : GROUP_COLORS[k % 4]}`,
                }}
              >
                {v}
              </div>
            ))}
          </div>
        </div>
      </div>
      <CodeBlock
        code={`a.${op}(${axis === 'none' ? '' : `axis=${axis}`}${keepdims ? `${axis === 'none' ? '' : ', '}keepdims=True` : ''})  # shape ${shape}`}
        className="text-xs"
      />
    </div>
  )
}

// ---------------------------------------------------------------- reshape

const RESHAPES: { label: string; shape: number[]; code: string }[] = [
  { label: '(12,)', shape: [12], code: 'a' },
  { label: '(3, 4)', shape: [3, 4], code: 'a.reshape(3, 4)' },
  { label: '(4, 3)', shape: [4, 3], code: 'a.reshape(4, 3)' },
  { label: '(2, 6)', shape: [2, 6], code: 'a.reshape(2, -1)' },
  { label: '(6, 2)', shape: [6, 2], code: 'a.reshape(-1, 2)' },
  { label: '(12, 1)', shape: [12, 1], code: 'a.reshape(-1, 1)  # ou a[:, None]' },
  { label: '(2, 2, 3)', shape: [2, 2, 3], code: 'a.reshape(2, 2, 3)' },
]

function Reshape() {
  const [k, setK] = useState(1)
  const [transpose, setTranspose] = useState(false)
  const r = RESHAPES[k]
  const is2d = r.shape.length === 2
  const showT = transpose && is2d
  const rows = r.shape.length === 1 ? 1 : r.shape.length === 3 ? r.shape[0] * r.shape[1] : r.shape[0]
  const cols = r.shape.at(-1)!
  const grid = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => i * cols + j))
  const shown = showT ? grid[0].map((_, j) => grid.map((row) => row[j])) : grid
  return (
    <div className="card space-y-4 p-5">
      <div>
        <div className="font-semibold">reshape et transpose</div>
        <p className="text-xs text-muted">
          <code>reshape</code> relit les mêmes 12 valeurs dans l’ordre (ligne par ligne, « C order ») : la couleur suit
          l’ordre en mémoire. <code>.T</code> échange les axes : ce n’est pas un reshape !
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {RESHAPES.map((x, i) => (
          <button
            key={x.label}
            onClick={() => setK(i)}
            className={clsx('chip font-mono', i === k && 'border-accent/50 bg-accent/15 text-fg')}
          >
            {x.label}
          </button>
        ))}
        <button
          disabled={!is2d}
          onClick={() => setTranspose(!transpose)}
          className={clsx('chip font-mono disabled:opacity-30', showT && 'border-accent-2/50 bg-accent-2/15 text-fg')}
        >
          .T
        </button>
      </div>
      <div className="flex flex-wrap gap-4">
        {(r.shape.length === 3 ? [0, 1] : [null]).map((block) => (
          <div key={String(block)} className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${shown[0].length}, 2.2rem)` }}>
            {shown
              .filter((_, i) => block === null || Math.floor(i / r.shape[1]) === block)
              .flat()
              .map((v) => (
                <div
                  key={v}
                  className="flex h-9 items-center justify-center rounded-lg font-mono text-xs"
                  style={{ background: `hsl(${250 - v * 12} 70% 60% / 0.25)`, border: `1px solid hsl(${250 - v * 12} 70% 60% / 0.6)` }}
                >
                  {v}
                </div>
              ))}
          </div>
        ))}
      </div>
      <CodeBlock code={`a = np.arange(12)\n${showT ? `(${r.code}).T` : r.code}  # shape (${(showT ? [...r.shape].reverse() : r.shape).join(', ')}${r.shape.length === 1 ? ',' : ''})`} className="text-xs" />
    </div>
  )
}

export interface ShapesConfig {
  a?: string
  b?: string
}

export default function ShapesLab({ preset }: { preset?: { config: Partial<ShapesConfig>; nonce: number } }) {
  const initial = useMemo(
    () => (preset?.config.a && preset.config.b ? { a: preset.config.a, b: preset.config.b } : undefined),
    [preset],
  )
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <Broadcasting initial={initial} />
        <Reshape />
      </div>
      <Axes />
    </div>
  )
}
