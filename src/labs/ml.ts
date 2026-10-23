// Tiny ML toolkit for the interactive labs: 2D datasets, an MLP trained with backprop,
// and a few classic classifiers. Everything runs in the browser in real time.

export type Point = [number, number]

export interface Dataset {
  xTrain: Point[]
  yTrain: number[]
  xTest: Point[]
  yTest: number[]
}

export type DatasetName = 'circles' | 'xor' | 'spiral' | 'moons' | 'blobs'

export const DATASETS: { id: DatasetName; label: string }[] = [
  { id: 'blobs', label: 'Nuages' },
  { id: 'moons', label: 'Lunes' },
  { id: 'circles', label: 'Cercles' },
  { id: 'xor', label: 'XOR' },
  { id: 'spiral', label: 'Spirale' },
]

/** Deterministic PRNG so that a given seed always yields the same dataset. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  const next = () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
  const normal = () => {
    const u = Math.max(1e-9, next())
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next())
  }
  return { next, normal }
}

export function makeDataset(name: DatasetName, n: number, noise: number, seed = 1, trainRatio = 0.7): Dataset {
  const r = rng(seed)
  const X: Point[] = []
  const y: number[] = []
  const jitter = () => r.normal() * noise * 0.5
  for (let i = 0; i < n; i++) {
    const label = i % 2
    let p: Point
    switch (name) {
      case 'circles': {
        const radius = label ? r.next() * 0.45 : 0.65 + r.next() * 0.3
        const a = r.next() * Math.PI * 2
        p = [radius * Math.cos(a) + jitter(), radius * Math.sin(a) + jitter()]
        break
      }
      case 'xor': {
        let a = r.next() * 1.8 - 0.9
        let b = r.next() * 1.8 - 0.9
        if (Math.abs(a) < 0.05) a += Math.sign(a || 1) * 0.05
        if (Math.abs(b) < 0.05) b += Math.sign(b || 1) * 0.05
        // label 1 when both coordinates have the same sign
        if ((a * b > 0 ? 1 : 0) !== label) b = -b
        p = [a + jitter(), b + jitter()]
        break
      }
      case 'spiral': {
        const t = (r.next() * 0.95 + 0.05) * 2.6 * Math.PI
        const radius = t / (2.8 * Math.PI)
        const a = t + label * Math.PI
        p = [radius * Math.cos(a) + jitter() * 0.6, radius * Math.sin(a) + jitter() * 0.6]
        break
      }
      case 'moons': {
        // Same geometry as sklearn.datasets.make_moons, centred and rescaled.
        const a = r.next() * Math.PI
        const [mx, my] = label ? [1 - Math.cos(a), 0.5 - Math.sin(a)] : [Math.cos(a), Math.sin(a)]
        p = [(mx - 0.5) * 0.75 + jitter(), (my - 0.25) * 0.75 + jitter()]
        break
      }
      default: {
        const c = label ? [0.4, 0.35] : [-0.4, -0.35]
        p = [c[0] + r.normal() * (0.18 + noise * 0.25), c[1] + r.normal() * (0.18 + noise * 0.25)]
      }
    }
    X.push(p)
    y.push(label)
  }
  // Shuffle, then split.
  const idx = X.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  const cut = Math.round(n * trainRatio)
  return {
    xTrain: idx.slice(0, cut).map((i) => X[i]),
    yTrain: idx.slice(0, cut).map((i) => y[i]),
    xTest: idx.slice(cut).map((i) => X[i]),
    yTest: idx.slice(cut).map((i) => y[i]),
  }
}

export function accuracy(pred: (p: Point) => number, X: Point[], y: number[]): number {
  if (!X.length) return 0
  let ok = 0
  for (let i = 0; i < X.length; i++) if ((pred(X[i]) >= 0.5 ? 1 : 0) === y[i]) ok++
  return ok / X.length
}

// ---------------------------------------------------------------- MLP

export type Activation = 'relu' | 'tanh' | 'sigmoid' | 'linear'
export type Optimizer = 'sgd' | 'adam'

const act = {
  relu: (x: number) => (x > 0 ? x : 0),
  tanh: Math.tanh,
  sigmoid: (x: number) => 1 / (1 + Math.exp(-x)),
  linear: (x: number) => x,
}
/** Derivatives expressed with the activation output `a`. */
const dact = {
  relu: (a: number) => (a > 0 ? 1 : 0),
  tanh: (a: number) => 1 - a * a,
  sigmoid: (a: number) => a * (1 - a),
  linear: () => 1,
}

