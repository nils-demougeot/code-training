import clsx from 'clsx'
import { BookMarked, Brain, ChevronDown, Layers, Play, Repeat, Shuffle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CodeBlock } from '@/components/Markdown'
import { DomainChip, PageHeader, ProgressBar } from '@/components/ui'
import { decks, exercises } from '@/lib/content'
import { DOMAINS } from '@/lib/domains'
import { useProgress } from '@/lib/progress'
import { dueCards, newCards } from '@/lib/recommend'
import { isMastered } from '@/lib/srs'

export default function Memory() {
  const p = useProgress((s) => s.p)
  const due = useMemo(() => dueCards(p), [p])
  const fresh = useMemo(() => newCards(p), [p])
  const [open, setOpen] = useState<string | null>(null)
  const navigate = useNavigate()
  // Solved exercises, the ones rewritten from memory the longest time ago first.
  const recallable = useMemo(
    () =>
      exercises
        .filter((e) => p.exercises[e.id]?.status === 'solved' && e.engine !== 'local')
        .sort((a, b) => (p.exercises[a.id].lastSolvedAt ?? 0) - (p.exercises[b.id].lastSolvedAt ?? 0)),
    [p],
  )

  const upcoming = useMemo(() => {
    const now = Date.now()
    const day = 86_400_000
    const buckets = [0, 0, 0, 0, 0, 0, 0]
    for (const s of Object.values(p.cards)) {
      const d = Math.floor((s.due - now) / day)
      if (d >= 0 && d < 7) buckets[d]++
    }
    return buckets
  }, [p])
  const maxUpcoming = Math.max(1, ...upcoming)

  return (
    <div>
      <PageHeader
        icon={<Layers className="size-6" />}
        title="Mémoire"
        subtitle="Des cartes de syntaxe à taper de mémoire, vérifiées en exécutant ton code, et revues juste avant que tu les oublies."
      />

      <section className="card relative mb-8 overflow-hidden p-6 animate-fade-up">
        <div className="pointer-events-none absolute -top-20 -right-10 size-64 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-8">
          <div className="flex-1">
            <div className="text-5xl font-semibold tracking-tight">{due.length}</div>
            <div className="mt-1 text-sm text-muted">
              carte{due.length > 1 ? 's' : ''} à réviser maintenant · {fresh.length} nouvelle{fresh.length > 1 ? 's' : ''} à découvrir
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/memoire/revision" className="btn btn-primary">
                <Play className="size-4" />
                {due.length ? 'Lancer la révision' : 'Apprendre 10 nouvelles cartes'}
              </Link>
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs text-faint">7 prochains jours</div>
            <div className="flex h-20 items-end gap-1.5">
              {upcoming.map((n, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="w-6 rounded-md bg-gradient-to-t from-accent/40 to-accent-2/60"
                    style={{ height: `${Math.max(4, (n / maxUpcoming) * 64)}px`, opacity: n ? 1 : 0.25 }}
                    title={`${n} carte(s)`}
                  />
                  <span className="text-[10px] text-faint">{i === 0 ? 'auj.' : `J+${i}`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card mb-8 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Brain className="size-6" />
          </div>
          <div className="min-w-60 flex-1">
            <h2 className="font-semibold">Réécrire de mémoire</h2>
            <p className="text-sm text-muted">
              Reprends un exercice déjà résolu sur une page blanche, sans indice ni solution, contre la montre. À la fin, un
              diff te montre ce qui diffère de la référence. Le meilleur moyen de graver la syntaxe.
            </p>
          </div>
          <button
            className="btn btn-primary"
            disabled={!recallable.length}
            onClick={() => {
              // Random pick among the least recently practiced half.
              const pool = recallable.slice(0, Math.max(1, Math.ceil(recallable.length / 2)))
              const pick = pool[Math.floor(Math.random() * pool.length)]
              navigate(`/exercices/${pick.id}?recall=1`)
            }}
          >
            <Shuffle className="size-4" />
            Défi aléatoire
          </button>
        </div>
        {recallable.length === 0 ? (
          <p className="mt-4 text-sm text-faint">Résous d’abord quelques exercices : ils apparaîtront ici.</p>
        ) : (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {recallable.slice(0, 8).map((e) => {
              const ep = p.exercises[e.id]
              return (
                <Link
                  key={e.id}
                  to={`/exercices/${e.id}?recall=1`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2 transition hover:border-line-strong"
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ background: DOMAINS[e.domain].color }} />
                  <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
                  <span className="shrink-0 text-[11px] text-faint">
                    {ep.recalls ? `${ep.recalls}× · record ${ep.bestRecallSec}s` : 'jamais réécrit'}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <div className="section-title mb-3">Paquets</div>
      <div className="grid gap-4 md:grid-cols-2">
        {decks.map((d) => {
          const meta = DOMAINS[d.domain]
          const seen = d.cards.filter((c) => p.cards[c.id]).length
          const mastered = d.cards.filter((c) => isMastered(p.cards[c.id])).length
          const dueHere = d.cards.filter((c) => p.cards[c.id] && p.cards[c.id].due <= Date.now()).length
          const isOpen = open === d.id
          return (
            <div key={d.id} className={clsx('card overflow-hidden', isOpen && 'md:col-span-2')}>
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl" style={{ background: `${meta.color}1a`, color: meta.color }}>
                    <meta.icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{d.title}</div>
                    <div className="text-xs text-muted">{d.description}</div>
                  </div>
                  <DomainChip domain={d.domain} className="hidden sm:inline-flex" />
                </div>
                <div className="mt-4 flex items-center gap-3 text-xs text-faint">
                  <ProgressBar value={mastered / d.cards.length} color={meta.color} className="flex-1" height={5} />
                  <span>
                    {mastered}/{d.cards.length} maîtrisées
                  </span>
                </div>
                <div className="mt-1 text-xs text-faint">
                  {d.cards.length - seen} nouvelles · {seen - mastered} en apprentissage
                  {dueHere > 0 && <span className="text-accent"> · {dueHere} à revoir</span>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/memoire/revision?deck=${d.id}`} className="btn btn-ghost px-3 py-1.5 text-xs">
                    <Play className="size-3.5" />
                    Étudier
                  </Link>
                  <Link to={`/memoire/revision?deck=${d.id}&cram=1`} className="btn btn-quiet px-3 py-1.5 text-xs">
                    <Repeat className="size-3.5" />
                    Tout revoir
                  </Link>
                  <button onClick={() => setOpen(isOpen ? null : d.id)} className="btn btn-quiet ml-auto px-3 py-1.5 text-xs">
                    <BookMarked className="size-3.5" />
                    Antisèche
                    <ChevronDown className={clsx('size-3.5 transition', isOpen && 'rotate-180')} />
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="divide-y divide-line border-t border-line">
                  {d.cards.map((c) => (
                    <div key={c.id} className="grid gap-2 px-5 py-3 md:grid-cols-[1fr_1.4fr]">
                      <div className="text-sm text-muted">{c.prompt}</div>
                      <CodeBlock code={c.answer} className="py-2 text-xs" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
