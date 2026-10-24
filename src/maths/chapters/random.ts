import { binom, factorial, field, num, phi, type Chapter, type MathExercise } from '../core'
import { formulaQuiz } from './formulaQuiz'

const md = String.raw

const expectation: MathExercise = {
  id: 'rv-expectation',
  title: 'Espérance et variance d’un jeu',
  skill: 'E[X] = Σ x p(x), Var = E[X²] − E[X]²',
  level: 1,
  generate: (r) => {
    const xs = r.pick([[-2, 0, 5], [-1, 1, 4], [-3, 0, 6], [0, 2, 10], [-5, 1, 3], [-4, 2, 8]])
    const p1 = r.int(2, 5)
    const p2 = r.int(1, 9 - p1)
    const ps = [p1 / 10, p2 / 10, (10 - p1 - p2) / 10]
    const e = xs.reduce((a, x, i) => a + x * ps[i], 0)
    const e2 = xs.reduce((a, x, i) => a + x * x * ps[i], 0)
    return {
      params: { xs, ps },
      statement: md`Un jeu rapporte un gain $X$ (en euros) selon la loi :

| $x$ | ${xs.join(' | ')} |
|---|---|---|---|
| $P(X = x)$ | ${ps.map((p) => num(p)).join(' | ')} |

Calcule l'**espérance** et la **variance** de $X$.`,
      fields: [field('$E[X]$', e, 2), field('$\\mathrm{Var}(X)$', e2 - e * e, 2)],
      hint: md`$E[X] = \sum_x x\,P(X = x)$ et $\mathrm{Var}(X) = E[X^2] - E[X]^2$ avec $E[X^2] = \sum_x x^2\,P(X = x)$.`,
      solution: md`$$E[X] = ${xs.map((x, i) => `(${x}) \\times ${num(ps[i])}`).join(' + ')} = ${num(e)}$$

$$E[X^2] = ${xs.map((x, i) => `${x * x} \\times ${num(ps[i])}`).join(' + ')} = ${num(e2)}$$

$$\mathrm{Var}(X) = ${num(e2)} - (${num(e)})^2 = ${num(e2 - e * e)}$$

${e > 0 ? 'Le jeu est favorable au joueur en moyenne.' : e < 0 ? 'En moyenne, le joueur perd de l’argent.' : 'Le jeu est équitable.'}`,
    }
  },
}

const linear: MathExercise = {
  id: 'rv-linear',
  title: 'Transformation affine',
  skill: 'E[aX + b], Var(aX + b)',
  level: 1,
  generate: (r) => {
    const m = r.int(10, 50)
    const sd = r.int(2, 8)
    const a = r.pick([2, 3, -2, 0.5, 1.5, -1])
    const b = r.pick([-10, -5, -3, 2, 5, 10, 15, 20])
    return {
      params: { m, sd, a, b },
      statement: md`Le temps de réponse $X$ d'une API a une moyenne de ${m} ms et un écart-type de ${sd} ms. On définit un score $Y = ${num(a)}\,X ${b < 0 ? '-' : '+'} ${Math.abs(b)}$.

Calcule l'espérance, la variance et l'écart-type de $Y$.`,
      fields: [field('$E[Y]$', a * m + b, 2), field('$\\mathrm{Var}(Y)$', a * a * sd * sd, 2), field('$\\sigma_Y$', Math.abs(a) * sd, 2)],
      hint: md`$E[aX + b] = a\,E[X] + b$ (linéarité) et $\mathrm{Var}(aX + b) = a^2\,\mathrm{Var}(X)$ : un décalage ne change pas la dispersion. Donc $\sigma_{aX+b} = |a|\,\sigma_X$.`,
      solution: md`$$E[Y] = ${num(a)} \times ${m} ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${num(a * m + b)}$$

$$\mathrm{Var}(Y) = (${num(a)})^2 \times ${sd}^2 = ${num(a * a)} \times ${sd * sd} = ${num(a * a * sd * sd)}$$

$$\sigma_Y = |${num(a)}| \times ${sd} = ${num(Math.abs(a) * sd)}$$`,
    }
  },
}

