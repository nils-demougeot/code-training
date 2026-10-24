import clsx from 'clsx'
import { useMemo } from 'react'
import type { Repo } from './engine'

export interface GraphRef {
  name: string
  id: string
  kind: 'branch' | 'head-branch' | 'head' | 'tracking' | 'tag'
}

const LANE_COLORS = ['#8b5cf6', '#22d3ee', '#34d399', '#fbbf24', '#f472b6', '#fb923c', '#60a5fa', '#a3e635']
const STEP_X = 76
const STEP_Y = 62
const PAD_X = 34
const PAD_TOP = 50
const LABEL_STEP = 17

/** Commit positions: x by generation (longest path from a root), y by lane (one lane per ref). */
function layout(repo: Repo, refs: GraphRef[]) {
  const visible = new Set<string>()
  const stack = refs.map((r) => r.id)
  while (stack.length) {
    const id = stack.pop()!
    if (visible.has(id) || !repo.commits[id]) continue
    visible.add(id)
    stack.push(...repo.commits[id].parents)
  }
  const gen = new Map<string, number>()
  const genOf = (id: string): number => {
    if (gen.has(id)) return gen.get(id)!
    const parents = repo.commits[id].parents.filter((p) => visible.has(p))
    const g = parents.length ? Math.max(...parents.map(genOf)) + 1 : 0
    gen.set(id, g)
    return g
  }
  const sorted = [...visible].sort((a, b) => repo.commits[a].order - repo.commits[b].order)
  for (const id of sorted) genOf(id)

  const lane = new Map<string, number>()
  let next = 0
  const walk = (start: string) => {
    let id: string | undefined = start
    let used = false
    while (id && visible.has(id) && !lane.has(id)) {
      lane.set(id, next)
      used = true
      id = repo.commits[id].parents[0]
    }
    if (used) next++
  }
  const priority = (r: GraphRef) => (r.name === 'main' || r.name === 'origin/main' ? 0 : r.kind === 'head-branch' ? 1 : r.kind === 'branch' ? 2 : r.kind === 'tracking' ? 3 : 4)
  for (const r of [...refs].sort((a, b) => priority(a) - priority(b) || a.name.localeCompare(b.name))) walk(r.id)
  for (const id of [...sorted].reverse()) if (!lane.has(id)) walk(id)

  // Each lane is tall enough for the labels stacked above its commits.
  const labelCount = new Map<string, number>()
  for (const r of refs) labelCount.set(r.id, (labelCount.get(r.id) ?? 0) + 1)
  const laneTop: number[] = []
  let y = 0
  for (let ln = 0; ln < next; ln++) {
    const most = Math.max(0, ...sorted.filter((id) => lane.get(id) === ln).map((id) => labelCount.get(id) ?? 0))
    y += Math.max(0, most - 1) * LABEL_STEP + (ln === 0 ? PAD_TOP : STEP_Y)
    laneTop.push(y)
  }
  const pos = new Map(sorted.map((id) => [id, { x: PAD_X + gen.get(id)! * STEP_X, y: laneTop[lane.get(id)!], lane: lane.get(id)! }]))
  const width = PAD_X * 2 + Math.max(0, ...[...gen.values()]) * STEP_X
  const height = (laneTop[laneTop.length - 1] ?? PAD_TOP) + 40
  return { commits: sorted, pos, width, height }
}

