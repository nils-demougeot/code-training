import { field, num, type Chapter, type MathExercise } from '../core'
import { formulaQuiz } from './formulaQuiz'

const md = String.raw

/** "3x^3 - 2x^2 + x - 4" from coefficients (highest degree first). */
function poly(coefs: number[], v = 'x'): string {
  const deg = coefs.length - 1
  const terms: string[] = []
  coefs.forEach((c, i) => {
    if (c === 0) return
    const p = deg - i
    const mono = p === 0 ? '' : p === 1 ? v : `${v}^{${p}}`
    const abs = Math.abs(c)
    const coef = abs === 1 && p > 0 ? '' : num(abs)
    terms.push(`${c < 0 ? '-' : '+'} ${coef}${mono}`)
  })
  const s = terms.join(' ').replace(/^\+ /, '')
  return s.startsWith('- ') ? `-${s.slice(2)}` : s || '0'
}

/** Signed term for a sum: "+ 3x", "- x", "+ 2" (first term without "+"). */
function term(c: number, v: string, first = false): string {
  const coef = Math.abs(c) === 1 && v ? '' : num(Math.abs(c))
  const sign = c < 0 ? '-' : first ? '' : '+'
  return `${sign}${first ? '' : ' '}${coef}${v}`.trim()
}

/** "a - b" written without a double sign. */
const minus = (a: string, b: number) => (b < 0 ? `${a} + ${num(-b)}` : `${a} - ${num(b)}`)

const polynomial: MathExercise = {
  id: 'calc-poly',
  title: 'Dériver un polynôme',
  skill: '(xⁿ)′ = n xⁿ⁻¹',
  level: 1,
  generate: (r) => {
    const a = r.pick([-2, -1, 1, 2, 3])
    const b = r.int(-4, 4)
    const c = r.int(-5, 5)
    const d = r.int(-5, 5)
    const x0 = r.int(-2, 3)
    return {
      params: { a, b, c, d, x0 },
      statement: md`Soit $f(x) = ${poly([a, b, c, d])}$.

Calcule $f'(${x0})$ et $f''(${x0})$.`,
      fields: [field(`$f'(${x0})$`, 3 * a * x0 * x0 + 2 * b * x0 + c, 0), field(`$f''(${x0})$`, 6 * a * x0 + 2 * b, 0)],
      hint: md`$(x^n)' = n\,x^{n-1}$, la dérivée est linéaire ($(\alpha f + \beta g)' = \alpha f' + \beta g'$) et une constante a une dérivée nulle.`,
      solution: md`$$f'(x) = ${poly([3 * a, 2 * b, c])} \qquad f''(x) = ${poly([6 * a, 2 * b])}$$

$$f'(${x0}) = ${3 * a}(${x0})^2 ${2 * b < 0 ? '-' : '+'} ${Math.abs(2 * b)}(${x0}) ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${3 * a * x0 * x0 + 2 * b * x0 + c}$$

$$f''(${x0}) = ${6 * a}(${x0}) ${2 * b < 0 ? '-' : '+'} ${Math.abs(2 * b)} = ${6 * a * x0 + 2 * b}$$

${6 * a * x0 + 2 * b > 0 ? 'La dérivée seconde est positive : la courbe est **convexe** en ce point.' : 6 * a * x0 + 2 * b < 0 ? 'La dérivée seconde est négative : la courbe est **concave** en ce point.' : 'La dérivée seconde est nulle : point d’inflexion possible.'}`,
    }
  },
}

