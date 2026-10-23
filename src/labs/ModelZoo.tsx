import { Loader2, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Legend, LineChart } from '@/components/charts'
import { Control, Metric, PlotCanvas, Segmented, Slider } from './controls'
import {
  accuracy, DATASETS, decisionTree, drawBoundary, gaussianNB, knn, logisticRegression, makeDataset, randomForest,
  type Classifier, type Dataset, type DatasetName,
} from './ml'

export type ModelKind = 'logreg' | 'knn' | 'tree' | 'forest' | 'nb'

export interface ZooConfig {
  dataset: DatasetName
  noise: number
  points: number
  model: ModelKind
  k: number
  depth: number
  degree: number
  trees: number
  scaleX: number
}

export const ZOO_DEFAULT: ZooConfig = {
  dataset: 'moons',
  noise: 0.25,
  points: 300,
  model: 'knn',
  k: 5,
  depth: 4,
  degree: 1,
  trees: 30,
  scaleX: 1,
}

const MODELS: { id: ModelKind; label: string; knob: string; blurb: string }[] = [
  {
    id: 'logreg', label: 'Régression logistique', knob: 'degree',
    blurb: 'Frontière linéaire dans l’espace des features. Avec des features polynomiales de degré d, elle devient courbe. `LogisticRegression` + `PolynomialFeatures`.',
  },
  {
    id: 'knn', label: 'k plus proches voisins', knob: 'k',
    blurb: 'Vote des k points d’entraînement les plus proches. Pas d’entraînement, tout se passe à la prédiction. Sensible à l’échelle des features. `KNeighborsClassifier`.',
  },
  {
    id: 'tree', label: 'Arbre de décision', knob: 'depth',
    blurb: 'Découpe l’espace avec des seuils sur une feature à la fois, d’où des frontières en escalier parallèles aux axes. `DecisionTreeClassifier`.',
  },
  {
    id: 'forest', label: 'Random forest', knob: 'depth',
    blurb: 'Moyenne de nombreux arbres entraînés sur des échantillons bootstrap avec features tirées au hasard. Réduit la variance d’un arbre seul. `RandomForestClassifier`.',
  },
  {
    id: 'nb', label: 'Naive Bayes gaussien', knob: '',
    blurb: 'Modélise chaque classe par une gaussienne et suppose les features indépendantes. Très rapide, mais aveugle aux interactions. `GaussianNB`.',
  },
]

function fit(cfg: ZooConfig, data: Dataset, override?: Partial<ZooConfig>): Classifier {
  const c = { ...cfg, ...override }
  // Simulate a feature measured in other units: x₁ is multiplied by scaleX before fitting.
  const X = data.xTrain.map(([a, b]) => [a * c.scaleX, b] as [number, number])
  const wrap = (m: Classifier): Classifier => ({ predict: ([a, b]) => m.predict([a * c.scaleX, b]) })
  switch (c.model) {
    case 'logreg':
      return wrap(logisticRegression(X, data.yTrain, c.degree))
    case 'knn':
      return wrap(knn(X, data.yTrain, c.k))
    case 'tree':
      return wrap(decisionTree(X, data.yTrain, c.depth))
    case 'forest':
      return wrap(randomForest(X, data.yTrain, c.trees, c.depth))
    default:
      return wrap(gaussianNB(X, data.yTrain))
  }
}

function sweep(model: ModelKind): { key: keyof ZooConfig; values: number[]; label: string } | null {
  if (model === 'knn') return { key: 'k', values: [1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 80, 120], label: 'k (← complexe | simple →)' }
  if (model === 'tree' || model === 'forest') return { key: 'depth', values: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15], label: 'profondeur max' }
  if (model === 'logreg') return { key: 'degree', values: [1, 2, 3, 4, 5, 6, 8], label: 'degré polynomial' }
  return null
}

