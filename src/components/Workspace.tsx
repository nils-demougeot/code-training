import clsx from 'clsx'
import { BookMarked, Play, RotateCcw, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { RunResult } from '@/lib/types'
import { CodeEditor } from './CodeEditor'
import { DocBrowser } from './DocBrowser'
import { EnginePill } from './Layout'
import { OutputPanel } from './OutputPanel'

/** Draggable two-pane split. Horizontal on large screens; stacked (with a pane switcher) on mobile. */
export function SplitPane({
  left,
  right,
  initial = 0.42,
  storageKey,
}: {
  left: ReactNode
  right: ReactNode
  initial?: number
  storageKey?: string
}) {
  const [ratio, setRatio] = useState(() => {
    try {
      const v = storageKey ? Number(localStorage.getItem(storageKey)) : NaN
      return v > 0.15 && v < 0.85 ? v : initial
    } catch {
      return initial
    }
  })
  const [mobilePane, setMobilePane] = useState<'left' | 'right'>('left')
  const container = useRef<HTMLDivElement>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    const rect = container.current!.getBoundingClientRect()
    const move = (ev: PointerEvent) => {
      const r = Math.min(0.75, Math.max(0.22, (ev.clientX - rect.left) / rect.width))
      setRatio(r)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.cursor = ''
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, String(ratio))
    } catch {
      /* ignore */
    }
  }, [ratio, storageKey])

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-line p-1.5 lg:hidden">
        {(['left', 'right'] as const).map((pane) => (
          <button
            key={pane}
            onClick={() => setMobilePane(pane)}
            className={clsx(
              'flex-1 rounded-lg py-1.5 text-sm font-medium',
              mobilePane === pane ? 'bg-white/[0.08] text-fg' : 'text-muted',
            )}
          >
            {pane === 'left' ? 'Énoncé' : 'Code'}
          </button>
        ))}
      </div>
      <div ref={container} className="flex min-h-0 flex-1">
        <div
          className={clsx(
            'min-w-0 overflow-hidden',
            mobilePane === 'left' ? 'flex-1' : 'hidden',
            'lg:block lg:flex-none lg:basis-[var(--split)]',
          )}
          style={{ '--split': `${ratio * 100}%` } as React.CSSProperties}
        >
          {left}
        </div>
        <div
          onPointerDown={onPointerDown}
          className="group hidden w-2 shrink-0 cursor-col-resize items-center justify-center lg:flex"
        >
          <div className="h-10 w-1 rounded-full bg-line transition group-hover:bg-accent/60" />
        </div>
        <div className={clsx('min-w-0 flex-1 overflow-hidden', mobilePane === 'right' ? 'block' : 'hidden', 'lg:block')}>
          {right}
        </div>
      </div>
    </div>
  )
}

export interface WorkspaceProps {
  code: string
  onChange: (code: string) => void
  onRun?: () => void
  onSubmit?: () => void
  onReset?: () => void
  running: boolean
  mode: 'run' | 'test' | null
  result: RunResult | null
  progress?: string | null
  language?: 'python' | 'sql'
  autocomplete?: boolean
  toolbar?: ReactNode
  submitLabel?: string
  banner?: ReactNode
  /** Library opened first in the documentation drawer; null disables the drawer (mock interview). */
  docLib?: string | null
}

/** Editor + toolbar + resizable output console. */
export function Workspace({
  code, onChange, onRun, onSubmit, onReset, running, mode, result, progress, language, autocomplete, toolbar,
  submitLabel = 'Soumettre', banner, docLib = 'python',
}: WorkspaceProps) {
  const [outputHeight, setOutputHeight] = useState(260)
  const [doc, setDoc] = useState<{ query: string } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const runRef = useRef(onRun)
  runRef.current = onRun

  // Ctrl/Cmd+S runs the code even when the focus is outside the editor (the editor handles it itself).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!(e.target instanceof HTMLElement && e.target.closest('.cm-editor'))) runRef.current?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openDoc = docLib === null ? undefined : (query: string) => setDoc({ query })

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const rect = box.current!.getBoundingClientRect()
    const move = (ev: PointerEvent) => setOutputHeight(Math.min(rect.height - 120, Math.max(90, rect.bottom - ev.clientY)))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [])

  return (
    <div ref={box} className="relative flex h-full flex-col bg-panel/40">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-[11px] text-muted">
          {language === 'sql' ? 'query.sql' : 'main.py'}
        </span>
        {onReset && (
          <button className="btn btn-quiet px-2 py-1 text-xs" onClick={onReset} title="Revenir au code de départ">
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">Réinitialiser</span>
          </button>
        )}
        {toolbar}
        {openDoc && (
          <button className="btn btn-quiet px-2 py-1 text-xs" onClick={() => openDoc('')} title="Documentation (F2 sur un mot)">
            <BookMarked className="size-3.5" />
            <span className="hidden sm:inline">Doc</span>
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <EnginePill compact />
          {onRun && (
            <button className="btn btn-ghost px-3 py-1.5" onClick={onRun} disabled={running} title="Ctrl+Entrée ou Ctrl+S">
              <Play className="size-3.5" />
              Exécuter
            </button>
          )}
          {onSubmit && (
            <button className="btn btn-success px-3 py-1.5" onClick={onSubmit} disabled={running} title="Ctrl+Maj+Entrée">
              <Send className="size-3.5" />
              {submitLabel}
            </button>
          )}
        </div>
      </div>
      {banner}
      <div className="min-h-0 flex-1">
        <CodeEditor
          value={code}
          onChange={onChange}
          onRun={onRun}
          onSubmit={onSubmit}
          onDoc={openDoc}
          errorLine={result?.errorLine}
          language={language}
          autocomplete={autocomplete}
        />
      </div>
      <div onPointerDown={onPointerDown} className="group flex h-2 cursor-row-resize items-center justify-center border-t border-line">
        <div className="h-1 w-10 rounded-full bg-line transition group-hover:bg-accent/60" />
      </div>
      <div className="overflow-y-auto" style={{ height: outputHeight }}>
        <OutputPanel result={result} running={running} progress={progress} mode={mode} />
      </div>
      {doc && docLib !== null && (
        <div className="absolute inset-y-0 right-0 z-30 w-full max-w-xl border-l border-line-strong bg-panel shadow-2xl animate-fade-up">
          <DocBrowser initialQuery={doc.query} initialLib={docLib} autoFocus onClose={() => setDoc(null)} />
        </div>
      )}
    </div>
  )
}
