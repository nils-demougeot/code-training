import clsx from 'clsx'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, Flame, Lightbulb, MessageSquareText, PenLine, RotateCcw, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Markdown } from '@/components/Markdown'
import { Empty } from '@/components/ui'
import { explainById } from '@/lib/content'
import { useProgress } from '@/lib/progress'
import type { ExplainDeck, ExplainItem, ExplainWrite } from '@/lib/types'
import { rng } from '@/maths/core'
import { celebrate } from './ExercisePage'

const KIND_LABEL: Record<ExplainItem['kind'], string> = {
  explain: 'Pick the clearest explanation',
  metric: 'Translate the metric',
  pushback: 'Handle the pushback',
  'so-what': 'Find the "so what"',
}

const VERDICT_POINTS = { best: 2, ok: 1, bad: 0 }

/** Technical terms a non-technical audience may not know, with a plainer way to say them. */
export const JARGON: [RegExp, string, string][] = [
  [/\bprecision\b/i, 'precision', 'say "of the cases we flag, how many are right"'],
  [/\brecall\b/i, 'recall', 'say "of all the real cases, how many we catch"'],
  [/\bf1\b/i, 'F1', 'give the two numbers that matter in plain words'],
  [/\b(auc|roc)\b/i, 'AUC/ROC', 'say how well the model ranks risky cases above safe ones'],
  [/\bembeddings?\b/i, 'embedding', 'say "a numeric fingerprint of the meaning"'],
  [/\bvectors?\b/i, 'vector', 'say "a list of numbers" or drop it'],
  [/\btokens?\b/i, 'token', 'say "pieces of words" or talk in pages and words'],
  [/\btransformers?\b/i, 'transformer', 'the architecture rarely matters to a client'],
  [/\bllms?\b/i, 'LLM', 'say "AI language model" the first time'],
  [/\brag\b|retrieval[- ]augmented/i, 'RAG', 'say "the AI first looks up your documents, then answers from them"'],
  [/\bfine[- ]?tun/i, 'fine-tuning', 'say "further training on your own examples"'],
  [/\bhyper-?parameters?\b/i, 'hyperparameter', 'say "settings" or drop it'],
  [/\bgradients?\b/i, 'gradient', 'drop the training mechanics'],
  [/\boverfit/i, 'overfitting', 'say "it memorised the past instead of learning general rules"'],
  [/\bp-?values?\b/i, 'p-value', 'say how confident you are that the effect is real'],
  [/\bstandard deviation\b/i, 'standard deviation', 'give a typical range instead'],
  [/\bconfidence intervals?\b/i, 'confidence interval', 'say "most likely between X and Y"'],
  [/\bneural (net|network)s?\b/i, 'neural network', 'say "the model"'],
  [/\binference\b/i, 'inference', 'say "when the model is used"'],
  [/\bhallucinat/i, 'hallucination', 'say "makes things up confidently"'],
  [/\b(training|test|validation) set\b/i, 'training/test set', 'say "past data we learned from / kept aside to check"'],
  [/\bxgboost|random forest|logistic regression|gradient boosting\b/i, 'algorithm name', 'the algorithm name rarely helps a business audience'],
]

export function jargonIn(text: string) {
  return JARGON.filter(([re]) => re.test(text)).map(([, term, tip]) => ({ term, tip }))
}

