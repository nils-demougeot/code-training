import clsx from 'clsx'
import { Check, Eye, Lightbulb, RefreshCw, Send, Star, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Markdown } from '@/components/Markdown'
import { isCorrect, parseAnswer, plain, precisionLabel, rng, type Lang, type MathExercise, type MathInstance } from './core'
import { t } from './i18n'

export function Stars({ n, size = 'size-3.5', lang = 'fr' }: { n: number; size?: string; lang?: Lang }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={t(lang).starsLabel(n)}>
      {[0, 1, 2].map((i) => (
        <Star key={i} className={clsx(size, i < n ? 'fill-warn text-warn' : 'text-faint/40')} />
      ))}
    </span>
  )
}

export type Outcome = { correct: boolean; stars: number; gaveUp: boolean }

/** Stars for a correct answer: 3, minus one for the hint, minus one per wrong attempt (min 1). */
const starsFor = (hint: boolean, wrong: number) => Math.max(1, 3 - (hint ? 1 : 0) - Math.min(wrong, 2))

/**
 * One exercise instance: statement, answer fields (or choices), hint, step-by-step correction.
 * In boss mode there is no hint and a single attempt.
 */
export function MathPlayer({
  exercise,
  seed,
  boss,
  onDone,
  onNext,
  nextLabel,
  lang = 'fr',
}: {
  exercise: MathExercise
  seed: number
  boss?: boolean
  onDone: (o: Outcome) => void
  onNext?: () => void
  nextLabel?: string
  lang?: Lang
}) {
  const T = t(lang)
  const inst: MathInstance = useMemo(() => exercise.generate(rng(seed)), [exercise, seed])
  const [values, setValues] = useState<string[]>(() => inst.fields.map(() => ''))
  const [choice, setChoice] = useState<number | null>(null)
  const [checked, setChecked] = useState<(boolean | undefined)[] | null>(null)
  const [wrong, setWrong] = useState(0)
  const [hint, setHint] = useState(false)
  const [done, setDone] = useState<Outcome | null>(null)
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => {
    first.current?.focus({ preventScroll: true })
  }, [inst])

  const parsed = values.map((v) => parseAnswer(v))
  const ready = inst.choice ? choice !== null : parsed.every((v) => v !== null)

  const finish = (o: Outcome) => {
    setDone(o)
    onDone(o)
  }

  const check = () => {
    if (!ready || done) return
    const results = inst.choice ? [choice === inst.choice.answer] : inst.fields.map((f, i) => isCorrect(parsed[i]!, f))
    setChecked(results)
    if (results.every(Boolean)) finish({ correct: true, stars: boss ? 3 : starsFor(hint, wrong), gaveUp: false })
    else if (boss || inst.choice) finish({ correct: false, stars: 0, gaveUp: false })
    else setWrong((w) => w + 1)
  }

  const giveUp = () => finish({ correct: false, stars: 0, gaveUp: true })

  return (
    <div className="space-y-5">
      <Markdown className="text-[15px]">{inst.statement}</Markdown>

      {inst.choice ? (
        <div className="grid gap-2">
          {inst.choice.options.map((o, i) => {
            const isAnswer = done && i === inst.choice!.answer
            const isWrongPick = done && i === choice && i !== inst.choice!.answer
            return (
              <button
                key={i}
                disabled={!!done}
                onClick={() => setChoice(i)}
                className={clsx(
                  'flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition',
                  isAnswer ? 'border-ok/60 bg-ok/10' : isWrongPick ? 'border-bad/60 bg-bad/10' : choice === i ? 'border-accent/60 bg-accent/10' : 'border-line hover:border-white/25',
                )}
                data-choice={i}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs text-faint">{'ABCD'[i]}</span>
                <Markdown className="min-w-0 flex-1 [&_p]:my-0">{o}</Markdown>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {inst.fields.map((f, i) => {
            const state = checked?.[i]
            return (
              <label key={i} className="block">
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <Markdown className="[&_p]:my-0">{f.label}</Markdown>
                  <span className="shrink-0 text-[11px] text-faint">{precisionLabel(f.decimals, lang)}</span>
                </div>
                <div
                  className={clsx(
                    'flex items-center rounded-xl border bg-black/30 px-3 transition focus-within:border-accent/70',
                    state === true ? 'border-ok/60' : state === false ? 'border-bad/60' : 'border-line',
                  )}
                >
                  <input
                    ref={i === 0 ? first : undefined}
                    value={values[i]}
                    disabled={!!done}
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => {
                      setValues((vs) => vs.map((v, j) => (j === i ? e.target.value : v)))
                      setChecked((c) => c && c.map((x, j) => (j === i ? undefined : x)))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        check()
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent py-2 font-mono text-[15px] outline-none"
                    placeholder={T.placeholder}
                    data-field={i}
                  />
                  {f.unit && <span className="ml-2 text-xs text-faint">{f.unit}</span>}
                  {state === true && <Check className="ml-2 size-4 text-ok" />}
                  {state === false && <X className="ml-2 size-4 text-bad" />}
                </div>
                <div className="mt-1 h-4 px-1 font-mono text-[11px] text-faint">
                  {values[i].trim() && (parsed[i] === null ? <span className="text-warn">{T.unrecognized}</span> : /[^0-9.,\s-]/.test(values[i]) ? `= ${plain(parsed[i]!, 6, lang)}` : null)}
                  {done && !checked?.[i] && <span className="text-ok"> {T.answer} : {plain(f.answer, Math.max(f.decimals + 1, 2), lang)}</span>}
                </div>
              </label>
            )
          })}
        </div>
      )}

      {!done && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary px-4 py-2 text-sm" onClick={check} disabled={!ready}>
            <Send className="size-4" />
            {T.check}
          </button>
          {!boss && (
            <>
              <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => setHint(true)} disabled={hint}>
                <Lightbulb className="size-4" />
                {T.hint}
              </button>
              <button className="btn btn-quiet px-3 py-2 text-sm" onClick={giveUp}>
                <Eye className="size-4" />
                {T.giveUp}
              </button>
            </>
          )}
          {!boss && wrong > 0 && <span className="text-xs text-bad">{T.notYet}</span>}
          {!boss && !inst.choice && <span className="ml-auto hidden text-[11px] text-faint sm:block">{T.keys}</span>}
        </div>
      )}

      {hint && !done && (
        <div className="rounded-xl border border-warn/30 bg-warn/[0.06] p-4 text-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-warn">
            <Lightbulb className="size-3.5" /> {T.hintTitle}
          </div>
          <Markdown>{inst.hint}</Markdown>
        </div>
      )}

      {done && (
        <div className={clsx('rounded-2xl border p-4 animate-fade-up', done.correct ? 'border-ok/30 bg-ok/[0.05]' : 'border-line bg-white/[0.02]')}>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            {done.correct ? <Check className="size-5 text-ok" /> : <X className="size-5 text-bad" />}
            <span className="font-semibold">{done.correct ? T.right : done.gaveUp ? T.correction : T.missed}</span>
            {done.correct && !boss && <Stars n={done.stars} lang={lang} />}
            {!boss && (
              <div className="ml-auto flex gap-2">
                {onNext && (
                  <button className="btn btn-primary px-3 py-1.5 text-xs" onClick={onNext}>
                    <RefreshCw className="size-3.5" />
                    {nextLabel ?? T.nextExercise}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="section-title mb-2">{T.stepByStep}</div>
          <Markdown>{inst.solution}</Markdown>
          {inst.choice?.explanations && (
            <div className="mt-4 space-y-2">
              <div className="section-title">{T.whyOptions}</div>
              {inst.choice.options.map((o, i) => (
                <div
                  key={i}
                  className={clsx('rounded-xl border px-3 py-2 text-sm', i === inst.choice!.answer ? 'border-ok/40 bg-ok/[0.05]' : 'border-line')}
                >
                  <div className="mb-1 flex items-start gap-2">
                    <span className="mt-0.5 text-xs text-faint">{'ABCD'[i]}</span>
                    <Markdown className="min-w-0 flex-1 font-medium [&_p]:my-0">{o}</Markdown>
                  </div>
                  <Markdown className="text-muted [&_p]:my-0">{inst.choice!.explanations![i]}</Markdown>
                </div>
              ))}
            </div>
          )}
          {boss && onNext && (
            <button className="btn btn-primary mt-4 px-4 py-2 text-sm" onClick={onNext}>
              {nextLabel ?? T.nextRound}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
