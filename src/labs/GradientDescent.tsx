import { Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Legend, LineChart } from '@/components/charts'
import { Control, Metric, PlotCanvas, Segmented, Slider } from './controls'
import { rng } from './ml'

type SurfaceId = 'bowl' | 'ravine' | 'rosenbrock' | 'saddle' | 'bumpy'
type OptId = 'sgd' | 'momentum' | 'rmsprop' | 'adam'

interface Surface {
  label: string
  f: (x: number, y: number) => number
  g: (x: number, y: number) => [number, number]
  range: [number, number, number, number] // xmin, xmax, ymin, ymax
  start: [number, number]
}

const SURFACES: Record<SurfaceId, Surface> = {
  bowl: {
    label: 'Bol',
    f: (x, y) => 0.5 * (x * x + y * y),
    g: (x, y) => [x, y],
    range: [-3, 3, -3, 3],
    start: [-2.5, 2.2],
  },
  ravine: {
    label: 'Ravin',
    f: (x, y) => 0.5 * (x * x + 30 * y * y),
    g: (x, y) => [x, 30 * y],
    range: [-3, 3, -1.5, 1.5],
    start: [-2.7, 1],
  },
  rosenbrock: {
    label: 'Rosenbrock',
    f: (x, y) => (1 - x) ** 2 + 10 * (y - x * x) ** 2,
    g: (x, y) => [-2 * (1 - x) - 40 * x * (y - x * x), 20 * (y - x * x)],
    range: [-2, 2, -1, 3],
    start: [-1.5, 2.5],
  },
  saddle: {
    label: 'Col (point selle)',
    f: (x, y) => 0.5 * x * x - 0.5 * y * y + 0.05 * y ** 4,
    g: (x, y) => [x, -y + 0.2 * y ** 3],
    range: [-3, 3, -3.5, 3.5],
    start: [-2.5, 0.001],
  },
  bumpy: {
    label: 'Minima locaux',
    f: (x, y) => 0.1 * (x * x + y * y) - Math.cos(2 * x) * Math.cos(2 * y) + 1,
    g: (x, y) => [0.2 * x + 2 * Math.sin(2 * x) * Math.cos(2 * y), 0.2 * y + 2 * Math.cos(2 * x) * Math.sin(2 * y)],
    range: [-4, 4, -4, 4],
    start: [-3.2, 2.9],
  },
}

const OPTS: { id: OptId; label: string; color: string }[] = [
  { id: 'sgd', label: 'SGD', color: '#fb923c' },
  { id: 'momentum', label: 'Momentum', color: '#f472b6' },
  { id: 'rmsprop', label: 'RMSProp', color: '#34d399' },
  { id: 'adam', label: 'Adam', color: '#22d3ee' },
]

interface Runner {
  pos: [number, number]
  path: [number, number][]
  losses: number[]
  m: [number, number]
  v: [number, number]
  t: number
  diverged: boolean
}

export interface GDConfig {
  surface: SurfaceId
  lr: number
  noise: number
  enabled: OptId[]
}

export const GD_DEFAULT: GDConfig = { surface: 'ravine', lr: 0.03, noise: 0, enabled: ['sgd', 'momentum', 'adam'] }

function newRunner(start: [number, number], f: Surface['f']): Runner {
  return { pos: [...start], path: [[...start]], losses: [f(...start)], m: [0, 0], v: [0, 0], t: 0, diverged: false }
}

