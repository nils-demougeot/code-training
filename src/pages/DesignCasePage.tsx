import clsx from 'clsx'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, Lightbulb, PartyPopper, Timer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Markdown } from '@/components/Markdown'
import { DifficultyBadge, Empty, ProgressBar } from '@/components/ui'
import { designCaseById } from '@/lib/content'
import { useProgress } from '@/lib/progress'
import type { DesignCase } from '@/lib/types'
import { celebrate } from './ExercisePage'
import { designScore } from './Design'

export default function DesignCasePage() {
  const { id = '' } = useParams()
  const c = designCaseById.get(id)
  if (!c) return <Empty title="Cas introuvable" />
  return <CaseView key={c.id} c={c} />
}

function CaseView({ c }: { c: DesignCase }) {
  const st = useProgress((s) => s.p.design?.[c.id])
  const store = useProgress()
  const firstOpen = c.steps.findIndex((s) => !st?.revealed.includes(s.id))
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen)
  const [showAnswer, setShowAnswer] = useState(false)
  const [started] = useState(Date.now())
  const [now, setNow] = useState(Date.now())
  const step = c.steps[index]
  const revealed = st?.revealed.includes(step.id) ?? false
  const checked = st?.checked[step.id] ?? []
  const [draft, setDraft] = useState(st?.notes[step.id] ?? '')
  const allRevealed = c.steps.every((s) => st?.revealed.includes(s.id))

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    setDraft(useProgress.getState().p.design?.[c.id]?.notes[step.id] ?? '')
    setShowAnswer(false)
  }, [c.id, step.id])

  const toggle = (i: number) =>
    store.setDesignChecked(c.id, step.id, checked.includes(i) ? checked.filter((x) => x !== i) : [...checked, i].sort())

  const finish = () => {
    store.completeDesign(c.id)
    celebrate()
  }

  const elapsed = Math.floor((now - started) / 1000)
  const score = designScore(c, st?.checked)

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Link to="/design" className="inline-flex items-center gap-1 text-xs text-faint hover:text-fg">
          <ArrowLeft className="size-3.5" />
          Design ML
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{c.title}</h1>
          <div className="mt-1 text-xs text-faint">{c.company}</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <DifficultyBadge difficulty={c.difficulty} />
            <span className="chip font-mono">
              <Timer className="size-3" />
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')} / {c.minutes} min
            </span>
          </div>
        </div>
        <nav className="space-y-1">
          {c.steps.map((s, i) => {
            const done = st?.revealed.includes(s.id)
            return (
              <button
                key={s.id}
                onClick={() => setIndex(i)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition',
                  i === index ? 'bg-white/[0.07] text-fg' : 'text-muted hover:bg-white/[0.03]',
                )}
              >
                <span
                  className={clsx(
                    'flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
                    done ? 'bg-ok/15 text-ok' : i === index ? 'bg-accent/20 text-accent' : 'bg-white/[0.05] text-faint',
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="flex-1">{s.title}</span>
                {done && <span className="text-[10px] text-faint">{(st?.checked[s.id] ?? []).length}/{s.points.length}</span>}
              </button>
            )
          })}
        </nav>
        <div>
          <div className="mb-1 flex justify-between text-xs text-faint">
            <span>Points clés couverts</span>
            <span>{Math.round(score * 100)} %</span>
          </div>
          <ProgressBar value={score} />
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        <section className="card p-6">
          <div className="section-title mb-2">Contexte</div>
          <Markdown>{c.context}</Markdown>
        </section>

        <section key={step.id} className="card p-6 animate-fade-up">
          <div className="text-xs font-semibold tracking-wider text-accent uppercase">
            Étape {index + 1}/{c.steps.length} · {step.title}
          </div>
          <div className="mt-2 text-lg font-medium">{step.question}</div>
          <textarea
            className="input mt-4 min-h-40 text-sm leading-relaxed"
            placeholder="Réponds comme à l’oral : structure ta réponse, cite des métriques, des pièges, des compromis…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => store.saveDesignNote(c.id, step.id, draft)}
          />
          <div className="mt-1 text-[11px] text-faint">Tes notes sont sauvegardées.</div>

          {!revealed ? (
            <button
              className="btn btn-primary mt-4"
              onClick={() => {
                store.saveDesignNote(c.id, step.id, draft)
                store.revealDesignStep(c.id, step.id)
              }}
            >
              <Lightbulb className="size-4" />
              Comparer avec les points clés
            </button>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-line p-4">
                <div className="mb-2 text-sm font-medium">Coche les points que tu as couverts :</div>
                <div className="space-y-1.5">
                  {step.points.map((pt, i) => (
                    <label
                      key={i}
                      className={clsx(
                        'flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 text-sm transition',
                        checked.includes(i) ? 'bg-ok/[0.08]' : 'hover:bg-white/[0.03]',
                      )}
                    >
                      <input type="checkbox" className="mt-1 accent-[#34d399]" checked={checked.includes(i)} onChange={() => toggle(i)} />
                      <Markdown className="flex-1 [&_p]:m-0">{pt}</Markdown>
                    </label>
                  ))}
                </div>
              </div>
              {showAnswer ? (
                <div className="rounded-2xl border border-accent/25 bg-accent/[0.04] p-4">
                  <div className="mb-2 text-[11px] font-semibold tracking-wider text-accent uppercase">Une réponse modèle</div>
                  <Markdown>{step.answer}</Markdown>
                </div>
              ) : (
                <button className="btn btn-ghost" onClick={() => setShowAnswer(true)}>
                  <Eye className="size-4" />
                  Voir une réponse modèle
                </button>
              )}
              <div className="flex justify-end">
                {index < c.steps.length - 1 ? (
                  <button className="btn btn-primary" onClick={() => setIndex(index + 1)}>
                    Étape suivante
                    <ArrowRight className="size-4" />
                  </button>
                ) : (
                  allRevealed &&
                  !st?.completedAt && (
                    <button className="btn btn-success" onClick={finish}>
                      <CheckCircle2 className="size-4" />
                      Terminer le cas (+40 XP)
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </section>

        {st?.completedAt && (
          <section className="card border-ok/30 p-6 animate-pop">
            <div className="flex items-center gap-2 font-semibold text-ok">
              <PartyPopper className="size-5" />
              Cas terminé : {Math.round(score * 100)} % des points clés couverts
            </div>
            <p className="mt-2 text-sm text-muted">
              Les points non cochés sont ceux à travailler. Refais ce cas dans quelques jours, à voix haute et en temps limité :
              c’est la structure de ta réponse qui fait la différence en entretien.
            </p>
            <div className="mt-3 space-y-2">
              {c.steps.map((s) => {
                const missed = s.points.filter((_, i) => !(st.checked[s.id] ?? []).includes(i))
                if (!missed.length) return null
                return (
                  <div key={s.id} className="text-sm">
                    <div className="font-medium">{s.title}</div>
                    <ul className="ml-5 list-disc text-muted">
                      {missed.map((m) => (
                        <li key={m}>
                          <Markdown className="[&_p]:m-0">{m}</Markdown>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