const binomialPmf: MathExercise = {
  id: 'rv-binomial',
  title: 'Loi binomiale',
  skill: 'P(X = k) = C(n,k) pᵏ (1−p)ⁿ⁻ᵏ',
  level: 2,
  generate: (r) => {
    const n = r.int(5, 10)
    const p = r.pick([0.1, 0.2, 0.3, 0.5])
    const k = r.int(0, 3)
    const pk = binom(n, k) * p ** k * (1 - p) ** (n - k)
    return {
      params: { n, p, k },
      statement: md`Une campagne d'e-mails a un taux de clic de ${num(p * 100)} %. On envoie **${n}** e-mails, les clics sont indépendants. $X$ est le nombre de clics.

1. Quelle est la probabilité d'obtenir **exactement ${k}** clic${k > 1 ? 's' : ''} ?
2. Combien de clics attend-on en moyenne ?`,
      fields: [field(`$P(X = ${k})$`, pk, 4), field('$E[X]$', n * p, 2)],
      hint: md`$X \sim \mathcal{B}(n, p)$ : $P(X = k) = \dbinom{n}{k}\,p^k\,(1-p)^{n-k}$ et $E[X] = np$.`,
      solution: md`$$P(X = ${k}) = \binom{${n}}{${k}} \times ${num(p)}^{${k}} \times ${num(1 - p)}^{${n - k}} = ${binom(n, k)} \times ${num(p ** k, 6)} \times ${num((1 - p) ** (n - k), 6)} \approx ${num(pk, 5)}$$

$$E[X] = np = ${n} \times ${num(p)} = ${num(n * p)}$$`,
    }
  },
}

const binomialMoments: MathExercise = {
  id: 'rv-binomial-moments',
  title: 'Moyenne et dispersion d’une binomiale',
  skill: 'E = np, Var = np(1−p)',
  level: 1,
  generate: (r) => {
    const n = r.pick([100, 200, 400, 1000])
    const p = r.pick([0.02, 0.05, 0.1, 0.2, 0.5])
    const v = n * p * (1 - p)
    return {
      params: { n, p },
      statement: md`Un modèle de détection se trompe sur ${num(p * 100)} % des images, indépendamment. On lui soumet **${n}** images ; $X$ est le nombre d'erreurs.

Donne l'espérance, la variance et l'écart-type de $X$.`,
      fields: [field('$E[X]$', n * p, 2), field('$\\mathrm{Var}(X)$', v, 2), field('$\\sigma_X$', Math.sqrt(v), 2)],
      hint: md`Une binomiale est une somme de $n$ Bernoulli indépendantes, chacune d'espérance $p$ et de variance $p(1-p)$ : $E[X] = np$ et $\mathrm{Var}(X) = np(1-p)$.`,
      solution: md`$$E[X] = ${n} \times ${num(p)} = ${num(n * p)}$$

$$\mathrm{Var}(X) = ${n} \times ${num(p)} \times ${num(1 - p)} = ${num(v)} \qquad \sigma_X = \sqrt{${num(v)}} \approx ${num(Math.sqrt(v), 3)}$$

On observera typiquement entre $${num(n * p)} - 2 \times ${num(Math.sqrt(v), 2)}$ et $${num(n * p)} + 2 \times ${num(Math.sqrt(v), 2)}$ erreurs.`,
    }
  },
}

const poisson: MathExercise = {
  id: 'rv-poisson',
  title: 'Loi de Poisson',
  skill: 'P(X = k) = e^(−λ) λᵏ / k!',
  level: 2,
  generate: (r) => {
    const lambda = r.int(1, 4)
    const k = r.int(0, 4)
    const pk = (Math.exp(-lambda) * lambda ** k) / factorial(k)
    return {
      params: { lambda, k },
      statement: md`Un serveur reçoit en moyenne **${lambda}** requête${lambda > 1 ? 's' : ''} d'erreur par minute ; on modélise ce nombre par une loi de Poisson $X \sim \mathcal{P}(${lambda})$.

1. Quelle est la probabilité d'avoir **exactement ${k}** erreur${k > 1 ? 's' : ''} dans une minute ?
2. Quelle est la probabilité d'avoir **au moins une** erreur ?

Tu peux taper une expression, comme e^-2 * 2^3 / 3!.`,
      fields: [field(`$P(X = ${k})$`, pk, 4), field('$P(X \\geq 1)$', 1 - Math.exp(-lambda), 4)],
      hint: md`$P(X = k) = e^{-\lambda}\,\dfrac{\lambda^k}{k!}$, et $P(X \geq 1) = 1 - P(X = 0) = 1 - e^{-\lambda}$.`,
      solution: md`$$P(X = ${k}) = e^{-${lambda}}\,\frac{${lambda}^{${k}}}{${k}!} = ${num(Math.exp(-lambda), 5)} \times \frac{${lambda ** k}}{${factorial(k)}} \approx ${num(pk, 5)}$$

$$P(X \geq 1) = 1 - e^{-${lambda}} \approx ${num(1 - Math.exp(-lambda), 5)}$$

Pour une loi de Poisson, la moyenne **et** la variance valent $\lambda$.`,
    }
  },
}

