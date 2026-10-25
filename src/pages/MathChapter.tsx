import clsx from 'clsx'
import { ArrowLeft, ArrowRight, BookOpen, Crown, Heart, PenLine, Skull, Swords, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Markdown } from '@/components/Markdown'
import { Empty } from '@/components/ui'
import { useProgress } from '@/lib/progress'
import { BOSS_LIVES, BOSS_ROUNDS, bossPool, rng, type Chapter } from '@/maths'
import { COURSES, type Course } from '@/maths/courses'
import { t } from '@/maths/i18n'
import { MathPlayer, Stars, type Outcome } from '@/maths/MathPlayer'
import { celebrate } from '@/lib/celebrate'
import { FormulaSheet } from './Maths'

type Tab = 'cours' | 'exercices' | 'boss'

const newSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0

/** A chapter of a course (maths in French, GenAI Academy in English): lesson, practice, boss. */
export default function MathChapter({ course: courseId = 'maths' }: { course?: Course['id'] }) {
  const course = COURSES[courseId]
  const { chapter: id } = useParams()
  const chapter = course.chapters.find((c) => c.id === id)
  if (!chapter) {
    return (
      <Empty icon={<BookOpen className="size-6" />} title={t(course.lang).notFound}>
        <Link to={course.home} className="btn btn-ghost mt-4">
          {t(course.lang).back}
        </Link>
      </Empty>
    )
  }
  return <ChapterView key={chapter.id} chapter={chapter} course={course} />
}

function ChapterView({ chapter, course }: { chapter: Chapter; course: Course }) {
  const T = t(course.lang)
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab | null) ?? 'cours'
  const [sheet, setSheet] = useState(false)
  const p = useProgress((s) => s.p)
  const index = course.chapters.indexOf(chapter)
  const next = course.chapters[index + 1]
  const setTab = (t: Tab) => {
    const n = new URLSearchParams(params)
    n.set('tab', t)
    setParams(n, { replace: true })
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link to={course.home} className="mb-3 inline-flex items-center gap-1 text-xs text-faint hover:text-fg">
        <ArrowLeft className="size-3.5" />
        {course.homeLabel}
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] text-3xl">{chapter.emoji}</span>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-faint">
            {T.chapter} {index + 1}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{chapter.title}</h1>
        </div>
        {p.bosses?.[chapter.id]?.beatenAt && <Crown className="size-6 text-warn" aria-label={T.won} />}
        <button className="btn btn-ghost ml-auto px-3 py-1.5 text-xs" onClick={() => setSheet(true)}>
          <BookOpen className="size-3.5" />
          {T.formulaSheet}
        </button>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl border border-line bg-white/[0.02] p-1" role="tablist">
        {([
          ['cours', T.lessonTab, <BookOpen key="c" className="size-4" />],
          ['exercices', T.exercisesTab, <PenLine key="e" className="size-4" />],
          ['boss', T.bossTab, <Swords key="b" className="size-4" />],
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
              {T.toExercises}
              <ArrowRight className="size-4" />
            </button>
            <button className="btn btn-ghost px-4 py-2 text-sm" onClick={() => setTab('boss')}>
              <Swords className="size-4" />
              {T.fightBoss}
            </button>
          </div>
        </div>
      )}
      {tab === 'exercices' && <Practice chapter={chapter} course={course} />}
      {tab === 'boss' && <Boss chapter={chapter} next={next} course={course} />}
      {sheet && <FormulaSheet chapters={[chapter]} title={T.formulaSheet} closeLabel={T.back} onClose={() => setSheet(false)} />}
    </div>
  )
}

function Practice({ chapter, course }: { chapter: Chapter; course: Course }) {
  const T = t(course.lang)
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

  // On narrow screens the list scrolls horizontally: keep the current exercise visible.
  useEffect(() => {
    document.querySelector(`[data-ex="${exercise.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [exercise.id])

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
              <Stars n={st} size="size-3" lang={course.lang} />
            </button>
          )
        })}
      </nav>
      <div className="card min-w-0 p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{exercise.title}</h2>
          <span className="chip">
            {'●'.repeat(exercise.level)}
            {'○'.repeat(3 - exercise.level)} {T.level} {exercise.level}
          </span>
          <button className="btn btn-quiet ml-auto px-2 py-1 text-xs" onClick={() => setSeed(newSeed())} title={T.againTitle}>
            {T.again}
          </button>
        </div>
        <MathPlayer
          key={`${exercise.id}-${seed}`}
          exercise={exercise}
          seed={seed}
          onDone={onDone}
          onNext={nextEx ? () => select(nextEx.id) : () => setSeed(newSeed())}
          nextLabel={nextEx ? T.nextExercise : T.again}
          lang={course.lang}
        />
        {nextEx && (
          <div className="mt-4 text-right">
            <button className="text-xs text-faint hover:text-fg" onClick={() => setSeed(newSeed())}>
              {T.againLink}
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

function Boss({ chapter, next, course }: { chapter: Chapter; next?: Chapter; course: Course }) {
  const T = t(course.lang)
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
        <h2 className="mt-4 text-xl font-semibold">{T.bossTitle}</h2>
        <p className="mt-2 max-w-md text-sm text-muted">{T.bossRules(BOSS_ROUNDS, BOSS_LIVES)}</p>
        {best && (
          <p className="mt-3 text-xs text-faint">
            {best.beatenAt ? T.bossBeaten(best.bestLives) : T.bossTries(best.attempts)}
          </p>
        )}
        <button className="btn btn-primary mt-6 px-5 py-2.5" onClick={start}>
          <Swords className="size-4" />
          {best?.beatenAt ? T.replay : T.fight}
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
            <span>
              {T.boss} : {chapter.title}
            </span>
            <span>
              {T.round} {Math.min(fight.round + 1, fight.rounds.length)}/{fight.rounds.length}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-bad to-warn transition-[width] duration-500"
              style={{ width: `${(1 - (fight.round + (fight.answered && fight.lives > 0 && fight.over !== 'lost' ? 1 : 0)) / fight.rounds.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex gap-1" aria-label={`${fight.lives} ♥`}>
          {Array.from({ length: BOSS_LIVES }, (_, k) => (
            <Heart key={k} className={clsx('size-5', k < fight.lives ? 'fill-bad text-bad' : 'text-faint/40')} />
          ))}
        </div>
      </div>

      {fight.over ? (
        <div className={clsx('card flex flex-col items-center p-8 text-center animate-fade-up', fight.over === 'won' ? 'border-ok/40' : 'border-bad/40')}>
          {fight.over === 'won' ? <Trophy className="size-12 text-warn" /> : <Skull className="size-12 text-bad" />}
          <h2 className="mt-3 text-xl font-semibold">{fight.over === 'won' ? T.won : T.lost}</h2>
          <p className="mt-2 text-sm text-muted">{fight.over === 'won' ? T.wonText(fight.lives, fight.xp) : T.lostText}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button className="btn btn-ghost px-4 py-2 text-sm" onClick={start}>
              {T.replay}
            </button>
            {fight.over === 'won' && next && (
              <Link to={`${course.base}/${next.id}`} className="btn btn-primary px-4 py-2 text-sm">
                {T.nextChapter} : {next.title}
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
          nextLabel={T.nextRound}
          lang={course.lang}
        />
      </div>
    </div>
  )
}
