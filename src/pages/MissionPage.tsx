import clsx from 'clsx'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Briefcase, Check, CheckCircle2, ChevronRight, Lightbulb, MessageCircle, NotebookPen, RotateCcw, X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Markdown } from '@/components/Markdown'
import { DifficultyBadge, Empty } from '@/components/ui'
import { missionById } from '@/lib/content'
import { useProgress } from '@/lib/progress'
import type { Mission, MissionChoice, MissionOption, QuestionValue } from '@/lib/types'
import { isCorrect, parseAnswer, plain, precisionLabel, rng } from '@/maths/core'
import { celebrate } from './ExercisePage'

// ---------------------------------------------------------------- scoring

/** Points of each section; they add up to 100. */
export const SECTION_POINTS = { discovery: 25, framing: 20, approach: 15, plan: 10, value: 15, pitch: 15 } as const
type Section = keyof typeof SECTION_POINTS

const QUESTION_POINTS: Record<QuestionValue, number> = { key: 3, useful: 1, weak: 0, off: -2 }
const TRUST_DELTA: Record<QuestionValue, number> = { key: 12, useful: 5, weak: -6, off: -18 }
const VERDICT_SHARE = { best: 1, ok: 0.5, bad: 0 }

export function rankFor(score: number) {
  if (score >= 90) return { title: 'Partner', emoji: '🎩', text: 'Client-ready. You would lead this conversation.' }
  if (score >= 75) return { title: 'Project Leader', emoji: '🧭', text: 'Strong: a few blind spots to fix.' }
  if (score >= 50) return { title: 'Consultant', emoji: '💼', text: 'Good basis. Review the debrief to sharpen your instincts.' }
  return { title: 'Analyst', emoji: '📋', text: 'Keep practising: read the debrief carefully and replay.' }
}

/** Share of pairs of steps in the right relative order (1 = perfect). */
function orderScore(order: number[]) {
  let good = 0
  let total = 0
  for (let i = 0; i < order.length; i++)
    for (let j = i + 1; j < order.length; j++) {
      total++
      if (order[i] < order[j]) good++
    }
  return total ? good / total : 1
}

const STEPS = ['Brief', 'Discovery', 'Framing', 'Approach', 'Plan', 'Value', 'Pitch', 'Debrief'] as const

// ---------------------------------------------------------------- page

export default function MissionPage() {
  const { id = '' } = useParams()
  const mission = missionById.get(id)
  if (!mission) {
    return (
      <Empty icon={<Briefcase className="size-6" />} title="Mission not found">
        <Link to="/prep" className="btn btn-ghost mt-4">
          Back to BCG X prep
        </Link>
      </Empty>
    )
  }
  return <MissionGame key={mission.id} mission={mission} />
}

interface Run {
  seed: number
  step: number
  asked: string[]
  trust: number
  /** Points earned per section (in section points). */
  points: Partial<Record<Section, number>>
}

const newRun = (): Run => ({ seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, step: 0, asked: [], trust: 50, points: {} })