const normal: MathExercise = {
  id: 'rv-normal',
  title: 'Loi normale et score z',
  skill: 'Centrer-réduire, lire Φ',
  level: 2,
  generate: (r) => {
    const mu = r.pick([100, 50, 170, 20, 500])
    const sigma = r.pick([5, 10, 15, 2, 20])
    const z = r.pick([-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2])
    const x = mu + z * sigma
    return {
      params: { mu, sigma, x },
      statement: md`Une mesure suit une loi normale $X \sim \mathcal{N}(\mu = ${mu},\ \sigma = ${sigma})$.

1. Quel est le **score z** de la valeur $x = ${num(x)}$ ?
2. Quelle est la probabilité $P(X > ${num(x)})$ ?

Table de la loi normale centrée réduite : $\Phi(0{,}5) = 0{,}6915$, $\Phi(1) = 0{,}8413$, $\Phi(1{,}5) = 0{,}9332$, $\Phi(2) = 0{,}9772$, et $\Phi(-z) = 1 - \Phi(z)$.`,
      fields: [field('$z$', z, 2), field(`$P(X > ${num(x)})$`, 1 - phi(z), 3)],
      hint: md`$Z = \dfrac{X - \mu}{\sigma} \sim \mathcal{N}(0, 1)$, donc $P(X > x) = P(Z > z) = 1 - \Phi(z)$.`,
      solution: md`$$z = \frac{${num(x)} - ${mu}}{${sigma}} = ${num(z)}$$

$$P(X > ${num(x)}) = 1 - \Phi(${num(z)}) = ${z < 0 ? md`1 - (1 - \Phi(${num(-z)})) = \Phi(${num(-z)})` : md`1 - ${num(phi(z), 4)}`} \approx ${num(1 - phi(z), 4)}$$`,
    }
  },
}

const sumIndep: MathExercise = {
  id: 'rv-sum',
  title: 'Somme de variables indépendantes',
  skill: 'Les variances s’additionnent',
  level: 2,
  generate: (r) => {
    const [s1, s2] = r.pick([[3, 4], [6, 8], [5, 12], [9, 12], [8, 15], [12, 16]])
    const m1 = r.int(20, 60)
    const m2 = r.int(10, 40)
    return {
      params: { m1, s1, m2, s2 },
      statement: md`Une requête passe par deux étapes indépendantes : la durée $X$ (moyenne ${m1} ms, écart-type ${s1} ms) puis $Y$ (moyenne ${m2} ms, écart-type ${s2} ms).

1. Quelle est la durée totale moyenne $E[X + Y]$ ?
2. Quelle est la variance de la durée totale ?
3. Quel est l'écart-type de la **différence** $X - Y$ ?`,
      fields: [field('$E[X + Y]$', m1 + m2, 2), field('$\\mathrm{Var}(X + Y)$', s1 * s1 + s2 * s2, 2), field('$\\sigma_{X - Y}$', Math.hypot(s1, s2), 2)],
      hint: md`L'espérance est toujours linéaire. Pour des variables **indépendantes**, $\mathrm{Var}(X \pm Y) = \mathrm{Var}(X) + \mathrm{Var}(Y)$ : les variances s'additionnent, **pas** les écarts-types (et jamais de soustraction !).`,
      solution: md`$$E[X + Y] = ${m1} + ${m2} = ${m1 + m2}$$

$$\mathrm{Var}(X + Y) = ${s1}^2 + ${s2}^2 = ${s1 * s1} + ${s2 * s2} = ${s1 * s1 + s2 * s2}$$

$$\mathrm{Var}(X - Y) = \mathrm{Var}(X) + (-1)^2\,\mathrm{Var}(Y) = ${s1 * s1 + s2 * s2} \quad\Rightarrow\quad \sigma_{X-Y} = \sqrt{${s1 * s1 + s2 * s2}} = ${Math.hypot(s1, s2)}$$

L'écart-type de la somme (${Math.hypot(s1, s2)}) est plus petit que la somme des écarts-types (${s1 + s2}).`,
    }
  },
}

