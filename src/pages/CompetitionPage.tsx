import clsx from 'clsx'
import {
  ArrowLeft, CheckCircle2, ChevronDown, Database, Eye, Lightbulb, Loader2, Lock, Medal as MedalIcon, Play, RotateCcw, Send, Trophy,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CodeEditor } from '@/components/CodeEditor'
import { CodeBlock, Markdown } from '@/components/Markdown'
import { OutputPanel } from '@/components/OutputPanel'
import { DifficultyBadge, Empty } from '@/components/ui'
import { describeResult, useAskContext } from '@/lib/askClaude'
import { celebrate } from '@/lib/celebrate'
import { competitionById, setupOf } from '@/lib/content'
import { runCode, runTests } from '@/lib/engine'
import { MEDAL_LABEL, useProgress, type Medal } from '@/lib/progress'
import type { Competition, CompetitionStep, RunResult } from '@/lib/types'
import { formatScore, MEDAL_EMOJI, medalFor } from './Competitions'

/** The previous cells run silently before the current one, in the same namespace (like a notebook). */
function withPreviousCells(setup: string, cells: string[]): string {
  if (!cells.length) return setup
  const code = cells.join('\n\n')
  return `${setup}
import contextlib as _ct_cl, io as _ct_io, sys as _ct_sys
try:
    with _ct_cl.redirect_stdout(_ct_io.StringIO()):
        exec(compile(${JSON.stringify(code)}, '<cellules précédentes>', 'exec'), globals())
except Exception as _ct_err:
    raise RuntimeError(f"Une cellule précédente plante ({type(_ct_err).__name__} : {_ct_err}). Corrige-la et revalide-la d'abord.") from None
if 'matplotlib.pyplot' in _ct_sys.modules:
    _ct_sys.modules['matplotlib.pyplot'].close('all')
`
}

export default function CompetitionPage() {
  const { id = '' } = useParams()
  const comp = competitionById.get(id)
  if (!comp) {
    return (
      <Empty icon={<Trophy className="size-6" />} title="Compétition introuvable">
        <Link to="/competitions" className="btn btn-ghost mt-4">
          Retour aux compétitions
        </Link>
      </Empty>
    )
  }
  return <CompetitionView key={comp.id} comp={comp} />
}

interface CellState {
  result: RunResult | null
  mode: 'run' | 'test' | null
  running: 'run' | 'test' | null
  hints: number
  showSolution: boolean
  justPassed: boolean
}

const emptyCell = (): CellState => ({ result: null, mode: null, running: null, hints: 0, showSolution: false, justPassed: false })

