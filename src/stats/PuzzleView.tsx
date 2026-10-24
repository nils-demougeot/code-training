import clsx from 'clsx'
import { Play, RotateCcw, Star, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Legend, LineChart } from '@/components/charts'
import { Markdown } from '@/components/Markdown'
import { rng } from '@/labs/ml'
import { useProgress } from '@/lib/progress'
import { formatAnswer, starsFor, type Puzzle } from './puzzles'

export function Stars({ n, size = 'size-4' }: { n: number; size?: string }) {
  return (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <Star key={i} className={clsx(size, i < n ? 'fill-warn text-warn' : 'text-faint/50')} />
      ))}
    </span>
  )
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

/** Guess with a slider, then watch a Monte-Carlo simulation converge to the exact answer. */
export function PuzzleView({ puzzle, onClose }: { puzzle: Puzzle; onClose: () => void }) {
  const answerPuzzle = useProgress((s) => s.answerPuzzle)
  const isPercent = puzzle.kind === 'percent'
  const [lo, hi] = puzzle.range ?? [0, 1]
  // Slider position in [0, 1000], mapped to a value (log scale when asked).
  const toValue = (pos: number) =>
    isPercent ? pos / 1000 : puzzle.log ? lo * (hi / lo) ** (pos / 1000) : lo + ((hi - lo) * pos) / 1000
  const [pos, setPos] = useState(500)
  const [revealed, setRevealed] = useState<{ guess: number; stars: number } | null>(null)
  const [series, setSeries] = useState<number[]>([])
  const [count, setCount] = useState(0)
  const [simDone, setSimDone] = useState(false)
  const raf = useRef(0)
  const guess = isPercent ? Math.round(toValue(pos) * 1000) / 1000 : toValue(pos)
  const target = puzzle.simTarget ?? puzzle.answer
  const simIsAnswer = puzzle.simTarget === undefined

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const simulate = () => {
    cancelAnimationFrame(raf.current)
    const r = rng(Date.now() % 100000)
    const frames = 60
    const perFrame = Math.ceil(puzzle.trials / frames)
    const values: number[] = []
    let sum = 0
    let n = 0
    const est: number[] = []
    let frame = 0
    setSimDone(false)
    const step = () => {
      for (let i = 0; i < perFrame; i++) {
        const v = puzzle.trial(r)
        if (v === null) continue
        n++
        sum += v
        if (puzzle.estimator === 'median') values.push(v)
      }
      est.push(puzzle.estimator === 'median' ? median(values) : sum / Math.max(1, n))
      setSeries([...est])
      setCount(n)
      frame++
      if (frame < frames) raf.current = requestAnimationFrame(step)
      else setSimDone(true)
    }
    raf.current = requestAnimationFrame(step)
  }

  const validate = () => {
    const stars = starsFor(puzzle, guess)
    setRevealed({ guess, stars })
    answerPuzzle(puzzle.id, guess, stars)
    simulate()
  }

  const fmtSim = (v: number) => (simIsAnswer ? formatAnswer(puzzle, v) : `${(v * 100).toFixed(1).replace('.', ',')} %`)
  const last = series.at(-1)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:pt-16" onClick={onClose}>
      <div className="card w-full max-w-2xl bg-panel p-6 animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="text-4xl">{puzzle.emoji}</span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{puzzle.title}</h2>
          </div>
          <button className="btn btn-quiet px-2 py-1" onClick={onClose} aria-label="Fermer">
            <X className="size-4" />
          </button>
        </div>
        <Markdown className="mt-3 text-[15px]">{puzzle.question}</Markdown>

        {!revealed ? (
          <div className="mt-6">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm text-muted">Ton intuition</span>
              <span className="font-mono text-2xl font-semibold text-accent-2">{formatAnswer(puzzle, guess)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              value={pos}
              onChange={(e) => setPos(Number(e.target.value))}
              className="w-full accent-[#22d3ee]"
              aria-label="Ton estimation"
            />
            <div className="flex justify-between text-[11px] text-faint">
              <span>{formatAnswer(puzzle, toValue(0))}</span>
              <span>{formatAnswer(puzzle, toValue(1000))}</span>
            </div>
            <p className="mt-3 text-xs text-faint">Réponds à l’instinct, sans calculer : le but est de confronter ton intuition à la réalité.</p>
            <button className="btn btn-primary mt-4" onClick={validate}>
              <Play className="size-4" />
              Valider et simuler
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-line p-3">
                <div className="text-[11px] text-faint">Ton intuition</div>
                <div className="font-mono text-lg font-semibold text-accent-2">{formatAnswer(puzzle, revealed.guess)}</div>
              </div>
              <div className="rounded-xl border border-ok/30 bg-ok/[0.06] p-3">
                <div className="text-[11px] text-faint">Réponse exacte</div>
                <div className="font-mono text-lg font-semibold text-ok">{formatAnswer(puzzle, puzzle.answer)}</div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-line p-3">
                <Stars n={revealed.stars} size="size-5" />
                <div className="mt-1 text-[11px] text-faint">
                  {['Le hasard est contre-intuitif !', 'Pas loin', 'Bien vu', 'Excellente intuition'][revealed.stars]}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-line p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted">{puzzle.simLabel}</span>
                <span className="font-mono text-xs text-faint">
                  n = {count.toLocaleString('fr-FR')} · estimation {last !== undefined ? fmtSim(last) : '—'}
                </span>
              </div>
              <LineChart
                series={[
                  { label: 'simulation', values: series, color: '#22d3ee' },
                  { label: 'exact', values: series.map(() => target), color: '#34d399', dashed: true },
                  ...(simIsAnswer ? [{ label: 'intuition', values: series.map(() => revealed.guess), color: '#fbbf24', dashed: true }] : []),
                ]}
                height={150}
                yMin={isPercent || !simIsAnswer ? 0 : undefined}
                yMax={isPercent || !simIsAnswer ? Math.min(1, Math.max(target, ...(simIsAnswer ? [revealed.guess] : []), ...series) * 1.25 + 0.02) : undefined}
                xLabel="simulations →"
              />
              <Legend
                items={[
                  { label: 'estimation simulée', color: '#22d3ee' },
                  { label: 'valeur exacte', color: '#34d399', dashed: true },
                  ...(simIsAnswer ? [{ label: 'ton intuition', color: '#fbbf24', dashed: true }] : []),
                ]}
              />
            </div>

            {simDone && (
              <div className="animate-fade-up">
                <Markdown>{puzzle.explain}</Markdown>
              </div>
            )}
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={simulate}>
                <Play className="size-4" />
                Relancer la simulation
              </button>
              <button
                className="btn btn-quiet"
                onClick={() => {
                  setRevealed(null)
                  setSeries([])
                }}
              >
                <RotateCcw className="size-4" />
                Rejouer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
