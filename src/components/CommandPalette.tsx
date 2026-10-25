import clsx from 'clsx'
import { BookMarked, BookOpen, Bot, Briefcase, Calculator, Code2, CornerDownLeft, FlaskConical, Puzzle, Rocket, Search, Sigma, Trophy } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { competitions, docLibraries, exercises, explainDecks, fiches, missions, parsonsProblems, projects } from '@/lib/content'
import { GENAI_CHAPTERS } from '@/genai'
import { LEVELS } from '@/mental/generators'
import { DOMAINS } from '@/lib/domains'
import { LABS } from '@/labs/registry'
import { CHAPTERS } from '@/maths'

interface Item {
  id: string
  label: string
  sub: string
  to: string
  kind: 'exercise' | 'fiche' | 'project' | 'lab' | 'doc' | 'competition' | 'blocks' | 'maths' | 'genai' | 'prep' | 'mental'
}

const ICONS = { exercise: Code2, fiche: BookOpen, project: Rocket, lab: FlaskConical, doc: BookMarked, competition: Trophy, blocks: Puzzle, maths: Sigma, genai: Bot, prep: Briefcase, mental: Calculator }

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const items = useMemo<Item[]>(
    () => [
      ...exercises.map((e) => ({
        id: e.id, label: e.title, sub: `${DOMAINS[e.domain].label} · ${e.tags.join(', ')}`, to: `/exercices/${e.id}`, kind: 'exercise' as const,
      })),
      ...fiches.map((f) => ({ id: f.id, label: f.title, sub: `Fiche · ${f.summary}`, to: `/fiches/${f.id}`, kind: 'fiche' as const })),
      ...projects.map((p) => ({ id: p.id, label: p.title, sub: `Projet · ${p.summary}`, to: `/projets/${p.id}`, kind: 'project' as const })),
      ...LABS.map((l) => ({ id: l.id, label: l.title, sub: `Lab · ${l.summary}`, to: `/labs/${l.id}`, kind: 'lab' as const })),
      ...CHAPTERS.flatMap((c) => [
        { id: `maths-${c.id}`, label: c.title, sub: `Maths · ${c.summary}`, to: `/maths/${c.id}`, kind: 'maths' as const },
        ...c.exercises.map((e) => ({ id: `maths-${e.id}`, label: e.title, sub: `Maths · ${c.title} · ${e.skill}`, to: `/maths/${c.id}?tab=exercices&ex=${e.id}`, kind: 'maths' as const })),
      ]),
      ...GENAI_CHAPTERS.flatMap((c) => [
        { id: `genai-${c.id}`, label: c.title, sub: `GenAI Academy · ${c.summary}`, to: `/genai/${c.id}`, kind: 'genai' as const },
        ...c.exercises.map((e) => ({ id: `genai-${e.id}`, label: e.title, sub: `GenAI Academy · ${c.title} · ${e.skill}`, to: `/genai/${c.id}?tab=exercices&ex=${e.id}`, kind: 'genai' as const })),
      ]),
      ...LEVELS.map((l) => ({ id: `mental-${l.id}`, label: `Calcul mental · ${l.name}`, sub: `Calcul mental · ${l.desc}`, to: '/calcul', kind: 'mental' as const })),
      ...missions.map((m) => ({ id: `mission-${m.id}`, label: m.title, sub: `Client mission · ${m.industry} · ${m.client.role}`, to: `/missions/${m.id}`, kind: 'prep' as const })),
      ...explainDecks.map((d) => ({ id: `explain-${d.id}`, label: d.title, sub: `Explain it simply · ${d.summary}`, to: `/explain/${d.id}`, kind: 'prep' as const })),
      ...competitions.map((c) => ({ id: c.id, label: c.title, sub: `Compétition · ${c.summary}`, to: `/competitions/${c.id}`, kind: 'competition' as const })),
      ...parsonsProblems
        .filter((b) => b.source === 'parsons')
        .map((b) => ({ id: b.id, label: b.title, sub: `Blocs de code · ${DOMAINS[b.domain].label}`, to: `/blocs/${b.id}`, kind: 'blocks' as const })),
      ...docLibraries.flatMap((lib) =>
        lib.sections.flatMap((sec) =>
          sec.entries.map((e) => ({
            id: `${lib.id}-${e.name}`,
            label: e.name,
            sub: `Doc ${lib.title} · ${sec.title}`,
            to: `/doc?lib=${lib.id}&q=${encodeURIComponent(e.name.split(/[ /(]/)[0])}`,
            kind: 'doc' as const,
          })),
        ),
      ),
    ],
    [],
  )

  const results = useMemo(() => {
    const terms = normalize(q).split(/\s+/).filter(Boolean)
    if (!terms.length) return items.slice(0, 12)
    return items.filter((i) => terms.every((t) => normalize(`${i.label} ${i.sub}`).includes(t))).slice(0, 30)
  }, [q, items])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-palette', onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  useEffect(() => setActive(0), [q])

  if (!open) return null

  const go = (item: Item | undefined) => {
    if (!item) return
    setOpen(false)
    navigate(item.to)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-panel shadow-2xl animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') go(results[active])
            }}
            placeholder="Exercice, fiche, lab, projet…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          <kbd className="kbd">Échap</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <div className="px-3 py-8 text-center text-sm text-faint">Aucun résultat</div>}
          {results.map((r, i) => {
            const Icon = ICONS[r.kind]
            return (
              <button
                key={`${r.kind}-${r.id}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={clsx('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left', i === active && 'bg-white/[0.06]')}
              >
                <Icon className="size-4 shrink-0 text-faint" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{r.label}</div>
                  <div className="truncate text-xs text-faint">{r.sub}</div>
                </div>
                {i === active && <CornerDownLeft className="size-3.5 text-faint" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
