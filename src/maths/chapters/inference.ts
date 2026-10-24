import { field, num, type Chapter, type MathExercise } from '../core'
import { formulaQuiz } from './formulaQuiz'

const md = String.raw

const meanStd: MathExercise = {
  id: 'inf-mean-std',
  title: 'Moyenne et écart-type d’un échantillon',
  skill: 'x̄ et s (division par n − 1)',
  level: 1,
  generate: (r) => {
    const xs = Array.from({ length: 4 }, () => r.int(2, 20))
    const rest = (5 - (xs.reduce((a, b) => a + b, 0) % 5)) % 5
    xs.push(r.pick([rest + 5, rest + 10, rest + 15].filter((v) => v <= 22)))
    const n = xs.length
    const mean = xs.reduce((a, b) => a + b, 0) / n
    const ss = xs.reduce((a, x) => a + (x - mean) ** 2, 0)
    return {
      params: { xs },
      statement: md`Temps de chargement mesurés (en secondes) : ${xs.join(' ; ')}.

Calcule la **moyenne** $\bar{x}$, puis l'**écart-type de l'échantillon** $s$ (estimateur sans biais de la variance, avec $n - 1$).`,
      fields: [field('$\\bar{x}$', mean, 2), field('$s$', Math.sqrt(ss / (n - 1)), 2)],
      hint: md`$\bar{x} = \dfrac{1}{n}\sum x_i$ et $s^2 = \dfrac{1}{n-1}\sum (x_i - \bar{x})^2$.`,
      solution: md`$$\bar{x} = \frac{${xs.join(' + ')}}{${n}} = \frac{${xs.reduce((a, b) => a + b, 0)}}{${n}} = ${num(mean)}$$

Écarts à la moyenne au carré : ${xs.map((x) => `$(${x} - ${num(mean)})^2 = ${num((x - mean) ** 2)}$`).join(', ')}. Leur somme vaut ${num(ss)}.

$$s^2 = \frac{${num(ss)}}{${n - 1}} = ${num(ss / (n - 1))} \qquad s = \sqrt{${num(ss / (n - 1))}} \approx ${num(Math.sqrt(ss / (n - 1)), 3)}$$

On divise par $n - 1$ car $\bar{x}$ est elle-même estimée sur les données (correction de Bessel). En NumPy : ${'`'}np.std(x, ddof=1)${'`'}.`,
    }
  },
}

const standardError: MathExercise = {
  id: 'inf-standard-error',
  title: 'Erreur standard de la moyenne',
  skill: 'SE = σ / √n',
  level: 1,
  generate: (r) => {
    const sigma = r.pick([10, 12, 15, 20, 30, 40])
    const n = r.pick([16, 25, 36, 64, 100, 400])
    return {
      params: { sigma, n },
      statement: md`Le panier moyen d'un site a un écart-type $\sigma = ${sigma}$ €. On estime la moyenne sur un échantillon de $n = ${n}$ commandes.

1. Quelle est l'**erreur standard** de la moyenne estimée ?
2. Que devient-elle avec **4 fois plus** de commandes ($n = ${4 * n}$) ?`,
      fields: [field('$SE$', sigma / Math.sqrt(n), 2, '€'), field(`$SE$ avec $n = ${4 * n}$`, sigma / Math.sqrt(4 * n), 2, '€')],
      hint: md`L'écart-type de la moyenne de $n$ observations indépendantes est $SE = \dfrac{\sigma}{\sqrt{n}}$.`,
      solution: md`$$SE = \frac{${sigma}}{\sqrt{${n}}} = \frac{${sigma}}{${Math.sqrt(n)}} = ${num(sigma / Math.sqrt(n))}\text{ euros}$$

$$SE' = \frac{${sigma}}{\sqrt{${4 * n}}} = \frac{${sigma}}{${Math.sqrt(4 * n)}} = ${num(sigma / Math.sqrt(4 * n))}\text{ euros}$$

La précision progresse en $\sqrt{n}$ : pour diviser l'erreur par 2, il faut **4 fois** plus de données.`,
    }
  },
}

