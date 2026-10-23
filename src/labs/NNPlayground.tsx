import { Minus, Pause, Play, Plus, RotateCcw, StepForward } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Legend, LineChart } from '@/components/charts'
import { Control, Metric, PlotCanvas, Segmented, Slider } from './controls'
import {
  accuracy, DATASETS, drawBoundary, makeDataset, MLP, rng,
  type Activation, type DatasetName, type FeatureSet, type Optimizer,
} from './ml'

export interface NNConfig {
  dataset: DatasetName
  noise: number
  points: number
  hidden: number[]
  activation: Activation
  lr: number
  optimizer: Optimizer
  l2: number
  batch: number
  features: FeatureSet
}

export const NN_DEFAULT: NNConfig = {
  dataset: 'circles',
  noise: 0.1,
  points: 300,
  hidden: [8, 8],
  activation: 'tanh',
  lr: 0.03,
  optimizer: 'adam',
  l2: 0,
  batch: 16,
  features: 'raw',
}

const MAX_EPOCHS = 1500

function NetworkDiagram({ model }: { model: MLP | null }) {
  if (!model) return null
  const sizes = model.sizes
  const W = 420
  const H = 170
  const maxShown = 10
  const colX = (l: number) => 22 + (l / (sizes.length - 1)) * (W - 44)
  const nodeY = (n: number, count: number) => {
    const shown = Math.min(count, maxShown)
    const gap = Math.min(16, (H - 30) / Math.max(1, shown - 1))
    return H / 2 - ((shown - 1) * gap) / 2 + n * gap
  }
  const edges: React.ReactElement[] = []
  const totalEdges = model.W.reduce((a, w) => a + w.length, 0)
  if (totalEdges < 2500) {
    for (let l = 0; l < sizes.length - 1; l++) {
      const nIn = Math.min(sizes[l], maxShown)
      const nOut = Math.min(sizes[l + 1], maxShown)
      let maxAbs = 1e-6
      for (const v of model.W[l]) maxAbs = Math.max(maxAbs, Math.abs(v))
      for (let i = 0; i < nIn; i++) {
        for (let j = 0; j < nOut; j++) {
          const w = model.W[l][i * sizes[l + 1] + j]
          edges.push(
            <line
              key={`${l}-${i}-${j}`}
              x1={colX(l)}
              y1={nodeY(i, sizes[l])}
              x2={colX(l + 1)}
              y2={nodeY(j, sizes[l + 1])}
              stroke={w >= 0 ? '#22d3ee' : '#fb923c'}
              strokeOpacity={0.12 + 0.6 * (Math.abs(w) / maxAbs)}
              strokeWidth={0.4 + 1.6 * (Math.abs(w) / maxAbs)}
            />,
          )
        }
      }
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {edges}
      {sizes.map((count, l) => (
        <g key={l}>
          {Array.from({ length: Math.min(count, maxShown) }, (_, n) => (
            <circle
              key={n}
              cx={colX(l)}
              cy={nodeY(n, count)}
              r={5}
              fill={l === 0 ? '#1e293b' : l === sizes.length - 1 ? '#8b5cf6' : '#334155'}
              stroke="#94a3b8"
              strokeWidth={0.6}
            />
          ))}
          {count > maxShown && (
            <text x={colX(l)} y={H - 4} textAnchor="middle" className="fill-faint text-[9px]">
              +{count - maxShown}
            </text>
          )}
          <text x={colX(l)} y={10} textAnchor="middle" className="fill-faint text-[9px]">
            {l === 0 ? 'entrées' : l === sizes.length - 1 ? 'sortie' : count}
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function NNPlayground({ preset }: { preset?: { config: Partial<NNConfig>; nonce: number } }) {
  const [cfg, setCfg] = useState<NNConfig>(NN_DEFAULT)
  const [running, setRunning] = useState(false)
  const [, setTick] = useState(0)
  const [seed, setSeed] = useState(1)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modelRef = useRef<MLP | null>(null)
  const history = useRef<{ train: number[]; test: number[] }>({ train: [], test: [] })
  const epochRef = useRef(0)
  const shuffle = useRef(rng(42))

  const data = useMemo(() => makeDataset(cfg.dataset, cfg.points, cfg.noise, seed), [cfg.dataset, cfg.points, cfg.noise, seed])

  // Apply presets coming from guided experiments.
  useEffect(() => {
    if (!preset) return
    setCfg({ ...NN_DEFAULT, ...preset.config })
    setRunning(false)
  }, [preset])

  const archKey = `${cfg.hidden.join('-')}|${cfg.activation}|${cfg.features}|${cfg.optimizer}|${cfg.dataset}|${cfg.points}|${cfg.noise}|${seed}|${preset?.nonce ?? 0}`

  const reset = useCallback(() => {
    modelRef.current = new MLP({ ...cfg, seed: seed * 7 + 3 })
    history.current = { train: [], test: [] }
    epochRef.current = 0
    shuffle.current = rng(42)
    setTick((t) => t + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archKey])

  useEffect(() => {
    reset()
  }, [reset])

  // Hyper-parameters that can change live without resetting the weights.
  useEffect(() => {
    if (modelRef.current) Object.assign(modelRef.current.cfg, { lr: cfg.lr, l2: cfg.l2, batch: cfg.batch })
  }, [cfg.lr, cfg.l2, cfg.batch])

  const trainEpochs = useCallback(
    (n: number) => {
      const m = modelRef.current
      if (!m) return
      for (let e = 0; e < n; e++) {
        m.epoch(data.xTrain, data.yTrain, shuffle.current.next)
        epochRef.current++
      }
      const tr = m.loss(data.xTrain, data.yTrain)
      const te = m.loss(data.xTest, data.yTest)
      history.current.train.push(Number.isFinite(tr) ? tr : 5)
      history.current.test.push(Number.isFinite(te) ? te : 5)
      if (history.current.train.length > 300) {
        // Keep the chart light: downsample old points.
        history.current.train = history.current.train.filter((_, i) => i % 2 === 0)
        history.current.test = history.current.test.filter((_, i) => i % 2 === 0)
      }
    },
    [data],
  )

  useEffect(() => {
    if (!running) return
    let raf = 0
    const loop = () => {
      const params = modelRef.current?.paramCount ?? 100
      trainEpochs(params > 3000 ? 1 : 2)
      setTick((t) => t + 1)
      if (epochRef.current >= MAX_EPOCHS) setRunning(false)
      else raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, trainEpochs])

  // Redraw on every tick.
  const m = modelRef.current
  useEffect(() => {
    if (canvasRef.current) drawBoundary(canvasRef.current, m ? (p) => m.predict(p) : null, data, { showTest: true, resolution: 50 })
  })

  const trainAcc = m ? accuracy((p) => m.predict(p), data.xTrain, data.yTrain) : 0
  const testAcc = m ? accuracy((p) => m.predict(p), data.xTest, data.yTest) : 0
  const lastTrain = history.current.train.at(-1)
  const lastTest = history.current.test.at(-1)
  const gradMax = Math.max(1e-12, ...(m?.gradNorms ?? [0]))

  const setHidden = (hidden: number[]) => setCfg((c) => ({ ...c, hidden }))
  const set = <K extends keyof NNConfig>(k: K, v: NNConfig[K]) => setCfg((c) => ({ ...c, [k]: v }))

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4">
        <PlotCanvas canvasRef={canvasRef} />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button className="btn btn-primary" onClick={() => setRunning((r) => !r)}>
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {running ? 'Pause' : epochRef.current ? 'Reprendre' : 'Entraîner'}
          </button>
          <button className="btn btn-ghost" onClick={() => { trainEpochs(1); setTick((t) => t + 1) }} disabled={running}>
            <StepForward className="size-4" />1 époque
          </button>
          <button className="btn btn-ghost" onClick={() => { setRunning(false); reset() }}>
            <RotateCcw className="size-4" />
            Réinitialiser
          </button>
          <button className="btn btn-quiet text-xs" onClick={() => setSeed((s) => s + 1)}>
            Nouvelles données
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Metric label="Époque" value={epochRef.current} />
          <Metric label="Paramètres" value={m?.paramCount ?? 0} />
          <Metric label="Loss train" value={lastTrain?.toFixed(3) ?? '—'} />
          <Metric label="Loss test" value={lastTest?.toFixed(3) ?? '—'} tone={lastTest !== undefined && lastTrain !== undefined && lastTest > lastTrain * 1.6 && lastTest > 0.2 ? 'warn' : undefined} />
          <Metric label="Acc. train" value={`${Math.round(trainAcc * 100)} %`} />
          <Metric label="Acc. test" value={`${Math.round(testAcc * 100)} %`} tone={testAcc > 0.9 ? 'ok' : testAcc < 0.7 ? 'bad' : undefined} />
        </div>
        <div className="card p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-muted">Courbes de loss</span>
            <Legend items={[{ label: 'train', color: '#a78bfa' }, { label: 'test', color: '#22d3ee', dashed: true }]} />
          </div>
          <LineChart
            series={[
              { label: 'train', values: history.current.train, color: '#a78bfa' },
              { label: 'test', values: history.current.test, color: '#22d3ee', dashed: true },
            ]}
            yMin={0}
            height={120}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Architecture</span>
            <span className="text-[11px] text-faint">
              {cfg.hidden.length} couche{cfg.hidden.length > 1 ? 's' : ''} cachée{cfg.hidden.length > 1 ? 's' : ''}
            </span>
          </div>
          <NetworkDiagram model={m} />
          <div className="mt-3 flex flex-wrap items-end gap-2">
            {cfg.hidden.map((n, i) => (
              <div key={i} className="flex flex-col items-center gap-1 rounded-xl border border-line bg-white/[0.02] p-1.5">
                <button className="btn-quiet btn p-0.5" onClick={() => setHidden(cfg.hidden.map((v, j) => (j === i ? Math.min(64, v + (v >= 8 ? 4 : 1)) : v)))} aria-label="Plus de neurones">
                  <Plus className="size-3" />
                </button>
                <span className="font-mono text-xs">{n}</span>
                <button className="btn-quiet btn p-0.5" onClick={() => setHidden(cfg.hidden.map((v, j) => (j === i ? Math.max(1, v - (v > 8 ? 4 : 1)) : v)))} aria-label="Moins de neurones">
                  <Minus className="size-3" />
                </button>
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <button className="btn btn-ghost px-2 py-1 text-xs" disabled={cfg.hidden.length >= 8} onClick={() => setHidden([...cfg.hidden, cfg.hidden.at(-1) ?? 4])}>
                <Plus className="size-3" />
                couche
              </button>
              <button className="btn btn-ghost px-2 py-1 text-xs" disabled={!cfg.hidden.length} onClick={() => setHidden(cfg.hidden.slice(0, -1))}>
                <Minus className="size-3" />
                couche
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              { label: 'Linéaire', hidden: [] },
              { label: 'Large [64]', hidden: [64] },
              { label: 'Profond [6×5]', hidden: [6, 6, 6, 6, 6] },
              { label: 'Équilibré [16, 16]', hidden: [16, 16] },
            ].map((p) => (
              <button key={p.label} className="chip hover:border-line-strong hover:text-fg" onClick={() => setHidden(p.hidden)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-2 text-xs font-medium text-muted">Signal du gradient par couche</div>
          <div className="space-y-1.5">
            {(m?.gradNorms ?? []).map((g, l) => {
              const ratio = Math.max(0, 1 + Math.log10(g / gradMax) / 4)
              return (
                <div key={l} className="flex items-center gap-2 text-[11px]">
                  <span className="w-16 text-faint">{l === (m?.gradNorms.length ?? 0) - 1 ? 'sortie' : `couche ${l + 1}`}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width]" style={{ width: `${ratio * 100}%` }} />
                  </div>
                  <span className="w-16 text-right font-mono text-faint">{g.toExponential(1)}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-faint">Échelle log. Des barres qui s’effondrent vers l’entrée signalent un gradient qui disparaît.</p>
        </div>

        <div className="card grid gap-4 p-4 sm:grid-cols-2">
          <Control label="Données">
            <Segmented options={DATASETS.map((d) => ({ value: d.id, label: d.label }))} value={cfg.dataset} onChange={(v) => set('dataset', v)} />
          </Control>
          <Control label="Entrées">
            <Segmented
              options={[
                { value: 'raw' as FeatureSet, label: 'x₁, x₂' },
                { value: 'poly' as FeatureSet, label: '+ x², y², xy' },
              ]}
              value={cfg.features}
              onChange={(v) => set('features', v)}
            />
          </Control>
          <Control label="Activation">
            <Segmented
              options={(['relu', 'tanh', 'sigmoid', 'linear'] as Activation[]).map((a) => ({ value: a, label: a }))}
              value={cfg.activation}
              onChange={(v) => set('activation', v)}
            />
          </Control>
          <Control label="Optimiseur">
            <Segmented
              options={[
                { value: 'sgd' as Optimizer, label: 'SGD' },
                { value: 'adam' as Optimizer, label: 'Adam' },
              ]}
              value={cfg.optimizer}
              onChange={(v) => set('optimizer', v)}
            />
          </Control>
          <Control label="Learning rate" value={cfg.lr}>
            <Segmented
              options={[0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1, 3].map((v) => ({ value: v, label: String(v) }))}
              value={cfg.lr}
              onChange={(v) => set('lr', v)}
            />
          </Control>
          <Control label="Régularisation L2" value={cfg.l2}>
            <Segmented options={[0, 0.0001, 0.001, 0.01, 0.1].map((v) => ({ value: v, label: String(v) }))} value={cfg.l2} onChange={(v) => set('l2', v)} />
          </Control>
          <Control label="Bruit" value={cfg.noise.toFixed(2)}>
            <Slider min={0} max={0.6} step={0.05} value={cfg.noise} onChange={(v) => set('noise', v)} />
          </Control>
          <Control label="Points" value={cfg.points}>
            <Slider min={60} max={600} step={20} value={cfg.points} onChange={(v) => set('points', v)} />
          </Control>
          <Control label="Taille de batch" value={cfg.batch}>
            <Segmented options={[1, 8, 16, 64, 256].map((v) => ({ value: v, label: String(v) }))} value={cfg.batch} onChange={(v) => set('batch', v)} />
          </Control>
        </div>
        <p className="text-[11px] text-faint">
          Points pleins : entraînement. Cercles : test (jamais vus pendant l’entraînement). Couleur du fond : probabilité
          prédite de la classe bleue.
        </p>
      </div>
    </div>
  )
}
