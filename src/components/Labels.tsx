import clsx from 'clsx'
import { Check, Tag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LABELS, labelById, toggled, type LabelId } from '@/lib/labels'
import { useProgress } from '@/lib/progress'

const EMPTY: LabelId[] = []

export function useLabels(id: string): LabelId[] {
  return useProgress((s) => s.p.labels?.[id]?.ids ?? EMPTY)
}

/** Small chips showing an item's labels (emoji only when compact). */
export function LabelChips({ ids, compact, className }: { ids: LabelId[]; compact?: boolean; className?: string }) {
  if (!ids.length) return null
  return (
    <span className={clsx('inline-flex flex-wrap items-center gap-1', className)}>
      {ids.map((id) => {
        const l = labelById.get(id)!
        return compact ? (
          <span key={id} title={l.label} aria-label={l.label} className="text-sm leading-none">
            {l.emoji}
          </span>
        ) : (
          <span key={id} className="chip" style={{ color: l.color, borderColor: `${l.color}40`, background: `${l.color}14` }}>
            {l.emoji} {l.label}
          </span>
        )
      })}
    </span>
  )
}

/** Button + menu to toggle the labels of an exercise. */
export function LabelPicker({ id, className }: { id: string; className?: string }) {
  const ids = useLabels(id)
  const setLabels = useProgress((s) => s.setLabels)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={box} className={clsx('relative inline-flex flex-wrap items-center gap-1', className)}>
      <LabelChips ids={ids} />
      <button
        className={clsx('chip transition hover:text-fg', open && 'border-accent/50 text-fg')}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Ranger cet exercice dans tes listes"
        data-label-picker
      >
        <Tag className="size-3" />
        {ids.length ? 'Étiquettes' : 'Étiqueter'}
      </button>
      {open && (
        <div role="menu" className="absolute top-full left-0 z-40 mt-1.5 w-72 rounded-xl border border-line bg-[#12141d] p-1.5 shadow-2xl shadow-black/60 animate-fade-up">
          {LABELS.map((l) => {
            const on = ids.includes(l.id)
            return (
              <button
                key={l.id}
                role="menuitemcheckbox"
                aria-checked={on}
                data-label={l.id}
                onClick={() => setLabels(id, toggled(ids, l.id))}
                className={clsx('flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.05]', on && 'bg-white/[0.04]')}
              >
                <span className="text-base leading-5">{l.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium" style={on ? { color: l.color } : undefined}>
                    {l.label}
                  </span>
                  <span className="block text-[11px] leading-snug text-faint">{l.hint}</span>
                </span>
                <span
                  className={clsx('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border', on ? 'border-transparent' : 'border-line')}
                  style={on ? { background: l.color } : undefined}
                >
                  {on && <Check className="size-3 text-black" />}
                </span>
              </button>
            )
          })}
          <div className="px-2.5 pt-1.5 pb-1 text-[11px] text-faint">Retrouve tes listes dans Exercices (filtres) et sur l’accueil.</div>
        </div>
      )}
    </div>
  )
}