const ciMean: MathExercise = {
  id: 'inf-ci-mean',
  title: 'Intervalle de confiance d’une moyenne',
  skill: 'x̄ ± 1,96 σ/√n',
  level: 2,
  generate: (r) => {
    const mean = r.int(40, 120)
    const sigma = r.pick([8, 10, 12, 15, 20])
    const n = r.pick([25, 64, 100, 144])
    const half = (1.96 * sigma) / Math.sqrt(n)
    return {
      params: { mean, sigma, n },
      statement: md`Sur $n = ${n}$ utilisateurs, la durée moyenne de session est $\bar{x} = ${mean}$ s. L'écart-type (supposé connu) vaut $\sigma = ${sigma}$ s.

Donne l'**intervalle de confiance à 95 %** de la durée moyenne.`,
      fields: [field('Borne basse', mean - half, 2, 's'), field('Borne haute', mean + half, 2, 's')],
      hint: md`Par le théorème central limite, $\bar{X} \approx \mathcal{N}(\mu, \sigma^2/n)$. IC à 95 % : $\bar{x} \pm 1{,}96\,\dfrac{\sigma}{\sqrt{n}}$.`,
      solution: md`Demi-largeur : $1{,}96 \times \dfrac{${sigma}}{\sqrt{${n}}} = 1{,}96 \times ${num(sigma / Math.sqrt(n))} = ${num(half)}$.

$$IC_{95\%} = [${mean} - ${num(half)} ;\ ${mean} + ${num(half)}] = [${num(mean - half)} ;\ ${num(mean + half)}]$$

Interprétation : si on répétait l'expérience, 95 % des intervalles construits ainsi contiendraient la vraie moyenne.`,
    }
  },
}

const ciProportion: MathExercise = {
  id: 'inf-ci-proportion',
  title: 'Intervalle de confiance d’un taux',
  skill: 'p̂ ± 1,96 √(p̂(1−p̂)/n)',
  level: 2,
  generate: (r) => {
    const n = r.pick([400, 500, 1000, 2000])
    const k = Math.round(n * r.pick([0.04, 0.05, 0.08, 0.1, 0.12, 0.2]))
    const p = k / n
    const margin = 1.96 * Math.sqrt((p * (1 - p)) / n)
    return {
      params: { n, k },
      statement: md`Une page a été vue par ${n} visiteurs, dont **${k}** ont acheté.

1. Quel est le taux de conversion observé $\hat{p}$ ?
2. Quelle est la **marge d'erreur** à 95 % sur ce taux ?`,
      fields: [field('$\\hat{p}$', p, 3), field('Marge (demi-largeur)', margin, 4)],
      hint: md`Une proportion est une moyenne de Bernoulli : sa variance est $\dfrac{p(1-p)}{n}$. Marge à 95 % : $1{,}96\sqrt{\dfrac{\hat{p}(1-\hat{p})}{n}}$.`,
      solution: md`$$\hat{p} = \frac{${k}}{${n}} = ${num(p)}$$

$$1{,}96\sqrt{\frac{${num(p)} \times ${num(1 - p)}}{${n}}} = 1{,}96 \times ${num(Math.sqrt((p * (1 - p)) / n), 5)} \approx ${num(margin, 4)}$$

Le taux est donc $${num(p * 100, 2)} \% \pm ${num(margin * 100, 2)}$ points.`,
    }
  },
}

