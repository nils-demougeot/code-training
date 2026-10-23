import clsx from 'clsx'
import { ArrowLeft, CheckCircle2, ChevronRight, Eye, FlaskConical, Play } from 'lucide-react'
import { Suspense, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Markdown } from '@/components/Markdown'
import { Empty } from '@/components/ui'
import { labById, type Experiment } from '@/labs/registry'
import { useProgress } from '@/lib/progress'

export default function LabPage() {
  const { id = '' } = useParams()
  // One instance per lab: experiment presets must not leak from one lab to another.
  return <LabView key={id} id={id} />
}

function LabView({ id }: { id: string }) {
  const lab = labById.get(id)
  const labState = useProgress((s) => s.p.labs[id])
  const done = labState?.done ?? []
  const labExperiment = useProgress((s) => s.labExperiment)
  const [preset, setPreset] = useState<{ config: Record<string, unknown>; nonce: number } | undefined>()
  const [active, setActive] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  if (!lab) return <Empty title="Lab introuvable" />
  const Lab = lab.component

  const load = (e: Experiment) => {
    setActive(e.id)
    setPreset({ config: e.preset, nonce: Date.now() })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const reveal = (e: Experiment) => {
    setRevealed((s) => new Set(s).add(e.id))
    labExperiment(lab.id, e.id)
  }

  return (
    <div>
      <Link to="/labs" className="mb-4 inline-flex items-center gap-1 text-xs text-faint hover:text-fg">
        <ArrowLeft className="size-3.5" />
        Labs
      </Link>
      <div className="mb-6 flex items-center gap-4 animate-fade-up">
        <div className="text-4xl">{lab.emoji}</div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{lab.title}</h1>
          <p className="text-sm text-muted">{lab.summary}</p>
        </div>
      </div>

      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <Lab preset={preset} />
      </Suspense>

      <section className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <FlaskConical className="size-4 text-accent" />
          <h2 className="font-semibold">Expériences guidées</h2>
          <span className="text-xs text-faint">
            {done.length}/{lab.experiments.length} réalisées · +15 XP chacune
          </span>
        </div>
        <div className="space-y-3">
          {lab.experiments.map((e, i) => {
            const isDone = done.includes(e.id)
            const isOpen = active === e.id || revealed.has(e.id)
            return (
              <div key={e.id} className={clsx('card overflow-hidden', active === e.id && 'border-accent/40')}>
                <button
                  className="flex w-full items-center gap-3 p-4 text-left"
                  onClick={() => (isOpen ? setActive(active === e.id ? null : e.id) : load(e))}
                >
                  <div
                    className={clsx(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold',
                      isDone ? 'bg-ok/15 text-ok' : 'bg-white/[0.05] text-muted',
                    )}
                  >
                    {isDone ? <CheckCircle2 className="size-4" /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{e.title}</div>
                    <div className="truncate text-xs text-muted">{e.task}</div>
                  </div>
                  <ChevronRight className={clsx('size-4 text-faint transition', isOpen && 'rotate-90')} />
                </button>
                {isOpen && (
                  <div className="space-y-4 border-t border-line p-5 animate-fade-up">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="flex-1 text-sm">{e.task}</p>
                      <button className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => load(e)}>
                        <Play className="size-3.5" />
                        Charger la configuration
                      </button>
                    </div>
                    <div className="rounded-xl border border-accent/20 bg-accent/[0.05] p-4">
                      <div className="mb-1 text-[11px] font-semibold tracking-wider text-accent uppercase">Question</div>
                      <Markdown>{e.question}</Markdown>
                    </div>
                    {revealed.has(e.id) || isDone ? (
                      <div className="rounded-xl border border-line bg-white/[0.02] p-4">
                        <div className="mb-2 text-[11px] font-semibold tracking-wider text-ok uppercase">Explication</div>
                        <Markdown>{e.insight}</Markdown>
                      </div>
                    ) : (
                      <button className="btn btn-primary" onClick={() => reveal(e)}>
                        <Eye className="size-4" />
                        J’ai observé : voir l’explication
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
