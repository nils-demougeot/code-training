import clsx from 'clsx'
import { ArrowLeft, ArrowRight, BookOpen, Crown, Heart, PenLine, Skull, Swords, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Markdown } from '@/components/Markdown'
import { Empty } from '@/components/ui'
import { useProgress } from '@/lib/progress'
import { BOSS_LIVES, BOSS_ROUNDS, bossPool, chapterById, CHAPTERS, rng, type Chapter } from '@/maths'
import { MathPlayer, Stars, type Outcome } from '@/maths/MathPlayer'
import { celebrate } from './ExercisePage'
import { FormulaSheet } from './Maths'

type Tab = 'cours' | 'exercices' | 'boss'

const newSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0

export default function MathChapter() {
  const { chapter: id } = useParams()
  const chapter = id ? chapterById.get(id) : undefined
  if (!chapter) {
    return (
      <Empty icon={<BookOpen className="size-6" />} title="Chapitre introuvable">
        <Link to="/maths" className="btn btn-ghost mt-4">
          Retour aux maths
        </Link>
      </Empty>
    )
  }
  return <ChapterView key={chapter.id} chapter={chapter} />
}

function ChapterView({ chapter }: { chapter: Chapter }) {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab | null) ?? 'cours'
  const [sheet, setSheet] = useState(false)
  const p = useProgress((s) => s.p)
  const index = CHAPTERS.indexOf(chapter)
  const next = CHAPTERS[index + 1]
  const setTab = (t: Tab) => {
    const n = new URLSearchParams(params)
    n.set('tab', t)
    setParams(n, { replace: true })
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/maths" className="mb-3 inline-flex items-center gap-1 text-xs text-faint hover:text-fg">
        <ArrowLeft className="size-3.5" />
        Maths pour la data
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] text-3xl">{chapter.emoji}</span>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-faint">Chapitre {index + 1}</div>
          <h1 className="text-2xl font-semibold tracking-tight">{chapter.title}</h1>
        </div>
        {p.bosses?.[chapter.id]?.beatenAt && <Crown className="size-6 text-warn" aria-label="Boss vaincu" />}
        <button className="btn btn-ghost ml-auto px-3 py-1.5 text-xs" onClick={() => setSheet(true)}>
          <BookOpen className="size-3.5" />
          Formulaire
        </button>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl border border-line bg-white/[0.02] p-1" role="tablist">
        {([
          ['cours', 'Cours', <BookOpen key="c" className="size-4" />],
          ['exercices', 'Exercices', <PenLine key="e" className="size-4" />],
          ['boss', 'Boss', <Swords key="b" className="size-4" />],
        ] as [Tab, string, React.ReactNode][]).map(([t, label, icon]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={clsx('flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition', tab === t ? 'bg-accent/15 text-fg' : 'text-muted hover:text-fg')}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {tab === 'cours' && (
        <div className="card p-6 md:p-8">
          <Markdown className="prose-base">{chapter.lesson}</Markdown>
          <div className="mt-8 flex flex-wrap gap-2 border-t border-line pt-5">
            <button className="btn btn-primary px-4 py-2 text-sm" onClick={() => setTab('exercices')}>
              Passer aux exercices
              <ArrowRight className="size-4" />
            </button>
            <button className="btn btn-ghost px-4 py-2 text-sm" onClick={() => setTab('boss')}>
              <Swords className="size-4" />
              Affronter le boss
            </button>
          </div>
        </div>
      )}
      {tab === 'exercices' && <Practice chapter={chapter} />}
      {tab === 'boss' && <Boss chapter={chapter} next={next} />}
      {sheet && <FormulaSheet only={chapter.id} onClose={() => setSheet(false)} />}
    </div>
  )
}

function Practice({ chapter }: { chapter: Chapter }) {
  const [params, setParams] = useSearchParams()
  const p = useProgress((s) => s.p)
  const solveMath = useProgress((s) => s.solveMath)
  // Without ?ex=, start on the first exercise not yet solved (fixed once, so solving it does not jump away).
  const [firstTodo] = useState(() => chapter.exercises.find((e) => !p.maths?.[e.id]?.stars)?.id ?? chapter.exercises[0].id)
  const exId = params.get('ex') ?? firstTodo
  const i = Math.max(0, chapter.exercises.findIndex((e) => e.id === exId))
  const exercise = chapter.exercises[i]
  const [seed, setSeed] = useState(newSeed)
  const select = (id: string) => {
    const n = new URLSearchParams(params)
    n.set('ex', id)
    setParams(n, { replace: true })
    setSeed(newSeed())
  }
  const onDone = (o: Outcome) => {
    if (o.correct) {
      solveMath(exercise.id, o.stars)
      if (o.stars === 3) celebrate()
    }
  }
  const nextEx = chapter.exercises[i + 1]

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0">
        {chapter.exercises.map((e, j) => {
          const st = p.maths?.[e.id]?.stars ?? 0
          return (
            <button
              key={e.id}
              onClick={() => select(e.id)}
              data-ex={e.id}
              className={clsx(
                'flex w-52 shrink-0 items-center gap-3 rounded-xl border px-3 py-2 text-left transition lg:w-full',
                e.id === exercise.id ? 'border-accent/50 bg-accent/10' : 'border-transparent hover:bg-white/[0.03]',
              )}
            >
              <span className="w-5 text-center text-xs text-faint">{j + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{e.title}</span>
                <span className="block truncate text-[11px] text-faint">{e.skill}</span>
              </span>
              <Stars n={st} size="size-3" />
            </button>
          )
        })}
      </nav>
      <div className="card min-w-0 p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{exercise.title}</h2>
          <span className="chip">{'●'.repeat(exercise.level)}{'○'.repeat(3 - exercise.level)} niveau {exercise.level}</span>
          <button className="btn btn-quiet ml-auto px-2 py-1 text-xs" onClick={() => setSeed(newSeed())} title="Mêmes questions, autres nombres">
            Autres nombres
          </button>
        </div>
        <MathPlayer
          key={`${exercise.id}-${seed}`}
          exercise={exercise}
          seed={seed}
          onDone={onDone}
          onNext={nextEx ? () => select(nextEx.id) : () => setSeed(newSeed())}
          nextLabel={nextEx ? 'Exercice suivant' : 'Autres nombres'}
        />
        {nextEx && (
          <div className="mt-4 text-right">
            <button className="text-xs text-faint hover:text-fg" onClick={() => setSeed(newSeed())}>
              Refaire avec d’autres nombres
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface Fight {
  seed: number
  rounds: string[]
  round: number
  lives: number
  answered: boolean
  over: null | 'won' | 'lost'
  xp: number
}

function Boss({ chapter, next }: { chapter: Chapter; next?: Chapter }) {
  const finishBoss = useProgress((s) => s.finishBoss)
  const best = useProgress((s) => s.p.bosses?.[chapter.id])
  const pool = useMemo(() => bossPool(chapter), [chapter])
  const [fight, setFight] = useState<Fight | null>(null)

  const start = () => {
    const seed = newSeed()
    // Harder exercises come last; the draw is random within the chapter.
    const rounds = rng(seed).sample(pool, BOSS_ROUNDS).sort((a, b) => a.level - b.level).map((e) => e.id)
    setFight({ seed, rounds, round: 0, lives: BOSS_LIVES, answered: false, over: null, xp: 0 })
  }

  if (!fight) {
    return (
      <div className="card flex flex-col items-center p-8 text-center">
        <div className="text-6xl">{chapter.emoji}</div>
        <h2 className="mt-4 text-xl font-semibold">Le boss du chapitre</h2>
        <p className="mt-2 max-w-md text-sm text-muted">
          {BOSS_ROUNDS} calculs d’affilée tirés dans tout le chapitre, sans formule ni second essai. Tu as {BOSS_LIVES} vies : chaque erreur en coûte une.
        </p>
        {best && (
          <p className="mt-3 text-xs text-faint">
            {best.beatenAt ? `Vaincu, meilleur score : ${best.bestLives} vie${best.bestLives > 1 ? 's' : ''} restante${best.bestLives > 1 ? 's' : ''}` : `${best.attempts} tentative${best.attempts > 1 ? 's' : ''}, pas encore vaincu`}
          </p>
        )}
        <button className="btn btn-primary mt-6 px-5 py-2.5" onClick={start}>
          <Swords className="size-4" />
          {best?.beatenAt ? 'Rejouer' : 'Combattre'}
        </button>
      </div>
    )
  }

  const exercise = pool.find((e) => e.id === fight.rounds[fight.round])!
  const onDone = (o: Outcome) => {
    const lives = fight.lives - (o.correct ? 0 : 1)
    const over = lives === 0 ? 'lost' : fight.round === fight.rounds.length - 1 ? 'won' : null
    let xp = 0
    if (over) {
      xp = finishBoss(chapter.id, over === 'won', lives)
      if (over === 'won') celebrate()
    }
    setFight({ ...fight, lives, answered: true, over, xp })
  }
  const advance = () => setFight((f) => f && { ...f, round: f.round + 1, answered: false })

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-4 p-4">
        <span className="text-3xl">{chapter.emoji}</span>
        <div className="min-w-40 flex-1">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>Boss : {chapter.title}</span>
            <span>
              Manche {Math.min(fight.round + 1, fight.rounds.length)}/{fight.rounds.length}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-bad to-warn transition-[width] duration-500"
              style={{ width: `${(1 - (fight.round + (fight.answered && fight.lives > 0 && fight.over !== 'lost' ? 1 : 0)) / fight.rounds.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex gap-1" aria-label={`${fight.lives} vies`}>
          {Array.from({ length: BOSS_LIVES }, (_, k) => (
            <Heart key={k} className={clsx('size-5', k < fight.lives ? 'fill-bad text-bad' : 'text-faint/40')} />
          ))}
        </div>
      </div>

      {fight.over ? (
        <div className={clsx('card flex flex-col items-center p-8 text-center animate-fade-up', fight.over === 'won' ? 'border-ok/40' : 'border-bad/40')}>
          {fight.over === 'won' ? <Trophy className="size-12 text-warn" /> : <Skull className="size-12 text-bad" />}
          <h2 className="mt-3 text-xl font-semibold">{fight.over === 'won' ? 'Boss vaincu !' : 'Le boss a gagné cette fois'}</h2>
          <p className="mt-2 text-sm text-muted">
            {fight.over === 'won'
              ? `Avec ${fight.lives} vie${fight.lives > 1 ? 's' : ''} restante${fight.lives > 1 ? 's' : ''}${fight.xp ? ` · +${fight.xp} XP` : ''}.`
              : 'Relis les corrections, entraîne-toi sur les exercices ratés, puis reviens.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button className="btn btn-ghost px-4 py-2 text-sm" onClick={start}>
              Rejouer
            </button>
            {fight.over === 'won' && next && (
              <Link to={`/maths/${next.id}`} className="btn btn-primary px-4 py-2 text-sm">
                Chapitre suivant : {next.title}
                <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        </div>
      ) : null}

      <div className={clsx('card p-5 md:p-6', fight.over && 'opacity-80')}>
        <div className="mb-4 text-xs text-faint">{exercise.title}</div>
        <MathPlayer
          key={`${fight.seed}-${fight.round}`}
          exercise={exercise}
          seed={fight.seed + fight.round * 7919}
          boss
          onDone={onDone}
          onNext={!fight.over ? advance : undefined}
          nextLabel="Manche suivante"
        />
      </div>
    </div>
  )
}