const chain: MathExercise = {
  id: 'calc-chain',
  title: 'Règle de la chaîne',
  skill: '(g ∘ h)′ = g′(h) · h′',
  level: 2,
  generate: (r) => {
    const a = r.pick([-2, -1, 2, 3])
    const b = r.int(-3, 3)
    const n = r.int(2, 4)
    const x0 = r.int(-1, 2)
    const inner = a * x0 + b
    return {
      params: { a, b, n, x0 },
      statement: md`Soit $f(x) = (${poly([a, b])})^{${n}}$.

Calcule $f'(${x0})$.`,
      fields: [field(`$f'(${x0})$`, n * a * inner ** (n - 1), 0)],
      hint: md`Si $f(x) = g(h(x))$, alors $f'(x) = g'(h(x)) \cdot h'(x)$. Ici $g(u) = u^{${n}}$ et $h(x) = ${poly([a, b])}$.`,
      solution: md`$g'(u) = ${n}u^{${n - 1}}$ et $h'(x) = ${a}$, donc
$$f'(x) = ${n}(${poly([a, b])})^{${n - 1}} \times ${a < 0 ? `(${a})` : a}$$
$$f'(${x0}) = ${n} \times (${inner})^{${n - 1}} \times ${a < 0 ? `(${a})` : a} = ${n * a * inner ** (n - 1)}$$

La règle de la chaîne est le cœur de la **rétropropagation** : on multiplie les dérivées locales de chaque couche en remontant.`,
    }
  },
}

const logExp: MathExercise = {
  id: 'calc-log-exp',
  title: 'Logarithme et exponentielle',
  skill: '(ln u)′ = u′/u, (eᵘ)′ = u′ eᵘ',
  level: 2,
  generate: (r) => {
    const a = r.pick([1, 2, 3])
    const b = r.pick([1, 2, 4])
    const x0 = r.pick([1, 2, -1])
    const k = r.pick([-1, 1, 2, -2])
    const kx = k === 1 ? 'x' : k === -1 ? '-x' : `${k}x`
    return {
      params: { a, b, x0, k },
      statement: md`1. Soit $f(x) = \ln(${poly([a, 0, b])})$. Calcule $f'(${x0})$.
2. Soit $g(x) = x^2 e^{${kx}}$. Calcule $g'(1)$.

Tu peux taper une expression comme 3*e^2.`,
      fields: [field(`$f'(${x0})$`, (2 * a * x0) / (a * x0 * x0 + b), 3), field("$g'(1)$", Math.exp(k) * (2 + k), 3)],
      hint: md`$(\ln u)' = \dfrac{u'}{u}$, $(e^u)' = u'\,e^u$ et $(uv)' = u'v + uv'$.`,
      solution: md`$$f'(x) = \frac{${2 * a}x}{${poly([a, 0, b])}} \quad\Rightarrow\quad f'(${x0}) = \frac{${2 * a * x0}}{${a * x0 * x0 + b}} \approx ${num((2 * a * x0) / (a * x0 * x0 + b), 4)}$$

$$g'(x) = 2x\,e^{${kx}} + x^2 \times (${k})\,e^{${kx}} = e^{${kx}}(2x ${k < 0 ? '-' : '+'} ${Math.abs(k) === 1 ? '' : Math.abs(k)}x^2) \quad\Rightarrow\quad g'(1) = ${2 + k}\,e^{${k}} \approx ${num(Math.exp(k) * (2 + k), 4)}$$`,
    }
  },
}

const gradient: MathExercise = {
  id: 'calc-gradient',
  title: 'Gradient d’une fonction de deux variables',
  skill: '∇f = (∂f/∂x, ∂f/∂y)',
  level: 2,
  generate: (r) => {
    const a = r.int(1, 3)
    const b = r.pick([-3, -2, -1, 1, 2, 3])
    const c = r.int(1, 3)
    const d = r.pick([-4, -3, -2, -1, 1, 2, 3, 4])
    const x0 = r.int(-2, 2)
    const y0 = r.int(-2, 2)
    return {
      params: { a, b, c, d, x0, y0 },
      statement: md`Soit $f(x, y) = ${term(a, 'x^2', true)} ${term(b, 'xy')} ${term(c, 'y^2')} ${term(d, 'x')}$.

Calcule le gradient $\nabla f$ au point $(${x0}, ${y0})$.`,
      fields: [field('$\\partial f / \\partial x$', 2 * a * x0 + b * y0 + d, 0), field('$\\partial f / \\partial y$', b * x0 + 2 * c * y0, 0)],
      hint: md`Une **dérivée partielle** se calcule en traitant les autres variables comme des constantes. Le gradient est le vecteur des dérivées partielles : il pointe vers la plus forte **montée**.`,
      solution: md`$$\frac{\partial f}{\partial x} = ${term(2 * a, 'x', true)} ${term(b, 'y')} ${term(d, '')} \qquad \frac{\partial f}{\partial y} = ${term(b, 'x', true)} ${term(2 * c, 'y')}$$

$$\nabla f(${x0}, ${y0}) = \begin{pmatrix} ${2 * a}(${x0}) + (${b})(${y0}) + (${d}) \\ (${b})(${x0}) + ${2 * c}(${y0}) \end{pmatrix} = \begin{pmatrix} ${2 * a * x0 + b * y0 + d} \\ ${b * x0 + 2 * c * y0} \end{pmatrix}$$

La descente de gradient se déplace dans la direction **opposée** : $-\nabla f$.`,
    }
  },
}

