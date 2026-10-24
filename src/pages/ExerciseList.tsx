import clsx from 'clsx'
import { CheckCircle2, Circle, CircleDashed, Clock, Code2, Cpu, Mic, RotateCcw, Search } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DifficultyBadge, Empty, PageHeader, ProgressBar } from '@/components/ui'
import { EXERCISE_DOMAINS, exercises } from '@/lib/content'
import { DIFFICULTY, DOMAINS } from '@/lib/domains'
import { domainMastery, useProgress } from '@/lib/progress'
import type { Difficulty, Domain } from '@/lib/types'

type Status = 'all' | 'todo' | 'solved' | 'review'

export default function ExerciseList() {
  const [params, setParams] = useSearchParams()
  const p = useProgress((s) => s.p)
  const domain = (params.get('domain') as Domain | null) ?? null
  const difficulty = (params.get('diff') as Difficulty | null) ?? null
  const status = (params.get('status') as Status | null) ?? 'all'
  const quick = params.get('quick') === '1'
  const q = params.get('q') ?? ''

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const filtered = useMemo(() => {
    const now = Date.now()
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return exercises.filter((e) => {
      const ep = p.exercises[e.id]
      if (domain && e.domain !== domain) return false
      if (difficulty && e.difficulty !== difficulty) return false
      if (quick && e.minutes > 10) return false
      if (status === 'todo' && ep?.status === 'solved') return false
      if (status === 'solved' && ep?.status !== 'solved') return false
      if (status === 'review' && !(ep?.review && ep.review.due <= now)) return false
      if (terms.length) {
        const hay = `${e.title} ${e.tags.join(' ')} ${e.domain}`.toLowerCase()
        if (!terms.every((t) => hay.includes(t))) return false
      }
      return true
    })
  }, [p, domain, difficulty, status, quick, q])

  const groups = EXERCISE_DOMAINS.map((d) => ({ domain: d, items: filtered.filter((e) => e.domain === d) })).filter(
    (g) => g.items.length,
  )

  return (
    <div>
      <PageHeader
        icon={<Code2 className="size-6" />}
        title="Exercices"
        subtitle={`${exercises.length} exercices de code avec tests automatiques, du réflexe de 3 minutes au problème d’entretien.`}
      />

      <div className="card mb-6 space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <input
              className="input pl-9"
              placeholder="Rechercher (ex. broadcasting, groupby, pipeline…)"
              value={q}
              onChange={(e) => setParam('q', e.target.value)}
            />
          </div>
          <FilterButton active={quick} onClick={() => setParam('quick', quick ? null : '1')}>
            <Clock className="size-3.5" />≤ 10 min
          </FilterButton>
          {(['todo', 'solved', 'review'] as Status[]).map((s) => (
            <FilterButton key={s} active={status === s} onClick={() => setParam('status', status === s ? null : s)}>
              {s === 'todo' ? 'À faire' : s === 'solved' ? 'Résolus' : (
                <>
                  <RotateCcw className="size-3.5" />À réviser
                </>
              )}
            </FilterButton>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterButton active={!domain} onClick={() => setParam('domain', null)}>
            Tous
          </FilterButton>
          {EXERCISE_DOMAINS.map((d) => {
            const Icon = DOMAINS[d].icon
            return (
              <FilterButton key={d} active={domain === d} color={DOMAINS[d].color} onClick={() => setParam('domain', domain === d ? null : d)}>
                <Icon className="size-3.5" />
                {DOMAINS[d].label}
              </FilterButton>
            )
          })}
          <span className="mx-1 w-px bg-line" />
          {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
            <FilterButton key={d} active={difficulty === d} color={DIFFICULTY[d].color} onClick={() => setParam('diff', difficulty === d ? null : d)}>
              {DIFFICULTY[d].label}
            </FilterButton>
          ))}
        </div>
      </div>

      {groups.length === 0 && (
        <Empty icon={<Search className="size-6" />} title="Aucun exercice ne correspond">
          Essaie d’enlever un filtre.
        </Empty>
      )}

      <div className="space-y-8">
        {groups.map(({ domain: d, items }) => {
          const meta = DOMAINS[d]
          const m = domainMastery(p, d)
          const Icon = meta.icon
          return (
            <section key={d} className="animate-fade-up">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl" style={{ background: `${meta.color}1a`, color: meta.color }}>
                  <Icon className="size-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{meta.label}</h2>
                  <p className="truncate text-xs text-muted">{meta.description}</p>
                </div>
                <div className="flex w-40 items-center gap-2 text-xs text-faint">
                  <ProgressBar value={m.ratio} color={meta.color} className="flex-1" height={5} />
                  {m.solved}/{m.total}
                </div>
              </div>
              <div className="card divide-y divide-line overflow-hidden">
                {items.map((e) => {
                  const ep = p.exercises[e.id]
                  const reviewDue = ep?.review && ep.review.due <= Date.now()
                  return (
                    <Link
                      key={e.id}
                      to={`/exercices/${e.id}`}
                      className="group flex items-center gap-4 px-4 py-3 transition hover:bg-white/[0.03]"
                    >
                      {ep?.status === 'solved' ? (
                        reviewDue ? (
                          <RotateCcw className="size-5 shrink-0 text-accent-2" />
                        ) : (
                          <CheckCircle2 className="size-5 shrink-0 text-ok" />
                        )
                      ) : ep ? (
                        <CircleDashed className="size-5 shrink-0 text-warn" />
                      ) : (
                        <Circle className="size-5 shrink-0 text-faint/60" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium group-hover:text-fg">{e.title}</span>
                          {e.interview && <Mic className="size-3.5 shrink-0 text-accent" aria-label="Question d’entretien" />}
                          {e.engine === 'local' && <Cpu className="size-3.5 shrink-0 text-warn" aria-label="Runner local" />}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-faint">{e.tags.join(' · ')}</div>
                      </div>
                      <span className="hidden items-center gap-1 text-xs text-faint sm:flex">
                        <Clock className="size-3" />
                        {e.minutes} min
                      </span>
                      <DifficultyBadge difficulty={e.difficulty} />
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

export function FilterButton({
  active, onClick, children, color,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
        active ? 'border-transparent text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
      )}
      style={active ? { background: color ? `${color}26` : 'rgb(139 92 246 / 0.2)', color: color ?? undefined } : undefined}
    >
      {children}
    </button>
  )
}
