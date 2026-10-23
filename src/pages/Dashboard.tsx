import clsx from 'clsx'
import {
  ArrowRight, Brain, CalendarClock, Check, Code2, Flame, FlaskConical, Layers, RotateCcw, Sparkles, Target, Timer,
  Trophy, Zap,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Heatmap, Radar } from '@/components/charts'
import { DifficultyBadge, DomainChip, ProgressBar, ProgressRing } from '@/components/ui'
import { cards, DOMAIN_ORDER, exercises } from '@/lib/content'
import { DOMAINS } from '@/lib/domains'
import { BADGES, domainMastery, levelInfo, streak, totalXp, useProgress } from '@/lib/progress'
import { dueCards, dueExerciseReviews, inProgress, recommendExercise, todayStats } from '@/lib/recommend'
import { useSettings } from '@/lib/settings'
import { isMastered } from '@/lib/srs'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Encore debout'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

function PlanItem({
  done, icon, title, detail, to, cta,
}: {
  done: boolean
  icon: React.ReactNode
  title: string
  detail: string
  to: string
  cta: string
}) {
  return (
    <Link
      to={to}
      className={clsx(
        'group flex items-center gap-4 rounded-2xl border p-4 transition',
        done ? 'border-ok/20 bg-ok/[0.04]' : 'border-line bg-white/[0.02] hover:border-line-strong hover:bg-white/[0.04]',
      )}
    >
      <div
        className={clsx(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          done ? 'bg-ok/15 text-ok' : 'bg-white/[0.05] text-muted group-hover:text-fg',
        )}
      >
        {done ? <Check className="size-5" /> : icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className={clsx('text-sm font-medium', done && 'text-muted line-through decoration-ok/40')}>{title}</div>
        <div className="truncate text-xs text-faint">{detail}</div>
      </div>
      {!done && (
        <span className="hidden items-center gap-1 text-xs font-medium text-accent sm:flex">
          {cta}
          <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
        </span>
      )}
    </Link>
  )
}

export default function Dashboard() {
  const p = useProgress((s) => s.p)
  const goal = useSettings((s) => s.dailyGoalXp)
  const xp = totalXp(p)
  const lvl = levelInfo(xp)
  const st = streak(p)
  const today = todayStats(p)

  const due = useMemo(() => dueCards(p), [p])
  const reviews = useMemo(() => dueExerciseReviews(p), [p])
  const next = useMemo(() => recommendExercise(p), [p])
  const quick = useMemo(() => recommendExercise(p, { maxMinutes: 8, exclude: next ? [next.id] : [] }), [p, next])
  const continuing = useMemo(() => inProgress(p), [p])
  const solved = Object.values(p.exercises).filter((e) => e.status === 'solved').length
  const mastered = cards.filter((c) => isMastered(p.cards[c.id])).length
  const accuracy = p.quiz.answered ? Math.round((p.quiz.correct / p.quiz.answered) * 100) : null

  const exerciseTarget = reviews[0] ?? next
  const cardsTodo = Math.max(due.length, 0)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="card relative overflow-hidden p-6 sm:p-8 animate-fade-up">
        <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-accent-2/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="text-sm text-muted">{greeting()} 👋</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              Prêt pour <span className="gradient-text">ton prochain entretien</span> ?
            </h1>
            <p className="mt-3 text-sm text-muted">
              Niveau {lvl.level} · <span className="text-fg">{lvl.title}</span> — {lvl.span - lvl.into} XP avant le niveau{' '}
              {lvl.level + 1}.
            </p>
            <ProgressBar value={lvl.ratio} className="mt-3 max-w-sm" />
            <div className="mt-6 flex flex-wrap gap-2">
              {exerciseTarget && (
                <Link to={`/exercices/${exerciseTarget.id}`} className="btn btn-primary">
                  <Code2 className="size-4" />
                  {reviews.length ? 'Réviser un exercice' : 'Exercice recommandé'}
                </Link>
              )}
              <Link to="/quiz?n=5" className="btn btn-ghost">
                <Zap className="size-4 text-warn" />
                Mode 5 minutes
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <ProgressRing value={today.xp / goal} size={112} stroke={9}>
                <div>
                  <div className="text-2xl font-semibold">{today.xp}</div>
                  <div className="text-[10px] text-faint">/ {goal} XP</div>
                </div>
              </ProgressRing>
              <div className="mt-2 text-xs text-muted">Objectif du jour</div>
            </div>
            <div className="text-center">
              <div
                className={clsx(
                  'flex size-[112px] flex-col items-center justify-center rounded-full border',
                  st.activeToday ? 'border-orange-400/30 bg-orange-400/10' : 'border-line bg-white/[0.02]',
                )}
              >
                <Flame className={clsx('size-8', st.activeToday ? 'text-orange-400' : 'text-faint')} />
                <div className="text-2xl font-semibold">{st.current}</div>
              </div>
              <div className="mt-2 text-xs text-muted">{st.current > 1 ? 'jours de suite' : 'jour de suite'}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Plan du jour */}
        <section className="card min-w-0 p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="section-title">Plan du jour</div>
              <div className="mt-1 text-sm text-muted">Trois réflexes, environ 20 minutes.</div>
            </div>
            <Target className="size-5 text-faint" />
          </div>
          <div className="space-y-2.5">
            <PlanItem
              done={today.cardsReviewed > 0 && cardsTodo === 0}
              icon={<Layers className="size-5" />}
              title={cardsTodo ? `Réviser ${cardsTodo} carte${cardsTodo > 1 ? 's' : ''} de syntaxe` : 'Apprendre de nouvelles cartes'}
              detail={cardsTodo ? 'Répétition espacée : c’est le bon moment pour les revoir.' : '10 nouvelles cartes pour ancrer la syntaxe.'}
              to="/memoire/revision"
              cta="Réviser"
            />
            <PlanItem
              done={today.exercisesSolved > 0}
              icon={reviews.length ? <RotateCcw className="size-5" /> : <Code2 className="size-5" />}
              title={exerciseTarget ? (reviews.length ? `Re-résoudre de mémoire : ${exerciseTarget.title}` : exerciseTarget.title) : 'Tous les exercices sont résolus 🎉'}
              detail={exerciseTarget ? `${DOMAINS[exerciseTarget.domain].label} · ~${exerciseTarget.minutes} min` : 'Lance un entretien blanc pour te tester.'}
              to={exerciseTarget ? `/exercices/${exerciseTarget.id}` : '/entretien'}
              cta="Coder"
            />
            <PlanItem
              done={today.quizAnswered >= 5}
              icon={<Zap className="size-5" />}
              title="Quiz éclair : prédis la sortie"
              detail="10 snippets, 20 secondes chacun. Le combo multiplie l’XP."
              to="/quiz"
              cta="Jouer"
            />
          </div>
          {quick && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3 text-sm">
              <Timer className="size-4 text-accent-2" />
              <span className="text-muted">Juste 5 minutes ?</span>
              <Link to={`/exercices/${quick.id}`} className="truncate font-medium text-fg hover:text-accent">
                {quick.title}
              </Link>
              <span className="ml-auto shrink-0 text-xs text-faint">~{quick.minutes} min</span>
            </div>
          )}
        </section>

        {/* Mastery radar */}
        <section className="card min-w-0 p-5 lg:col-span-2">
          <div className="section-title">Maîtrise par domaine</div>
          <div className="flex justify-center py-2">
            <Radar
              axes={DOMAIN_ORDER.map((d) => ({ label: DOMAINS[d].short, value: domainMastery(p, d).ratio, color: DOMAINS[d].color }))}
            />
          </div>
          <div className="space-y-2">
            {DOMAIN_ORDER.map((d) => {
              const m = domainMastery(p, d)
              return (
                <Link key={d} to={`/exercices?domain=${d}`} className="flex items-center gap-3 text-xs hover:text-fg">
                  <span className="w-28 truncate text-muted">{DOMAINS[d].label}</span>
                  <ProgressBar value={m.ratio} color={DOMAINS[d].color} className="flex-1" height={5} />
                  <span className="w-10 text-right text-faint">
                    {m.solved}/{m.total}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      </div>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={<Code2 className="size-4" />} label="Exercices résolus" value={`${solved}`} hint={`sur ${exercises.length}`} />
        <StatTile icon={<Brain className="size-4" />} label="Cartes maîtrisées" value={`${mastered}`} hint={`sur ${cards.length}`} />
        <StatTile icon={<Zap className="size-4" />} label="Précision quiz" value={accuracy === null ? '—' : `${accuracy}%`} hint={`record combo ×${p.quiz.bestCombo}`} />
        <StatTile icon={<Trophy className="size-4" />} label="Meilleure série" value={`${st.best} j`} hint={`${xp} XP au total`} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="card min-w-0 p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div className="section-title">Activité</div>
            <CalendarClock className="size-4 text-faint" />
          </div>
          <Heatmap activity={p.activity} />
          {reviews.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-xs font-medium text-muted">À re-résoudre de mémoire ({reviews.length})</div>
              <div className="flex flex-wrap gap-2">
                {reviews.slice(0, 6).map((e) => (
                  <Link key={e.id} to={`/exercices/${e.id}`} className="chip hover:border-line-strong hover:text-fg">
                    <RotateCcw className="size-3" />
                    {e.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="card min-w-0 p-5 lg:col-span-2">
          <div className="section-title mb-3">{continuing.length ? 'Reprendre' : 'Explorer'}</div>
          {continuing.length ? (
            <div className="space-y-2">
              {continuing.map((e) => (
                <Link key={e.id} to={`/exercices/${e.id}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.04]">
                  <DomainChip domain={e.domain} />
                  <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
                  <DifficultyBadge difficulty={e.difficulty} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <ExploreLink to="/labs/nn-playground" icon={<FlaskConical className="size-4" />} title="Réseau large ou profond ?" sub="Lab interactif" />
              <ExploreLink to="/labs/model-zoo" icon={<Sparkles className="size-4" />} title="Comparer les modèles de ML" sub="Lab interactif" />
              <ExploreLink to="/fiches" icon={<Layers className="size-4" />} title="list vs ndarray vs DataFrame" sub="Fiches de synthèse" />
            </div>
          )}
          <div className="mt-5">
            <div className="mb-2 text-xs font-medium text-muted">Badges</div>
            <div className="flex flex-wrap gap-1.5">
              {BADGES.map((b) => (
                <span
                  key={b.id}
                  title={`${b.label} — ${b.description}`}
                  className={clsx(
                    'flex size-9 items-center justify-center rounded-xl border text-lg',
                    p.badges[b.id] ? 'border-accent/30 bg-accent/10' : 'border-line bg-white/[0.02] opacity-30 grayscale',
                  )}
                >
                  {b.emoji}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function StatTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="text-faint">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-faint">{hint}</div>
    </div>
  )
}

function ExploreLink({ to, icon, title, sub }: { to: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.04]">
      <div className="flex size-9 items-center justify-center rounded-lg bg-white/[0.05] text-muted">{icon}</div>
      <div>
        <div className="text-sm">{title}</div>
        <div className="text-xs text-faint">{sub}</div>
      </div>
    </Link>
  )
}
