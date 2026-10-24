import clsx from 'clsx'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Eye, Lightbulb, Loader2, Play, Puzzle, Send, Shuffle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CodeBlock, Markdown } from '@/components/Markdown'
import { OutputPanel } from '@/components/OutputPanel'
import { DifficultyBadge, DomainChip, Empty } from '@/components/ui'
import { SplitPane } from '@/components/Workspace'
import { parsonsById, parsonsProblems, setupOf, toPython } from '@/lib/content'
import { runCode, runTests } from '@/lib/engine'
import { assemble, distractorBlocks, shuffled, toBlocks, type ParsonsBlock } from '@/lib/parsons'
import { useProgress } from '@/lib/progress'
import type { ParsonsProblem, RunResult } from '@/lib/types'
import { celebrate } from './ExercisePage'
import { ParsonsBoard, type BoardState } from './ParsonsBoard'

const MODE_KEY = 'ct.parsons.mode'

interface Mode {
  /** The learner places the indentation (otherwise blocks come pre-indented). */
  indent: boolean
  /** Distractor blocks are mixed in. */
  traps: boolean
}

function loadMode(): Mode {
  try {
    return { indent: true, traps: false, ...JSON.parse(localStorage.getItem(MODE_KEY) ?? '{}') }
  } catch {
    return { indent: true, traps: false }
  }
}

type Board = BoardState

const blockText = (b: ParsonsBlock) => b.lines.join('\n')

export default function ParsonsPage() {
  const { id } = useParams()
  const problem = id ? parsonsById.get(id) : undefined
  if (!problem) {
    return (
      <Empty icon={<Puzzle className="size-6" />} title="Problème introuvable">
        <Link to="/blocs" className="btn btn-ghost mt-4">
          Retour aux blocs
        </Link>
      </Empty>
    )
  }
  return <ParsonsGame key={problem.id} problem={problem} />
}

