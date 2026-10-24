import { CheckCircle2, Circle, IndentIncrease, Puzzle, Shuffle, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DifficultyBadge, PageHeader, ProgressBar } from '@/components/ui'
import { EXERCISE_DOMAINS, parsonsProblems } from '@/lib/content'
import { DOMAINS } from '@/lib/domains'
import { toBlocks } from '@/lib/parsons'
import { useProgress } from '@/lib/progress'
import type { Domain } from '@/lib/types'
import { FilterButton } from './ExerciseList'

type Source = 'all' | 'parsons' | 'exercise' | 'todo'

/** Dedicated problems come first: they were written for blocks, not converted from exercises. */
const DEFAULT_SOURCE: Source = 'parsons'

export default function Blocks() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const p = useProgress((s) => s.p)
  const domain = (params.get('domain') as Domain | null) ?? null
  const source = (params.get('source') as Source | null) ?? DEFAULT_SOURCE
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const sizes = useMemo(() => new Map(parsonsProblems.map((q) => [q.id, toBlocks(q.solution, q.language).length])), [])
  const filtered = parsonsProblems.filter((q) => {
    if (domain && q.domain !== domain) return false
    if (source === 'parsons' || source === 'exercise') return q.source === source
    if (source === 'todo') return !p.parsons?.[q.id]?.solvedAt
    return true
  })
  const solved = parsonsProblems.filter((q) => p.parsons?.[q.id]?.solvedAt).length
  const indented = parsonsProblems.filter((q) => p.parsons?.[q.id]?.indent).length
  const trapped = parsonsProblems.filter((q) => p.parsons?.[q.id]?.traps).length
  const withTraps = parsonsProblems.filter((q) => q.distractors.length).length

  const random = () => {
    const pool = filtered.filter((q) => !p.parsons?.[q.id]?.solvedAt)
    const pick = (pool.length ? pool : filtered)[Math.floor(Math.random() * (pool.length || filtered.length))]
    if (pick) navigate(`/blocs/${pick.id}`)
  }

  return (
    <div>
      <PageHeader
        icon={<Puzzle className="size-6" />}
        title="Blocs de code"
        subtitle="Remets les lignes dans l’ordre et indente-les, sans te soucier de la syntaxe. Idéal pour mémoriser la structure d’un algorithme ou d’une boucle d’entraînement. Ton programme est validé par les vrais tests."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Counter label="Programmes réussis" value={solved} total={parsonsProblems.length} />
        <Counter label="Avec l’indentation" value={indented} total={parsonsProblems.length} icon={<IndentIncrease className="size-4" />} />
        <Counter label="Avec les pièges" value={trapped} total={withTraps} icon={<Sparkles className="size-4" />} />
      </div>

      <div className="card mb-6 flex flex-wrap items-center gap-2 p-4">
        {([
          ['parsons', 'Spécial blocs'],
          ['all', 'Tous'],
          ['exercise', 'Issus des exercices'],
          ['todo', 'À faire'],
        ] as [Source, string][]).map(([s, label]) => (
          <FilterButton key={s} active={source === s} onClick={() => setParam('source', s === DEFAULT_SOURCE ? null : s)}>
            {label}
          </FilterButton>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        {EXERCISE_DOMAINS.map((d) => {
          const Icon = DOMAINS[d].icon
          return (
            <FilterButton key={d} active={domain === d} color={DOMAINS[d].color} onClick={() => setParam('domain', domain === d ? null : d)}>
              <Icon className="size-3.5" />
              {DOMAINS[d].label}
            </FilterButton>
          )
        })}
        <button className="btn btn-primary ml-auto px-3 py-1.5 text-xs" onClick={random} disabled={!filtered.length}>
          <Shuffle className="size-3.5" />
          Au hasard
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((q, i) => {
          const st = p.parsons?.[q.id]
          const meta = DOMAINS[q.domain]
          return (
            <Link
              key={q.id}
              to={`/blocs/${q.id}`}
              className="card card-hover group flex items-start gap-3 p-4 animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 20) * 20}ms` }}
            >
              {st?.solvedAt ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" /> : <Circle className="mt-0.5 size-5 shrink-0 text-faint/60" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium group-hover:text-fg">{q.title}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
                  <span style={{ color: meta.color }}>{meta.label}</span>·<span>{sizes.get(q.id)} blocs</span>
                  {q.source === 'parsons' && <span className="chip py-0 text-[10px] text-accent">spécial</span>}
                  {q.distractors.length > 0 && <span className="chip py-0 text-[10px] text-warn">{q.distractors.length} pièges</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <DifficultyBadge difficulty={q.difficulty} />
                <span className="flex gap-1 text-faint">
                  <IndentIncrease className={st?.indent ? 'size-3.5 text-ok' : 'size-3.5 opacity-30'} aria-label="Réussi avec l’indentation" />
                  <Sparkles className={st?.traps ? 'size-3.5 text-ok' : 'size-3.5 opacity-30'} aria-label="Réussi avec les pièges" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function Counter({ label, value, total, icon }: { label: string; value: number; total: number; icon?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">
        {value}
        <span className="text-sm text-faint"> / {total}</span>
      </div>
      <ProgressBar value={total ? value / total : 0} className="mt-2" height={4} />
    </div>
  )
}
