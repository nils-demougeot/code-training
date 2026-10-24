import { Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Control, Metric, Segmented } from './controls'
import { Histogram, normalPdf } from './Histogram'
import { rng } from './ml'

type Dist = 'uniform' | 'exponential' | 'dice' | 'bimodal' | 'pareto'

const DISTS: Record<Dist, { label: string; mu: number; sigma: number; lo: number; hi: number; draw: (r: ReturnType<typeof rng>) => number }> = {
  uniform: { label: 'Uniforme', mu: 0.5, sigma: Math.sqrt(1 / 12), lo: 0, hi: 1, draw: (r) => r.next() },
  exponential: {
    label: 'Exponentielle',
    mu: 1,
    sigma: 1,
    lo: 0,
    hi: 6,
    draw: (r) => -Math.log(1 - r.next()),
  },
  dice: {
    label: 'Dé',
    mu: 3.5,
    sigma: Math.sqrt(35 / 12),
    lo: 0.5,
    hi: 6.5,
    draw: (r) => 1 + Math.floor(r.next() * 6),
  },
  bimodal: {
    label: 'Bimodale',
    mu: 0,
    sigma: Math.sqrt(1 + 0.3 ** 2),
    lo: -2,
    hi: 2,
    draw: (r) => (r.next() < 0.5 ? -1 : 1) + r.normal() * 0.3,
  },
  pareto: {
    // Pareto with alpha = 1.5: finite mean (3), infinite variance.
    label: 'Pareto (queue lourde)',
    mu: 3,
    sigma: Number.POSITIVE_INFINITY,
    lo: 1,
    hi: 10,
    draw: (r) => (1 - r.next()) ** (-1 / 1.5),
  },
}

export interface CLTConfig {
  dist: Dist
  n: number
}

export const CLT_DEFAULT: CLTConfig = { dist: 'exponential', n: 1 }

export default function CLTLab({ preset }: { preset?: { config: Partial<CLTConfig>; nonce: number } }) {
  const [cfg, setCfg] = useState<CLTConfig>(CLT_DEFAULT)
  const [means, setMeans] = useState<number[]>([])
  const [running, setRunning] = useState(false)
  const r = useRef(rng(11))
  const d = DISTS[cfg.dist]

  useEffect(() => {
    if (preset) setCfg({ ...CLT_DEFAULT, ...preset.config })
  }, [preset])

  const population = useMemo(() => {
    const pr = rng(3)
    return Array.from({ length: 20_000 }, () => d.draw(pr))
  }, [d])

  const reset = useCallback(() => {
    setMeans([])
    r.current = rng(11)
  }, [])

  useEffect(() => {
    reset()
    setRunning(true)
  }, [cfg, reset])

  useEffect(() => {
    if (!running) return
    let raf = 0
    const tick = () => {
      setMeans((prev) => {
        if (prev.length >= 5000) {
          setRunning(false)
          return prev
        }
        const next = prev.slice()
        for (let k = 0; k < 80; k++) {
          let s = 0
          for (let i = 0; i < cfg.n; i++) s += d.draw(r.current)
          next.push(s / cfg.n)
        }
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, cfg.n, d])

  const meanOfMeans = means.reduce((a, b) => a + b, 0) / Math.max(1, means.length)
  const sdOfMeans = Math.sqrt(means.reduce((a, b) => a + (b - meanOfMeans) ** 2, 0) / Math.max(1, means.length - 1))
  const theoSd = d.sigma / Math.sqrt(cfg.n)
  const finite = Number.isFinite(theoSd)
  // Zoom the right histogram on the theoretical spread of the mean.
  const span = finite ? Math.max(4 * theoSd, 1e-3) : (d.hi - d.lo) / Math.sqrt(cfg.n)
  const lo = finite ? d.mu - span : d.lo
  const hi = finite ? d.mu + span : d.mu + span * 1.5

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-4">
        <div className="card p-4">
          <div className="mb-2 text-xs font-medium text-muted">Population : un tirage (n = 1)</div>
          <Histogram values={population} lo={d.lo} hi={d.hi} color="#a78bfa" markers={[{ x: d.mu, color: '#34d399', label: 'μ' }]} />
        </div>
        <div className="card space-y-4 p-4">
          <Control label="Distribution de départ">
            <Segmented options={(Object.keys(DISTS) as Dist[]).map((k) => ({ value: k, label: DISTS[k].label }))} value={cfg.dist} onChange={(v) => setCfg((c) => ({ ...c, dist: v }))} />
          </Control>
          <Control label="Taille de chaque échantillon (n)" value={cfg.n}>
            <Segmented options={[1, 2, 5, 10, 30, 100].map((v) => ({ value: v, label: String(v) }))} value={cfg.n} onChange={(v) => setCfg((c) => ({ ...c, n: v }))} />
          </Control>
        </div>
      </div>
      <div className="space-y-4">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Moyennes de {means.length.toLocaleString('fr-FR')} échantillons de taille {cfg.n}</span>
            <div className="flex gap-1">
              <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setRunning((x) => !x)}>
                {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>
              <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => { reset(); setRunning(true) }}>
                <RotateCcw className="size-3.5" />
              </button>
            </div>
          </div>
          <Histogram
            values={means}
            lo={lo}
            hi={hi}
            color="#22d3ee"
            density={finite ? normalPdf(d.mu, theoSd) : undefined}
            markers={[{ x: d.mu, color: '#34d399', label: 'μ' }]}
          />
          <p className="mt-1 text-[11px] text-faint">
            Courbe jaune : la loi normale prédite par le théorème central limite, N(μ, σ/√n).
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="μ (population)" value={d.mu.toFixed(3)} />
          <Metric label="moyenne des moyennes" value={meanOfMeans.toFixed(3)} />
          <Metric label="σ/√n (théorie)" value={finite ? theoSd.toFixed(3) : '∞'} tone={finite ? undefined : 'warn'} />
          <Metric label="écart-type observé" value={sdOfMeans.toFixed(3)} />
        </div>
      </div>
    </div>
  )
}