const exponential: MathExercise = {
  id: 'rv-exponential',
  title: 'Temps d’attente exponentiel',
  skill: 'P(T > t) = e^(−λt), E[T] = 1/λ',
  level: 2,
  generate: (r) => {
    const lambda = r.pick([0.5, 2, 3, 4, 0.25])
    const t = r.pick([0.5, 1, 2, 3])
    return {
      params: { lambda, t },
      statement: md`Les commandes arrivent sur un site au rythme moyen de $\lambda = ${num(lambda)}$ par minute. Le temps $T$ (en minutes) avant la prochaine commande suit une loi **exponentielle** de paramètre $\lambda$.

1. Quel est le temps d'attente moyen ?
2. Quelle est la probabilité d'attendre **plus de ${num(t)} minute${t > 1 ? 's' : ''}** ?`,
      fields: [field('$E[T]$', 1 / lambda, 2, 'min'), field(`$P(T > ${num(t)})$`, Math.exp(-lambda * t), 3)],
      hint: md`Pour $T \sim \mathcal{E}(\lambda)$ : $P(T > t) = e^{-\lambda t}$ et $E[T] = \dfrac{1}{\lambda}$.`,
      solution: md`$$E[T] = \frac{1}{${num(lambda)}} = ${num(1 / lambda)} \text{ min}$$

$$P(T > ${num(t)}) = e^{-${num(lambda)} \times ${num(t)}} = e^{-${num(lambda * t)}} \approx ${num(Math.exp(-lambda * t), 4)}$$

La loi exponentielle est **sans mémoire** : avoir déjà attendu 5 minutes ne change rien à l'attente restante.`,
    }
  },
}