export function GitGraph({
  repo,
  refs,
  className,
  emptyText = 'Aucun commit',
  compact,
}: {
  repo: Repo
  refs: GraphRef[]
  className?: string
  emptyText?: string
  compact?: boolean
}) {
  const { commits, pos, width, height } = useMemo(() => layout(repo, refs), [repo, refs])
  const head = refs.find((r) => r.kind === 'head' || r.kind === 'head-branch')?.id
  const labels = useMemo(() => {
    const m = new Map<string, GraphRef[]>()
    for (const r of refs) m.set(r.id, [...(m.get(r.id) ?? []), r])
    return m
  }, [refs])

  if (!commits.length) return <div className={clsx('flex h-24 items-center justify-center text-xs text-faint', className)}>{emptyText}</div>

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <svg width={Math.max(width, 120)} height={height} className="block" role="img" aria-label="Graphe des commits">
        {commits.flatMap((id) =>
          repo.commits[id].parents
            .filter((p) => pos.has(p))
            .map((p, i) => {
              const a = pos.get(p)!
              const b = pos.get(id)!
              const color = LANE_COLORS[(i === 0 ? b.lane : a.lane) % LANE_COLORS.length]
              const mid = (a.x + b.x) / 2
              const d = a.y === b.y ? `M ${a.x} ${a.y} L ${b.x} ${b.y}` : `M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`
              return <path key={`${p}-${id}`} d={d} fill="none" stroke={color} strokeWidth={2.5} strokeOpacity={0.75} />
            }),
        )}
        {commits.map((id) => {
          const p = pos.get(id)!
          const c = repo.commits[id]
          const color = LANE_COLORS[p.lane % LANE_COLORS.length]
          const refsHere = labels.get(id) ?? []
          return (
            <g key={id} style={{ transform: `translate(${p.x}px, ${p.y}px)`, transition: 'transform 0.35s ease' }}>
              <title>{`${id} — ${c.message}${c.parents.length > 1 ? ' (merge)' : ''}`}</title>
              {id === head && <circle r={16} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="3 3" />}
              <circle r={11} fill={color} fillOpacity={c.parents.length > 1 ? 0.35 : 0.9} stroke={color} strokeWidth={2} />
              {!compact && (
                <text y={27} textAnchor="middle" className="fill-faint font-mono text-[9.5px]">
                  {id}
                </text>
              )}
              {refsHere.map((r, i) => (
                <RefPill key={r.name + r.kind} r={r} y={-22 - i * LABEL_STEP} />
              ))}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function RefPill({ r, y }: { r: GraphRef; y: number }) {
  const text = r.kind === 'head-branch' ? `${r.name} ◂ HEAD` : r.kind === 'tag' ? `🏷 ${r.name}` : r.name
  const w = Math.max(30, text.length * 6.2 + 12)
  const style =
    r.kind === 'head-branch' ? { fill: '#8b5cf6', stroke: '#c4b5fd', color: '#fff' }
    : r.kind === 'head' ? { fill: '#f59e0b', stroke: '#fde68a', color: '#111' }
    : r.kind === 'branch' ? { fill: '#1e1b2e', stroke: '#8b5cf6', color: '#ddd6fe' }
    : r.kind === 'tracking' ? { fill: '#0b1720', stroke: '#22d3ee', color: '#a5f3fc' }
    : { fill: '#241a05', stroke: '#fbbf24', color: '#fde68a' }
  return (
    <g transform={`translate(0, ${y})`}>
      <rect x={-w / 2} y={-8} width={w} height={15} rx={7.5} fill={style.fill} stroke={style.stroke} strokeWidth={1} strokeDasharray={r.kind === 'tracking' ? '3 2' : undefined} />
      <text y={3} textAnchor="middle" fill={style.color} className="font-mono text-[9.5px] font-medium">
        {text}
      </text>
    </g>
  )
}

/** Refs to draw for the local repository. */
export function localRefs(local: { branches: Record<string, string>; tags: Record<string, string>; tracking: Record<string, string>; head: { branch: string | null; detached: string | null } }): GraphRef[] {
  const refs: GraphRef[] = Object.entries(local.branches).map(([name, id]) => ({ name, id, kind: local.head.branch === name ? 'head-branch' : 'branch' }))
  if (!local.head.branch && local.head.detached) refs.push({ name: 'HEAD', id: local.head.detached, kind: 'head' })
  for (const [name, id] of Object.entries(local.tracking)) refs.push({ name, id, kind: 'tracking' })
  for (const [name, id] of Object.entries(local.tags)) refs.push({ name, id, kind: 'tag' })
  return refs
}

export function remoteRefs(remote: Repo): GraphRef[] {
  const refs: GraphRef[] = Object.entries(remote.branches).map(([name, id]) => ({ name, id, kind: 'branch' }))
  for (const [name, id] of Object.entries(remote.tags)) refs.push({ name, id, kind: 'tag' })
  return refs
}