const zTest: MathExercise = {
  id: 'inf-ab-test',
  title: 'A/B test : statistique z',
  skill: 'Test de deux proportions',
  level: 3,
  generate: (r) => {
    const n = r.pick([1000, 2000, 2500])
    const pa = r.pick([0.05, 0.08, 0.1])
    const lift = r.pick([0.005, 0.01, 0.015, 0.02, 0.025])
    const ka = Math.round(n * pa)
    const kb = Math.round(n * (pa + lift))
    const pA = ka / n
    const pB = kb / n
    const pool = (ka + kb) / (2 * n)
    const se = Math.sqrt(pool * (1 - pool) * (2 / n))
    const z = (pB - pA) / se
    return {
      params: { n, ka, kb },
      statement: md`A/B test d'un nouveau bouton, ${n} visiteurs par version :

- version A : **${ka}** conversions ;
- version B : **${kb}** conversions.

1. Calcule le taux **commun** $\hat{p}$ (les deux groupes réunis).
2. Calcule la statistique $z$ du test de différence de proportions.

La différence est significative à 5 % (bilatéral) si $|z| > 1{,}96$.`,
      fields: [field('$\\hat{p}$ commun', pool, 4), field('$z$', z, 2)],
      hint: md`Sous $H_0$ (pas de différence), on estime un taux commun $\hat{p} = \dfrac{k_A + k_B}{n_A + n_B}$, puis
$$z = \frac{\hat{p}_B - \hat{p}_A}{\sqrt{\hat{p}(1 - \hat{p})\left(\frac{1}{n_A} + \frac{1}{n_B}\right)}}$$`,
      solution: md`$\hat{p}_A = ${num(pA)}$, $\hat{p}_B = ${num(pB)}$, et $\hat{p} = \dfrac{${ka} + ${kb}}{${2 * n}} = ${num(pool, 5)}$.

$$SE = \sqrt{${num(pool, 5)} \times ${num(1 - pool, 5)} \times \frac{2}{${n}}} \approx ${num(se, 5)}$$

$$z = \frac{${num(pB)} - ${num(pA)}}{${num(se, 5)}} \approx ${num(z, 3)}$$

${Math.abs(z) > 1.96 ? md`$|z| > 1{,}96$ : la différence est **significative** au seuil de 5 %.` : md`$|z| \le 1{,}96$ : on **ne peut pas** conclure à une différence au seuil de 5 % (ce qui ne prouve pas qu'il n'y en a pas : le test manque peut-être de puissance).`}`,
    }
  },
}

const sampleSize: MathExercise = {
  id: 'inf-sample-size',
  title: 'Taille d’échantillon',
  skill: 'n = (1,96 σ / E)²',
  level: 2,
  generate: (r) => {
    const sigma = r.pick([5, 8, 10, 12, 15, 20])
    const e = r.pick([1, 2, 2.5, 3])
    const exact = ((1.96 * sigma) / e) ** 2
    return {
      params: { sigma, e },
      statement: md`On veut estimer une durée moyenne avec une **marge d'erreur** de $\pm ${num(e)}$ minutes à 95 %. L'écart-type est d'environ $\sigma = ${sigma}$ minutes.

Combien d'observations faut-il au minimum ? (arrondis à l'entier **supérieur**)`,
      fields: [field('$n$', Math.ceil(exact), 0)],
      hint: md`On veut $1{,}96\,\dfrac{\sigma}{\sqrt{n}} \le E$, donc $n \ge \left(\dfrac{1{,}96\,\sigma}{E}\right)^2$.`,
      solution: md`$$n \geq \left(\frac{1{,}96 \times ${sigma}}{${num(e)}}\right)^2 = (${num((1.96 * sigma) / e)})^2 = ${num(exact, 2)}$$

Il faut donc au moins **${Math.ceil(exact)}** observations. Diviser la marge par 2 demanderait 4 fois plus de données.`,
    }
  },
}

