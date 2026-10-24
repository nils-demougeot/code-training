import clsx from 'clsx'
import { BookMarked, Check, Copy, Loader2, Play, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { docLibraries, setupOf } from '@/lib/content'
import { runCode } from '@/lib/engine'
import type { DocEntry, DocLibrary, Domain, RunResult } from '@/lib/types'
import { CodeBlock, Markdown } from './Markdown'
import { OutputPanel } from './OutputPanel'

/** Library to show first for a given exercise domain. */
export function docLibForDomain(domain: Domain, local?: boolean): string {
  switch (domain) {
    case 'numpy':
      return 'numpy'
    case 'pandas':
      return 'pandas'
    case 'sql':
      return 'sql'
    case 'stats':
      return 'stats'
    case 'ml':
      return 'sklearn'
    case 'dl':
      return local ? 'pytorch' : 'numpy'
    default:
      return 'python'
  }
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

interface Hit {
  lib: DocLibrary
  section: string
  entry: DocEntry
  score: number
}

function search(query: string, libId: string | null): Hit[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  const hits: Hit[] = []
  for (const lib of docLibraries) {
    if (libId && lib.id !== libId) continue
    for (const section of lib.sections) {
      for (const entry of section.entries) {
        const name = normalize(entry.name)
        const hay = normalize(`${entry.name} ${entry.signature ?? ''} ${entry.description} ${section.title} ${entry.example ?? ''}`)
        if (!terms.every((t) => hay.includes(t))) continue
        let score = 0
        for (const t of terms) {
          if (name === t || name.endsWith('.' + t) || name.endsWith(t + '()')) score += 10
          else if (name.includes(t)) score += 5
          else if (normalize(section.title).includes(t)) score += 2
          else score += 1
        }
        hits.push({ lib, section: section.title, entry, score })
      }
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 60)
}

function EntryCard({ lib, entry, section }: { lib: DocLibrary; entry: DocEntry; section?: string }) {
  const [result, setResult] = useState<RunResult | null>(null)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)
  const runnable = entry.example && entry.run !== false

  const run = async () => {
    setRunning(true)
    // SQL examples run against the demo database and print the result table.
    const code = lib.language === 'sql' ? `show(${JSON.stringify(entry.example)})` : entry.example!
    setResult(await runCode(code, { setup: setupOf(lib) }))
    setRunning(false)
  }

  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <code className="font-mono text-sm font-semibold text-accent-2">{entry.name}</code>
        {section && <span className="text-[10px] text-faint">{lib.title} · {section}</span>}
      </div>
      {entry.signature && <div className="mt-1 font-mono text-[11px] break-all text-muted">{entry.signature}</div>}
      <Markdown className="mt-2 text-[13px]">{entry.description}</Markdown>
      {entry.example && (
        <div className="mt-3">
          <CodeBlock code={entry.example} language={lib.language ?? 'python'} className="text-xs" />
          <div className="mt-2 flex gap-2">
            {runnable && (
              <button className="btn btn-ghost px-2.5 py-1 text-xs" onClick={run} disabled={running}>
                {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                Essayer
              </button>
            )}
            <button
              className="btn btn-quiet px-2.5 py-1 text-xs"
              onClick={() => {
                navigator.clipboard?.writeText(entry.example!).catch(() => {})
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
              }}
            >
              {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
              Copier
            </button>
            {entry.run === false && <span className="self-center text-[11px] text-faint">non exécutable dans le navigateur</span>}
          </div>
          {(result || running) && (
            <div className="mt-2 rounded-xl border border-line bg-black/20">
              <OutputPanel result={result} running={running} mode="run" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Searchable documentation: Python, NumPy, Pandas, scikit-learn, PyTorch, SQL, stats. */
export function DocBrowser({
  initialQuery = '',
  initialLib = null,
  autoFocus,
  onClose,
}: {
  initialQuery?: string
  initialLib?: string | null
  autoFocus?: boolean
  onClose?: () => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const [libId, setLibId] = useState<string | null>(initialLib)
  const inputRef = useRef<HTMLInputElement>(null)
  const lib = docLibraries.find((l) => l.id === libId) ?? null
  const hits = useMemo(() => (query.trim() ? search(query, libId) : []), [query, libId])
  // A query that only matches in another library: search everywhere instead of showing nothing.
  const globalHits = useMemo(
    () => (query.trim() && libId && hits.length === 0 ? search(query, null) : []),
    [query, libId, hits.length],
  )

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])
  useEffect(() => {
    if (initialLib !== undefined) setLibId(initialLib)
  }, [initialLib])
  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 30)
  }, [autoFocus, initialQuery])

  const shown = hits.length ? hits : globalHits

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-line p-4">
        <div className="flex items-center gap-2">
          <BookMarked className="size-4 text-accent" />
          <span className="font-semibold">Documentation</span>
          <span className="text-xs text-faint">F2 sur un mot dans l’éditeur</span>
          {onClose && (
            <button className="btn btn-quiet ml-auto px-2 py-1" onClick={onClose} aria-label="Fermer la documentation">
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input
            ref={inputRef}
            className="input pl-9"
            placeholder="reshape, groupby, merge, train_test_split, sorted…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (query) setQuery('')
                else onClose?.()
              }
            }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setLibId(null)}
            className={clsx('chip transition', !libId && 'border-accent/50 bg-accent/15 text-fg')}
          >
            Tout
          </button>
          {docLibraries.map((l) => (
            <button
              key={l.id}
              onClick={() => setLibId(l.id)}
              className={clsx('chip transition', libId === l.id && 'border-accent/50 bg-accent/15 text-fg')}
            >
              {l.title}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {query.trim() ? (
          <>
            {globalHits.length > 0 && (
              <p className="text-xs text-faint">Rien dans {lib?.title} : résultats dans toutes les librairies.</p>
            )}
            {shown.length === 0 && <p className="py-10 text-center text-sm text-faint">Aucun résultat pour « {query} ».</p>}
            {shown.map((h) => (
              <EntryCard key={`${h.lib.id}-${h.entry.name}-${h.section}`} lib={h.lib} entry={h.entry} section={h.section} />
            ))}
          </>
        ) : (
          (lib ? [lib] : docLibraries).map((l) => (
            <div key={l.id} className="space-y-3">
              {!lib && <h2 className="pt-2 text-lg font-semibold">{l.title}</h2>}
              {l.sections.map((sec) => (
                <details key={sec.title} className="group rounded-2xl border border-line" open={!!lib}>
                  <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium select-none">
                    {sec.title}
                    <span className="text-xs font-normal text-faint">{sec.entries.length}</span>
                    <span className="ml-auto hidden truncate font-mono text-[11px] font-normal text-faint sm:block">
                      {sec.entries.slice(0, 4).map((e) => e.name).join(' · ')}
                    </span>
                  </summary>
                  <div className="space-y-3 px-3 pb-3">
                    {sec.entries.map((e) => (
                      <EntryCard key={e.name} lib={l} entry={e} />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
