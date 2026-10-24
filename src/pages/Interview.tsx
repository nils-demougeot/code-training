import clsx from 'clsx'
import {
  AlarmClock, CheckCircle2, Circle, ClipboardCheck, Flag, ListChecks, Mic, Play, Timer, Trophy,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { create } from 'zustand'
import { Markdown } from '@/components/Markdown'
import { DifficultyBadge, DomainChip, PageHeader } from '@/components/ui'
import { SplitPane, Workspace } from '@/components/Workspace'
import { exerciseById, exercises, setupOf, toPython } from '@/lib/content'
import { activeEngine, runCode, runTests } from '@/lib/engine'
import { useProgress } from '@/lib/progress'
import type { Domain, Exercise, RunResult } from '@/lib/types'
import { celebrate, runnableCode } from './ExercisePage'

type Track = 'algo' | 'data' | 'ml' | 'mix'

const TRACKS: { id: Track; label: string; domains: Domain[]; desc: string }[] = [
  { id: 'algo', label: 'Python & algo', domains: ['python', 'algo'], desc: 'Structures de données, complexité, problèmes classiques.' },
  { id: 'data', label: 'Data', domains: ['numpy', 'pandas', 'sql'], desc: 'NumPy, Pandas et SQL : manipuler et agréger des données.' },
  { id: 'ml', label: 'ML & Deep Learning', domains: ['ml', 'dl'], desc: 'Algos from scratch, métriques, pipelines, réseaux.' },
  { id: 'mix', label: 'Mix complet', domains: ['python', 'numpy', 'pandas', 'sql', 'ml', 'dl', 'algo'], desc: 'Comme un vrai entretien data/ML.' },
]

const METHOD = [
  'Reformuler le problème à voix haute',
  'Clarifier entrées, sorties et contraintes',
  'Dérouler un exemple à la main + cas limites',
  'Annoncer une approche simple, puis optimiser',
  'Donner la complexité temps / mémoire',
  'Coder proprement, nommer clairement',
  'Tester sur les exemples, puis les cas limites',
]

interface Session {
  id: string
  track: Track
  exerciseIds: string[]
  startedAt: number
  limitSec: number
  codes: Record<string, string>
  solved: string[]
  finishedAt?: number
}

const KEY = 'ct.interview.session'

const useSession = create<{ s: Session | null; set: (s: Session | null) => void }>((set) => ({
  s: (() => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Session | null
    } catch {
      return null
    }
  })(),
  set: (s) => {
    try {
      if (s) sessionStorage.setItem(KEY, JSON.stringify(s))
      else sessionStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    set({ s })
  },
}))

function pickProblems(track: Track, count: number): Exercise[] {
  const p = useProgress.getState().p
  const domains = TRACKS.find((t) => t.id === track)!.domains
  const local = activeEngine() === 'local'
  const pool = exercises.filter(
    (e) => domains.includes(e.domain) && e.difficulty !== 'easy' && (local || e.engine !== 'local'),
  )
  const score = (e: Exercise) =>
    (e.interview ? 2 : 0) + (p.exercises[e.id]?.status === 'solved' ? 0 : 1.5) + Math.random() * 2
  const sorted = [...pool].sort((a, b) => score(b) - score(a))
  // Prefer distinct domains so the session feels varied.
  const chosen: Exercise[] = []
  for (const e of sorted) {
    if (chosen.length >= count) break
    if (!chosen.some((c) => c.domain === e.domain) || sorted.length - chosen.length <= count) chosen.push(e)
  }
  for (const e of sorted) if (chosen.length < count && !chosen.includes(e)) chosen.push(e)
  return chosen.sort((a, b) => (a.difficulty === b.difficulty ? 0 : a.difficulty === 'medium' ? -1 : 1))
}

export default function Interview() {
  const location = useLocation()
  const session = useSession((s) => s.s)
  if (location.pathname === '/entretien/session' && session) return <SessionView session={session} />
  return <Setup />
}

