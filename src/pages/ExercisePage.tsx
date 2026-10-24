import confetti from 'canvas-confetti'
import clsx from 'clsx'
import {
  ArrowLeft, ArrowRight, BookOpenCheck, Brain, CheckCircle2, Clock, Cpu, Eye, Gauge, Lightbulb, Lock, Medal, Mic,
  NotebookPen, Puzzle, RotateCcw, Sparkles, Timer, X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { docLibForDomain } from '@/components/DocBrowser'
import { CodeBlock, Markdown } from '@/components/Markdown'
import { DifficultyBadge, DomainChip, Empty, Tabs } from '@/components/ui'
import { SplitPane, Workspace } from '@/components/Workspace'
import { cardById, exerciseById, exercises, parsonsById, setupOf, toPython } from '@/lib/content'
import { runCode, runTests } from '@/lib/engine'
import { diffLines, similarity } from '@/lib/diff'
import { exerciseXp, useProgress } from '@/lib/progress'
import { formatInterval, scheduleAfterSolve, type Grade } from '@/lib/srs'
import type { Exercise, RunResult, TestResult } from '@/lib/types'

type Tab = 'statement' | 'hints' | 'solution' | 'learn' | 'notes'

function useTimer(resetKey: string) {
  const [start, setStart] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    setStart(Date.now())
    setNow(Date.now())
  }, [resetKey])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const seconds = Math.max(0, Math.floor((now - start) / 1000))
  const restart = useCallback(() => {
    setStart(Date.now())
    setNow(Date.now())
  }, [])
  return { seconds, restart, label: `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` }
}

export function celebrate() {
  const colors = ['#8b5cf6', '#22d3ee', '#34d399', '#fbbf24']
  confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors, disableForReducedMotion: true })
  setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors, disableForReducedMotion: true }), 180)
  setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors, disableForReducedMotion: true }), 300)
}

/** Builds the Python source to execute for a "Run" (SQL exercises print the query result). */
export function runnableCode(ex: Pick<Exercise, 'language'>, code: string) {
  return ex.language === 'sql' ? `${toPython(ex, code)}show(QUERY)\n` : code
}

export default function ExercisePage() {
  const { id = '' } = useParams()
  const ex = exerciseById.get(id)
  if (!ex) {
    return (
      <div className="p-10">
        <Empty title="Exercice introuvable">
          <Link to="/exercices" className="text-accent">
            Retour aux exercices
          </Link>
        </Empty>
      </div>
    )
  }
  return <ExerciseView key={ex.id} ex={ex} />
}