const descent: MathExercise = {
  id: 'calc-gd',
  title: 'Deux pas de descente de gradient',
  skill: 'θ ← θ − η ∇L(θ)',
  level: 2,
  generate: (r) => {
    const a = r.pick([1, 2])
    const m = r.int(-3, 4)
    const x0 = m + r.pick([-4, -2, 2, 4, 6])
    // With a = 2, η = 0.25 would land on the minimum in one step and give away question 2.
    const eta = a === 2 ? r.pick([0.05, 0.1]) : r.pick([0.1, 0.25])
    const g = (x: number) => 2 * a * (x - m)
    const x1 = x0 - eta * g(x0)
    const x2 = x1 - eta * g(x1)
    // "θ - 3", "θ + 2" or just "θ" when the minimum is at 0.
    const shifted = (t: string) => (m === 0 ? t : `${t} ${m < 0 ? '+' : '-'} ${Math.abs(m)}`)
    const sq = m === 0 ? '\\theta^2' : `(${shifted('\\theta')})^2`
    return {
      params: { a, m, x0, eta },
      statement: md`On minimise $L(\theta) = ${a === 1 ? '' : a}${sq}$ par descente de gradient, en partant de $\theta_0 = ${x0}$ avec un taux d'apprentissage $\eta = ${num(eta)}$.

1. Calcule $\theta_1$ puis $\theta_2$.
2. Quel taux $\eta$ amènerait directement au minimum en **un seul** pas ?`,
      fields: [field('$\\theta_1$', x1, 3), field('$\\theta_2$', x2, 3), field('$\\eta$ idéal', 1 / (2 * a), 3)],
      hint: md`$L'(\theta) = ${2 * a}${m === 0 ? '\\theta' : `(${shifted('\\theta')})`}$ et la mise à jour est $\theta_{t+1} = \theta_t - \eta\,L'(\theta_t)$.`,
      solution: md`$$\theta_1 = ${x0} - ${num(eta)} \times ${2 * a}(${shifted(String(x0))}) = ${minus(String(x0), eta * g(x0))} = ${num(x1)}$$
$$\theta_2 = ${num(x1)} - ${num(eta)} \times ${2 * a}(${shifted(num(x1))}) = ${num(x2)}$$

À chaque pas, la distance au minimum $${m}$ est multipliée par $1 - ${2 * a}\eta = ${num(1 - 2 * a * eta)}$. Avec $\eta = \frac{1}{${2 * a}} = ${num(1 / (2 * a))}$, ce facteur vaut 0 : on atteint le minimum en un pas. Au-delà de $\frac{1}{${a}}$, le facteur dépasse 1 en valeur absolue et la descente **diverge**.`,
    }
  },
}