export function textStats(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const sentences = text
    .split(/[.!?]+(?:\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean)
  const longest = sentences.reduce((m, s) => Math.max(m, s.split(/\s+/).length), 0)
  return { words, sentences: sentences.length, longest }
}

export default function ExplainPage() {
  const { id = '' } = useParams()
  const deck = explainById.get(id)
  if (!deck) {
    return (
      <Empty icon={<MessageSquareText className="size-6" />} title="Deck not found">
        <Link to="/prep" className="btn btn-ghost mt-4">
          Back to BCG X prep
        </Link>
      </Empty>
    )
  }
  return <ExplainGame key={deck.id} deck={deck} />
}

type Phase = { kind: 'items'; index: number } | { kind: 'write'; index: number } | { kind: 'results' }

function ExplainGame({ deck }: { deck: ExplainDeck }) {
  const [seed, setSeed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0)
  const items = useMemo(() => rng(seed).sample(deck.items, deck.items.length), [deck, seed])
  const [phase, setPhase] = useState<Phase>({ kind: 'items', index: 0 })
  const [points, setPoints] = useState<number[]>([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [xp, setXp] = useState<number | null>(null)
  const finishExplain = useProgress((s) => s.finishExplain)
  const best = useProgress((s) => s.p.explain?.[deck.id]?.best)
  const top = useRef<HTMLDivElement>(null)
  const score = Math.round((points.reduce((a, b) => a + b, 0) / (deck.items.length * 2)) * 100)

  // Saved once the multiple-choice part is over (writing is practice, not scored).
  const mcqDone = points.length === deck.items.length
  useEffect(() => {
    if (mcqDone && xp === null) {
      setXp(finishExplain(deck.id, score))
      if (score >= 80) celebrate()
    }
  }, [mcqDone, xp, finishExplain, deck.id, score])

  const go = (p: Phase) => {
    setPhase(p)
    setTimeout(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const restart = () => {
    setSeed((s) => s + 1)
    setPoints([])
    setStreak(0)
    setBestStreak(0)
    setXp(null)
    go({ kind: 'items', index: 0 })
  }

  return (
    <div className="mx-auto max-w-3xl" lang="en" ref={top}>
      <Link to="/prep" className="mb-3 inline-flex scroll-mt-4 items-center gap-1 text-xs text-faint hover:text-fg">
        <ArrowLeft className="size-3.5" />
        BCG X prep
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] text-3xl">{deck.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-faint">Explain it simply</div>
          <h1 className="text-2xl font-semibold tracking-tight">{deck.title}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {best !== undefined && <span className="chip text-warn">Best: {best}/100</span>}
          <span className={clsx('chip', streak >= 2 && 'border-warn/40 text-warn')} data-streak={streak}>
            <Flame className="size-3.5" /> {streak}
          </span>
        </div>
      </div>

      {phase.kind === 'items' && (
        <>
          <div className="mb-4 flex gap-1">
            {deck.items.map((_, i) => (
              <span
                key={i}
                className={clsx(
                  'h-1.5 flex-1 rounded-full',
                  i < points.length ? (points[i] === 2 ? 'bg-ok' : points[i] === 1 ? 'bg-warn' : 'bg-bad') : i === phase.index ? 'bg-accent' : 'bg-white/10',
                )}
              />
            ))}
          </div>
          <ItemCard
            key={items[phase.index].id}
            item={items[phase.index]}
            seed={seed + phase.index}
            last={phase.index + 1 === items.length}
            onAnswer={(pts) => {
              setPoints((p) => [...p, pts])
              const s = pts === 2 ? streak + 1 : 0
              setStreak(s)
              setBestStreak((b) => Math.max(b, s))
            }}
            onNext={() => go(phase.index + 1 < items.length ? { kind: 'items', index: phase.index + 1 } : deck.write.length ? { kind: 'write', index: 0 } : { kind: 'results' })}
          />
        </>
      )}

      {phase.kind === 'write' && (
        <WriteCard
          key={deck.write[phase.index].id}
          write={deck.write[phase.index]}
          step={`${phase.index + 1} / ${deck.write.length}`}
          onNext={() => go(phase.index + 1 < deck.write.length ? { kind: 'write', index: phase.index + 1 } : { kind: 'results' })}
          onSkip={() => go({ kind: 'results' })}
        />
      )}

      {phase.kind === 'results' && (
        <div className="space-y-4" data-results>
          <div className="card flex flex-wrap items-center gap-5 p-6 animate-fade-up">
            <span className="text-5xl">{score >= 90 ? '🎤' : score >= 70 ? '💬' : '📝'}</span>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider text-faint">Communication score</div>
              <div className="text-3xl font-semibold tabular-nums" data-score={score}>
                {score}
                <span className="text-lg text-faint">/100</span>
              </div>
              <div className="text-sm text-muted">
                Best streak: {bestStreak} · {score >= 90 ? 'Crystal clear: a client would follow you.' : score >= 70 ? 'Good: a few answers to polish.' : 'Re-read the feedback and replay: clarity is a skill you can train.'}
              </div>
            </div>
            {!!xp && <div className="text-sm text-accent-2">+{xp} XP</div>}
          </div>
          <div className="card p-5 text-sm">
            <div className="section-title mb-2">Remember</div>
            <ul className="space-y-1.5">
              {items.map((it) => (
                <li key={it.id} className="flex gap-2">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span className="text-muted">{it.takeaway}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost px-4 py-2 text-sm" onClick={restart}>
              <RotateCcw className="size-4" /> Replay
            </button>
            <Link to="/prep" className="btn btn-primary px-4 py-2 text-sm">
              Other decks <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function ItemCard({ item, seed, last, onAnswer, onNext }: { item: ExplainItem; seed: number; last: boolean; onAnswer: (points: number) => void; onNext: () => void }) {
  const order = useMemo(() => rng(seed * 31 + 7).sample(item.options.map((_, i) => i), item.options.length), [item, seed])
  const [picked, setPicked] = useState<number | null>(null)
  const pick = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    onAnswer(VERDICT_POINTS[item.options[i].verdict])
  }
  return (
    <div className="card p-5 animate-fade-up" data-item={item.id}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="chip">{KIND_LABEL[item.kind]}</span>
        <span className="chip text-accent">
          <Users className="size-3.5" /> {item.audience}
        </span>
      </div>
      <Markdown className="mb-4">{item.prompt}</Markdown>
      <div className="grid gap-2">
        {order.map((i) => {
          const o = item.options[i]
          const shown = picked !== null
          const sel = picked === i
          return (
            <div key={i}>
              <button
                data-option={i}
                data-verdict={o.verdict}
                disabled={shown}
                onClick={() => pick(i)}
                className={clsx(
                  'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition',
                  shown
                    ? o.verdict === 'best'
                      ? 'border-ok/50 bg-ok/[0.07]'
                      : sel
                        ? o.verdict === 'ok'
                          ? 'border-warn/50 bg-warn/[0.06]'
                          : 'border-bad/50 bg-bad/[0.06]'
                        : 'border-line opacity-75'
                    : 'border-line hover:border-accent/50 hover:bg-accent/[0.04]',
                )}
              >
                <Markdown className="min-w-0 flex-1 [&_p]:my-0">{o.text}</Markdown>
                {shown && (o.verdict === 'best' ? <CheckCircle2 className="size-4 shrink-0 text-ok" /> : sel ? <X className="size-4 shrink-0 text-bad" /> : null)}
              </button>
              {shown && (
                <div className={clsx('mt-1 ml-1 text-xs animate-fade-up', sel || o.verdict === 'best' ? 'text-muted' : 'text-faint')}>
                  <span className={clsx('mr-1 font-medium', o.verdict === 'best' ? 'text-ok' : o.verdict === 'ok' ? 'text-warn' : 'text-bad')}>
                    {o.verdict === 'best' ? 'Best.' : o.verdict === 'ok' ? 'Acceptable.' : 'Avoid.'}
                  </span>
                  {o.feedback}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {picked !== null && (
        <div className="mt-4 space-y-3 animate-fade-up">
          <div className="flex gap-2 rounded-xl border border-accent/25 bg-accent/[0.05] p-3 text-sm">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>{item.takeaway}</span>
          </div>
          <button className="btn btn-primary px-4 py-2 text-sm" onClick={onNext} data-next>
            {last ? 'Continue' : 'Next'} <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function WriteCard({ write, step, onNext, onSkip }: { write: ExplainWrite; step: string; onNext: () => void; onSkip: () => void }) {
  const [text, setText] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [ticks, setTicks] = useState<boolean[]>(() => write.checklist.map(() => false))
  const stats = textStats(text)
  const jargon = jargonIn(text)
  const max = write.maxWords ?? 120
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="chip">
            <PenLine className="size-3.5" /> Your turn · {step}
          </span>
          <span className="chip text-accent">
            <Users className="size-3.5" /> {write.audience}
          </span>
          <span className="text-faint">Practice: not scored</span>
        </div>
        <Markdown className="mb-3">{write.prompt}</Markdown>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          data-write
          placeholder="Write as you would say it out loud…"
          className="w-full resize-y rounded-xl border border-line bg-black/30 p-3 text-sm outline-none focus:border-accent/50"
        />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" data-write-stats>
          <span className={clsx(stats.words > max ? 'text-warn' : 'text-muted')}>
            {stats.words} / {max} words
          </span>
          <span className={clsx(stats.longest > 25 ? 'text-warn' : 'text-muted')}>Longest sentence: {stats.longest} words{stats.longest > 25 && ' (split it)'}</span>
          <span className={clsx(jargon.length ? 'text-warn' : 'text-ok')} data-jargon={jargon.length}>
            {jargon.length ? `Jargon: ${jargon.map((j) => j.term).join(', ')}` : 'No jargon detected'}
          </span>
        </div>
        {jargon.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-faint">
            {jargon.map((j) => (
              <li key={j.term}>
                <b className="text-muted">{j.term}</b>: {j.tip}
              </li>
            ))}
          </ul>
        )}
        {!revealed && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-primary px-4 py-2 text-sm" disabled={stats.words < 8} onClick={() => setRevealed(true)} data-reveal>
              Compare with a strong answer
            </button>
            <button className="btn btn-ghost px-4 py-2 text-sm" onClick={onSkip}>
              Skip to results
            </button>
          </div>
        )}
      </div>
      {revealed && (
        <div className="space-y-4 animate-fade-up">
          <div className="card p-5">
            <div className="section-title mb-2">Check your answer honestly</div>
            <div className="space-y-1.5">
              {write.checklist.map((c, i) => (
                <label key={i} className="flex cursor-pointer items-start gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setTicks((t) => t.map((v, j) => (j === i ? !v : v)))}
                    className={clsx('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border', ticks[i] ? 'border-ok bg-ok text-black' : 'border-line')}
                    aria-label={c}
                  >
                    {ticks[i] && <Check className="size-3" />}
                  </button>
                  <span className={ticks[i] ? 'text-fg' : 'text-muted'}>{c}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="card border-ok/25 p-5">
            <div className="section-title mb-2 text-ok">A strong answer</div>
            <Markdown>{write.model}</Markdown>
          </div>
          <button className="btn btn-primary px-4 py-2 text-sm" onClick={onNext} data-next>
            Continue <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