function ParsonsGame({ problem }: { problem: ParsonsProblem }) {
  const navigate = useNavigate()
  const store = useProgress()
  const pp = store.p.parsons?.[problem.id]
  const isSql = problem.language === 'sql'
  const [mode, setModeState] = useState<Mode>(loadMode)
  // SQL has no meaningful indentation; problems without distractors cannot have traps.
  const indentMode = mode.indent && !isSql
  const trapsMode = mode.traps && problem.distractors.length > 0

  const reference = useMemo(() => toBlocks(problem.solution, problem.language), [problem])
  const blocks = useMemo(() => {
    const all = [...reference, ...(trapsMode ? distractorBlocks(reference, problem.distractors) : [])]
    return new Map(all.map((b) => [b.id, b]))
  }, [reference, trapsMode, problem.distractors])

  const freshBoard = useCallback(
    (): Board => ({ pool: shuffled([...blocks.keys()], Date.now()), program: [], indents: {} }),
    [blocks],
  )
  const [board, setBoard] = useState<Board>(freshBoard)
  useEffect(() => setBoard(freshBoard()), [freshBoard])

  const [result, setResult] = useState<RunResult | null>(null)
  const [running, setRunning] = useState<'run' | 'test' | null>(null)
  const [solvedNow, setSolvedNow] = useState<{ xp: number } | null>(null)
  const [hint, setHint] = useState<{ id: string | null; text: string } | null>(null)
  const [showSolution, setShowSolution] = useState(false)

  const setMode = (m: Mode) => {
    setModeState(m)
    try {
      localStorage.setItem(MODE_KEY, JSON.stringify(m))
    } catch {
      /* storage unavailable */
    }
  }

  const indentOf = (bid: string) => (indentMode ? board.indents[bid] ?? 0 : blocks.get(bid)?.indent ?? 0)
  const changed = () => {
    setHint(null)
    setSolvedNow(null)
  }

  const program = () =>
    assemble(board.program.map((bid) => ({ block: blocks.get(bid)!, indent: indentOf(bid) })))

  // ------------------------------------------------------------- actions

  const visibleCalls = problem.tests.filter((t) => !t.hidden && t.call).map((t) => t.call!)

  const onRun = async () => {
    if (!board.program.length) return
    setRunning('run')
    setResult(null)
    const code = isSql ? `${toPython(problem, program())}show(QUERY)\n` : program()
    const res = await runCode(code, { setup: setupOf(problem), examples: isSql ? undefined : visibleCalls })
    setResult(res)
    setRunning(null)
  }

  const onValidate = async () => {
    if (!board.program.length) return
    setRunning('test')
    setResult(null)
    setHint(null)
    store.attemptParsons(problem.id)
    const res = await runTests({
      code: toPython(problem, program()),
      solution: toPython(problem, problem.solution),
      setup: setupOf(problem),
      tests: problem.tests,
    })
    setResult(res)
    setRunning(null)
    if (res.ok && res.total && res.passed === res.total) {
      const xp = store.solveParsons(problem.id, { indent: indentMode, traps: trapsMode })
      setSolvedNow({ xp })
      celebrate()
    }
  }

  const onHint = () => {
    const prog = board.program
    for (let i = 0; i < prog.length; i++) {
      const got = blocks.get(prog[i])!
      if (got.distractor) return setHint({ id: prog[i], text: 'Ce bloc est un piège : il ressemble à une vraie ligne, mais il contient une erreur.' })
      const ref = reference[i]
      if (!ref || blockText(ref) !== blockText(got)) {
        return setHint({ id: prog[i], text: 'D’après la solution de référence, ce bloc n’est pas à sa place (il existe parfois d’autres ordres valides).' })
      }
      if (indentMode && indentOf(prog[i]) !== ref.indent) {
        return setHint({ id: prog[i], text: `Ce bloc devrait être indenté de ${ref.indent} niveau${ref.indent > 1 ? 'x' : ''}.` })
      }
    }
    if (prog.length < reference.length) {
      return setHint({ id: prog[prog.length - 1] ?? null, text: `Tout est bon jusqu’ici. Il manque encore ${reference.length - prog.length} bloc(s) à la suite.` })
    }
    setHint({ id: null, text: 'Ton programme correspond à la solution de référence : valide-le !' })
  }

  const reset = () => {
    changed()
    setResult(null)
    setShowSolution(false)
    setBoard(freshBoard())
  }

  const next = useMemo(() => {
    const i = parsonsProblems.findIndex((p) => p.id === problem.id)
    const rest = [...parsonsProblems.slice(i + 1), ...parsonsProblems.slice(0, i)]
    return rest.find((p) => p.domain === problem.domain && !store.p.parsons?.[p.id]?.solvedAt) ?? rest.find((p) => !store.p.parsons?.[p.id]?.solvedAt)
  }, [problem, store.p.parsons])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) void onValidate()
        else void onRun()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const solved = !!pp?.solvedAt

  // ------------------------------------------------------------- layout

  const left = (
    <div className="flex h-full min-w-0 flex-col">
      <div className="border-b border-line px-5 pt-4 pb-3">
        <button className="mb-2 flex items-center gap-1 text-xs text-faint hover:text-fg" onClick={() => navigate('/blocs')}>
          <ArrowLeft className="size-3.5" />
          Blocs de code
        </button>
        <h1 className="flex items-start gap-2 text-xl font-semibold tracking-tight">
          {solved && <CheckCircle2 className="mt-1 size-5 shrink-0 text-ok" />}
          {problem.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <DomainChip domain={problem.domain} />
          <DifficultyBadge difficulty={problem.difficulty} />
          <span className="chip">
            <Puzzle className="size-3" />
            {reference.length} blocs
          </span>
          {problem.source === 'exercise' && (
            <Link to={`/exercices/${problem.id}`} className="chip hover:text-fg">
              Version à écrire
              <ArrowRight className="size-3" />
            </Link>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div className="rounded-xl border border-accent/25 bg-accent/[0.06] p-3 text-xs leading-relaxed text-muted">
          Construis <b className="text-fg">ton programme</b> dans le bon ordre : un clic sur un bloc l’ajoute sous la ligne sélectionnée,
          un glisser-déposer le place exactement où la ligne en pointillés l’indique.
          {indentMode && (
            <> L’indentation se règle en glissant plus à gauche ou plus à droite (le niveau s’affiche), ou avec <kbd>Tab</kbd> / <kbd>Maj+Tab</kbd> sur la ligne sélectionnée.
            Après une ligne qui finit par <code>:</code>, le bloc ajouté par clic est indenté automatiquement.</>
          )}
          {trapsMode && <> Attention : certains blocs sont des <b className="text-warn">pièges</b> à laisser de côté.</>}
          {' '}Valide avec <kbd>Ctrl+Maj+Entrée</kbd> : les tests de l’exercice tournent sur ton programme.
        </div>
        <Markdown>{problem.statement}</Markdown>
        {solvedNow && problem.explanation && (
          <div>
            <div className="section-title mb-2">À retenir</div>
            <Markdown>{problem.explanation}</Markdown>
          </div>
        )}
      </div>
    </div>
  )

  const right = (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <Toggle
          on={indentMode}
          disabled={isSql}
          onClick={() => setMode({ ...mode, indent: !mode.indent })}
          label="Indentation à placer"
          title={isSql ? 'Pas d’indentation en SQL' : 'Sinon, les blocs arrivent déjà indentés'}
        />
        <Toggle
          on={trapsMode}
          disabled={!problem.distractors.length}
          onClick={() => setMode({ ...mode, traps: !mode.traps })}
          label={`Pièges${problem.distractors.length ? ` (${problem.distractors.length})` : ''}`}
          title={problem.distractors.length ? 'Ajoute des lignes fausses mais plausibles' : 'Pas de piège pour ce problème'}
        />
        <div className="ml-auto flex items-center gap-1.5">
          <button className="btn btn-quiet px-2 py-1 text-xs" onClick={reset} title="Tout remettre et mélanger">
            <Shuffle className="size-3.5" />
            <span className="hidden sm:inline">Mélanger</span>
          </button>
          <button className="btn btn-quiet px-2 py-1 text-xs" onClick={onHint} disabled={!board.program.length} title="Repère le premier bloc qui diffère de la référence">
            <Lightbulb className="size-3.5" />
            <span className="hidden sm:inline">Indice</span>
          </button>
          <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={onRun} disabled={!!running || !board.program.length} title="Exécuter sans valider (Ctrl+Entrée)">
            <Play className="size-4" />
            <span className="hidden sm:inline">Exécuter</span>
          </button>
          <button className="btn btn-primary px-3 py-1.5 text-sm" onClick={onValidate} disabled={!!running || !board.program.length} title="Valider (Ctrl+Maj+Entrée)">
            {running === 'test' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Valider
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3" data-scroll>
        <ParsonsBoard
          blocks={blocks}
          state={board}
          onChange={(b) => {
            changed()
            setBoard(b)
          }}
          indentMode={indentMode}
          language={problem.language}
          highlighted={hint?.id}
        />

        {hint && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/[0.06] p-3 text-sm text-warn">
            <Lightbulb className="mt-0.5 size-4 shrink-0" />
            <span>{hint.text}</span>
          </div>
        )}

        {solvedNow && (
          <div className="mt-3 rounded-2xl border border-ok/30 bg-ok/[0.06] p-4 animate-fade-up">
            <div className="flex flex-wrap items-center gap-3">
              <CheckCircle2 className="size-6 text-ok" />
              <div className="flex-1">
                <div className="font-semibold">Programme correct !</div>
                <div className="text-xs text-muted">
                  {solvedNow.xp > 0 ? `+${solvedNow.xp} XP` : 'Déjà réussi dans ce mode'}
                  {!indentMode && !isSql && ' · Essaie maintenant en plaçant aussi l’indentation.'}
                  {indentMode && !trapsMode && problem.distractors.length > 0 && ' · Essaie maintenant avec les pièges.'}
                </div>
              </div>
              <button className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => setShowSolution((s) => !s)}>
                <Eye className="size-3.5" />
                Référence
              </button>
              {next && (
                <button className="btn btn-primary px-3 py-1.5 text-xs" onClick={() => navigate(`/blocs/${next.id}`)}>
                  Suivant
                  <ArrowRight className="size-3.5" />
                </button>
              )}
            </div>
            {showSolution && <CodeBlock className="mt-3" code={problem.solution} language={isSql ? 'sql' : 'python'} />}
          </div>
        )}

        {(running || result) && (
          <div className="mt-3 rounded-2xl border border-line bg-black/20 p-3">
            <OutputPanel result={result} running={!!running} mode={running ?? (result?.tests ? 'test' : 'run')} />
          </div>
        )}
      </div>
    </div>
  )

  return <SplitPane storageKey="ct.split.parsons" initial={0.36} left={left} right={right} />
}

// ---------------------------------------------------------------- pieces

function Toggle({ on, onClick, label, title, disabled }: { on: boolean; onClick: () => void; label: string; title?: string; disabled?: boolean }) {
  return (
    <button
      className={clsx(
        'flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs transition',
        on ? 'border-accent/40 bg-accent/10 text-fg' : 'border-line text-muted hover:text-fg',
        disabled && 'pointer-events-none opacity-40',
      )}
      onClick={onClick}
      title={title}
      aria-pressed={on}
    >
      <span className={clsx('relative h-3.5 w-6 rounded-full transition', on ? 'bg-accent' : 'bg-white/15')}>
        <span className={clsx('absolute top-0.5 size-2.5 rounded-full bg-white transition-all', on ? 'left-3' : 'left-0.5')} />
      </span>
      {label}
    </button>
  )
}