export default function ModelZoo({ preset }: { preset?: { config: Partial<ZooConfig>; nonce: number } }) {
  const [cfg, setCfg] = useState<ZooConfig>(ZOO_DEFAULT)
  const [seed, setSeed] = useState(3)
  const [curve, setCurve] = useState<{ train: number[]; test: number[]; values: number[]; label: string } | null>(null)
  const [computing, setComputing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (preset) {
      setCfg({ ...ZOO_DEFAULT, ...preset.config })
      setCurve(null)
    }
  }, [preset])

  const data = useMemo(() => makeDataset(cfg.dataset, cfg.points, cfg.noise, seed), [cfg.dataset, cfg.points, cfg.noise, seed])
  const model = useMemo(() => fit(cfg, data), [cfg, data])
  const trainAcc = accuracy(model.predict, data.xTrain, data.yTrain)
  const testAcc = accuracy(model.predict, data.xTest, data.yTest)

  useEffect(() => {
    if (canvasRef.current) drawBoundary(canvasRef.current, model.predict, data, { showTest: true, resolution: cfg.model === 'knn' || cfg.model === 'forest' ? 40 : 60 })
  }, [model, data, cfg.model])

  useEffect(() => setCurve(null), [cfg.model, cfg.dataset, cfg.noise, cfg.points, cfg.scaleX, seed])

  const computeCurve = () => {
    const s = sweep(cfg.model)
    if (!s) return
    setComputing(true)
    setTimeout(() => {
      const train: number[] = []
      const test: number[] = []
      for (const v of s.values) {
        const m = fit(cfg, data, { [s.key]: v })
        train.push(accuracy(m.predict, data.xTrain, data.yTrain))
        test.push(accuracy(m.predict, data.xTest, data.yTest))
      }
      setCurve({ train, test, values: s.values, label: s.label })
      setComputing(false)
    }, 30)
  }

  const set = <K extends keyof ZooConfig>(k: K, v: ZooConfig[K]) => setCfg((c) => ({ ...c, [k]: v }))
  const meta = MODELS.find((m) => m.id === cfg.model)!
  const gap = trainAcc - testAcc
  const best = curve ? curve.test.indexOf(Math.max(...curve.test)) : -1

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4">
        <PlotCanvas canvasRef={canvasRef} />
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Accuracy train" value={`${(trainAcc * 100).toFixed(1)} %`} />
          <Metric label="Accuracy test" value={`${(testAcc * 100).toFixed(1)} %`} tone={testAcc > 0.9 ? 'ok' : testAcc < 0.75 ? 'bad' : undefined} />
          <Metric
            label="Écart train − test"
            value={`${(gap * 100).toFixed(1)} pts`}
            tone={gap > 0.08 || (trainAcc > 0.995 && gap > 0.03) ? 'warn' : undefined}
          />
        </div>
        <div className="rounded-xl border border-line bg-white/[0.02] p-3 text-xs text-muted">
          {gap > 0.08 || (trainAcc > 0.995 && gap > 0.03)
            ? '⚠️ Écart train/test : le modèle mémorise le bruit (overfitting, variance élevée).'
            : trainAcc < 0.8
              ? '⚠️ Même l’entraînement est mal appris : le modèle est trop simple pour ces données (underfitting, biais élevé).'
              : '✓ Écart train/test raisonnable.'}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card space-y-4 p-4">
          <Control label="Modèle">
            <Segmented options={MODELS.map((m) => ({ value: m.id, label: m.label }))} value={cfg.model} onChange={(v) => set('model', v)} />
          </Control>
          <p className="text-xs leading-relaxed text-muted">{meta.blurb.replace(/`/g, '')}</p>
          {cfg.model === 'knn' && (
            <Control label="k (nombre de voisins)" value={cfg.k}>
              <Slider min={1} max={120} step={1} value={cfg.k} onChange={(v) => set('k', v)} />
            </Control>
          )}
          {(cfg.model === 'tree' || cfg.model === 'forest') && (
            <Control label="Profondeur max" value={cfg.depth}>
              <Slider min={1} max={15} step={1} value={cfg.depth} onChange={(v) => set('depth', v)} />
            </Control>
          )}
          {cfg.model === 'forest' && (
            <Control label="Nombre d’arbres" value={cfg.trees}>
              <Slider min={1} max={80} step={1} value={cfg.trees} onChange={(v) => set('trees', v)} />
            </Control>
          )}
          {cfg.model === 'logreg' && (
            <Control label="Degré des features polynomiales" value={cfg.degree}>
              <Slider min={1} max={8} step={1} value={cfg.degree} onChange={(v) => set('degree', v)} />
            </Control>
          )}
        </div>

        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Courbe de complexité (validation)</span>
            <button className="btn btn-ghost px-3 py-1 text-xs" onClick={computeCurve} disabled={!sweep(cfg.model) || computing}>
              {computing ? <Loader2 className="size-3.5 animate-spin" /> : <TrendingUp className="size-3.5" />}
              Calculer
            </button>
          </div>
          {curve ? (
            <>
              <LineChart
                series={[
                  { label: 'train', values: curve.train, color: '#a78bfa' },
                  { label: 'test', values: curve.test, color: '#22d3ee', dashed: true },
                ]}
                yMax={1}
                height={130}
                markers={best >= 0 ? [{ x: best, label: `meilleur : ${curve.values[best]}` }] : undefined}
              />
              <div className="mt-1 flex items-center justify-between">
                <Legend items={[{ label: 'train', color: '#a78bfa' }, { label: 'test', color: '#22d3ee', dashed: true }]} />
                <span className="text-[10px] text-faint">
                  {curve.label} : {curve.values.join(', ')}
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-faint">
              {sweep(cfg.model)
                ? 'Entraîne le modèle pour toute une plage d’hyperparamètres et compare accuracy train et test : c’est le compromis biais-variance en une image.'
                : 'Naive Bayes n’a pas d’hyperparamètre de complexité ici.'}
            </p>
          )}
        </div>

        <div className="card grid gap-4 p-4 sm:grid-cols-2">
          <Control label="Données">
            <Segmented options={DATASETS.map((d) => ({ value: d.id, label: d.label }))} value={cfg.dataset} onChange={(v) => set('dataset', v)} />
          </Control>
          <Control label="Échelle de x₁ (unités différentes)" value={`×${cfg.scaleX}`}>
            <Segmented options={[1, 10, 100].map((v) => ({ value: v, label: `×${v}` }))} value={cfg.scaleX} onChange={(v) => set('scaleX', v)} />
          </Control>
          <Control label="Bruit" value={cfg.noise.toFixed(2)}>
            <Slider min={0} max={0.8} step={0.05} value={cfg.noise} onChange={(v) => set('noise', v)} />
          </Control>
          <Control label="Points" value={cfg.points}>
            <Slider min={40} max={600} step={20} value={cfg.points} onChange={(v) => set('points', v)} />
          </Control>
          <button className="btn btn-quiet text-xs sm:col-span-2" onClick={() => setSeed((s) => s + 1)}>
            Tirer un nouvel échantillon
          </button>
        </div>
      </div>
    </div>
  )
}