export type FeatureSet = 'raw' | 'poly'

export function featurize(p: Point, features: FeatureSet): number[] {
  const [x, y] = p
  return features === 'poly' ? [x, y, x * x, y * y, x * y] : [x, y]
}

export interface MlpConfig {
  hidden: number[]
  activation: Activation
  lr: number
  optimizer: Optimizer
  l2: number
  batch: number
  features: FeatureSet
  seed: number
}

export class MLP {
  sizes: number[]
  W: Float64Array[] = []
  b: Float64Array[] = []
  private mW: Float64Array[] = []
  private vW: Float64Array[] = []
  private mb: Float64Array[] = []
  private vb: Float64Array[] = []
  private t = 0
  /** Mean |gradient| of each weight matrix over the last step (shows vanishing gradients). */
  gradNorms: number[] = []

  constructor(public cfg: MlpConfig) {
    const inputs = cfg.features === 'poly' ? 5 : 2
    this.sizes = [inputs, ...cfg.hidden, 1]
    const r = rng(cfg.seed)
    for (let l = 0; l < this.sizes.length - 1; l++) {
      const fanIn = this.sizes[l]
      const fanOut = this.sizes[l + 1]
      const scale = cfg.activation === 'relu' ? Math.sqrt(2 / fanIn) : Math.sqrt(1 / fanIn)
      const w = new Float64Array(fanIn * fanOut)
      for (let i = 0; i < w.length; i++) w[i] = r.normal() * scale
      this.W.push(w)
      this.b.push(new Float64Array(fanOut))
      this.mW.push(new Float64Array(w.length))
      this.vW.push(new Float64Array(w.length))
      this.mb.push(new Float64Array(fanOut))
      this.vb.push(new Float64Array(fanOut))
    }
    this.gradNorms = this.W.map(() => 0)
  }

  get paramCount() {
    return this.W.reduce((a, w) => a + w.length, 0) + this.b.reduce((a, b) => a + b.length, 0)
  }

  /** Forward pass; returns the activations of every layer (last = probability). */
  forward(input: number[]): Float64Array[] {
    const acts: Float64Array[] = [Float64Array.from(input)]
    for (let l = 0; l < this.W.length; l++) {
      const prev = acts[l]
      const nIn = this.sizes[l]
      const nOut = this.sizes[l + 1]
      const out = new Float64Array(nOut)
      const last = l === this.W.length - 1
      const f = last ? act.sigmoid : act[this.cfg.activation]
      const w = this.W[l]
      for (let j = 0; j < nOut; j++) {
        let z = this.b[l][j]
        for (let i = 0; i < nIn; i++) z += prev[i] * w[i * nOut + j]
        out[j] = f(z)
      }
      acts.push(out)
    }
    return acts
  }

  predict(p: Point): number {
    const acts = this.forward(featurize(p, this.cfg.features))
    return acts[acts.length - 1][0]
  }