const sigmoid: MathExercise = {
  id: 'calc-sigmoid',
  title: 'Dérivée de la sigmoïde',
  skill: 'σ′ = σ(1 − σ)',
  level: 2,
  generate: (r) => {
    const z = r.pick([-2, -1, 0, 1, 2, 3])
    const y = r.pick([0, 1])
    const s = 1 / (1 + Math.exp(-z))
    return {
      params: { z, y },
      statement: md`La sigmoïde $\sigma(z) = \dfrac{1}{1 + e^{-z}}$ vaut $\sigma(${z}) \approx ${num(s, 4)}$.

1. Calcule $\sigma'(${z})$.
2. En régression logistique, la perte d'un exemple d'étiquette $y = ${y}$ est $L = -[y \ln \sigma(z) + (1 - y)\ln(1 - \sigma(z))]$. Calcule $\dfrac{\partial L}{\partial z}$ en $z = ${z}$.`,
      fields: [field(`$\\sigma'(${z})$`, s * (1 - s), 3), field('$\\partial L / \\partial z$', s - y, 3)],
      hint: md`$\sigma'(z) = \sigma(z)\,(1 - \sigma(z))$. En combinant avec la dérivée de la log-loss, tout se simplifie : $\dfrac{\partial L}{\partial z} = \sigma(z) - y$.`,
      solution: md`$$\sigma'(${z}) = ${num(s, 4)} \times (1 - ${num(s, 4)}) \approx ${num(s * (1 - s), 4)}$$

$\dfrac{\partial L}{\partial \sigma} = -\dfrac{y}{\sigma} + \dfrac{1 - y}{1 - \sigma}$, multiplié par $\sigma(1 - \sigma)$, donne $\sigma - y$ :
$$\frac{\partial L}{\partial z} = ${num(s, 4)} - ${y} = ${num(s - y, 4)}$$

« prédiction moins vérité » : c'est le même gradient que pour la régression linéaire avec la MSE (à un facteur près).`,
    }
  },
}

const minimum: MathExercise = {
  id: 'calc-min',
  title: 'Minimum d’une parabole',
  skill: 'f′(x*) = 0',
  level: 1,
  generate: (r) => {
    const a = r.pick([1, 2, 0.5])
    const b = r.int(-6, 6)
    const c = r.int(-5, 5)
    const xs = -b / (2 * a)
    return {
      params: { a, b, c },
      statement: md`Trouve le point où $f(x) = ${poly([a, b, c])}$ atteint son **minimum**, et la valeur de ce minimum.`,
      fields: [field('$x^*$', xs, 2), field('$f(x^*)$', a * xs * xs + b * xs + c, 2)],
      hint: md`En un minimum, la dérivée s'annule : $f'(x^*) = 0$. Comme $f'' = ${num(2 * a)} > 0$, la fonction est **convexe** et ce point est le minimum global.`,
      solution: md`$$f'(x) = ${poly([2 * a, b])} = 0 \quad\Rightarrow\quad x^* = ${num(xs)}$$

$$f(x^*) = ${num(a)} \times (${num(xs)})^2 + (${b}) \times (${num(xs)}) + (${c}) = ${num(a * xs * xs + b * xs + c)}$$

C'est l'idée de toutes les solutions « en forme close » (comme les moindres carrés) : annuler le gradient.`,
    }
  },
}

