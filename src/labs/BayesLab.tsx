import { useEffect, useState } from 'react'
import { Control, Metric, Segmented, Slider } from './controls'

export interface BayesConfig {
  prevalence: number
  sensitivity: number
  specificity: number
  retest: boolean
}

export const BAYES_DEFAULT: BayesConfig = { prevalence: 0.01, sensitivity: 0.99, specificity: 0.95, retest: false }

const COLORS = {
  tp: '#f87171',
  fn: '#fca5a5',
  fp: '#fbbf24',
  tn: 'rgb(255 255 255 / 0.12)',
}

export default function BayesLab({ preset }: { preset?: { config: Partial<BayesConfig>; nonce: number } }) {
  const [cfg, setCfg] = useState<BayesConfig>(BAYES_DEFAULT)
  useEffect(() => {
    if (preset) setCfg({ ...BAYES_DEFAULT, ...preset.config })
  }, [preset])
  const set = <K extends keyof BayesConfig>(k: K, v: BayesConfig[K]) => setCfg((c) => ({ ...c, [k]: v }))

  // A second positive test: the first posterior becomes the new prior.
  const prior = cfg.retest
    ? (cfg.prevalence * cfg.sensitivity) / (cfg.prevalence * cfg.sensitivity + (1 - cfg.prevalence) * (1 - cfg.specificity))
    : cfg.prevalence
  const N = 1000
  const sick = Math.round(N * prior)
  const tp = Math.round(sick * cfg.sensitivity)
  const fn = sick - tp
  const healthy = N - sick
  const fp = Math.round(healthy * (1 - cfg.specificity))
  const tn = healthy - fp
  const ppv = (prior * cfg.sensitivity) / (prior * cfg.sensitivity + (1 - prior) * (1 - cfg.specificity))
  const npv = ((1 - prior) * cfg.specificity) / ((1 - prior) * cfg.specificity + prior * (1 - cfg.sensitivity))

  const dots: string[] = [
    ...Array(tp).fill(COLORS.tp),
    ...Array(fn).fill(COLORS.fn),
    ...Array(fp).fill(COLORS.fp),
    ...Array(tn).fill(COLORS.tn),
  ]
  const cols = 40
  const size = 10

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <div className="card p-4">
        <div className="mb-2 text-xs font-medium text-muted">
          {N} personnes {cfg.retest ? 'déjà positives au 1er test, re-testées' : 'testées'} : chaque point est une personne
        </div>
        <svg viewBox={`0 0 ${cols * size} ${Math.ceil(N / cols) * size}`} className="w-full">
          {dots.map((c, i) => (
            <circle key={i} cx={(i % cols) * size + size / 2} cy={Math.floor(i / cols) * size + size / 2} r={size * 0.36} fill={c} />
          ))}
        </svg>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          {[
            { c: COLORS.tp, l: `Malades détectés (TP) : ${tp}` },
            { c: COLORS.fn, l: `Malades ratés (FN) : ${fn}` },
            { c: COLORS.fp, l: `Fausses alertes (FP) : ${fp}` },
            { c: COLORS.tn, l: `Sains, test négatif (TN) : ${tn}` },
          ].map((x) => (
            <span key={x.l} className="flex items-center gap-1.5 text-muted">
              <span className="size-2.5 rounded-full" style={{ background: x.c }} />
              {x.l}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="card space-y-4 p-4">
          <Control label="Prévalence (taux de base)" value={`${(cfg.prevalence * 100).toFixed(1)} %`}>
            <Slider min={0.001} max={0.5} step={0.001} value={cfg.prevalence} onChange={(v) => set('prevalence', v)} />
          </Control>
          <Control label="Sensibilité = recall (malades détectés)" value={`${(cfg.sensitivity * 100).toFixed(0)} %`}>
            <Slider min={0.5} max={1} step={0.01} value={cfg.sensitivity} onChange={(v) => set('sensitivity', v)} />
          </Control>
          <Control label="Spécificité (sains correctement négatifs)" value={`${(cfg.specificity * 100).toFixed(1)} %`}>
            <Slider min={0.5} max={0.999} step={0.001} value={cfg.specificity} onChange={(v) => set('specificity', v)} />
          </Control>
          <Control label="Second test sur les positifs">
            <Segmented options={[{ value: 'no', label: 'Non' }, { value: 'yes', label: 'Oui, re-tester' }]} value={cfg.retest ? 'yes' : 'no'} onChange={(v) => set('retest', v === 'yes')} />
          </Control>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="P(malade | test +) = precision" value={`${(ppv * 100).toFixed(1)} %`} tone={ppv < 0.5 ? 'bad' : 'ok'} />
          <Metric label="P(sain | test −)" value={`${(npv * 100).toFixed(2)} %`} />
        </div>
        <div className="rounded-xl border border-line bg-white/[0.02] p-3 font-mono text-[11px] text-muted">
          P(M|+) = P(+|M)·P(M) / [P(+|M)·P(M) + P(+|S)·P(S)]
          <br />= {cfg.sensitivity.toFixed(2)}×{prior.toFixed(3)} / ({cfg.sensitivity.toFixed(2)}×{prior.toFixed(3)} + {(1 - cfg.specificity).toFixed(3)}×{(1 - prior).toFixed(3)}) = {ppv.toFixed(3)}
        </div>
      </div>
    </div>
  )
}