  loss(X: Point[], y: number[]): number {
    if (!X.length) return 0
    let total = 0
    for (let i = 0; i < X.length; i++) {
      const p = Math.min(1 - 1e-7, Math.max(1e-7, this.predict(X[i])))
      total += -(y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p))
    }
    return total / X.length
  }

  /** One mini-batch gradient step (binary cross-entropy + optional L2). */
  step(X: Point[], y: number[]) {
    const L = this.W.length
    const gW = this.W.map((w) => new Float64Array(w.length))
    const gb = this.b.map((b) => new Float64Array(b.length))
    for (let s = 0; s < X.length; s++) {
      const acts = this.forward(featurize(X[s], this.cfg.features))
      // dLoss/dz for sigmoid + BCE simplifies to (p - y).
      let delta = new Float64Array([acts[L][0] - y[s]])
      for (let l = L - 1; l >= 0; l--) {
        const nIn = this.sizes[l]
        const nOut = this.sizes[l + 1]
        const prev = acts[l]
        const w = this.W[l]
        for (let j = 0; j < nOut; j++) {
          gb[l][j] += delta[j]
          for (let i = 0; i < nIn; i++) gW[l][i * nOut + j] += prev[i] * delta[j]
        }
        if (l > 0) {
          const next = new Float64Array(nIn)
          const d = dact[this.cfg.activation]
          for (let i = 0; i < nIn; i++) {
            let sum = 0
            for (let j = 0; j < nOut; j++) sum += w[i * nOut + j] * delta[j]
            next[i] = sum * d(prev[i])
          }
          delta = next
        }
      }
    }
    const n = X.length
    this.t += 1
    const { lr, optimizer, l2 } = this.cfg
    const b1 = 0.9
    const b2 = 0.999
    for (let l = 0; l < L; l++) {
      let norm = 0
      const update = (params: Float64Array, grads: Float64Array, m: Float64Array, v: Float64Array, decay: boolean) => {
        for (let k = 0; k < params.length; k++) {
          const g = grads[k] / n + (decay ? l2 * params[k] : 0)
          if (decay) norm += Math.abs(g)
          if (optimizer === 'adam') {
            m[k] = b1 * m[k] + (1 - b1) * g
            v[k] = b2 * v[k] + (1 - b2) * g * g
            const mh = m[k] / (1 - b1 ** this.t)
            const vh = v[k] / (1 - b2 ** this.t)
            params[k] -= (lr * mh) / (Math.sqrt(vh) + 1e-8)
          } else {
            params[k] -= lr * g
          }
        }
      }
      update(this.W[l], gW[l], this.mW[l], this.vW[l], true)
      update(this.b[l], gb[l], this.mb[l], this.vb[l], false)
      this.gradNorms[l] = norm / this.W[l].length
    }
  }

  /** One pass over the training data in shuffled mini-batches. */
  epoch(X: Point[], y: number[], r: () => number) {
    const idx = X.map((_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    const B = Math.max(1, this.cfg.batch)
    for (let s = 0; s < idx.length; s += B) {
      const batch = idx.slice(s, s + B)
      this.step(batch.map((i) => X[i]), batch.map((i) => y[i]))
    }
  }
}

// ---------------------------------------------------------------- classic models

export interface Classifier {
  predict: (p: Point) => number
}

export function knn(X: Point[], y: number[], k: number, scaleX = 1): Classifier {
  return {
    predict: ([a, b]) => {
      const d = X.map(([x1, x2], i) => ({ d: ((a - x1) * scaleX) ** 2 + (b - x2) ** 2, y: y[i] }))
      d.sort((u, v) => u.d - v.d)
      const kk = Math.min(k, d.length)
      let s = 0
      for (let i = 0; i < kk; i++) s += d[i].y
      return s / kk
    },
  }
}

interface TreeNode {
  leaf?: number
  feature?: 0 | 1
  threshold?: number
  left?: TreeNode
  right?: TreeNode
}

function gini(ys: number[]) {
  if (!ys.length) return 0
  const p = ys.reduce((a, b) => a + b, 0) / ys.length
  return 2 * p * (1 - p)
}

function buildTree(
  X: Point[], y: number[], depth: number, maxDepth: number, minLeaf: number, featureChoice: () => (0 | 1)[],
): TreeNode {
  const mean = y.reduce((a, b) => a + b, 0) / Math.max(1, y.length)
  if (depth >= maxDepth || y.length < 2 * minLeaf || mean === 0 || mean === 1) return { leaf: mean }
  let best = { score: Infinity, feature: 0 as 0 | 1, threshold: 0 }
  for (const f of featureChoice()) {
    const order = X.map((p, i) => ({ v: p[f], y: y[i] })).sort((a, b) => a.v - b.v)
    let leftSum = 0
    const total = order.reduce((a, o) => a + o.y, 0)
    for (let i = 0; i < order.length - 1; i++) {
      leftSum += order[i].y
      if (order[i].v === order[i + 1].v) continue
      const nl = i + 1
      const nr = order.length - nl
      if (nl < minLeaf || nr < minLeaf) continue
      const pl = leftSum / nl
      const pr = (total - leftSum) / nr
      const score = (nl * 2 * pl * (1 - pl) + nr * 2 * pr * (1 - pr)) / order.length
      if (score < best.score) best = { score, feature: f, threshold: (order[i].v + order[i + 1].v) / 2 }
    }
  }
  if (best.score === Infinity || best.score >= gini(y) - 1e-12) return { leaf: mean }
  const li: number[] = []
  const ri: number[] = []
  X.forEach((p, i) => (p[best.feature] <= best.threshold ? li : ri).push(i))
  return {
    feature: best.feature,
    threshold: best.threshold,
    left: buildTree(li.map((i) => X[i]), li.map((i) => y[i]), depth + 1, maxDepth, minLeaf, featureChoice),
    right: buildTree(ri.map((i) => X[i]), ri.map((i) => y[i]), depth + 1, maxDepth, minLeaf, featureChoice),
  }
}

function treePredict(node: TreeNode, p: Point): number {
  while (node.leaf === undefined) node = p[node.feature!] <= node.threshold! ? node.left! : node.right!
  return node.leaf
}

export function decisionTree(X: Point[], y: number[], maxDepth: number, minLeaf = 1): Classifier {
  const root = buildTree(X, y, 0, maxDepth, minLeaf, () => [0, 1])
  return { predict: (p) => treePredict(root, p) }
}

export function randomForest(X: Point[], y: number[], nTrees: number, maxDepth: number, seed = 7): Classifier {
  const r = rng(seed)
  const trees: TreeNode[] = []
  for (let t = 0; t < nTrees; t++) {
    const idx = X.map(() => Math.floor(r.next() * X.length))
    // Feature subsampling: each split looks at one random feature (out of two).
    const choose = () => [(r.next() < 0.5 ? 0 : 1) as 0 | 1]
    trees.push(buildTree(idx.map((i) => X[i]), idx.map((i) => y[i]), 0, maxDepth, 1, choose))
  }
  return { predict: (p) => trees.reduce((a, tr) => a + treePredict(tr, p), 0) / trees.length }
}

export function polyFeatures([a, b]: Point, degree: number): number[] {
  const out: number[] = []
  for (let d = 1; d <= degree; d++) for (let i = 0; i <= d; i++) out.push(a ** (d - i) * b ** i)
  return out
}

export function logisticRegression(X: Point[], y: number[], degree: number, l2 = 1e-3, epochs = 400): Classifier {
  const feats = X.map((p) => polyFeatures(p, degree))
  const dim = feats[0]?.length ?? 0
  // Standardize features (crucial for gradient descent on polynomial features).
  const mu = new Array(dim).fill(0)
  const sd = new Array(dim).fill(0)
  for (const f of feats) f.forEach((v, j) => (mu[j] += v / feats.length))
  for (const f of feats) f.forEach((v, j) => (sd[j] += (v - mu[j]) ** 2 / feats.length))
  for (let j = 0; j < dim; j++) sd[j] = Math.sqrt(sd[j]) || 1
  const norm = (f: number[]) => f.map((v, j) => (v - mu[j]) / sd[j])
  const Z = feats.map(norm)
  const w = new Array(dim).fill(0)
  let b = 0
  const lr = 0.5
  for (let e = 0; e < epochs; e++) {
    const gw = new Array(dim).fill(0)
    let gb = 0
    for (let i = 0; i < Z.length; i++) {
      const z = Z[i].reduce((a, v, j) => a + v * w[j], b)
      const err = 1 / (1 + Math.exp(-z)) - y[i]
      for (let j = 0; j < dim; j++) gw[j] += err * Z[i][j]
      gb += err
    }
    for (let j = 0; j < dim; j++) w[j] -= lr * (gw[j] / Z.length + l2 * w[j])
    b -= (lr * gb) / Z.length
  }
  return {
    predict: (p) => {
      const z = norm(polyFeatures(p, degree)).reduce((a, v, j) => a + v * w[j], b)
      return 1 / (1 + Math.exp(-z))
    },
  }
}

export function gaussianNB(X: Point[], y: number[]): Classifier {
  const stats = [0, 1].map((c) => {
    const pts = X.filter((_, i) => y[i] === c)
    const n = Math.max(1, pts.length)
    const mean = [0, 1].map((f) => pts.reduce((a, p) => a + p[f], 0) / n)
    const v = [0, 1].map((f) => pts.reduce((a, p) => a + (p[f] - mean[f]) ** 2, 0) / n + 1e-3)
    return { prior: pts.length / Math.max(1, X.length), mean, v }
  })
  const logLik = (p: Point, c: number) => {
    const s = stats[c]
    let l = Math.log(s.prior || 1e-9)
    for (const f of [0, 1]) l += -0.5 * Math.log(2 * Math.PI * s.v[f]) - (p[f] - s.mean[f]) ** 2 / (2 * s.v[f])
    return l
  }
  return {
    predict: (p) => {
      const l0 = logLik(p, 0)
      const l1 = logLik(p, 1)
      return 1 / (1 + Math.exp(l0 - l1))
    },
  }
}

// ---------------------------------------------------------------- drawing

export const VIEW = 1.25 // plot covers [-VIEW, VIEW]²

/** Paints the decision surface of `predict` plus the data points on a canvas. */
export function drawBoundary(
  canvas: HTMLCanvasElement,
  predict: ((p: Point) => number) | null,
  data: Dataset,
  opts: { showTest?: boolean; resolution?: number; xScale?: number } = {},
) {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width
  const H = canvas.height
  const res = opts.resolution ?? 48
  const toWorld = (px: number, py: number): Point => [(px / W) * 2 * VIEW - VIEW, VIEW - (py / H) * 2 * VIEW]
  const toPx = ([x, y]: Point) => [((x + VIEW) / (2 * VIEW)) * W, ((VIEW - y) / (2 * VIEW)) * H]
  ctx.clearRect(0, 0, W, H)
  if (predict) {
    const off = document.createElement('canvas')
    off.width = res
    off.height = res
    const octx = off.getContext('2d')!
    const img = octx.createImageData(res, res)
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const p = toWorld(((i + 0.5) / res) * W, ((j + 0.5) / res) * H)
        const v = Math.min(1, Math.max(0, predict(p)))
        // Orange (class 0) → dark → violet/cyan (class 1)
        const t = v * 2 - 1
        const k = (i + j * res) * 4
        if (t >= 0) {
          img.data[k] = 20 + 90 * t
          img.data[k + 1] = 22 + 110 * t
          img.data[k + 2] = 34 + 200 * t
        } else {
          img.data[k] = 20 + 230 * -t
          img.data[k + 1] = 22 + 120 * -t
          img.data[k + 2] = 34 + 20 * -t
        }
        img.data[k + 3] = 255
      }
    }
    octx.putImageData(img, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.globalAlpha = 0.55
    ctx.drawImage(off, 0, 0, W, H)
    ctx.globalAlpha = 1
  }
  const dot = (p: Point, label: number, test: boolean) => {
    const [x, y] = toPx(p)
    ctx.beginPath()
    ctx.arc(x, y, test ? 3.6 : 4.2, 0, Math.PI * 2)
    ctx.fillStyle = label ? '#7dd3fc' : '#fb923c'
    if (test) {
      ctx.strokeStyle = label ? '#7dd3fc' : '#fb923c'
      ctx.lineWidth = 1.5
      ctx.stroke()
    } else {
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
  data.xTrain.forEach((p, i) => dot(p, data.yTrain[i], false))
  if (opts.showTest) data.xTest.forEach((p, i) => dot(p, data.yTest[i], true))
}
