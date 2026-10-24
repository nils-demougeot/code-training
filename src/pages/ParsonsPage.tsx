import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import clsx from 'clsx'
import {
  ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, Eye, GripVertical, Lightbulb, Loader2, Play, Puzzle,
  Send, Shuffle, X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CodeBlock, highlight, Markdown } from '@/components/Markdown'
import { OutputPanel } from '@/components/OutputPanel'
import { DifficultyBadge, DomainChip, Empty } from '@/components/ui'
import { SplitPane } from '@/components/Workspace'
import { parsonsById, parsonsProblems, setupOf, toPython } from '@/lib/content'
import { runCode, runTests } from '@/lib/engine'
import { assemble, distractorBlocks, MAX_INDENT, shuffled, toBlocks, type ParsonsBlock } from '@/lib/parsons'
import { useProgress } from '@/lib/progress'
import type { ParsonsProblem, RunResult } from '@/lib/types'
import { celebrate } from './ExercisePage'

/** Width of one indentation level on screen. */
const STEP = 28
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

interface Board {
  pool: string[]
  program: string[]
  indents: Record<string, number>
}

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
  const [activeId, setActiveId] = useState<string | null>(null)
  const programRef = useRef<HTMLDivElement>(null)

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

  // ------------------------------------------------------------- board moves

  const containerOf = (bid: string): 'pool' | 'program' | null =>
    bid === 'pool' || bid === 'program' ? bid : board.pool.includes(bid) ? 'pool' : board.program.includes(bid) ? 'program' : null

  const toProgram = (bid: string, at?: number) => {
    changed()
    setBoard((b) => {
      const prog = b.program.filter((x) => x !== bid)
      const pos = at ?? prog.length
      prog.splice(pos, 0, bid)
      // A new line starts at the indentation of the line above (the usual editor behaviour).
      const above = prog[pos - 1]
      const indent = b.indents[bid] ?? (above ? b.indents[above] ?? 0 : 0)
      return { pool: b.pool.filter((x) => x !== bid), program: prog, indents: { ...b.indents, [bid]: indent } }
    })
  }

  const toPool = (bid: string) => {
    changed()
    setBoard((b) => {
      const indents = { ...b.indents }
      delete indents[bid]
      return { pool: [...b.pool, bid], program: b.program.filter((x) => x !== bid), indents }
    })
  }

  const shiftIndent = (bid: string, delta: number) => {
    if (!indentMode) return
    changed()
    setBoard((b) => ({
      ...b,
      indents: { ...b.indents, [bid]: Math.max(0, Math.min(MAX_INDENT, (b.indents[bid] ?? 0) + delta)) },
    }))
  }

  const moveInProgram = (bid: string, delta: number) => {
    changed()
    setBoard((b) => {
      const i = b.program.indexOf(bid)
      const j = i + delta
      if (i < 0 || j < 0 || j >= b.program.length) return b
      return { ...b, program: arrayMove(b.program, i, j) }
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const from = containerOf(String(active.id))
    const to = containerOf(String(over.id))
    if (!from || !to || from === to) return
    setBoard((b) => {
      const src = b[from].filter((x) => x !== active.id)
      const dst = b[to].slice()
      const overIndex = dst.indexOf(String(over.id))
      dst.splice(overIndex >= 0 ? overIndex : dst.length, 0, String(active.id))
      return { ...b, [from]: src, [to]: dst }
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    const bid = String(active.id)
    const where = containerOf(bid)
    if (!where) return
    changed()
    setBoard((b) => {
      let list = b[where]
      if (over && containerOf(String(over.id)) === where && over.id !== where) {
        const i = list.indexOf(bid)
        const j = list.indexOf(String(over.id))
        if (i >= 0 && j >= 0 && i !== j) list = arrayMove(list, i, j)
      }
      const indents = { ...b.indents }
      if (where === 'program') {
        // The indentation follows where the block was dropped horizontally.
        const rect = active.rect.current.translated
        const box = programRef.current?.getBoundingClientRect()
        if (rect && box) indents[bid] = Math.max(0, Math.min(MAX_INDENT, Math.round((rect.left - box.left - 12) / STEP)))
        else indents[bid] ??= 0
      } else {
        delete indents[bid]
      }
      return { ...b, [where]: list, indents }
    })
  }

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
  const active = activeId ? blocks.get(activeId) : undefined

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
          Glisse les blocs dans <b className="text-fg">ton programme</b> (ou clique dessus), dans le bon ordre.
          {indentMode && (
            <> Indente-les en les lâchant plus à droite, avec les flèches, ou avec <kbd>Tab</kbd> / <kbd>Maj+Tab</kbd> sur un bloc sélectionné.</>
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

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Column id="pool" title="Blocs disponibles" count={board.pool.length} empty="Tous les blocs sont placés.">
              {board.pool.map((bid) => (
                <SortableBlock key={bid} id={bid} block={blocks.get(bid)!} language={problem.language} indent={0} onClick={() => toProgram(bid)} />
              ))}
            </Column>
            <Column
              id="program"
              title="Ton programme"
              count={board.program.length}
              empty="Glisse ou clique des blocs ici."
              innerRef={programRef}
              guides={indentMode}
            >
              {board.program.map((bid, i) => (
                <SortableBlock
                  key={bid}
                  id={bid}
                  block={blocks.get(bid)!}
                  language={problem.language}
                  indent={indentOf(bid)}
                  inProgram
                  canIndent={indentMode}
                  highlighted={hint?.id === bid}
                  onIndent={(d) => shiftIndent(bid, d)}
                  onMove={(d) => moveInProgram(bid, d)}
                  onRemove={() => toPool(bid)}
                  isFirst={i === 0}
                />
              ))}
            </Column>
          </div>
          <DragOverlay>
            {active && (
              <BlockView block={active} language={problem.language} className="cursor-grabbing border-accent/60 shadow-2xl shadow-black/60" />
            )}
          </DragOverlay>
        </DndContext>

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

function Column({
  id, title, count, empty, children, innerRef, guides,
}: {
  id: string
  title: string
  count: number
  empty: string
  children: React.ReactNode
  innerRef?: React.Ref<HTMLDivElement>
  guides?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const items = (Array.isArray(children) ? children : [children]).flat().map((c) => (c as { key: string }).key)
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between px-1 text-xs text-faint">
        <span className="section-title">{title}</span>
        <span>{count}</span>
      </div>
      <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
        <div
          ref={(node) => {
            setNodeRef(node)
            if (typeof innerRef === 'function') innerRef(node)
            else if (innerRef) (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = node
          }}
          className={clsx(
            'min-h-40 space-y-1.5 rounded-2xl border border-dashed p-3 transition',
            isOver ? 'border-accent/60 bg-accent/[0.05]' : 'border-line bg-white/[0.015]',
          )}
          style={
            guides
              ? {
                  backgroundImage: `repeating-linear-gradient(to right, rgb(255 255 255 / 0.05) 0 1px, transparent 1px ${STEP}px)`,
                  backgroundPosition: '12px 0',
                }
              : undefined
          }
        >
          {count === 0 && <div className="flex h-32 items-center justify-center text-center text-xs text-faint">{empty}</div>}
          {children}
        </div>
      </SortableContext>
    </div>
  )
}

function BlockView({
  block, language, className, children, highlighted,
}: {
  block: ParsonsBlock
  language?: string
  className?: string
  children?: React.ReactNode
  highlighted?: boolean
}) {
  return (
    <div
      className={clsx(
        'group relative flex min-w-0 items-stretch rounded-lg border bg-[#11131c] font-mono text-[12.5px] leading-relaxed transition',
        highlighted ? 'border-warn/70 ring-2 ring-warn/30' : 'border-white/10 hover:border-white/25',
        className,
      )}
    >
      <span className="flex items-center px-1 text-faint">
        <GripVertical className="size-3.5" />
      </span>
      <pre className="min-w-0 flex-1 overflow-x-auto py-1.5 pr-2 text-[#c0caf5]">
        <code dangerouslySetInnerHTML={{ __html: highlight(blockText(block), language === 'sql' ? 'sql' : 'python') }} />
      </pre>
      {children}
    </div>
  )
}

function SortableBlock({
  id, block, language, indent, inProgram, canIndent, highlighted, onClick, onIndent, onMove, onRemove, isFirst,
}: {
  id: string
  block: ParsonsBlock
  language?: string
  indent: number
  inProgram?: boolean
  canIndent?: boolean
  highlighted?: boolean
  onClick?: () => void
  onIndent?: (delta: number) => void
  onMove?: (delta: number) => void
  onRemove?: () => void
  isFirst?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!inProgram) {
      if (e.key === 'Enter') {
        // Enter adds the block; Space still starts a keyboard drag (dnd-kit).
        e.preventDefault()
        onClick?.()
      }
      return
    }
    if (e.key === 'Tab' && canIndent) {
      e.preventDefault()
      onIndent?.(e.shiftKey ? -1 : 1)
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      onMove?.(e.key === 'ArrowUp' ? -1 : 1)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onRemove?.()
    }
  }
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, marginLeft: indent * STEP }}
      className={clsx('group/block touch-manipulation outline-none focus-visible:[&>div]:border-accent', isDragging && 'opacity-30')}
      {...attributes}
      {...listeners}
      onKeyDown={(e) => {
        onKeyDown(e)
        if (!e.defaultPrevented) listeners?.onKeyDown?.(e)
      }}
      onClick={inProgram ? undefined : onClick}
      data-block={id}
    >
      <BlockView block={block} language={language} highlighted={highlighted} className={clsx(!inProgram && 'cursor-pointer')}>
        {inProgram && (
          <span
            className="absolute top-1/2 right-1 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-white/10 bg-[#11131c]/95 px-0.5 shadow-lg group-hover/block:flex group-focus/block:flex"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {canIndent && (
              <>
                <IconButton title="Désindenter (Maj+Tab)" onClick={() => onIndent?.(-1)} disabled={indent === 0}>
                  <ChevronLeft className="size-3.5" />
                </IconButton>
                <IconButton title="Indenter (Tab)" onClick={() => onIndent?.(1)} disabled={indent >= MAX_INDENT}>
                  <ChevronRight className="size-3.5" />
                </IconButton>
              </>
            )}
            <IconButton title="Monter (Alt+↑)" onClick={() => onMove?.(-1)} disabled={isFirst}>
              <ArrowUp className="size-3.5" />
            </IconButton>
            <IconButton title="Retirer (Suppr)" onClick={() => onRemove?.()}>
              <X className="size-3.5" />
            </IconButton>
          </span>
        )}
      </BlockView>
    </div>
  )
}

function IconButton({ children, onClick, title, disabled }: { children: React.ReactNode; onClick: () => void; title: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="rounded p-1 text-muted hover:bg-white/10 hover:text-fg disabled:pointer-events-none disabled:opacity-30"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={title}
      aria-label={title}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