const correlation: MathExercise = {
  id: 'inf-correlation',
  title: 'Coefficient de corrélation',
  skill: 'r = cov / (σx σy)',
  level: 3,
  generate: (r) => {
    const xs = [1, 2, 3, 4, 5]
    const slope = r.pick([1, 2, -1, -2])
    const noise = r.pick([[1, -1, 0, 1, -1], [0, 1, -2, 1, 0], [2, -1, 0, -2, 1], [1, 0, -1, 0, 0]])
    const b = r.int(1, 6)
    const ys = xs.map((x, i) => b + slope * x + noise[i])
    const mx = 3
    const my = ys.reduce((a, y) => a + y, 0) / 5
    const sxy = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0)
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
    const syy = ys.reduce((a, y) => a + (y - my) ** 2, 0)
    return {
      params: { xs, ys },
      statement: md`Cinq points $(x, y)$ :

| $x$ | ${xs.join(' | ')} |
|---|---|---|---|---|---|
| $y$ | ${ys.join(' | ')} |

Calcule la **covariance** (avec $n - 1$) puis le **coefficient de corrélation** de Pearson $r$.`,
      fields: [field('$\\mathrm{cov}(x, y)$', sxy / 4, 2), field('$r$', sxy / Math.sqrt(sxx * syy), 3)],
      hint: md`$$r = \frac{\sum (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum (x_i - \bar{x})^2}\,\sqrt{\sum (y_i - \bar{y})^2}} \qquad \mathrm{cov}(x, y) = \frac{1}{n-1}\sum (x_i - \bar{x})(y_i - \bar{y})$$`,
      solution: md`$\bar{x} = 3$ et $\bar{y} = ${num(my)}$.

- $\sum (x_i - \bar{x})(y_i - \bar{y}) = ${num(sxy)}$, donc $\mathrm{cov} = ${num(sxy)} / 4 = ${num(sxy / 4)}$ ;
- $\sum (x_i - \bar{x})^2 = ${sxx}$ et $\sum (y_i - \bar{y})^2 = ${num(syy)}$.

$$r = \frac{${num(sxy)}}{\sqrt{${sxx} \times ${num(syy)}}} \approx ${num(sxy / Math.sqrt(sxx * syy), 4)}$$

$r$ est entre $-1$ et $1$ ; il ne mesure que la relation **linéaire**, et une corrélation n'implique pas une causalité.`,
    }
  },
}