function Setup() {
  const navigate = useNavigate()
  const setSession = useSession((s) => s.set)
  const history = useProgress((s) => s.p.interviews)
  const current = useSession((s) => s.s)
  const [track, setTrack] = useState<Track>('mix')
  const [minutes, setMinutes] = useState(45)
  const [count, setCount] = useState(2)

  const start = () => {
    const problems = pickProblems(track, count)
    setSession({
      id: `itw-${Date.now()}`,
      track,
      exerciseIds: problems.map((e) => e.id),
      startedAt: Date.now(),
      limitSec: minutes * 60,
      codes: Object.fromEntries(problems.map((e) => [e.id, e.starter])),
      solved: [],
    })
    navigate('/entretien/session')
  }

  return (
    <div>
      <PageHeader
        icon={<Mic className="size-6" />}
        title="Entretien blanc"
        subtitle="Conditions réelles : chrono, pas d’indice, pas de solution, pas d’autocomplétion. Puis un débrief."
      />
      {current && !current.finishedAt && (
        <div className="card mb-6 flex items-center gap-4 border-accent/40 p-4">
          <AlarmClock className="size-5 text-accent" />
          <div className="flex-1 text-sm">Un entretien est en cours.</div>
          <Link to="/entretien/session" className="btn btn-primary px-3 py-1.5 text-xs">
            Reprendre
          </Link>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-6 p-6 lg:col-span-2">
          <div>
            <div className="section-title mb-3">Format</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {TRACKS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTrack(t.id)}
                  className={clsx(
                    'rounded-xl border p-4 text-left transition',
                    track === t.id ? 'border-accent/50 bg-accent/10' : 'border-line bg-white/[0.02] hover:border-line-strong',
                  )}
                >
                  <div className="font-medium">{t.label}</div>
                  <div className="mt-0.5 text-xs text-muted">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-8">
            <div>
              <div className="section-title mb-3">Durée</div>
              <div className="flex gap-2">
                {[30, 45, 60].map((m) => (
                  <button key={m} onClick={() => setMinutes(m)} className={clsx('btn px-4', minutes === m ? 'btn-primary' : 'btn-ghost')}>
                    {m} min
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="section-title mb-3">Problèmes</div>
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <button key={n} onClick={() => setCount(n)} className={clsx('btn px-4', count === n ? 'btn-primary' : 'btn-ghost')}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button className="btn btn-primary px-6 py-3 text-base" onClick={start}>
            <Play className="size-5" />
            Commencer l’entretien
          </button>
        </div>
        <div className="card p-6">
          <div className="section-title mb-3 flex items-center gap-2">
            <ListChecks className="size-4" />
            La méthode
          </div>
          <ol className="space-y-2 text-sm text-muted">
            {METHOD.map((m, i) => (
              <li key={m} className="flex gap-2">
                <span className="font-mono text-xs text-accent">{i + 1}.</span>
                {m}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-faint">
            En vrai entretien, l’évaluateur juge autant ta communication que ton code. Entraîne-toi à parler à voix haute.
          </p>
        </div>
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <div className="section-title mb-3">Historique</div>
          <div className="card divide-y divide-line">
            {history.slice(0, 10).map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="w-32 text-faint">{new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="flex-1 truncate text-muted">
                  {h.exerciseIds.map((id) => exerciseById.get(id)?.title ?? id).join(' · ')}
                </span>
                <span className={clsx('font-medium', h.solved.length === h.exerciseIds.length ? 'text-ok' : 'text-fg')}>
                  {h.solved.length}/{h.exerciseIds.length}
                </span>
                <span className="w-16 text-right font-mono text-xs text-faint">{Math.round(h.durationSec / 60)} min</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function useCountdown(session: Session) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const end = session.finishedAt ?? now
  const elapsed = Math.floor((end - session.startedAt) / 1000)
  const left = Math.max(0, session.limitSec - elapsed)
  return { elapsed, left, label: `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}` }
}

function SessionView({ session }: { session: Session }) {
  const setSession = useSession((s) => s.set)
  const finishInterview = useProgress((s) => s.finishInterview)
  const solveExercise = useProgress((s) => s.solveExercise)
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<Record<string, RunResult | null>>({})
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<'run' | 'test' | null>(null)
  const [checklist, setChecklist] = useState<Set<number>>(new Set())
  const problems = useMemo(() => session.exerciseIds.map((id) => exerciseById.get(id)!).filter(Boolean), [session])
  const ex = problems[index]
  const { elapsed, left, label } = useCountdown(session)
  const finished = !!session.finishedAt

  const finish = useCallback(() => {
    const s = useSession.getState().s
    if (!s || s.finishedAt) return
    const done = { ...s, finishedAt: Date.now() }
    setSession(done)
    finishInterview({
      id: done.id,
      date: done.startedAt,
      exerciseIds: done.exerciseIds,
      solved: done.solved,
      durationSec: Math.min(done.limitSec, Math.round((done.finishedAt - done.startedAt) / 1000)),
      limitSec: done.limitSec,
    })
  }, [setSession, finishInterview])

  useEffect(() => {
    if (!finished && left <= 0) finish()
  }, [left, finished, finish])

  if (finished) return <Report session={session} problems={problems} elapsed={elapsed} />
  if (!ex) return null

  const code = session.codes[ex.id] ?? ex.starter
  const setCode = (v: string) => setSession({ ...session, codes: { ...session.codes, [ex.id]: v } })
  const setup = setupOf(ex)

  const onRun = async () => {
    if (running) return
    setRunning(true)
    setMode('run')
    const examples = ex.language === 'sql' ? [] : ex.tests.flatMap((t) => (t.call && !t.hidden ? [t.call] : []))
    const res = await runCode(runnableCode(ex, code), { setup, requireLocal: ex.engine === 'local', examples })
    setResults((r) => ({ ...r, [ex.id]: res }))
    setRunning(false)
  }

  const onSubmit = async () => {
    if (running) return
    setRunning(true)
    setMode('test')
    const res = await runTests(
      { code: toPython(ex, code), solution: toPython(ex, ex.solution), setup, tests: ex.tests },
      { requireLocal: ex.engine === 'local', timeoutMs: 30_000 },
    )
    setResults((r) => ({ ...r, [ex.id]: res }))
    setRunning(false)
    if (res.ok && res.total && res.passed === res.total && !session.solved.includes(ex.id)) {
      const s = useSession.getState().s!
      setSession({ ...s, solved: [...s.solved, ex.id] })
      solveExercise(ex.id, elapsed)
      celebrate()
    }
  }

  const left_ = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className={clsx('flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-sm font-semibold', left < 300 ? 'bg-bad/15 text-bad' : 'bg-white/[0.05]')}>
          <Timer className="size-4" />
          {label}
        </div>
        <div className="flex gap-1">
          {problems.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIndex(i)}
              className={clsx('flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium', i === index ? 'bg-white/[0.08] text-fg' : 'text-muted hover:text-fg')}
            >
              {session.solved.includes(p.id) ? <CheckCircle2 className="size-3.5 text-ok" /> : <Circle className="size-3.5" />}
              Q{i + 1}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost ml-auto px-3 py-1 text-xs" onClick={() => confirm('Terminer l’entretien maintenant ?') && finish()}>
          <Flag className="size-3.5" />
          Terminer
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <h1 className="text-xl font-semibold">{ex.title}</h1>
        <div className="mt-2 mb-4 flex gap-1.5">
          <DomainChip domain={ex.domain} />
          <DifficultyBadge difficulty={ex.difficulty} />
        </div>
        <Markdown>{ex.statement}</Markdown>
        {ex.tests.filter((t) => !t.hidden && t.call).map((t, i) => (
          <div key={i} className="mt-2 rounded-xl border border-line bg-black/20 p-3 font-mono text-xs">
            <div className="text-muted">&gt;&gt;&gt; {t.call}</div>
            {t.expected && <div className="mt-1 text-ok/90">{t.expected}</div>}
          </div>
        ))}
        <div className="mt-6 rounded-2xl border border-line p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
            <ClipboardCheck className="size-4" />
            Checklist de méthode
          </div>
          {METHOD.map((m, i) => (
            <label key={m} className="flex cursor-pointer items-center gap-2 py-1 text-sm text-muted">
              <input
                type="checkbox"
                className="accent-[#8b5cf6]"
                checked={checklist.has(i)}
                onChange={() =>
                  setChecklist((c) => {
                    const n = new Set(c)
                    if (n.has(i)) n.delete(i)
                    else n.add(i)
                    return n
                  })
                }
              />
              <span className={clsx(checklist.has(i) && 'text-faint line-through')}>{m}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <SplitPane
      storageKey="ct.split.interview"
      left={left_}
      right={
        <Workspace
          key={ex.id}
          code={code}
          onChange={setCode}
          onRun={onRun}
          onSubmit={onSubmit}
          running={running}
          mode={mode}
          result={results[ex.id] ?? null}
          language={ex.language}
          autocomplete={false}
          docLib={null}
        />
      }
    />
  )
}

function Report({ session, problems, elapsed }: { session: Session; problems: Exercise[]; elapsed: number }) {
  const setSession = useSession((s) => s.set)
  const navigate = useNavigate()
  const solved = session.solved.length
  const ratio = solved / Math.max(1, problems.length)
  const verdict =
    ratio === 1
      ? { title: 'Excellent', text: 'Tous les problèmes résolus dans le temps. Tu peux passer à des formats plus longs ou plus difficiles.' }
      : ratio >= 0.5
        ? { title: 'Solide', text: 'La base est là. Relis les solutions des problèmes manqués et reprogramme-les dans quelques jours.' }
        : { title: 'À retravailler', text: 'Pas d’inquiétude, c’est le but de l’entraînement. Refais ces exercices avec les indices, puis retente un entretien.' }
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="card p-8 text-center animate-pop">
          <Trophy className="mx-auto size-10 text-warn" />
          <h1 className="mt-3 text-2xl font-semibold">{verdict.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {solved}/{problems.length} résolu{solved > 1 ? 's' : ''} en {Math.floor(Math.min(elapsed, session.limitSec) / 60)} min
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted">{verdict.text}</p>
        </div>
        <div className="mt-6 space-y-3">
          {problems.map((p) => (
            <Link key={p.id} to={`/exercices/${p.id}`} className="card card-hover flex items-center gap-3 p-4">
              {session.solved.includes(p.id) ? <CheckCircle2 className="size-5 text-ok" /> : <Circle className="size-5 text-bad" />}
              <span className="flex-1 font-medium">{p.title}</span>
              <DomainChip domain={p.domain} />
              <span className="text-xs text-accent">Voir indices & solution →</span>
            </Link>
          ))}
        </div>
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn btn-primary" onClick={() => { setSession(null); navigate('/entretien') }}>
            Nouvel entretien
          </button>
          <Link to="/" className="btn btn-ghost" onClick={() => setSession(null)}>
            Tableau de bord
          </Link>
        </div>
      </div>
    </div>
  )
}