function ExerciseView({ ex }: { ex: Exercise }) {
  const navigate = useNavigate()
  const store = useProgress()
  const ep = store.p.exercises[ex.id]
  const reviewDue = ep?.status === 'solved' && !!ep.review && ep.review.due <= Date.now()
  const [params, setParams] = useSearchParams()
  const recallRequested = params.get('recall') === '1'

  // « Réécris de mémoire »: blank starter, no hints/solution, then a diff against the reference.
  const [recall, setRecall] = useState(recallRequested)
  const [recallDone, setRecallDone] = useState<{ seconds: number; code: string } | null>(null)
  const savedCode = useRef(ep?.code ?? ex.starter)
  const [code, setCode] = useState(() => (recallRequested ? ex.starter : ep?.code ?? ex.starter))
  const [tab, setTab] = useState<Tab>('statement')
  const [result, setResult] = useState<RunResult | null>(null)
  const [mode, setMode] = useState<'run' | 'test' | null>(null)
  const [running, setRunning] = useState(false)
  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const [justSolved, setJustSolved] = useState<{ xp: number } | null>(null)
  const [hintsShown, setHintsShown] = useState(() => ep?.hintsUsed ?? 0)
  const [solutionOpen, setSolutionOpen] = useState(false)
  const [bonus, setBonus] = useState<{ passed: boolean; failures: TestResult[] } | null>(null)
  const timer = useTimer(ex.id)

  const setup = useMemo(() => setupOf(ex), [ex])
  const visibleTests = ex.tests.filter((t) => !t.hidden)
  const requireLocal = ex.engine === 'local'

  // Persist the code (debounced) so nothing is lost when navigating away.
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const onChange = (value: string) => {
    setCode(value)
    // In recall mode the attempt is not saved, so abandoning it keeps the previous solution.
    if (recall) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => useProgress.getState().saveExerciseCode(ex.id, value), 800)
  }
  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const onRun = useCallback(async () => {
    if (running) return
    setRunning(true)
    setMode('run')
    setProgressMsg(null)
    // The statement's examples are evaluated too: results show up without any print().
    const examples = ex.language === 'sql' ? [] : visibleTests.flatMap((t) => (t.call ? [t.call] : []))
    const res = await runCode(runnableCode(ex, code), { setup, requireLocal, examples, onProgress: setProgressMsg })
    setResult(res)
    setRunning(false)
  }, [code, ex, running, setup, requireLocal, visibleTests])

  const onSubmit = useCallback(async () => {
    if (running) return
    setRunning(true)
    setMode('test')
    setProgressMsg(null)
    useProgress.getState().recordAttempt(ex.id)
    const res = await runTests(
      { code: toPython(ex, code), solution: toPython(ex, ex.solution), setup, tests: ex.tests },
      { requireLocal, onProgress: setProgressMsg, timeoutMs: requireLocal ? 120_000 : 30_000 },
    )
    setResult(res)
    setRunning(false)
    if (res.ok && res.total && res.passed === res.total) {
      const state = useProgress.getState()
      const xp = state.solveExercise(ex.id, timer.seconds)
      state.saveExerciseCode(ex.id, code)
      savedCode.current = code
      if (recall) {
        state.recordRecall(ex.id, timer.seconds)
        setRecallDone({ seconds: timer.seconds, code })
        setRecall(false)
        if (recallRequested) setParams({}, { replace: true })
      }
      if (res.bonusTotal) {
        const failures = (res.tests ?? []).filter((t) => t.bonus && !t.passed)
        setBonus({ passed: failures.length === 0, failures })
        if (!failures.length) state.markOptimal(ex.id)
      } else {
        setBonus(null)
      }
      setJustSolved({ xp })
      setTab('learn')
      celebrate()
    }
  }, [code, ex, running, setup, requireLocal, timer.seconds, recall, recallRequested, setParams])

  const revealHint = () => {
    const next = hintsShown + 1
    setHintsShown(next)
    store.takeHint(ex.id, next - 1)
  }

  const openSolution = () => {
    setSolutionOpen(true)
    if (ep?.status !== 'solved') store.seeSolution(ex.id)
  }

  const startRecall = () => {
    clearTimeout(saveTimer.current)
    savedCode.current = useProgress.getState().p.exercises[ex.id]?.code ?? code
    setRecall(true)
    setRecallDone(null)
    setCode(ex.starter)
    setResult(null)
    setTab('statement')
    setJustSolved(null)
    setBonus(null)
    timer.restart()
  }

  // Arriving on ?recall=1 while the page is already open (e.g. from the Memory page).
  useEffect(() => {
    if (recallRequested && !recall) startRecall()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recallRequested])

  const exitRecall = () => {
    setRecall(false)
    setCode(savedCode.current)
    setResult(null)
    if (recallRequested) setParams({}, { replace: true })
  }

  const index = exercises.findIndex((e) => e.id === ex.id)
  const next = exercises.slice(index + 1).find((e) => e.domain === ex.domain) ?? exercises[index + 1]
  const solved = ep?.status === 'solved'
  const potentialXp = exerciseXp(ex.difficulty, hintsShown, !!ep?.solutionSeen)

  const allTabs: { id: Tab; label: React.ReactNode }[] = [
    { id: 'statement', label: 'Énoncé' },
    {
      id: 'hints',
      label: (
        <>
          <Lightbulb className="size-3.5" />
          Indices {ex.hints.length > 0 && <span className="text-faint">{hintsShown}/{ex.hints.length}</span>}
        </>
      ),
    },
    { id: 'solution', label: <>{solved || solutionOpen ? <Eye className="size-3.5" /> : <Lock className="size-3.5" />}Solution</> },
    ...(solved || solutionOpen
      ? [{ id: 'learn' as Tab, label: <><BookOpenCheck className="size-3.5" />À retenir</> }]
      : []),
    { id: 'notes', label: <NotebookPen className="size-3.5" aria-label="Notes" /> },
  ]
  // In recall mode only the statement stays visible.
  const tabs = recall ? allTabs.filter((t) => t.id === 'statement') : allTabs

  const left = (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-5 pt-4 pb-3">
        <div className="mb-3 flex items-center gap-2 text-xs text-faint">
          <button onClick={() => navigate('/exercices')} className="flex items-center gap-1 hover:text-fg">
            <ArrowLeft className="size-3.5" />
            Exercices
          </button>
          <span className="ml-auto flex items-center gap-1 font-mono" title="Chrono">
            <Timer className="size-3.5" />
            {timer.label}
          </span>
        </div>
        <h1 className="flex items-start gap-2 text-xl font-semibold tracking-tight">
          {solved && <CheckCircle2 className="mt-1 size-5 shrink-0 text-ok" />}
          {ex.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <DomainChip domain={ex.domain} />
          <DifficultyBadge difficulty={ex.difficulty} />
          <span className="chip">
            <Clock className="size-3" />~{ex.minutes} min
          </span>
          {ex.interview && (
            <span className="chip text-accent">
              <Mic className="size-3" />
              Entretien
            </span>
          )}
          {requireLocal && (
            <span className="chip text-warn">
              <Cpu className="size-3" />
              Runner local
            </span>
          )}
          {ex.complexity && (
            <span
              className={clsx('chip', ep?.optimal ? 'text-ok' : 'text-warn')}
              title="Bonus : atteindre la complexité optimale"
            >
              <Gauge className="size-3" />
              Bonus {ex.complexity.target}
            </span>
          )}
          {parsonsById.has(ex.id) && !recall && (
            <Link to={`/blocs/${ex.id}`} className="chip hover:text-fg" title="Remettre les lignes de la solution dans l’ordre, sans écrire de code">
              <Puzzle className="size-3" />
              En blocs
            </Link>
          )}
          {!solved && (
            <span className="chip ml-auto text-accent-2" title="XP si tu réussis maintenant">
              <Sparkles className="size-3" />
              {potentialXp} XP
            </span>
          )}
          {solved && !recall && (
            <button className="btn btn-ghost ml-auto px-2.5 py-1 text-xs" onClick={startRecall} title="Repartir d’une page blanche, sans indice ni solution">
              <Brain className="size-3.5 text-accent" />
              Réécrire de mémoire
            </button>
          )}
        </div>
        {recall && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/[0.08] px-3 py-2 text-sm">
            <Brain className="size-4 shrink-0 text-accent" />
            <div className="flex-1">
              <div className="font-medium">Mode mémoire</div>
              <div className="text-xs text-muted">
                Page blanche, ni indice ni solution. Soumets quand c’est prêt : tu verras la différence avec la référence.
                {ep?.bestRecallSec !== undefined && ` Record : ${formatSeconds(ep.bestRecallSec)}.`}
              </div>
            </div>
            <button className="btn btn-quiet px-2 py-1 text-xs" onClick={exitRecall}>
              <X className="size-3.5" />
              Quitter
            </button>
          </div>
        )}
        <Tabs className="mt-4 -mb-1" tabs={tabs} value={tab} onChange={setTab} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {tab === 'statement' && (
          <div className="space-y-5">
            {reviewDue && !recall && (
              <div className="flex items-center gap-3 rounded-xl border border-accent-2/30 bg-accent-2/[0.06] p-3 text-sm">
                <RotateCcw className="size-4 shrink-0 text-accent-2" />
                <div className="flex-1">
                  <div className="font-medium">Révision espacée</div>
                  <div className="text-xs text-muted">Re-résous-le de mémoire, sans regarder ta solution.</div>
                </div>
                <button className="btn btn-ghost px-3 py-1 text-xs" onClick={startRecall}>
                  <Brain className="size-3.5" />
                  Réécrire de mémoire
                </button>
              </div>
            )}
            {requireLocal && (
              <div className="rounded-xl border border-warn/30 bg-warn/[0.05] p-3 text-xs text-warn">
                Cet exercice utilise PyTorch, qui ne tourne pas dans le navigateur. Lance le runner local (
                <code>python runner/local_runner.py</code>) puis configure-le dans{' '}
                <Link to="/profil#moteur" className="underline">
                  Réglages
                </Link>
                .
              </div>
            )}
            <Markdown>{ex.statement}</Markdown>
            {visibleTests.some((t) => t.call) && (
              <div>
                <div className="section-title mb-2">Exemples</div>
                <div className="space-y-2">
                  {visibleTests
                    .filter((t) => t.call)
                    .map((t, i) => (
                      <div key={i} className="rounded-xl border border-line bg-black/20 p-3 font-mono text-xs">
                        <div className="text-muted">
                          <span className="text-faint">&gt;&gt;&gt; </span>
                          {t.call}
                        </div>
                        {t.expected && <div className="mt-1 text-ok/90">{t.expected}</div>}
                      </div>
                    ))}
                </div>
              </div>
            )}
            {ex.tests.some((t) => t.hidden) && (
              <p className="text-xs text-faint">
                + {ex.tests.filter((t) => t.hidden).length} test(s) caché(s) pour les cas limites.
              </p>
            )}
          </div>
        )}

        {tab === 'hints' && (
          <div className="space-y-3">
            {ex.hints.length === 0 && <p className="text-sm text-muted">Pas d’indice pour celui-ci : tu peux le faire !</p>}
            {ex.hints.slice(0, hintsShown).map((h, i) => (
              <div key={i} className="rounded-xl border border-warn/20 bg-warn/[0.04] p-4 animate-fade-up">
                <div className="mb-1 text-xs font-semibold text-warn">Indice {i + 1}</div>
                <Markdown>{h}</Markdown>
              </div>
            ))}
            {hintsShown < ex.hints.length && (
              <button className="btn btn-ghost w-full" onClick={revealHint}>
                <Lightbulb className="size-4 text-warn" />
                Révéler l’indice {hintsShown + 1}
                {!solved && <span className="text-xs text-faint">(−20 % XP)</span>}
              </button>
            )}
          </div>
        )}

        {tab === 'solution' && (
          <div className="space-y-4">
            {solved || solutionOpen ? (
              <>
                <CodeBlock code={ex.solution} language={ex.language ?? 'python'} />
                <button className="btn btn-ghost" onClick={() => onChange(ex.solution)}>
                  Copier dans l’éditeur
                </button>
              </>
            ) : (
              <div className="rounded-2xl border border-line bg-white/[0.02] p-6 text-center">
                <Lock className="mx-auto mb-3 size-6 text-faint" />
                <div className="font-medium">Solution verrouillée</div>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                  Bloqué ? Les indices aident sans tout dévoiler. Voir la solution réduit l’XP de cet exercice à 25 %, et
                  il reviendra plus vite en révision.
                </p>
                <button className="btn btn-ghost mt-4" onClick={openSolution}>
                  <Eye className="size-4" />
                  Voir la solution
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'learn' && (
          <div className="space-y-5">
            {justSolved && (
              <SolvedPanel ex={ex} xp={justSolved.xp} seconds={recallDone?.seconds ?? timer.seconds} next={next} />
            )}
            {bonus && ex.complexity && <BonusPanel ex={ex} bonus={bonus} />}
            {recallDone && <RecallPanel ex={ex} attempt={recallDone.code} seconds={recallDone.seconds} />}
            <div>
              <div className="section-title mb-2">À retenir</div>
              <Markdown>{ex.explanation}</Markdown>
            </div>
            {ex.cards && ex.cards.length > 0 && (
              <div>
                <div className="section-title mb-2">Cartes de syntaxe liées</div>
                <div className="space-y-1.5">
                  {ex.cards.map((cid) => {
                    const c = cardById.get(cid)
                    if (!c) return null
                    return (
                      <div key={cid} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2 text-sm">
                        <span className="flex-1 text-muted">{c.prompt}</span>
                        <code className="font-mono text-xs text-accent-2">{c.answer.split('\n')[0]}</code>
                      </div>
                    )
                  })}
                </div>
                <Link to={`/memoire/revision?deck=${cardById.get(ex.cards[0])?.deck ?? ''}`} className="mt-2 inline-flex text-xs text-accent hover:underline">
                  Réviser ce paquet →
                </Link>
              </div>
            )}
          </div>
        )}

        {tab === 'notes' && (
          <div>
            <div className="section-title mb-2">Mes notes</div>
            <textarea
              className="input min-h-64 font-mono text-xs leading-relaxed"
              placeholder="Ce que j’ai appris, le piège à éviter, la syntaxe à retenir…"
              defaultValue={ep?.notes ?? ''}
              onBlur={(e) => store.setNotes(ex.id, e.target.value)}
            />
            <p className="mt-2 text-xs text-faint">Sauvegardé automatiquement quand tu quittes le champ.</p>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <SplitPane
      storageKey="ct.split.exercise"
      left={left}
      right={
        <Workspace
          code={code}
          onChange={onChange}
          onRun={onRun}
          onSubmit={onSubmit}
          onReset={() => {
            if (code === ex.starter || confirm('Revenir au code de départ ? Ton code actuel sera perdu.')) onChange(ex.starter)
          }}
          running={running}
          mode={mode}
          result={result}
          progress={progressMsg}
          language={ex.language}
          docLib={docLibForDomain(ex.domain, requireLocal)}
          banner={
            recall ? (
              <div className="flex items-center gap-2 border-b border-accent/30 bg-accent/[0.08] px-3 py-1.5 text-xs text-accent">
                <Brain className="size-3.5" />
                Mode mémoire : {timer.label}
              </div>
            ) : undefined
          }
        />
      }
    />
  )
}

function SolvedPanel({ ex, xp, seconds, next }: { ex: Exercise; xp: number; seconds: number; next?: Exercise }) {
  const reviewExercise = useProgress((s) => s.reviewExercise)
  const [picked, setPicked] = useState<Grade | null>(null)
  const options: { grade: Grade; label: string }[] = [
    { grade: 1, label: 'Laborieux' },
    { grade: 2, label: 'Correct' },
    { grade: 3, label: 'Facile' },
  ]
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ok/30 bg-gradient-to-br from-ok/[0.12] to-accent-2/[0.05] p-5 animate-pop">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-ok/20 text-ok">
          <CheckCircle2 className="size-6" />
        </div>
        <div className="flex-1">
          <div className="text-lg font-semibold">Bravo, tous les tests passent !</div>
          <div className="text-sm text-muted">
            {xp > 0 ? `+${xp} XP · ` : ''}
            {Math.floor(seconds / 60)} min {seconds % 60} s
          </div>
        </div>
      </div>
      <div className="mt-4 text-xs text-muted">Comment c’était ? (planifie la prochaine révision)</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const interval = scheduleAfterSolve(o.grade).interval
          return (
            <button
              key={o.grade}
              onClick={() => {
                setPicked(o.grade)
                reviewExercise(ex.id, o.grade, true)
              }}
              className={clsx('btn btn-ghost px-3 py-1.5 text-xs', picked === o.grade && 'border-ok/50 bg-ok/10')}
            >
              {o.label}
              <span className="text-faint">{formatInterval(interval)}</span>
            </button>
          )
        })}
        {next && (
          <Link to={`/exercices/${next.id}`} className="btn btn-primary ml-auto px-3 py-1.5 text-xs">
            Suivant
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
    </div>
  )
}

function formatSeconds(sec: number) {
  return sec >= 60 ? `${Math.floor(sec / 60)} min ${sec % 60} s` : `${sec} s`
}

function BonusPanel({ ex, bonus }: { ex: Exercise; bonus: { passed: boolean; failures: TestResult[] } }) {
  if (bonus.passed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-ok/30 bg-ok/[0.06] p-4 animate-fade-up">
        <Medal className="size-6 shrink-0 text-ok" />
        <div>
          <div className="font-semibold text-ok">Complexité optimale : {ex.complexity!.target}</div>
          <div className="text-xs text-muted">Ta solution passe aussi le test de performance. Exactement ce qu’on attend en entretien.</div>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-warn/30 bg-warn/[0.06] p-4 animate-fade-up">
      <div className="flex items-center gap-2 font-semibold text-warn">
        <Gauge className="size-5" />
        Validé, mais il y a mieux
      </div>
      <p className="mt-1 text-sm text-muted">
        Ta solution est correcte, mais elle n’atteint pas la complexité attendue en entretien (
        <span className="font-mono text-fg">{ex.complexity!.target}</span>).
      </p>
      {bonus.failures.map((f, i) => f.error && (
        <pre key={i} className="mt-2 rounded-lg bg-black/30 p-2 font-mono text-xs whitespace-pre-wrap text-warn/90">{f.error}</pre>
      ))}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-accent">Une piste pour optimiser</summary>
        <Markdown className="mt-2">{ex.complexity!.note}</Markdown>
      </details>
    </div>
  )
}

function RecallPanel({ ex, attempt, seconds }: { ex: Exercise; attempt: string; seconds: number }) {
  const ep = useProgress((s) => s.p.exercises[ex.id])
  const diff = useMemo(() => diffLines(ex.solution, attempt), [ex.solution, attempt])
  const score = similarity(diff)
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/[0.05] p-4 animate-fade-up">
      <div className="flex flex-wrap items-center gap-3">
        <Brain className="size-5 text-accent" />
        <div className="flex-1">
          <div className="font-semibold">Réécrit de mémoire en {formatSeconds(seconds)}</div>
          <div className="text-xs text-muted">
            {ep?.recalls ?? 1} fois au total
            {ep?.bestRecallSec !== undefined && ` · record ${formatSeconds(ep.bestRecallSec)}`} · {Math.round(score * 100)} %
            des lignes identiques à la référence
          </div>
        </div>
      </div>
      <div className="mt-3 text-[11px] text-faint">
        Différences avec la solution de référence (<span className="text-bad">− référence</span>,{' '}
        <span className="text-ok">+ ta version</span>). Deux solutions différentes peuvent être toutes deux justes : regarde
        surtout la syntaxe.
      </div>
      <pre className="mt-2 max-h-80 overflow-auto rounded-xl border border-line bg-black/40 py-2 font-mono text-xs leading-relaxed">
        {diff.map((d, i) => (
          <div
            key={i}
            className={clsx(
              'px-3',
              d.kind === 'add' && 'bg-ok/10 text-ok',
              d.kind === 'del' && 'bg-bad/10 text-bad',
              d.kind === 'same' && 'text-[#c0caf5]/80',
            )}
          >
            <span className="mr-2 select-none opacity-60">{d.kind === 'add' ? '+' : d.kind === 'del' ? '−' : ' '}</span>
            {d.text}
          </div>
        ))}
      </pre>
    </div>
  )
}