const mseGrad: MathExercise = {
  id: 'calc-mse-grad',
  title: 'Gradient de la MSE',
  skill: 'dL/dw pour ŷ = wx',
  level: 3,
  generate: (r) => {
    const xs = r.sample([1, 2, 3, 4], 3)
    const trueW = r.pick([1, 2, 3])
    const ys = xs.map((x) => trueW * x + r.pick([-1, 0, 1]))
    const w0 = r.pick([0, 1, 4])
    const n = xs.length
    const loss = xs.reduce((s, x, i) => s + (w0 * x - ys[i]) ** 2, 0) / n
    const grad = (2 / n) * xs.reduce((s, x, i) => s + x * (w0 * x - ys[i]), 0)
    const sxy = xs.reduce((s, x, i) => s + x * ys[i], 0)
    const sxx = xs.reduce((s, x) => s + x * x, 0)
    return {
      params: { xs, ys, w0 },
      statement: md`Un modèle sans biais $\hat{y} = w\,x$ est évalué sur 3 points avec la perte $L(w) = \dfrac{1}{n}\sum_i (w x_i - y_i)^2$ :

| $x$ | ${xs.join(' | ')} |
|---|---|---|---|
| $y$ | ${ys.join(' | ')} |

1. Calcule $L(${w0})$.
2. Calcule $\dfrac{dL}{dw}$ en $w = ${w0}$.
3. Quel $w^*$ minimise $L$ ?`,
      fields: [field(`$L(${w0})$`, loss, 2), field(`$L'(${w0})$`, grad, 2), field('$w^*$', sxy / sxx, 3)],
      hint: md`$$\frac{dL}{dw} = \frac{2}{n}\sum_i x_i\,(w x_i - y_i)$$
et $w^*$ annule cette dérivée : $w^* = \dfrac{\sum_i x_i y_i}{\sum_i x_i^2}$.`,
      solution: md`Erreurs en $w = ${w0}$ : ${xs.map((x, i) => `$${w0} \\times ${x} - ${ys[i]} = ${w0 * x - ys[i]}$`).join(', ')}.

$$L(${w0}) = \frac{${xs.map((x, i) => `(${w0 * x - ys[i]})^2`).join(' + ')}}{${n}} = ${num(loss)}$$

$$L'(${w0}) = \frac{2}{${n}}\left(${xs.map((x, i) => `${x} \\times (${w0 * x - ys[i]})`).join(' + ')}\right) = ${num(grad)}$$

$$w^* = \frac{${xs.map((x, i) => `${x} \\times ${ys[i]}`).join(' + ')}}{${xs.map((x) => `${x}^2`).join(' + ')}} = \frac{${sxy}}{${sxx}} \approx ${num(sxy / sxx, 4)}$$

${grad > 0 ? `Le gradient est positif : il faut **diminuer** $w$.` : grad < 0 ? `Le gradient est négatif : il faut **augmenter** $w$.` : 'Le gradient est nul : on est déjà au minimum.'}`,
    }
  },
}