export default function GradientDescent({ preset }: { preset?: { config: Partial<GDConfig>; nonce: number } }) {
  const [cfg, setCfg] = useState<GDConfig>(GD_DEFAULT)
  const [start, setStart] = useState<[number, number]>(SURFACES[GD_DEFAULT.surface].start)
  const [running, setRunning] = useState(false)
  const [, setTick] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bgRef = useRef<HTMLCanvasElement | null>(null)
  const runners = useRef<Partial<Record<OptId, Runner>>>({})
  const noiseRng = useRef(rng(5))
  const surface = SURFACES[cfg.surface]

  useEffect(() => {
    if (!preset) return
    const next = { ...GD_DEFAULT, ...preset.config }
    setCfg(next)
    setStart(SURFACES[next.surface].start)
    setRunning(false)
  }, [preset])

  const reset = useCallback(() => {
    runners.current = Object.fromEntries(cfg.enabled.map((o) => [o, newRunner(start, surface.f)]))
    noiseRng.current = rng(5)
    setTick((t) => t + 1)
  }, [cfg.enabled, start, surface])

  useEffect(() => {
    reset()
    setRunning(false)
  }, [reset, cfg.lr, cfg.noise])

  useEffect(() => {
    setStart(SURFACES[cfg.surface].start)
  }, [cfg.surface])

  // Pre-render the loss landscape once per surface.
  useEffect(() => {
    const size = 420
    const off = document.createElement('canvas')
    off.width = size
    off.height = size
    const ctx = off.getContext('2d')!
    const img = ctx.createImageData(size, size)
    const [x0, x1, y0, y1] = surface.range
    const vals = new Float64Array(size * size)
    let lo = Infinity
    let hi = -Infinity
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const v = Math.log(1e-3 + surface.f(x0 + (i / size) * (x1 - x0), y1 - (j / size) * (y1 - y0)) - (cfg.surface === 'saddle' ? -20 : 0))
        vals[i + j * size] = v
        lo = Math.min(lo, v)
        hi = Math.max(hi, v)
      }
    }
    for (let k = 0; k < vals.length; k++) {
      const t = (vals[k] - lo) / (hi - lo || 1)
      const band = Math.floor(t * 18) / 18
      const contour = Math.abs(t * 18 - Math.round(t * 18)) < 0.06
      img.data[k * 4] = 12 + 70 * band + (contour ? 25 : 0)
      img.data[k * 4 + 1] = 14 + 40 * band + (contour ? 25 : 0)
      img.data[k * 4 + 2] = 30 + 110 * band + (contour ? 30 : 0)
      img.data[k * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    bgRef.current = off
    setTick((t) => t + 1)
  }, [surface, cfg.surface])

  const step = useCallback(() => {
    for (const opt of cfg.enabled) {
      const r = runners.current[opt]
      if (!r || r.diverged) continue
      let [gx, gy] = surface.g(...r.pos)
      if (cfg.noise) {
        gx += noiseRng.current.normal() * cfg.noise * 3
        gy += noiseRng.current.normal() * cfg.noise * 3
      }
      r.t++
      const lr = cfg.lr
      let dx: number
      let dy: number
      if (opt === 'sgd') {
        dx = lr * gx
        dy = lr * gy
      } else if (opt === 'momentum') {
        r.m = [0.9 * r.m[0] + gx, 0.9 * r.m[1] + gy]
        dx = lr * r.m[0]
        dy = lr * r.m[1]
      } else if (opt === 'rmsprop') {
        r.v = [0.9 * r.v[0] + 0.1 * gx * gx, 0.9 * r.v[1] + 0.1 * gy * gy]
        dx = (lr * gx) / (Math.sqrt(r.v[0]) + 1e-8)
        dy = (lr * gy) / (Math.sqrt(r.v[1]) + 1e-8)
      } else {
        r.m = [0.9 * r.m[0] + 0.1 * gx, 0.9 * r.m[1] + 0.1 * gy]
        r.v = [0.999 * r.v[0] + 0.001 * gx * gx, 0.999 * r.v[1] + 0.001 * gy * gy]
        const mh = [r.m[0] / (1 - 0.9 ** r.t), r.m[1] / (1 - 0.9 ** r.t)]
        const vh = [r.v[0] / (1 - 0.999 ** r.t), r.v[1] / (1 - 0.999 ** r.t)]
        dx = (lr * mh[0]) / (Math.sqrt(vh[0]) + 1e-8)
        dy = (lr * mh[1]) / (Math.sqrt(vh[1]) + 1e-8)
      }
      r.pos = [r.pos[0] - dx, r.pos[1] - dy]
      const loss = surface.f(...r.pos)
      if (!Number.isFinite(loss) || Math.abs(r.pos[0]) > 1e3 || Math.abs(r.pos[1]) > 1e3) r.diverged = true
      r.path.push([...r.pos])
      r.losses.push(Number.isFinite(loss) ? loss : NaN)
    }
  }, [cfg, surface])

  useEffect(() => {
    if (!running) return
    let frames = 0
    let raf = 0
    const loop = () => {
      step()
      step()
      frames++
      setTick((t) => t + 1)
      if (frames < 300) raf = requestAnimationFrame(loop)
      else setRunning(false)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, step])

  // Draw.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width
    const [x0, x1, y0, y1] = surface.range
    const px = ([x, y]: [number, number]) => [((x - x0) / (x1 - x0)) * W, ((y1 - y) / (y1 - y0)) * W]
    ctx.clearRect(0, 0, W, W)
    if (bgRef.current) ctx.drawImage(bgRef.current, 0, 0, W, W)
    for (const o of OPTS) {
      const r = runners.current[o.id]
      if (!r) continue
      ctx.strokeStyle = o.color
      ctx.lineWidth = 2
      ctx.beginPath()
      r.path.forEach((p, i) => {
        const [a, b] = px(p)
        if (i === 0) ctx.moveTo(a, b)
        else ctx.lineTo(a, b)
      })
      ctx.stroke()
      const [a, b] = px(r.pos)
      ctx.fillStyle = o.color
      ctx.beginPath()
      ctx.arc(a, b, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    const [sa, sb] = px(start)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(sa, sb, 6, 0, Math.PI * 2)
    ctx.stroke()
  })

  const onCanvasClick = (fx: number, fy: number) => {
    const [x0, x1, y0, y1] = surface.range
    setStart([x0 + fx * (x1 - x0), y1 - fy * (y1 - y0)])
    setRunning(false)
  }

  const set = <K extends keyof GDConfig>(k: K, v: GDConfig[K]) => setCfg((c) => ({ ...c, [k]: v }))
  const anyRunner = Object.values(runners.current)[0]

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
      <div className="space-y-3">
        <PlotCanvas canvasRef={canvasRef} onClick={onCanvasClick}>
          <div className="pointer-events-none absolute top-2 left-2 rounded-lg bg-black/50 px-2 py-1 text-[10px] text-muted">
            Clique pour choisir le point de départ
          </div>
        </PlotCanvas>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn btn-primary" onClick={() => setRunning((r) => !r)}>
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {running ? 'Pause' : 'Lancer'}
          </button>
          <button className="btn btn-ghost" onClick={() => { setRunning(false); reset() }}>
            <RotateCcw className="size-4" />
            Réinitialiser
          </button>
        </div>
      </div>
      <div className="space-y-4">
        <div className="card space-y-4 p-4">
          <Control label="Surface de loss">
            <Segmented options={(Object.keys(SURFACES) as SurfaceId[]).map((s) => ({ value: s, label: SURFACES[s].label }))} value={cfg.surface} onChange={(v) => set('surface', v)} />
          </Control>
          <Control label="Optimiseurs">
            <div className="flex flex-wrap gap-2">
              {OPTS.map((o) => {
                const on = cfg.enabled.includes(o.id)
                return (
                  <button
                    key={o.id}
                    onClick={() => set('enabled', on ? cfg.enabled.filter((x) => x !== o.id) : [...cfg.enabled, o.id])}
                    className="chip transition"
                    style={on ? { color: o.color, borderColor: `${o.color}66`, background: `${o.color}18` } : undefined}
                  >
                    <span className="size-2 rounded-full" style={{ background: on ? o.color : '#5b6378' }} />
                    {o.label}
                  </button>
                )
              })}
            </div>
          </Control>
          <Control label="Learning rate" value={cfg.lr}>
            <Segmented options={[0.001, 0.003, 0.01, 0.03, 0.06, 0.1, 0.3].map((v) => ({ value: v, label: String(v) }))} value={cfg.lr} onChange={(v) => set('lr', v)} />
          </Control>
          <Control label="Bruit du gradient (mini-batch)" value={cfg.noise.toFixed(1)}>
            <Slider min={0} max={1} step={0.1} value={cfg.noise} onChange={(v) => set('noise', v)} />
          </Control>
        </div>
        <div className="card p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-muted">Loss au fil des itérations</span>
            <Legend items={OPTS.filter((o) => runners.current[o.id]).map((o) => ({ label: o.label, color: o.color }))} />
          </div>
          <LineChart
            series={OPTS.filter((o) => runners.current[o.id]).map((o) => ({
              label: o.label,
              color: o.color,
              values: runners.current[o.id]!.losses.map((l) => Math.log10(Math.max(1e-6, Number.isFinite(l) ? l + (cfg.surface === 'saddle' ? 20 : 0) : 1e6))),
            }))}
            height={130}
            yLabel="log₁₀(loss)"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {OPTS.filter((o) => runners.current[o.id]).map((o) => {
            const r = runners.current[o.id]!
            return (
              <Metric
                key={o.id}
                label={o.label}
                value={r.diverged ? 'diverge !' : surface.f(...r.pos).toFixed(3)}
                tone={r.diverged ? 'bad' : undefined}
              />
            )
          })}
        </div>
        <p className="text-[11px] text-faint">Itération {anyRunner?.t ?? 0}. Les couleurs sombres sont les zones de loss faible.</p>
      </div>
    </div>
  )
}