function CompetitionView({ comp }: { comp: Competition }) {
  const saved = useProgress((s) => s.p.competitions?.[comp.id])
  const store = useProgress()
  const setup = useMemo(() => setupOf(comp), [comp])
  const [codes, setCodes] = useState<Record<string, string>>(() =>
    Object.fromEntries(comp.steps.map((s) => [s.id, saved?.cells[s.id] ?? s.starter])),
  )
  const [cells, setCells] = useState<Record<string, CellState>>(() => Object.fromEntries(comp.steps.map((s) => [s.id, emptyCell()])))
  const [score, setScore] = useState<{ value: number; medal?: Medal; xp: number } | null>(null)
  const [scoring, setScoring] = useState(false)
  const [showStory, setShowStory] = useState(!saved?.stepsDone.length)
  const done = new Set(saved?.stepsDone ?? [])
  const firstOpen = comp.steps.findIndex((s) => !done.has(s.id))

  // "Ask Claude" sees the first unfinished step of the notebook (or the last one).
  const askStep = comp.steps[firstOpen >= 0 ? firstOpen : comp.steps.length - 1]
  useAskContext(
    useMemo(
      () => ({
        kind: 'Compétition façon Kaggle',
        title: `${comp.title} · étape « ${askStep.title} »`,
        english: comp.id === 'rag',
        sections: [
          { label: 'Le problème', content: comp.summary },
          { label: 'Consignes de l’étape', content: `${askStep.goal}\n\n${askStep.instructions}` },
          { label: 'Ma cellule', content: codes[askStep.id] ?? '', code: 'python' },
          { label: 'Dernière exécution', content: describeResult(cells[askStep.id]?.result ?? null) },
        ],
        suggestions: ['Donne-moi un indice', 'Pourquoi ma cellule échoue ?', 'Comment améliorer mon score ?'],
      }),
      [comp, askStep, codes, cells],
    ),
  )
  const unlocked = (i: number) => i === 0 || done.has(comp.steps[i - 1].id)
  const refs = useRef<Record<string, HTMLElement | null>>({})
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const better = useCallback((a: number, b: number) => (comp.higher_is_better ? a > b : a < b), [comp])

  useEffect(() => () => Object.values(saveTimers.current).forEach(clearTimeout), [])

  const patch = (stepId: string, p: Partial<CellState>) => setCells((c) => ({ ...c, [stepId]: { ...c[stepId], ...p } }))

  const onChange = (stepId: string, v: string) => {
    setCodes((c) => ({ ...c, [stepId]: v }))
    patch(stepId, { justPassed: false })
    clearTimeout(saveTimers.current[stepId])
    saveTimers.current[stepId] = setTimeout(() => store.saveCompetitionCell(comp.id, stepId, v), 600)
  }

  const previous = (i: number) => comp.steps.slice(0, i).map((s) => codes[s.id])

  const run = async (i: number) => {
    const step = comp.steps[i]
    if (cells[step.id].running) return
    patch(step.id, { running: 'run', mode: 'run' })
    const prev = previous(i)
    const res = await runCode(codes[step.id], { setup: withPreviousCells(setup, prev), timeoutMs: 180_000, importsFrom: prev })
    patch(step.id, { running: null, result: res })
  }

  const submitScore = async () => {
    setScoring(true)
    const all = comp.steps.map((s) => codes[s.id])
    const res = await runCode(`print('__SCORE__', repr(float(_score(submission))))`, { setup: withPreviousCells(setup, all), timeoutMs: 240_000, importsFrom: all })
    setScoring(false)
    const m = /__SCORE__ ([0-9.eE+-]+)/.exec(res.stdout ?? '')
    if (!m) return
    const value = parseFloat(m[1])
    const medal = medalFor(comp, value)
    const xp = store.submitCompetition(comp.id, value, medal, better)
    setScore({ value, medal, xp })
    if (medal) celebrate()
  }

  const validate = async (i: number) => {
    const step = comp.steps[i]
    if (cells[step.id].running) return
    store.saveCompetitionCell(comp.id, step.id, codes[step.id])
    patch(step.id, { running: 'test', mode: 'test' })
    const prev = previous(i)
    const res = await runTests(
      { code: codes[step.id], setup: withPreviousCells(setup, prev), tests: step.tests },
      { timeoutMs: 240_000, importsFrom: prev },
    )
    const passed = !!res.ok && !!res.total && res.passed === res.total
    patch(step.id, { running: null, result: res, justPassed: passed })
    if (!passed) return
    store.completeCompetitionStep(comp.id, step.id)
    if (step.id === 'submit') {
      await submitScore()
    } else {
      const next = comp.steps[i + 1]
      if (next) setTimeout(() => refs.current[next.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
    }
  }

  const reset = (step: CompetitionStep) => {
    if (!confirm('Remettre cette cellule à son état de départ ?')) return
    onChange(step.id, step.starter)
    patch(step.id, emptyCell())
  }

  const rows = useMemo(() => {
    const you = saved?.best !== undefined ? [{ name: 'Toi', score: saved.best, you: true }] : []
    return [...comp.leaderboard.map((r) => ({ ...r, you: false })), ...you].sort((a, b) => (comp.higher_is_better ? b.score - a.score : a.score - b.score))
  }, [comp, saved?.best])

  return (
    <div className="mx-auto max-w-7xl">
      <Link to="/competitions" className="mb-3 inline-flex items-center gap-1 text-xs text-faint hover:text-fg">
        <ArrowLeft className="size-3.5" />
        Compétitions
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.04] text-4xl">{comp.emoji}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{comp.title}</h1>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="chip">{comp.task}</span>
            <span className="chip">
              Métrique : {comp.metric_label} {comp.higher_is_better ? '↑' : '↓'}
            </span>
            <DifficultyBadge difficulty={comp.difficulty} />
          </div>
        </div>
        {saved?.medal && (
          <div className="flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/[0.06] px-3 py-2 text-sm">
            <span className="text-2xl">{MEDAL_EMOJI[saved.medal]}</span>
            <span>
              Médaille {MEDAL_LABEL[saved.medal]}
              <span className="block text-xs text-muted">meilleur score {formatScore(comp, saved.best!)}</span>
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <section className="card overflow-hidden">
            <button className="flex w-full items-center gap-2 px-5 py-3 text-left" onClick={() => setShowStory((v) => !v)} aria-expanded={showStory}>
              <Database className="size-4 text-accent" />
              <span className="font-medium">Le problème et les données</span>
              <ChevronDown className={clsx('ml-auto size-4 text-faint transition', showStory && 'rotate-180')} />
            </button>
            {showStory && (
              <div className="grid gap-6 border-t border-line px-5 py-5 lg:grid-cols-2">
                <Markdown>{comp.story}</Markdown>
                <Markdown>{comp.data}</Markdown>
              </div>
            )}
          </section>

          {comp.steps.map((step, i) => {
            const cell = cells[step.id]
            const isDone = done.has(step.id)
            const open = unlocked(i)
            return (
              <section
                key={step.id}
                ref={(el) => {
                  refs.current[step.id] = el
                }}
                className={clsx('card scroll-mt-4 overflow-hidden', i === firstOpen && 'ring-1 ring-accent/40')}
                data-step={step.id}
              >
                <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
                  <span
                    className={clsx(
                      'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      isDone ? 'bg-ok/20 text-ok' : open ? 'bg-accent/20 text-accent' : 'bg-white/5 text-faint',
                    )}
                  >
                    {isDone ? <CheckCircle2 className="size-4" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{step.title}</h2>
                    <p className="text-xs text-muted">{step.goal}</p>
                  </div>
                  {!open && <Lock className="size-4 text-faint" aria-label="Verrouillée" />}
                </div>

                {!open ? (
                  <div className="px-5 py-6 text-sm text-faint">Valide l’étape précédente pour débloquer celle-ci.</div>
                ) : (
                  <div className="space-y-4 px-5 py-5">
                    <Markdown>{step.instructions}</Markdown>
                    <div className="overflow-hidden rounded-xl border border-line bg-[#0b0d14]">
                      <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-2 py-1.5">
                        <span className="px-2 font-mono text-[11px] text-faint">[{i + 1}]</span>
                        <button className="btn btn-ghost px-2.5 py-1 text-xs" onClick={() => run(i)} disabled={!!cell.running} title="Exécuter la cellule (Ctrl+Entrée)">
                          {cell.running === 'run' ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                          Exécuter
                        </button>
                        <button className="btn btn-primary px-2.5 py-1 text-xs" onClick={() => validate(i)} disabled={!!cell.running} title="Valider l’étape (Ctrl+Maj+Entrée)">
                          {cell.running === 'test' ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                          {step.id === 'submit' ? 'Soumettre' : 'Valider l’étape'}
                        </button>
                        <span className="ml-auto flex gap-1">
                          <button
                            className="btn btn-quiet px-2 py-1 text-xs"
                            onClick={() => patch(step.id, { hints: Math.min(cell.hints + 1, step.hints.length) })}
                            disabled={cell.hints >= step.hints.length}
                          >
                            <Lightbulb className="size-3.5" />
                            Indice {cell.hints}/{step.hints.length}
                          </button>
                          <button className="btn btn-quiet px-2 py-1 text-xs" onClick={() => patch(step.id, { showSolution: !cell.showSolution })}>
                            <Eye className="size-3.5" />
                            Solution
                          </button>
                          <button className="btn btn-quiet px-2 py-1 text-xs" onClick={() => reset(step)} title="Réinitialiser la cellule">
                            <RotateCcw className="size-3.5" />
                          </button>
                        </span>
                      </div>
                      <CodeEditor
                        value={codes[step.id]}
                        onChange={(v) => onChange(step.id, v)}
                        onRun={() => run(i)}
                        onSubmit={() => validate(i)}
                        errorLine={cell.result?.errorLine}
                        height="auto"
                        minHeight="120px"
                      />
                    </div>

                    {cell.hints > 0 && (
                      <div className="space-y-2">
                        {step.hints.slice(0, cell.hints).map((h, k) => (
                          <div key={k} className="flex gap-2 rounded-xl border border-warn/25 bg-warn/[0.05] px-4 py-2.5 text-sm">
                            <Lightbulb className="mt-0.5 size-4 shrink-0 text-warn" />
                            <Markdown className="[&_p]:my-0">{h}</Markdown>
                          </div>
                        ))}
                      </div>
                    )}

                    {cell.showSolution && (
                      <div className="rounded-xl border border-line bg-white/[0.02] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="section-title">Une solution possible</span>
                          <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => onChange(step.id, step.solution)}>
                            Copier dans la cellule
                          </button>
                        </div>
                        <CodeBlock code={step.solution} />
                      </div>
                    )}

                    {(cell.running || cell.result) && (
                      <div className="rounded-xl border border-line bg-black/20 p-3">
                        <OutputPanel result={cell.result} running={!!cell.running} mode={cell.running ?? cell.mode ?? 'run'} />
                      </div>
                    )}

                    {cell.justPassed && (
                      <div className="rounded-xl border border-ok/30 bg-ok/[0.05] p-4 animate-fade-up">
                        <div className="mb-1 flex items-center gap-2 font-medium text-ok">
                          <CheckCircle2 className="size-4" />
                          Étape validée
                        </div>
                        <Markdown>{step.explanation}</Markdown>
                      </div>
                    )}

                    {step.id === 'submit' && (scoring || score) && (
                      <ScoreCard comp={comp} scoring={scoring} score={score} />
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div className="card p-4">
            <div className="section-title mb-3 flex items-center gap-2">
              <MedalIcon className="size-4" /> Médailles
            </div>
            {(['gold', 'silver', 'bronze'] as Medal[]).map((m) => (
              <div key={m} className={clsx('flex items-center justify-between rounded-lg px-2 py-1.5 text-sm', saved?.medal === m && 'bg-warn/10')}>
                <span>
                  {MEDAL_EMOJI[m]} {m === 'gold' ? 'Or' : m === 'silver' ? 'Argent' : 'Bronze'}
                </span>
                <span className="font-mono text-xs text-muted">
                  {comp.higher_is_better ? '≥' : '≤'} {formatScore(comp, comp.medals[m])}
                </span>
              </div>
            ))}
          </div>
          <div className="card p-4" data-leaderboard>
            <div className="section-title mb-3 flex items-center gap-2">
              <Trophy className="size-4" /> Classement (test caché)
            </div>
            <ol className="space-y-0.5 text-sm">
              {rows.map((r, k) => {
                const m = medalFor(comp, r.score)
                return (
                  <li key={r.name + r.score} className={clsx('flex items-center gap-2 rounded-lg px-2 py-1', r.you && 'bg-accent/15 font-semibold text-fg')}>
                    <span className="w-5 text-right text-xs text-faint">{k + 1}</span>
                    <span className="w-5 text-center">{m ? MEDAL_EMOJI[m] : ''}</span>
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="font-mono text-xs">{formatScore(comp, r.score)}</span>
                  </li>
                )
              })}
            </ol>
            {saved?.best === undefined && <p className="mt-3 text-xs text-faint">Soumets à la dernière étape pour apparaître au classement.</p>}
          </div>
          <div className="card p-4">
            <div className="section-title mb-2">Progression</div>
            <ol className="space-y-1 text-sm">
              {comp.steps.map((s, i) => (
                <li key={s.id}>
                  <button
                    className={clsx('flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-white/[0.04]', !unlocked(i) && 'text-faint')}
                    onClick={() => refs.current[s.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  >
                    {done.has(s.id) ? <CheckCircle2 className="size-4 text-ok" /> : unlocked(i) ? <span className="size-4 rounded-full border border-accent/60" /> : <Lock className="size-4" />}
                    {s.title}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  )
}

function ScoreCard({ comp, scoring, score }: { comp: Competition; scoring: boolean; score: { value: number; medal?: Medal; xp: number } | null }) {
  if (scoring || !score) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line p-5 text-sm text-muted">
        <Loader2 className="size-5 animate-spin" />
        Calcul du score sur le test caché…
      </div>
    )
  }
  const next = !score.medal ? 'bronze' : score.medal === 'bronze' ? 'silver' : score.medal === 'silver' ? 'gold' : null
  return (
    <div className={clsx('rounded-2xl border p-5 animate-fade-up', score.medal ? 'border-warn/40 bg-warn/[0.06]' : 'border-line bg-white/[0.02]')} data-score>
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-5xl">{score.medal ? MEDAL_EMOJI[score.medal] : '📉'}</span>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-faint">Score sur le test caché</div>
          <div className="text-3xl font-semibold tabular-nums">{formatScore(comp, score.value)}</div>
          <div className="text-sm text-muted">
            {score.medal ? `Médaille ${MEDAL_LABEL[score.medal]} !` : 'Pas encore de médaille.'}
            {score.xp > 0 && ` +${score.xp} XP`}
          </div>
        </div>
      </div>
      {next && (
        <p className="mt-3 text-sm text-muted">
          Prochaine marche : {MEDAL_EMOJI[next]} {comp.higher_is_better ? 'au moins' : 'au plus'} {formatScore(comp, comp.medals[next])}. Améliore les variables ou le modèle (étapes 3 et 5),
          revalide, puis resoumets.
        </p>
      )}
    </div>
  )
}