function MissionGame({ mission }: { mission: Mission }) {
  const [run, setRun] = useState<Run>(newRun)
  const finishMission = useProgress((s) => s.finishMission)
  const best = useProgress((s) => s.p.missions?.[mission.id]?.best)
  const [saved, setSaved] = useState<{ xp: number } | null>(null)
  const top = useRef<HTMLDivElement>(null)

  const facts = useMemo(() => {
    const revealed = new Set(mission.discovery.questions.filter((q) => run.asked.includes(q.id)).flatMap((q) => q.reveals ?? []))
    return mission.facts.filter((f) => revealed.has(f.id))
  }, [mission, run.asked])

  const next = () => {
    setRun((r) => ({ ...r, step: r.step + 1 }))
    setTimeout(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const award = (section: Section, share: number) => setRun((r) => ({ ...r, points: { ...r.points, [section]: Math.round(SECTION_POINTS[section] * Math.max(0, Math.min(1, share)) * 10) / 10 } }))
  const score = Math.round(Object.values(run.points).reduce((a, b) => a + (b ?? 0), 0))

  // Save once, when the debrief is reached.
  useEffect(() => {
    if (STEPS[run.step] === 'Debrief' && !saved) {
      const xp = finishMission(mission.id, score)
      setSaved({ xp })
      if (score >= 75) celebrate()
    }
  }, [run.step, saved, score, mission.id, finishMission])

  const restart = () => {
    setRun(newRun())
    setSaved(null)
  }

  return (
    <div className="mx-auto max-w-6xl" lang="en" ref={top}>
      <Link to="/prep" className="mb-3 inline-flex scroll-mt-4 items-center gap-1 text-xs text-faint hover:text-fg">
        <ArrowLeft className="size-3.5" />
        BCG X prep
      </Link>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.04] text-4xl">{mission.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-faint">Client mission · {mission.industry}</div>
          <h1 className="text-2xl font-semibold tracking-tight">{mission.title}</h1>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <DifficultyBadge difficulty={mission.difficulty} lang="en" />
            <span className="chip">~{mission.minutes} min</span>
            {best !== undefined && <span className="chip text-warn">Best: {best}/100</span>}
          </div>
        </div>
      </div>

      <ol className="mb-6 flex flex-wrap gap-1 rounded-xl border border-line bg-white/[0.02] p-1 text-xs" aria-label="Mission steps">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5',
              i === run.step ? 'bg-accent/15 text-fg' : i < run.step ? 'text-ok' : 'text-faint',
            )}
          >
            {i < run.step ? <Check className="size-3.5" /> : <span className="w-3.5 text-center">{i + 1}</span>}
            {s}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {STEPS[run.step] === 'Brief' && <Brief mission={mission} onNext={next} />}
          {STEPS[run.step] === 'Discovery' && (
            <Discovery
              mission={mission}
              run={run}
              onAsk={(qid, value) => setRun((r) => ({ ...r, asked: [...r.asked, qid], trust: Math.max(0, Math.min(100, r.trust + TRUST_DELTA[value])) }))}
              onDone={() => {
                const values = mission.discovery.questions.map((q) => QUESTION_POINTS[q.value]).sort((a, b) => b - a)
                const max = values.slice(0, mission.discovery.budget).reduce((a, b) => a + b, 0)
                const got = mission.discovery.questions.filter((q) => run.asked.includes(q.id)).reduce((a, q) => a + QUESTION_POINTS[q.value], 0)
                award('discovery', got / max)
                next()
              }}
            />
          )}
          {STEPS[run.step] === 'Framing' && (
            <ChoiceSequence
              key="framing"
              title="Frame the problem"
              intro="Turn what you heard into a clear problem statement. Use your notes."
              choices={mission.framing}
              onDone={(share) => {
                award('framing', share)
                next()
              }}
            />
          )}
          {STEPS[run.step] === 'Approach' && (
            <ChoiceSequence
              key="approach"
              title="Choose the approach"
              intro="Several approaches are possible. Pick the one you would recommend for a first version."
              choices={[mission.approach]}
              onDone={(share) => {
                award('approach', share)
                next()
              }}
            />
          )}
          {STEPS[run.step] === 'Plan' && (
            <Plan
              mission={mission}
              seed={run.seed}
              onDone={(share) => {
                award('plan', share)
                next()
              }}
            />
          )}
          {STEPS[run.step] === 'Value' && (
            <Value
              mission={mission}
              onDone={(share) => {
                award('value', share)
                next()
              }}
            />
          )}
          {STEPS[run.step] === 'Pitch' && (
            <ChoiceSequence
              key="pitch"
              title="Write back to the client"
              intro="Your manager asks you to send the follow-up email. Which summary do you send?"
              choices={[mission.pitch]}
              onDone={(share) => {
                award('pitch', share)
                next()
              }}
            />
          )}
          {STEPS[run.step] === 'Debrief' && <Debrief mission={mission} run={run} score={score} xp={saved?.xp ?? 0} onReplay={restart} />}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <ClientCard mission={mission} trust={run.trust} showTrust={run.step >= 1} />
          <div className="card p-4" data-notes>
            <div className="section-title mb-2 flex items-center gap-2">
              <NotebookPen className="size-4" /> Your notes
            </div>
            {facts.length ? (
              <ul className="space-y-1.5 text-sm">
                {facts.map((f) => (
                  <li key={f.id} className="flex gap-2">
                    <span className="text-accent">•</span>
                    <span className="text-muted">{f.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-faint">Facts you learn from the client will appear here.</p>
            )}
          </div>
          {run.step > 1 && (
            <div className="card p-4 text-sm">
              <div className="section-title mb-2">Score so far</div>
              {(Object.keys(SECTION_POINTS) as Section[]).map((s) => (
                <div key={s} className="flex justify-between py-0.5 text-xs">
                  <span className="capitalize text-muted">{s}</span>
                  <span className="font-mono">{run.points[s] === undefined ? '–' : `${run.points[s]}/${SECTION_POINTS[s]}`}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- pieces

/** First name, or the full name when it starts with a title ("Dr. …"). */
const shortName = (name: string) => (name.split(' ')[0].endsWith('.') ? name : name.split(' ')[0])

function ClientCard({ mission, trust, showTrust }: { mission: Mission; trust: number; showTrust: boolean }) {
  const initials = mission.client.name
    .split(' ')
    .filter((w) => !w.endsWith('.'))
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
  const mood = trust >= 75 ? '😊' : trust >= 50 ? '🙂' : trust >= 30 ? '😐' : '😠'
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-accent/40 to-cyan-400/30 font-semibold">{initials}</span>
        <div className="min-w-0">
          <div className="font-medium">{mission.client.name}</div>
          <div className="text-xs text-muted">{mission.client.role}</div>
          <div className="text-xs text-faint">{mission.client.company}</div>
        </div>
      </div>
      {showTrust && (
        <div className="mt-3" data-trust={trust}>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>Client trust</span>
            <span>
              {mood} {trust}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div className={clsx('h-full rounded-full transition-[width] duration-500', trust >= 50 ? 'bg-ok' : trust >= 30 ? 'bg-warn' : 'bg-bad')} style={{ width: `${trust}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

function Brief({ mission, onNext }: { mission: Mission; onNext: () => void }) {
  return (
    <div className="space-y-5">
      <div className="card p-6">
        <div className="mb-3 flex items-center gap-2 text-xs text-faint">
          <MessageCircle className="size-4" /> {mission.client.name} says
        </div>
        <Markdown className="text-[17px] leading-relaxed">{mission.brief}</Markdown>
      </div>
      <div className="card p-6">
        <div className="section-title mb-2">Your situation</div>
        <Markdown>{mission.context}</Markdown>
      </div>
      <div className="rounded-2xl border border-accent/25 bg-accent/[0.05] p-5 text-sm">
        <div className="mb-2 flex items-center gap-2 font-medium text-accent">
          <Lightbulb className="size-4" /> Coach tip: the framing checklist
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>
            <b className="text-fg">Objective</b>: what business result, measured how? (Not "use AI".)
          </li>
          <li>
            <b className="text-fg">Process and users</b>: what happens today, where is the pain, who will use the solution?
          </li>
          <li>
            <b className="text-fg">Data</b>: what exists, how much, labelled or not, accessible?
          </li>
          <li>
            <b className="text-fg">Constraints</b>: legal, privacy, IT, deadline, what must stay human.
          </li>
          <li>
            <b className="text-fg">Baseline and value</b>: what was tried, what is it worth?
          </li>
        </ol>
      </div>
      <button className="btn btn-primary px-5 py-2.5" onClick={onNext}>
        Start the meeting
        <ArrowRight className="size-4" />
      </button>
    </div>
  )
}

function Discovery({
  mission,
  run,
  onAsk,
  onDone,
}: {
  mission: Mission
  run: Run
  onAsk: (id: string, value: QuestionValue) => void
  onDone: () => void
}) {
  const order = useMemo(() => rng(run.seed).sample(mission.discovery.questions, mission.discovery.questions.length), [mission, run.seed])
  const left = mission.discovery.budget - run.asked.length
  // Too many irrelevant questions and the client ends the meeting.
  const walkedOut = run.trust <= 15 && left > 0
  const transcript = useRef<HTMLDivElement>(null)
  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'smooth' })
  }, [run.asked.length])
  const asked = run.asked.map((id) => mission.discovery.questions.find((q) => q.id === id)!)

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="text-lg font-semibold">Discovery meeting</h2>
        <p className="mt-1 text-sm text-muted">{mission.discovery.intro}</p>
        <p className="mt-1 text-xs text-faint">Watch the client's trust gauge: sharp questions raise it, irrelevant ones lower it, and if it falls too low the client ends the meeting.</p>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="font-medium">Questions left:</span>
          {Array.from({ length: mission.discovery.budget }, (_, i) => (
            <span key={i} className={clsx('size-3 rounded-full', i < left ? 'bg-accent' : 'bg-white/10')} />
          ))}
        </div>
      </div>

      {asked.length > 0 && (
        <div ref={transcript} className="card max-h-[28rem] space-y-3 overflow-y-auto p-5" data-transcript>
          {asked.map((q) => (
            <div key={q.id} className="space-y-2 animate-fade-up">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-accent/20 px-4 py-2 text-sm">{q.text}</div>
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-line bg-white/[0.03] px-4 py-2 text-sm">
                <div className="mb-0.5 text-[11px] text-faint">{mission.client.name}</div>
                <Markdown className="[&_p]:my-0">{q.answer}</Markdown>
              </div>
            </div>
          ))}
        </div>
      )}

      {left > 0 && !walkedOut ? (
        <div className="grid gap-2" data-questions>
          {order
            .filter((q) => !run.asked.includes(q.id))
            .map((q) => (
              <button
                key={q.id}
                data-question={q.id}
                onClick={() => onAsk(q.id, q.value)}
                className="flex items-start gap-3 rounded-xl border border-line px-4 py-2.5 text-left text-sm transition hover:border-accent/50 hover:bg-accent/[0.05]"
              >
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-faint" />
                {q.text}
              </button>
            ))}
        </div>
      ) : (
        <div className={clsx('rounded-xl border p-4 text-sm', walkedOut ? 'border-bad/40 bg-bad/[0.05] text-bad' : 'border-line bg-white/[0.02] text-muted')} data-meeting-over>
          {walkedOut
            ? `${shortName(mission.client.name)} looks at their watch: "I am sorry, I have another meeting." Too many questions missed the point and the meeting ended early.`
            : 'The meeting is over. Time to make sense of what you heard.'}
        </div>
      )}
      <button className="btn btn-primary px-5 py-2.5" onClick={onDone} disabled={run.asked.length === 0} data-done-discovery>
        {left > 0 && !walkedOut ? 'End the meeting now' : 'Continue to framing'}
        <ArrowRight className="size-4" />
      </button>
    </div>
  )
}

/** A series of single or multiple choice questions with immediate feedback. Reports the average share of points. */
function ChoiceSequence({ title, intro, choices, onDone }: { title: string; intro: string; choices: MissionChoice[]; onDone: (share: number) => void }) {
  const [index, setIndex] = useState(0)
  const [shares, setShares] = useState<number[]>([])
  const [picked, setPicked] = useState<number[]>([])
  const [locked, setLocked] = useState(false)
  const choice = choices[index]
  const order = useMemo(() => rng(index * 7919 + choice.options.length + choice.question.length).sample(choice.options.map((_, i) => i), choice.options.length), [choice, index])

  const scoreOf = (sel: number[]) => {
    if (choice.multi) {
      // One point per option classified correctly (picked if right, left out if wrong).
      const ok = choice.options.filter((o, i) => !!o.correct === sel.includes(i)).length
      return ok / choice.options.length
    }
    const o = choice.options[sel[0]]
    return o.verdict ? VERDICT_SHARE[o.verdict] : o.correct ? 1 : 0
  }

  const lock = (sel: number[]) => {
    setPicked(sel)
    setLocked(true)
    setShares((s) => [...s, scoreOf(sel)])
  }

  const advance = () => {
    if (index + 1 < choices.length) {
      setIndex(index + 1)
      setPicked([])
      setLocked(false)
    } else {
      onDone(shares.reduce((a, b) => a + b, 0) / shares.length)
    }
  }

  const good = (o: MissionOption) => (o.verdict ? o.verdict === 'best' : !!o.correct)

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          {choices.length > 1 && (
            <span className="text-xs text-faint">
              {index + 1} / {choices.length}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">{intro}</p>
      </div>
      <div className="card p-5" data-choice-question={choice.id}>
        <Markdown className="mb-4 font-medium">{choice.question}</Markdown>
        <div className="grid gap-2">
          {order.map((i) => {
            const o = choice.options[i]
            const sel = picked.includes(i)
            return (
              <div key={i}>
                <button
                  disabled={locked}
                  data-option={i}
                  onClick={() => (choice.multi ? setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i])) : lock([i]))}
                  className={clsx(
                    'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition',
                    locked
                      ? good(o)
                        ? 'border-ok/50 bg-ok/[0.07]'
                        : sel
                          ? o.verdict === 'ok'
                            ? 'border-warn/50 bg-warn/[0.06]'
                            : 'border-bad/50 bg-bad/[0.06]'
                          : 'border-line opacity-80'
                      : sel
                        ? 'border-accent/60 bg-accent/10'
                        : 'border-line hover:border-white/25',
                  )}
                >
                  <span
                    className={clsx(
                      'mt-0.5 flex size-4 shrink-0 items-center justify-center border',
                      choice.multi ? 'rounded' : 'rounded-full',
                      sel ? 'border-accent bg-accent text-black' : 'border-line',
                    )}
                  >
                    {sel && <Check className="size-3" />}
                  </span>
                  <Markdown className="min-w-0 flex-1 [&_p]:my-0">{o.text}</Markdown>
                  {locked && (good(o) ? <CheckCircle2 className="size-4 shrink-0 text-ok" /> : sel ? <X className="size-4 shrink-0 text-bad" /> : null)}
                </button>
                {locked && (sel || good(o)) && (
                  <div className="mt-1 ml-7 text-xs text-muted animate-fade-up">
                    <Markdown className="[&_p]:my-0">{o.feedback}</Markdown>
                  </div>
                )}
                {locked && choice.multi && !sel && !good(o) && <div className="mt-1 ml-7 text-xs text-faint">{o.feedback}</div>}
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex gap-2">
          {!locked && choice.multi && (
            <button className="btn btn-primary px-4 py-2 text-sm" onClick={() => lock(picked)} data-check-choice>
              Check
            </button>
          )}
          {locked && (
            <button className="btn btn-primary px-4 py-2 text-sm" onClick={advance} data-next>
              {index + 1 < choices.length ? 'Next question' : 'Continue'}
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Plan({ mission, seed, onDone }: { mission: Mission; seed: number; onDone: (share: number) => void }) {
  const [order, setOrder] = useState<number[]>(() => {
    const idx = mission.plan.steps.map((_, i) => i)
    let s = rng(seed).sample(idx, idx.length)
    // Never start already sorted.
    if (s.every((v, i) => v === i)) s = [...s.slice(1), s[0]]
    return s
  })
  const [checked, setChecked] = useState(false)
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= order.length) return
    const o = order.slice()
    ;[o[i], o[j]] = [o[j], o[i]]
    setOrder(o)
  }
  const share = orderScore(order)
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="text-lg font-semibold">Plan the work</h2>
        <p className="mt-1 text-sm text-muted">{mission.plan.question} Use the arrows to reorder.</p>
      </div>
      <div className="card p-5">
        <ol className="space-y-2" data-plan>
          {order.map((stepIndex, i) => (
            <li
              key={stepIndex}
              className={clsx(
                'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm',
                checked ? (stepIndex === i ? 'border-ok/50 bg-ok/[0.06]' : 'border-bad/40 bg-bad/[0.05]') : 'border-line',
              )}
            >
              <span className="w-5 text-center font-mono text-xs text-faint">{i + 1}</span>
              <span className="flex-1">{mission.plan.steps[stepIndex]}</span>
              {!checked && (
                <span className="flex gap-1">
                  <button className="rounded p-1 text-muted hover:bg-white/10 disabled:opacity-25" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUp className="size-4" />
                  </button>
                  <button className="rounded p-1 text-muted hover:bg-white/10 disabled:opacity-25" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Move down">
                    <ArrowDown className="size-4" />
                  </button>
                </span>
              )}
              {checked && stepIndex !== i && <span className="text-xs text-faint">should be #{stepIndex + 1}</span>}
            </li>
          ))}
        </ol>
        {checked && (
          <div className="mt-4 rounded-xl border border-line bg-white/[0.02] p-4 text-sm animate-fade-up">
            <div className="mb-1 font-medium">{Math.round(share * 100)} % of the steps are in the right relative order</div>
            <Markdown className="text-muted">{mission.plan.explanation}</Markdown>
          </div>
        )}
        <div className="mt-4">
          {!checked ? (
            <button className="btn btn-primary px-4 py-2 text-sm" onClick={() => setChecked(true)} data-check-plan>
              Check the order
            </button>
          ) : (
            <button className="btn btn-primary px-4 py-2 text-sm" onClick={() => onDone(share)} data-next>
              Continue
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Value({ mission, onDone }: { mission: Mission; onDone: (share: number) => void }) {
  const fields = mission.value.fields
  const [values, setValues] = useState(() => fields.map(() => ''))
  const [tries, setTries] = useState(0)
  const [status, setStatus] = useState<(boolean | null)[]>(() => fields.map(() => null))
  const [done, setDone] = useState(false)
  const [earned, setEarned] = useState(0)
  const check = () => {
    const res = fields.map((f, i) => {
      const v = parseAnswer(values[i])
      return v !== null && isCorrect(v, { label: f.label, answer: f.answer, decimals: f.decimals })
    })
    const attempt = tries + 1
    setTries(attempt)
    setStatus(res)
    if (res.every(Boolean) || attempt >= 2) {
      // Full points per field right at the first try, half at the second.
      const share = res.reduce((a, ok) => a + (ok ? (attempt === 1 ? 1 : 0.5) : 0), 0) / fields.length
      setEarned(share)
      setDone(true)
    }
  }
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="text-lg font-semibold">Size the value</h2>
        <p className="mt-1 text-sm text-muted">Clients expect a back-of-the-envelope estimate early. Two tries; you can type expressions like 3000*0.7*1.5/60.</p>
      </div>
      <div className="card space-y-4 p-5">
        <Markdown>{mission.value.intro}</Markdown>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f, i) => (
            <label key={i} className="block">
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span>{f.label}</span>
                <span className="shrink-0 text-[11px] text-faint">{precisionLabel(f.decimals, 'en')}</span>
              </div>
              <div
                className={clsx(
                  'flex items-center rounded-xl border bg-black/30 px-3',
                  status[i] === true ? 'border-ok/60' : status[i] === false ? 'border-bad/60' : 'border-line',
                )}
              >
                <input
                  value={values[i]}
                  disabled={done}
                  data-value-field={i}
                  inputMode="decimal"
                  onChange={(e) => setValues((vs) => vs.map((v, j) => (j === i ? e.target.value : v)))}
                  onKeyDown={(e) => e.key === 'Enter' && check()}
                  className="min-w-0 flex-1 bg-transparent py-2 font-mono outline-none"
                  placeholder="e.g. 3000*0.7"
                />
                {f.unit && <span className="ml-2 text-xs text-faint">{f.unit}</span>}
              </div>
              {done && status[i] === false && <div className="mt-1 text-xs text-ok">answer: {plain(f.answer, Math.max(f.decimals, 1), 'en')}</div>}
            </label>
          ))}
        </div>
        {!done ? (
          <div className="flex items-center gap-3">
            <button className="btn btn-primary px-4 py-2 text-sm" onClick={check} disabled={values.some((v) => parseAnswer(v) === null)} data-check-value>
              Check
            </button>
            {tries === 1 && <span className="text-xs text-bad">Not quite: one more try.</span>}
          </div>
        ) : (
          <div className="space-y-3 animate-fade-up">
            <div className="rounded-xl border border-line bg-white/[0.02] p-4 text-sm">
              <Markdown>{mission.value.solution}</Markdown>
            </div>
            <button className="btn btn-primary px-4 py-2 text-sm" onClick={() => onDone(earned)} data-next>
              Continue
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Debrief({ mission, run, score, xp, onReplay }: { mission: Mission; run: Run; score: number; xp: number; onReplay: () => void }) {
  const rank = rankFor(score)
  const missedKey = mission.discovery.questions.filter((q) => q.value === 'key' && !run.asked.includes(q.id))
  return (
    <div className="space-y-5" data-debrief>
      <div className="card flex flex-wrap items-center gap-5 p-6 animate-fade-up">
        <span className="text-6xl">{rank.emoji}</span>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-faint">Your level on this case</div>
          <div className="text-3xl font-semibold">{rank.title}</div>
          <div className="text-sm text-muted">{rank.text}</div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-semibold tabular-nums" data-score={score}>
            {score}
            <span className="text-lg text-faint">/100</span>
          </div>
          {xp > 0 && <div className="text-xs text-accent-2">+{xp} XP</div>}
        </div>
      </div>

      <div className="card p-5">
        <div className="section-title mb-3">Breakdown</div>
        {(Object.keys(SECTION_POINTS) as Section[]).map((s) => (
          <div key={s} className="mb-2">
            <div className="mb-1 flex justify-between text-sm">
              <span className="capitalize">{s}</span>
              <span className="font-mono text-xs">
                {run.points[s] ?? 0}/{SECTION_POINTS[s]}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-cyan-400" style={{ width: `${((run.points[s] ?? 0) / SECTION_POINTS[s]) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      {missedKey.length > 0 && (
        <div className="card border-warn/30 p-5">
          <div className="section-title mb-2 text-warn">Key questions you did not ask</div>
          <ul className="space-y-3 text-sm">
            {missedKey.map((q) => (
              <li key={q.id}>
                <div className="font-medium">“{q.text}”</div>
                <Markdown className="text-muted [&_p]:my-0">{q.why}</Markdown>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-5">
        <div className="section-title mb-3">All the discovery questions, rated</div>
        <ul className="space-y-2 text-sm">
          {mission.discovery.questions.map((q) => (
            <li key={q.id} className="flex gap-3">
              <span
                className={clsx(
                  'mt-0.5 h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                  q.value === 'key' ? 'bg-ok/15 text-ok' : q.value === 'useful' ? 'bg-accent/15 text-accent' : q.value === 'weak' ? 'bg-white/10 text-muted' : 'bg-bad/15 text-bad',
                )}
              >
                {q.value}
              </span>
              <div>
                <div className={clsx(run.asked.includes(q.id) ? 'text-fg' : 'text-muted')}>
                  {q.text} {run.asked.includes(q.id) && <span className="text-xs text-accent">(asked)</span>}
                </div>
                <Markdown className="text-xs text-faint [&_p]:my-0">{q.why}</Markdown>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-6">
        <Markdown>{mission.debrief}</Markdown>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost px-4 py-2 text-sm" onClick={onReplay}>
          <RotateCcw className="size-4" />
          Replay this mission
        </button>
        <Link to="/prep" className="btn btn-primary px-4 py-2 text-sm">
          Other missions
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}
