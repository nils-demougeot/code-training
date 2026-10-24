import { Loader2, Play } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Control, Metric, Segmented, Slider } from './controls'
import { Histogram, normCdf } from './Histogram'
import { rng } from './ml'

export interface ABConfig {
  base: number
  uplift: number
  n: number
  peeking: boolean
}

export const AB_DEFAULT: ABConfig = { base: 0.1, uplift: 0.1, n: 2000, peeking: false }

const EXPERIMENTS = 1000
const LOOKS = 10

interface Outcome {
  pvalues: number[]
  significant: number
  estimates: number[]
}

/** Simulates many A/B tests (normal approximation of the binomial), optionally peeking at 10 interim looks. */
function simulate(cfg: ABConfig, seed: number): Outcome {
  const r = rng(seed)
  const pA = cfg.base
  const pB = cfg.base * (1 + cfg.uplift)
  const chunk = cfg.n / LOOKS
  const pvalues: number[] = []
  const estimates: number[] = []
  let significant = 0
  for (let e = 0; e < EXPERIMENTS; e++) {
    let convA = 0
    let convB = 0
    let stopped = false
    let p = 1
    for (let look = 1; look <= LOOKS; look++) {
      convA += Math.max(0, chunk * pA + Math.sqrt(chunk * pA * (1 - pA)) * r.normal())
      convB += Math.max(0, chunk * pB + Math.sqrt(chunk * pB * (1 - pB)) * r.normal())
      if (!cfg.peeking && look < LOOKS) continue
      const n = chunk * look
      const a = convA / n
      const b = convB / n
      const pool = (convA + convB) / (2 * n)
      const se = Math.sqrt(Math.max(1e-12, pool * (1 - pool) * (2 / n)))
      const z = (b - a) / se
      p = 2 * (1 - normCdf(Math.abs(z)))
      if (p < 0.05) {
        stopped = true
        break
      }
    }
    if (stopped) significant++
    pvalues.push(p)
    estimates.push(convA > 0 ? convB / convA - 1 : 0)
  }
  return { pvalues, significant, estimates }
}

/** Sample size per group for a two-sided two-proportion test (alpha 5 %, power 80 %). */
export function requiredN(base: number, uplift: number): number {
  const p1 = base
  const p2 = base * (1 + uplift)
  if (p2 === p1) return Infinity
  const za = 1.959964
  const zb = 0.841621
  const pbar = (p1 + p2) / 2
  const num = za * Math.sqrt(2 * pbar * (1 - pbar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))
  return Math.ceil((num * num) / (p2 - p1) ** 2)
}

export default function ABTestLab({ preset }: { preset?: { config: Partial<ABConfig>; nonce: number } }) {
  const [cfg, setCfg] = useState<ABConfig>(AB_DEFAULT)
  const [out, setOut] = useState<Outcome | null>(null)
  const [busy, setBusy] = useState(false)
  const [seed, setSeed] = useState(1)

  useEffect(() => {
    if (preset) setCfg({ ...AB_DEFAULT, ...preset.config })
  }, [preset])

  const run = useCallback(() => {
    setBusy(true)
    setTimeout(() => {
      setOut(simulate(cfg, seed))
      setSeed((s) => s + 1)
      setBusy(false)
    }, 20)
  }, [cfg, seed])

  useEffect(() => {
    setOut(null)
  }, [cfg])

  const set = <K extends keyof ABConfig>(k: K, v: ABConfig[K]) => setCfg((c) => ({ ...c, [k]: v }))
  const rate = out ? out.significant / EXPERIMENTS : null
  const nNeeded = requiredN(cfg.base, cfg.uplift)
  const noEffect = cfg.uplift === 0

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-4">
        <div className="card space-y-4 p-4">
          <Control label="Taux de conversion du groupe A" value={`${(cfg.base * 100).toFixed(0)} %`}>
            <Slider min={0.01} max={0.5} step={0.01} value={cfg.base} onChange={(v) => set('base', v)} />
          </Control>
          <Control label="Effet réel de la variante B (relatif)" value={`${cfg.uplift >= 0 ? '+' : ''}${(cfg.uplift * 100).toFixed(0)} %`}>
            <Segmented options={[0, 0.02, 0.05, 0.1, 0.2, 0.5].map((v) => ({ value: v, label: v === 0 ? 'aucun' : `+${v * 100} %` }))} value={cfg.uplift} onChange={(v) => set('uplift', v)} />
          </Control>
          <Control label="Utilisateurs par groupe" value={cfg.n.toLocaleString('fr-FR')}>
            <Segmented options={[200, 1000, 2000, 5000, 15000, 50000].map((v) => ({ value: v, label: v.toLocaleString('fr-FR') }))} value={cfg.n} onChange={(v) => set('n', v)} />
          </Control>
          <Control label="Regarder les résultats en cours de route (peeking)">
            <Segmented
              options={[
                { value: 'no', label: 'Non : une seule analyse à la fin' },
                { value: 'yes', label: 'Oui : 10 coups d’œil, arrêt au 1er p < 0,05' },
              ]}
              value={cfg.peeking ? 'yes' : 'no'}
              onChange={(v) => set('peeking', v === 'yes')}
            />
          </Control>
          <button className="btn btn-primary w-full" onClick={run} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Simuler {EXPERIMENTS.toLocaleString('fr-FR')} A/B tests
          </button>
        </div>
        <div className="rounded-xl border border-line bg-white/[0.02] p-3 text-xs text-muted">
          Taille nécessaire pour détecter cet effet avec 80 % de puissance (α = 5 %) :{' '}
          <span className="font-mono text-fg">{Number.isFinite(nNeeded) ? `${nNeeded.toLocaleString('fr-FR')} par groupe` : '— (pas d’effet à détecter)'}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Metric
            label={noEffect ? 'Faux positifs (B déclaré gagnant à tort)' : 'Puissance (effet détecté)'}
            value={rate === null ? '—' : `${(rate * 100).toFixed(1)} %`}
            tone={rate === null ? undefined : noEffect ? (rate > 0.07 ? 'bad' : 'ok') : rate >= 0.8 ? 'ok' : 'warn'}
          />
          <Metric label="Attendu" value={noEffect ? '5 % (= α)' : Number.isFinite(nNeeded) && cfg.n >= nNeeded ? '≥ 80 %' : '< 80 %'} />
        </div>
        <div className="card p-4">
          <div className="mb-1 text-xs font-medium text-muted">Distribution des p-values</div>
          {out ? (
            <Histogram values={out.pvalues} lo={0} hi={1} bins={20} color={noEffect ? '#a78bfa' : '#22d3ee'} markers={[{ x: 0.05, color: '#f87171', label: 'α = 0,05' }]} />
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-faint">Lance une simulation</div>
          )}
          <p className="mt-1 text-[11px] text-faint">
            Sans effet réel, les p-values sont uniformes : 5 % tombent sous 0,05 par pur hasard.
          </p>
        </div>
        {out && (
          <div className="card p-4">
            <div className="mb-1 text-xs font-medium text-muted">Uplift mesuré dans chaque test (vrai uplift : {(cfg.uplift * 100).toFixed(0)} %)</div>
            <Histogram values={out.estimates} lo={-0.5} hi={0.8} bins={52} color="#34d399" markers={[{ x: cfg.uplift, color: '#fbbf24', label: 'vrai effet' }]} height={130} />
          </div>
        )}
      </div>
    </div>
  )
}
