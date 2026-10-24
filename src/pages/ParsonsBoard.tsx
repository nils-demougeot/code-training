import clsx from 'clsx'
import { ArrowDown, ArrowUp, GripVertical, IndentDecrease, IndentIncrease, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { highlight } from '@/components/Markdown'
import { MAX_INDENT, type ParsonsBlock } from '@/lib/parsons'

/** Width of one indentation level on screen. */
export const STEP = 26
/** Width of the line-number gutter in the program. */
const GUTTER = 38

export interface BoardState {
  pool: string[]
  program: string[]
  indents: Record<string, number>
}

interface Drag {
  id: string
  from: 'pool' | 'program'
  /** Pointer position and where the block was grabbed (relative to its top-left corner). */
  x: number
  y: number
  dx: number
  dy: number
  width: number
  /** Drop target in the program, or null when the pointer is outside it. */
  index: number | null
  indent: number
}

const text = (b: ParsonsBlock) => b.lines.join('\n')

/** Indentation an editor would propose for a line inserted after `above`. */
function suggestedIndent(above: ParsonsBlock | undefined, aboveIndent: number) {
  if (!above) return 0
  const last = above.lines[above.lines.length - 1].trim()
  return Math.min(MAX_INDENT, last.endsWith(':') ? aboveIndent + 1 : aboveIndent)
}

export function ParsonsBoard({
  blocks,
  state,
  onChange,
  indentMode,
  language,
  highlighted,
}: {
  blocks: Map<string, ParsonsBlock>
  state: BoardState
  onChange: (s: BoardState) => void
  /** The learner places the indentation (otherwise the reference indentation is shown). */
  indentMode: boolean
  language?: string
  highlighted?: string | null
}) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const programRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef(new Map<string, HTMLDivElement>())
  const ghostRef = useRef<HTMLDivElement>(null)
  const pending = useRef<{ id: string; from: 'pool' | 'program'; x: number; y: number; dx: number; dy: number; width: number } | null>(null)

  const indentOf = (id: string) => (indentMode ? state.indents[id] ?? 0 : blocks.get(id)?.indent ?? 0)

  // ------------------------------------------------------------- mutations

  const place = (id: string, index: number, indent?: number) => {
    const program = state.program.filter((x) => x !== id)
    const at = Math.max(0, Math.min(index, program.length))
    program.splice(at, 0, id)
    const above = program[at - 1]
    const auto = suggestedIndent(above ? blocks.get(above) : undefined, above ? indentOf(above) : 0)
    onChange({
      pool: state.pool.filter((x) => x !== id),
      program,
      indents: { ...state.indents, [id]: indent ?? auto },
    })
    setSelected(id)
  }

  const unplace = (id: string) => {
    const indents = { ...state.indents }
    delete indents[id]
    onChange({ pool: [...state.pool.filter((x) => x !== id), id], program: state.program.filter((x) => x !== id), indents })
    if (selected === id) setSelected(null)
  }

  const shift = (id: string, delta: number) => {
    if (!indentMode) return
    onChange({ ...state, indents: { ...state.indents, [id]: Math.max(0, Math.min(MAX_INDENT, indentOf(id) + delta)) } })
  }

  const move = (id: string, delta: number) => {
    const i = state.program.indexOf(id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= state.program.length) return
    const program = state.program.slice()
    ;[program[i], program[j]] = [program[j], program[i]]
    onChange({ ...state, program })
  }

  /** Click on a pool block: insert it under the selected line (or at the end). */
  const addFromPool = (id: string) => {
    const at = selected && state.program.includes(selected) ? state.program.indexOf(selected) + 1 : state.program.length
    place(id, at)
  }

  // ------------------------------------------------------------- drag & drop

  const target = (x: number, y: number, d: Pick<Drag, 'id' | 'dx'> & { index?: number | null }) => {
    const box = programRef.current?.getBoundingClientRect()
    if (!box || x < box.left - 20 || x > box.right + 20 || y < box.top - 30 || y > box.bottom + 30) return { index: null, indent: 0 }
    const others = state.program.filter((id) => id !== d.id)
    // Positions as if the placeholder were not there, otherwise the slot would oscillate around it.
    const ghostH = d.index != null ? ghostRef.current?.getBoundingClientRect().height ?? 0 : 0
    let index = others.length
    for (let i = 0; i < others.length; i++) {
      const r = lineRefs.current.get(others[i])?.getBoundingClientRect()
      if (r && y < r.top - (d.index != null && i >= d.index ? ghostH : 0) + r.height / 2) {
        index = i
        break
      }
    }
    // The block's left edge (not the pointer) decides the indentation, snapped to whole levels.
    const left = x - d.dx - (box.left + GUTTER + 8)
    const indent = indentMode ? Math.max(0, Math.min(MAX_INDENT, Math.round(left / STEP))) : blocks.get(d.id)?.indent ?? 0
    return { index, indent }
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = pending.current
      if (!drag && p) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) return
        pending.current = null
        const t = target(e.clientX, e.clientY, { id: p.id, dx: p.dx })
        setDrag({ ...p, x: e.clientX, y: e.clientY, ...t })
        return
      }
      if (!drag) return
      e.preventDefault()
      setDrag({ ...drag, x: e.clientX, y: e.clientY, ...target(e.clientX, e.clientY, drag) })
      // Auto-scroll the panel when dragging near its edges.
      const scroller = programRef.current?.closest('[data-scroll]') as HTMLElement | null
      if (scroller) {
        const r = scroller.getBoundingClientRect()
        if (e.clientY < r.top + 40) scroller.scrollBy(0, -12)
        else if (e.clientY > r.bottom - 40) scroller.scrollBy(0, 12)
      }
    }
    const onUp = () => {
      const p = pending.current
      pending.current = null
      if (p && !drag) {
        // A click, not a drag.
        if (p.from === 'pool') addFromPool(p.id)
        else setSelected(p.id)
        return
      }
      if (!drag) return
      if (drag.index !== null) {
        const others = state.program.filter((id) => id !== drag.id)
        others.splice(drag.index, 0, drag.id)
        onChange({
          pool: state.pool.filter((x) => x !== drag.id),
          program: others,
          indents: { ...state.indents, [drag.id]: drag.indent },
        })
        setSelected(drag.id)
      } else if (drag.from === 'program') {
        unplace(drag.id)
      }
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    // A cancelled gesture (e.g. the browser took over to scroll) is neither a click nor a drop.
    const onCancel = () => {
      pending.current = null
      setDrag(null)
    }
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  })

  const startPointer = (e: ReactPointerEvent, id: string, from: 'pool' | 'program') => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    pending.current = { id, from, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, width: r.width }
  }

  // ------------------------------------------------------------- keyboard

  const onLineKey = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Tab' && indentMode) {
      e.preventDefault()
      shift(id, e.shiftKey ? -1 : 1)
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      move(id, e.key === 'ArrowUp' ? -1 : 1)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      unplace(id)
    } else if (e.key === 'Escape') {
      ;(e.currentTarget as HTMLElement).blur()
      setSelected(null)
    } else if (e.key === 'ArrowLeft' && indentMode) {
      e.preventDefault()
      shift(id, -1)
    } else if (e.key === 'ArrowRight' && indentMode) {
      e.preventDefault()
      shift(id, 1)
    }
  }

  // ------------------------------------------------------------- render

  const shownProgram = drag ? state.program.filter((id) => id !== drag.id) : state.program
  const rows: ({ kind: 'line'; id: string } | { kind: 'ghost' })[] = shownProgram.map((id) => ({ kind: 'line' as const, id }))
  if (drag && drag.index !== null) rows.splice(drag.index, 0, { kind: 'ghost' })

  let lineNo = 1
  const dragged = drag ? blocks.get(drag.id) : undefined

  return (
    <div className="@container">
    <div className="grid gap-3 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between px-1 text-xs text-faint">
          <span className="section-title">Blocs disponibles</span>
          <span>{state.pool.length}</span>
        </div>
        <div className="flex min-h-16 flex-wrap content-start gap-1.5 rounded-2xl border border-dashed border-line bg-white/[0.015] p-2.5 @4xl:min-h-32 @4xl:flex-col @4xl:flex-nowrap">
          {state.pool.length === 0 && <div className="flex h-10 w-full items-center justify-center text-xs text-faint">Tous les blocs sont placés.</div>}
          {state.pool.map((id) => (
            <div
              key={id}
              data-block={id}
              role="button"
              tabIndex={0}
              onPointerDown={(e) => startPointer(e, id, 'pool')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  addFromPool(id)
                }
              }}
              className={clsx(
                'group flex min-w-0 max-w-full cursor-grab select-none items-stretch rounded-lg border border-white/10 bg-[#11131c] font-mono text-[12.5px] leading-relaxed transition hover:border-accent/50 hover:bg-[#151827] focus-visible:border-accent focus-visible:outline-none active:cursor-grabbing',
                drag?.id === id && 'opacity-30',
              )}
              title="Clic : ajouter sous la ligne sélectionnée · glisser : placer précisément"
            >
              <span className="flex touch-none items-center px-1 text-faint group-hover:text-muted">
                <GripVertical className="size-3.5" />
              </span>
              <Code block={blocks.get(id)!} language={language} wrap />
            </div>
          ))}
        </div>
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-faint">
          <b className="text-muted">Clic</b> : ajoute le bloc sous la ligne sélectionnée. <b className="text-muted">Glisser</b> : la ligne en pointillés montre où il atterrit
          {indentMode ? ' et à quel niveau d’indentation (déplace la souris à gauche / à droite).' : '.'}
        </p>
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between px-1 text-xs text-faint">
          <span className="section-title">Ton programme</span>
          <span>{state.program.length}</span>
        </div>
        <div
          ref={programRef}
          className={clsx(
            'min-h-40 rounded-2xl border bg-[#0b0d14] py-2 transition',
            drag && drag.index !== null ? 'border-accent/60' : 'border-line',
          )}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null)
          }}
        >
          {rows.length === 0 && (
            <div className="flex h-36 items-center justify-center px-4 text-center text-xs text-faint">
              Clique ou glisse les blocs ici, dans l’ordre.
            </div>
          )}
          {rows.map((row) => {
            if (row.kind === 'ghost') {
              const n = dragged?.lines.length ?? 1
              const start = lineNo
              lineNo += n
              return (
                <div key="ghost" ref={ghostRef} className="flex items-stretch">
                  <Gutter from={start} count={n} />
                  <Guides n={drag!.indent} />
                  <div className="my-0.5 mr-2 flex min-w-0 flex-1 items-center rounded-md border border-dashed border-accent/70 bg-accent/10 px-2 py-1 font-mono text-[12.5px] text-accent">
                    <span className="truncate opacity-80">{dragged?.lines[0]}</span>
                    {indentMode && <span className="ml-auto shrink-0 rounded bg-accent/25 px-1.5 font-sans text-[10px] font-medium">niveau {drag!.indent}</span>}
                  </div>
                </div>
              )
            }
            const id = row.id
            const b = blocks.get(id)!
            const indent = indentOf(id)
            const start = lineNo
            lineNo += b.lines.length
            const isSel = selected === id
            return (
              <div
                key={id}
                ref={(el) => {
                  if (el) lineRefs.current.set(id, el)
                  else lineRefs.current.delete(id)
                }}
                data-block={id}
                data-indent={indent}
                tabIndex={0}
                onPointerDown={(e) => startPointer(e, id, 'program')}
                onKeyDown={(e) => onLineKey(e, id)}
                onFocus={() => setSelected(id)}
                className={clsx(
                  'group relative flex cursor-grab select-none items-stretch outline-none transition-colors',
                  isSel ? 'bg-accent/[0.09]' : 'hover:bg-white/[0.03]',
                  highlighted === id && 'bg-warn/15 ring-1 ring-warn/60',
                )}
              >
                <Gutter from={start} count={b.lines.length} active={isSel} />
                <Guides n={indent} />
                <div className="flex min-w-0 flex-1 items-center">
                  <Code block={b} language={language} />
                </div>
                <div className={clsx('flex shrink-0 items-center gap-0.5 pr-1.5 transition', isSel ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
                  {indentMode && (
                    <>
                      <Icon title="Désindenter (Maj+Tab ou ←)" onClick={() => shift(id, -1)} disabled={indent === 0}>
                        <IndentDecrease className="size-3.5" />
                      </Icon>
                      <Icon title="Indenter (Tab ou →)" onClick={() => shift(id, 1)} disabled={indent >= MAX_INDENT}>
                        <IndentIncrease className="size-3.5" />
                      </Icon>
                    </>
                  )}
                  <Icon title="Monter (Alt+↑)" onClick={() => move(id, -1)}>
                    <ArrowUp className="size-3.5" />
                  </Icon>
                  <Icon title="Descendre (Alt+↓)" onClick={() => move(id, 1)}>
                    <ArrowDown className="size-3.5" />
                  </Icon>
                  <Icon title="Retirer (Suppr)" onClick={() => unplace(id)}>
                    <X className="size-3.5" />
                  </Icon>
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-faint">
          Ligne sélectionnée : {indentMode ? <><kbd>Tab</kbd> / <kbd>Maj+Tab</kbd> (ou ← →) pour indenter, </> : null}
          <kbd>Alt+↑↓</kbd> pour déplacer, <kbd>Suppr</kbd> pour retirer. Glisser une ligne hors du programme la retire.
        </p>
      </div>

      {drag && dragged && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-accent/70 bg-[#151827] font-mono text-[12.5px] leading-relaxed shadow-2xl shadow-black/60"
          style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, maxWidth: 560, minWidth: Math.min(drag.width, 560) }}
        >
          <Code block={dragged} language={language} />
        </div>
      )}
    </div>
    </div>
  )
}

function Gutter({ from, count, active }: { from: number; count: number; active?: boolean }) {
  return (
    <div className={clsx('shrink-0 select-none py-1 pr-2 text-right font-mono text-[11px]', active ? 'text-accent' : 'text-faint/70')} style={{ width: GUTTER }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="leading-[20px]">{from + i}</div>
      ))}
    </div>
  )
}

/** Indentation guides: one column per level, like an editor. */
function Guides({ n }: { n: number }) {
  return (
    <div className="flex shrink-0 pl-2">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="border-l border-white/10" style={{ width: STEP }} />
      ))}
    </div>
  )
}

function Code({ block, language, wrap }: { block: ParsonsBlock; language?: string; wrap?: boolean }) {
  return (
    <pre className={clsx('min-w-0 flex-1 py-1 pr-2 leading-[20px] text-[#c0caf5]', wrap ? 'whitespace-pre-wrap break-all' : 'overflow-x-auto')}>
      <code dangerouslySetInnerHTML={{ __html: highlight(text(block), language === 'sql' ? 'sql' : 'python') }} />
    </pre>
  )
}

function Icon({ children, onClick, title, disabled }: { children: React.ReactNode; onClick: () => void; title: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="rounded p-1 text-muted hover:bg-white/10 hover:text-fg disabled:pointer-events-none disabled:opacity-25"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      title={title}
      aria-label={title}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