export const calculusChapter: Chapter = {
  id: 'calculus',
  title: 'Dérivées et optimisation',
  emoji: '⛰️',
  summary: 'Dérivées, règle de la chaîne, gradient, descente de gradient, sigmoïde.',
  lesson: md`## La dérivée

$f'(x)$ est la **pente** de $f$ en $x$ : si $x$ augmente d'un petit $h$, $f$ varie d'environ $f'(x)\,h$.

| Fonction | Dérivée |
|---|---|
| $c$ (constante) | $0$ |
| $x^n$ | $n\,x^{n-1}$ |
| $e^x$ | $e^x$ |
| $\ln x$ | $1/x$ |
| $\sigma(x) = \frac{1}{1 + e^{-x}}$ | $\sigma(x)\,(1 - \sigma(x))$ |
| $\tanh x$ | $1 - \tanh^2 x$ |
| $\mathrm{ReLU}(x) = \max(0, x)$ | $1$ si $x > 0$, $0$ sinon |

**Règles** : $(u + v)' = u' + v'$, $(uv)' = u'v + uv'$, $\left(\frac{u}{v}\right)' = \frac{u'v - uv'}{v^2}$.

**Règle de la chaîne** : $\big(g(h(x))\big)' = g'(h(x))\cdot h'(x)$. Exemples : $(e^{u})' = u'e^u$, $(\ln u)' = u'/u$, $(u^n)' = n u^{n-1} u'$.

## Extremums

En un minimum ou un maximum (intérieur), $f'(x^*) = 0$. Si $f'' > 0$ partout, $f$ est **convexe** : un point où la dérivée s'annule est le minimum **global**. La MSE d'un modèle linéaire et la log-loss de la régression logistique sont convexes ; la perte d'un réseau de neurones ne l'est pas.

## Plusieurs variables : le gradient

Pour $f(x, y)$, la **dérivée partielle** $\frac{\partial f}{\partial x}$ se calcule en gelant $y$. Le **gradient** rassemble toutes les dérivées partielles :
$$\nabla f = \left(\frac{\partial f}{\partial x_1}, \dots, \frac{\partial f}{\partial x_n}\right)$$
Il pointe dans la direction de **plus forte montée**.

## Descente de gradient

Pour minimiser une perte $L(\theta)$ :
$$\theta \leftarrow \theta - \eta\,\nabla L(\theta)$$
$\eta$ est le **taux d'apprentissage** : trop petit, c'est lent ; trop grand, ça oscille ou diverge. La version **stochastique** (SGD) estime le gradient sur un mini-batch.

## Les gradients à connaître

- MSE avec $\hat{y} = wx$ : $L = \frac{1}{n}\sum (wx_i - y_i)^2$, $\dfrac{dL}{dw} = \dfrac{2}{n}\sum x_i(wx_i - y_i)$.
- Log-loss avec $p = \sigma(z)$ : $\dfrac{\partial L}{\partial z} = p - y$ (« prédiction − vérité »).

## Exemple résolu

$L(\theta) = (\theta - 3)^2$, $\theta_0 = 7$, $\eta = 0{,}1$. $L'(\theta) = 2(\theta - 3)$, donc $\theta_1 = 7 - 0{,}1 \times 8 = 6{,}2$, puis $\theta_2 = 6{,}2 - 0{,}1 \times 6{,}4 = 5{,}56$. La distance au minimum est multipliée par $0{,}8$ à chaque pas.`,
  formulas: [
    { name: 'Puissance', tex: md`(x^n)' = n\,x^{n-1}` },
    { name: 'Produit', tex: md`(uv)' = u'v + uv'` },
    { name: 'Chaîne', tex: md`\big(g(h(x))\big)' = g'(h(x))\,h'(x)` },
    { name: 'Exp et log', tex: md`(e^u)' = u'e^u \qquad (\ln u)' = \frac{u'}{u}` },
    { name: 'Sigmoïde', tex: md`\sigma'(z) = \sigma(z)\,(1 - \sigma(z))` },
    { name: 'Descente de gradient', tex: md`\theta \leftarrow \theta - \eta\,\nabla L(\theta)` },
    { name: 'Gradient de la log-loss', tex: md`\frac{\partial L}{\partial z} = \sigma(z) - y` },
  ],
  exercises: [
    polynomial,
    minimum,
    chain,
    logExp,
    gradient,
    descent,
    sigmoid,
    mseGrad,
    formulaQuiz('calc-formulas', 'Les bonnes formules', [
      {
        q: 'La dérivée de la sigmoïde $\\sigma(z) = \\frac{1}{1 + e^{-z}}$ est :',
        correct: md`$\sigma(z)\,(1 - \sigma(z))$`,
        wrong: [md`$\sigma(z)^2$`, md`$1 - \sigma(z)^2$`, md`$e^{-z}$`],
      },
      {
        q: 'La règle de la chaîne s’écrit :',
        correct: md`$(g \circ h)'(x) = g'(h(x))\,h'(x)$`,
        wrong: [md`$(g \circ h)'(x) = g'(x)\,h'(x)$`, md`$(g \circ h)'(x) = g'(h'(x))$`, md`$(g \circ h)'(x) = g(h'(x)) + g'(h(x))$`],
      },
      {
        q: 'Une étape de descente de gradient est :',
        correct: md`$\theta \leftarrow \theta - \eta\,\nabla L(\theta)$`,
        wrong: [md`$\theta \leftarrow \theta + \eta\,\nabla L(\theta)$`, md`$\theta \leftarrow \eta\,\nabla L(\theta)$`, md`$\theta \leftarrow \theta - \nabla L(\eta)$`],
      },
      {
        q: 'La dérivée de $\\ln(u(x))$ est :',
        correct: md`$\dfrac{u'(x)}{u(x)}$`,
        wrong: [md`$\dfrac{1}{u'(x)}$`, md`$\ln(u'(x))$`, md`$\dfrac{u(x)}{u'(x)}$`],
      },
      {
        q: 'Le gradient d’une fonction pointe vers :',
        correct: 'la direction de plus forte augmentation',
        wrong: ['la direction de plus forte diminution', 'le minimum global', 'l’origine'],
      },
      {
        q: 'Pour une fonction **convexe** dérivable, un point où la dérivée s’annule est :',
        correct: 'un minimum global',
        wrong: ['un maximum global', 'un point d’inflexion', 'un minimum local qui peut ne pas être global'],
      },
    ]),
  ],
}