export const inferenceChapter: Chapter = {
  id: 'inference',
  title: 'Statistique et tests',
  emoji: '🧪',
  summary: 'Estimateurs, erreur standard, intervalles de confiance, A/B tests, corrélation.',
  lesson: md`## Échantillon et estimateurs

On observe un **échantillon** $x_1, \dots, x_n$ pour estimer des paramètres inconnus de la population.

- **Moyenne empirique** : $\bar{x} = \dfrac{1}{n}\sum_i x_i$.
- **Variance empirique corrigée** : $s^2 = \dfrac{1}{n-1}\sum_i (x_i - \bar{x})^2$. On divise par $n - 1$ pour que l'estimateur soit **sans biais**.
- Pour une proportion (taux de clic, de conversion…) : $\hat{p} = k / n$.

## Théorème central limite (TCL)

Quelle que soit la loi des données (de variance finie), la moyenne de $n$ observations indépendantes suit approximativement une loi normale :
$$\bar{X} \approx \mathcal{N}\!\left(\mu,\ \frac{\sigma^2}{n}\right)$$
L'écart-type de $\bar{X}$ est l'**erreur standard** $SE = \sigma / \sqrt{n}$ : la précision s'améliore en $\sqrt{n}$.

## Intervalle de confiance à 95 %

$$\bar{x} \pm 1{,}96\,\frac{\sigma}{\sqrt{n}} \qquad\qquad \hat{p} \pm 1{,}96\sqrt{\frac{\hat{p}(1 - \hat{p})}{n}}$$

($1{,}96$ est le quantile à 97,5 % de $\mathcal{N}(0,1)$ ; pour 90 % on prend $1{,}645$, pour 99 % $2{,}576$.) Avec peu de données et $\sigma$ inconnu, on remplace $1{,}96$ par un quantile de **Student**.

Pour une marge $E$ voulue : $n \geq \left(\dfrac{1{,}96\,\sigma}{E}\right)^2$.

## Tests d'hypothèse

1. **$H_0$** (hypothèse nulle) : « pas d'effet ». **$H_1$** : « il y a un effet ».
2. On calcule une **statistique de test**, par exemple $z = \dfrac{\text{écart observé}}{\text{erreur standard}}$.
3. La **p-value** est la probabilité, **si $H_0$ est vraie**, d'observer un écart au moins aussi extrême.
4. On rejette $H_0$ si $p < \alpha$ (souvent $\alpha = 5\,\%$), c'est-à-dire si $|z| > 1{,}96$ en bilatéral.

Erreurs : **type I** = rejeter $H_0$ à tort (probabilité $\alpha$) ; **type II** = ne pas détecter un vrai effet (probabilité $\beta$). La **puissance** vaut $1 - \beta$.

**A/B test sur deux taux** : avec le taux commun $\hat{p} = \frac{k_A + k_B}{n_A + n_B}$,
$$z = \frac{\hat{p}_B - \hat{p}_A}{\sqrt{\hat{p}(1-\hat{p})\left(\frac{1}{n_A} + \frac{1}{n_B}\right)}}$$

## Corrélation

$$\mathrm{cov}(x, y) = \frac{1}{n-1}\sum (x_i - \bar{x})(y_i - \bar{y}) \qquad r = \frac{\mathrm{cov}(x, y)}{s_x\,s_y} \in [-1, 1]$$

## Exemple résolu

*400 visiteurs, 60 achats.* $\hat{p} = 0{,}15$, $SE = \sqrt{0{,}15 \times 0{,}85 / 400} \approx 0{,}0179$, donc $IC_{95\%} \approx 0{,}15 \pm 0{,}035 = [0{,}115 ;\ 0{,}185]$.`,
  formulas: [
    { name: 'Variance corrigée', tex: md`s^2 = \frac{1}{n-1}\sum_i (x_i - \bar{x})^2` },
    { name: 'Erreur standard', tex: md`SE = \frac{\sigma}{\sqrt{n}}` },
    { name: 'IC 95 % d’une moyenne', tex: md`\bar{x} \pm 1{,}96\,\frac{\sigma}{\sqrt{n}}` },
    { name: 'IC 95 % d’une proportion', tex: md`\hat{p} \pm 1{,}96\sqrt{\frac{\hat{p}(1-\hat{p})}{n}}` },
    { name: 'Taille d’échantillon', tex: md`n \geq \left(\frac{1{,}96\,\sigma}{E}\right)^2` },
    { name: 'Test de deux proportions', tex: md`z = \frac{\hat{p}_B - \hat{p}_A}{\sqrt{\hat{p}(1-\hat{p})\left(\frac{1}{n_A} + \frac{1}{n_B}\right)}}` },
    { name: 'Corrélation', tex: md`r = \frac{\mathrm{cov}(x, y)}{s_x\,s_y}` },
  ],
  exercises: [
    meanStd,
    standardError,
    ciMean,
    ciProportion,
    sampleSize,
    zTest,
    correlation,
    formulaQuiz('inf-formulas', 'Les bonnes définitions', [
      {
        q: 'La **p-value** d’un test est :',
        correct: 'la probabilité, si $H_0$ est vraie, d’observer un résultat au moins aussi extrême',
        wrong: ['la probabilité que $H_0$ soit vraie', 'la probabilité que $H_1$ soit vraie', 'la probabilité de se tromper en acceptant $H_1$'],
      },
      {
        q: 'Une **erreur de type I** consiste à :',
        correct: 'rejeter $H_0$ alors qu’elle est vraie',
        wrong: ['ne pas rejeter $H_0$ alors qu’elle est fausse', 'choisir un mauvais seuil $\\alpha$', 'utiliser un test unilatéral au lieu de bilatéral'],
      },
      {
        q: 'Pour diviser par 2 la largeur d’un intervalle de confiance, il faut multiplier la taille d’échantillon par :',
        correct: '4',
        wrong: ['2', '$\\sqrt{2}$', '8'],
      },
      {
        q: 'L’erreur standard de la moyenne de $n$ observations d’écart-type $\\sigma$ vaut :',
        correct: md`$\sigma / \sqrt{n}$`,
        wrong: [md`$\sigma / n$`, md`$\sigma^2 / n$`, md`$\sigma\sqrt{n}$`],
      },
      {
        q: 'La **puissance** d’un test est :',
        correct: 'la probabilité de rejeter $H_0$ quand $H_1$ est vraie',
        wrong: ['la probabilité de rejeter $H_0$ quand elle est vraie', 'la valeur de $1 - \\alpha$', 'la taille de l’effet observé'],
      },
      {
        q: 'Un intervalle de confiance à 95 % signifie que :',
        correct: '95 % des intervalles construits ainsi contiennent la vraie valeur',
        wrong: ['la vraie valeur a 95 % de chances d’être dans cet intervalle précis', '95 % des données sont dans l’intervalle', 'l’estimation est juste à 95 %'],
      },
    ]),
  ],
}