export const randomChapter: Chapter = {
  id: 'random',
  title: 'Variables aléatoires et lois',
  emoji: '📊',
  summary: 'Espérance, variance, binomiale, Poisson, normale, exponentielle.',
  lesson: md`## Variable aléatoire

Une **variable aléatoire** $X$ associe un nombre à chaque résultat d'une expérience. Sa **loi** donne les probabilités de ses valeurs : $P(X = x)$ pour une variable discrète, une **densité** $f$ pour une variable continue ($P(a \le X \le b) = \int_a^b f(x)\,dx$).

## Espérance et variance

L'**espérance** est la moyenne pondérée par les probabilités :
$$E[X] = \sum_x x\,P(X = x)$$

La **variance** mesure la dispersion autour de la moyenne :
$$\mathrm{Var}(X) = E\big[(X - E[X])^2\big] = E[X^2] - E[X]^2 \qquad \sigma_X = \sqrt{\mathrm{Var}(X)}$$

Règles à connaître par cœur :

- $E[aX + b] = a\,E[X] + b$ et $E[X + Y] = E[X] + E[Y]$ (**toujours**) ;
- $\mathrm{Var}(aX + b) = a^2\,\mathrm{Var}(X)$ ;
- si $X$ et $Y$ sont **indépendantes** : $\mathrm{Var}(X + Y) = \mathrm{Var}(X - Y) = \mathrm{Var}(X) + \mathrm{Var}(Y)$.

## Les lois usuelles

| Loi | Modélise | $P(X = k)$ ou densité | $E[X]$ | $\mathrm{Var}(X)$ |
|---|---|---|---|---|
| Bernoulli $\mathcal{B}(p)$ | un succès/échec | $P(X=1) = p$ | $p$ | $p(1-p)$ |
| Binomiale $\mathcal{B}(n,p)$ | nb de succès sur $n$ essais | $\binom{n}{k}p^k(1-p)^{n-k}$ | $np$ | $np(1-p)$ |
| Poisson $\mathcal{P}(\lambda)$ | nb d'événements rares par intervalle | $e^{-\lambda}\frac{\lambda^k}{k!}$ | $\lambda$ | $\lambda$ |
| Exponentielle $\mathcal{E}(\lambda)$ | temps d'attente | $\lambda e^{-\lambda x}$ | $1/\lambda$ | $1/\lambda^2$ |
| Normale $\mathcal{N}(\mu,\sigma^2)$ | erreurs, mesures, moyennes | $\frac{1}{\sigma\sqrt{2\pi}}e^{-\frac{(x-\mu)^2}{2\sigma^2}}$ | $\mu$ | $\sigma^2$ |

## La loi normale

On ramène toute normale à la **normale centrée réduite** $\mathcal{N}(0, 1)$ :
$$Z = \frac{X - \mu}{\sigma}$$
Le **score z** dit à combien d'écarts-types de la moyenne se trouve une valeur. On lit ensuite $\Phi(z) = P(Z \le z)$ dans une table, avec $\Phi(-z) = 1 - \Phi(z)$.

Repères : environ **68 %** des valeurs à moins de $1\sigma$, **95 %** à moins de $1{,}96\sigma$, **99,7 %** à moins de $3\sigma$.

## Exemple résolu

*Les tailles suivent $\mathcal{N}(170, 10^2)$. Proportion de personnes de plus de 185 cm ?*

$z = \frac{185 - 170}{10} = 1{,}5$, donc $P(X > 185) = 1 - \Phi(1{,}5) = 1 - 0{,}9332 = 0{,}0668$, soit environ 6,7 %.`,
  formulas: [
    { name: 'Espérance', tex: md`E[X] = \sum_x x\,P(X = x)` },
    { name: 'Variance', tex: md`\mathrm{Var}(X) = E[X^2] - E[X]^2` },
    { name: 'Transformation affine', tex: md`E[aX+b] = aE[X]+b \qquad \mathrm{Var}(aX+b) = a^2\,\mathrm{Var}(X)` },
    { name: 'Somme indépendante', tex: md`\mathrm{Var}(X + Y) = \mathrm{Var}(X) + \mathrm{Var}(Y)` },
    { name: 'Binomiale', tex: md`P(X=k) = \binom{n}{k}p^k(1-p)^{n-k},\quad E = np,\quad \mathrm{Var} = np(1-p)` },
    { name: 'Poisson', tex: md`P(X=k) = e^{-\lambda}\frac{\lambda^k}{k!},\quad E = \mathrm{Var} = \lambda` },
    { name: 'Exponentielle', tex: md`P(T > t) = e^{-\lambda t},\quad E[T] = 1/\lambda` },
    { name: 'Score z', tex: md`Z = \frac{X - \mu}{\sigma} \sim \mathcal{N}(0, 1)` },
  ],
  exercises: [
    expectation,
    linear,
    binomialMoments,
    binomialPmf,
    poisson,
    normal,
    sumIndep,
    exponential,
    formulaQuiz('rv-formulas', 'Les bonnes formules', [
      {
        q: 'La variance d’une loi binomiale $\\mathcal{B}(n, p)$ vaut :',
        correct: md`$np(1-p)$`,
        wrong: [md`$np$`, md`$\sqrt{np(1-p)}$`, md`$n^2p(1-p)$`],
      },
      {
        q: 'Pour deux variables **indépendantes**, $\\mathrm{Var}(X - Y)$ vaut :',
        correct: md`$\mathrm{Var}(X) + \mathrm{Var}(Y)$`,
        wrong: [md`$\mathrm{Var}(X) - \mathrm{Var}(Y)$`, md`$|\mathrm{Var}(X) - \mathrm{Var}(Y)|$`, md`$\mathrm{Var}(X)\,\mathrm{Var}(Y)$`],
      },
      {
        q: '$\\mathrm{Var}(3X + 2)$ vaut :',
        correct: md`$9\,\mathrm{Var}(X)$`,
        wrong: [md`$3\,\mathrm{Var}(X) + 2$`, md`$9\,\mathrm{Var}(X) + 2$`, md`$3\,\mathrm{Var}(X)$`],
      },
      {
        q: 'Une loi de Poisson de paramètre $\\lambda$ a pour espérance et variance :',
        correct: md`$E = \lambda$ et $\mathrm{Var} = \lambda$`,
        wrong: [md`$E = \lambda$ et $\mathrm{Var} = \lambda^2$`, md`$E = 1/\lambda$ et $\mathrm{Var} = 1/\lambda^2$`, md`$E = \lambda$ et $\mathrm{Var} = \sqrt{\lambda}$`],
      },
      {
        q: 'La variance s’écrit aussi :',
        correct: md`$E[X^2] - E[X]^2$`,
        wrong: [md`$E[X]^2 - E[X^2]$`, md`$E[X^2]$`, md`$E[(X - E[X])]^2$`],
      },
      {
        q: 'Si $X \\sim \\mathcal{N}(\\mu, \\sigma^2)$, la variable centrée réduite est :',
        correct: md`$\dfrac{X - \mu}{\sigma}$`,
        wrong: [md`$\dfrac{X - \mu}{\sigma^2}$`, md`$\dfrac{X}{\sigma} - \mu$`, md`$(X - \mu)\,\sigma$`],
      },
    ]),
  ],
}
