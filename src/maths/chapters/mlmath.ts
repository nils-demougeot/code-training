import { field, num, type Chapter, type MathExercise } from '../core'
import { formulaQuiz } from './formulaQuiz'

const md = String.raw

const metrics: MathExercise = {
  id: 'ml-metrics',
  title: 'Précision, rappel, F1',
  skill: 'Lire une matrice de confusion',
  level: 1,
  generate: (r) => {
    const tp = r.int(20, 90)
    const fp = r.int(5, 40)
    const fn = r.int(5, 40)
    const tn = r.int(100, 400)
    const precision = tp / (tp + fp)
    const recall = tp / (tp + fn)
    return {
      params: { tp, fp, fn, tn },
      statement: md`Un classifieur de spam donne sur le jeu de test :

| | Prédit spam | Prédit normal |
|---|---|---|
| **Vrai spam** | ${tp} (VP) | ${fn} (FN) |
| **Vrai normal** | ${fp} (FP) | ${tn} (VN) |

Calcule la **précision**, le **rappel** et le **score F1**.`,
      fields: [field('Précision', precision, 3), field('Rappel', recall, 3), field('F1', (2 * precision * recall) / (precision + recall), 3)],
      hint: md`Précision $= \dfrac{VP}{VP + FP}$ (parmi les alertes, combien sont justes), rappel $= \dfrac{VP}{VP + FN}$ (parmi les vrais positifs, combien sont trouvés), $F_1 = \dfrac{2\,P\,R}{P + R}$ (moyenne harmonique).`,
      solution: md`$$P = \frac{${tp}}{${tp} + ${fp}} \approx ${num(precision, 4)} \qquad R = \frac{${tp}}{${tp} + ${fn}} \approx ${num(recall, 4)}$$

$$F_1 = \frac{2 \times ${num(precision, 4)} \times ${num(recall, 4)}}{${num(precision, 4)} + ${num(recall, 4)}} \approx ${num((2 * precision * recall) / (precision + recall), 4)}$$

Autre écriture utile : $F_1 = \dfrac{2\,VP}{2\,VP + FP + FN} = \dfrac{${2 * tp}}{${2 * tp + fp + fn}}$.`,
    }
  },
}

const imbalance: MathExercise = {
  id: 'ml-imbalance',
  title: 'Le piège de l’accuracy',
  skill: 'Données déséquilibrées',
  level: 2,
  generate: (r) => {
    const n = 1000
    const pos = r.pick([10, 20, 50])
    const tp = Math.round(pos * r.pick([0.6, 0.7, 0.8, 0.9]))
    const fp = r.pick([30, 50, 80, 120])
    const acc2 = (tp + (n - pos - fp)) / n
    return {
      params: { n, pos, tp, fp },
      statement: md`Sur ${n} transactions, **${pos}** sont frauduleuses.

- Le modèle A répond toujours « pas de fraude ».
- Le modèle B détecte ${tp} fraudes, mais lève aussi ${fp} fausses alertes.

Calcule l'**accuracy** des deux modèles, puis le **rappel** du modèle B.`,
      fields: [field('Accuracy de A', (n - pos) / n, 3), field('Accuracy de B', acc2, 3), field('Rappel de B', tp / pos, 3)],
      hint: md`Accuracy $= \dfrac{VP + VN}{N}$. Le modèle A n'a que des vrais négatifs. Rappel $= \dfrac{VP}{VP + FN}$.`,
      solution: md`Modèle A : $\dfrac{${n - pos}}{${n}} = ${num((n - pos) / n)}$, sans détecter **aucune** fraude (rappel nul).

Modèle B : $VP = ${tp}$, $VN = ${n - pos} - ${fp} = ${n - pos - fp}$, donc accuracy $= \dfrac{${tp} + ${n - pos - fp}}{${n}} = ${num(acc2)}$ et rappel $= \dfrac{${tp}}{${pos}} = ${num(tp / pos)}$.

${acc2 < (n - pos) / n ? 'Le modèle B a une accuracy **plus faible** que le modèle trivial, alors qu’il est bien plus utile !' : 'Les accuracies sont proches alors que les modèles n’ont rien à voir.'} Sur des données déséquilibrées, on regarde le rappel, la précision, le F1 ou l'aire sous la courbe précision-rappel.`,
    }
  },
}

const regression: MathExercise = {
  id: 'ml-regression-metrics',
  title: 'MSE, RMSE, MAE',
  skill: 'Erreurs de régression',
  level: 1,
  generate: (r) => {
    const y = Array.from({ length: 4 }, () => r.int(5, 30))
    const err = r.pick([[1, -2, 3, 0], [2, 2, -1, -3], [-4, 1, 0, 1], [0, 3, -3, 2], [1, 1, -1, 5]])
    const yhat = y.map((v, i) => v + err[i])
    const mse = err.reduce((a, e) => a + e * e, 0) / 4
    return {
      params: { y, yhat },
      statement: md`Prix réels et prédits (en k€) :

| Vrai $y$ | ${y.join(' | ')} |
|---|---|---|---|---|
| Prédit $\hat{y}$ | ${yhat.join(' | ')} |

Calcule la **MSE**, la **RMSE** et la **MAE**.`,
      fields: [field('MSE', mse, 2), field('RMSE', Math.sqrt(mse), 2), field('MAE', err.reduce((a, e) => a + Math.abs(e), 0) / 4, 2)],
      hint: md`$\mathrm{MSE} = \dfrac{1}{n}\sum (y_i - \hat{y}_i)^2$, $\mathrm{RMSE} = \sqrt{\mathrm{MSE}}$, $\mathrm{MAE} = \dfrac{1}{n}\sum |y_i - \hat{y}_i|$.`,
      solution: md`Erreurs $\hat{y} - y$ : ${err.join(', ')}.

$$\mathrm{MSE} = \frac{${err.map((e) => `${e < 0 ? `(${e})` : e}^2`).join(' + ')}}{4} = \frac{${err.reduce((a, e) => a + e * e, 0)}}{4} = ${num(mse)} \qquad \mathrm{RMSE} = \sqrt{${num(mse)}} \approx ${num(Math.sqrt(mse), 3)}$$

$$\mathrm{MAE} = \frac{${err.map((e) => Math.abs(e)).join(' + ')}}{4} = ${num(err.reduce((a, e) => a + Math.abs(e), 0) / 4)}$$

La RMSE est dans l'unité de $y$ (k€) et pénalise plus les grosses erreurs que la MAE, qui est plus robuste aux valeurs aberrantes.`,
    }
  },
}

const r2: MathExercise = {
  id: 'ml-r2',
  title: 'Coefficient de détermination R²',
  skill: 'R² = 1 − SSres / SStot',
  level: 2,
  generate: (r) => {
    const base = r.pick([[2, 4, 6, 8], [1, 3, 4, 8], [3, 5, 9, 11], [10, 12, 15, 19]])
    const y = base
    const err = r.pick([[1, -1, 0, 1], [0, 1, -1, 0], [1, 0, -2, 1], [-1, 1, 1, -1]])
    const yhat = y.map((v, i) => v + err[i])
    const mean = y.reduce((a, b) => a + b, 0) / 4
    const ssRes = err.reduce((a, e) => a + e * e, 0)
    const ssTot = y.reduce((a, v) => a + (v - mean) ** 2, 0)
    return {
      params: { y, yhat },
      statement: md`| Vrai $y$ | ${y.join(' | ')} |
|---|---|---|---|---|
| Prédit $\hat{y}$ | ${yhat.join(' | ')} |

Calcule $SS_{res}$, $SS_{tot}$, puis le $R^2$ du modèle.`,
      fields: [field('$SS_{res}$', ssRes, 2), field('$SS_{tot}$', ssTot, 2), field('$R^2$', 1 - ssRes / ssTot, 3)],
      hint: md`$SS_{res} = \sum (y_i - \hat{y}_i)^2$ (erreur du modèle), $SS_{tot} = \sum (y_i - \bar{y})^2$ (erreur d'un modèle qui prédit toujours la moyenne), $R^2 = 1 - \dfrac{SS_{res}}{SS_{tot}}$.`,
      solution: md`$\bar{y} = ${num(mean)}$.

$$SS_{res} = ${err.map((e) => `${e < 0 ? `(${e})` : e}^2`).join(' + ')} = ${ssRes} \qquad SS_{tot} = ${y.map((v) => `(${v} - ${num(mean)})^2`).join(' + ')} = ${num(ssTot)}$$

$$R^2 = 1 - \frac{${ssRes}}{${num(ssTot)}} \approx ${num(1 - ssRes / ssTot, 4)}$$

$R^2 = 1$ : prédiction parfaite. $R^2 = 0$ : pas mieux que la moyenne. Il peut être **négatif** sur un jeu de test si le modèle fait pire que la moyenne.`,
    }
  },
}

const logLoss: MathExercise = {
  id: 'ml-logloss',
  title: 'Log-loss (entropie croisée binaire)',
  skill: '−[y ln p + (1−y) ln(1−p)]',
  level: 2,
  generate: (r) => {
    const ys = [1, 0, r.pick([0, 1])]
    const ps = [r.pick([0.9, 0.8, 0.6]), r.pick([0.2, 0.1, 0.3]), r.pick([0.7, 0.4, 0.5])]
    const losses = ys.map((y, i) => -(y ? Math.log(ps[i]) : Math.log(1 - ps[i])))
    return {
      params: { ys, ps },
      statement: md`Un modèle prédit la probabilité $p$ que la classe soit 1 :

| Exemple | 1 | 2 | 3 |
|---|---|---|---|
| Vraie classe $y$ | ${ys.join(' | ')} |
| $p = P(y = 1)$ | ${ps.map((p) => num(p)).join(' | ')} |

Calcule la **log-loss moyenne** (logarithme népérien). Tu peux taper une expression, comme -(ln(0.9) + ln(0.8)) / 2.`,
      fields: [field('Log-loss moyenne', losses.reduce((a, b) => a + b, 0) / 3, 3)],
      hint: md`$$L = -\frac{1}{n}\sum_i \big[y_i \ln p_i + (1 - y_i)\ln(1 - p_i)\big]$$
Pour $y = 1$ on garde $-\ln p$, pour $y = 0$ on garde $-\ln(1 - p)$.`,
      solution: md`${ys.map((y, i) => `Exemple ${i + 1} : $-\\ln(${num(y ? ps[i] : 1 - ps[i])}) \\approx ${num(losses[i], 4)}$`).join(' ; ')}.

$$L = \frac{${losses.map((l) => num(l, 4)).join(' + ')}}{3} \approx ${num(losses.reduce((a, b) => a + b, 0) / 3, 4)}$$

Une prédiction confiante et fausse coûte très cher : $-\ln(0{,}01) \approx 4{,}6$. C'est pour cela que la log-loss pousse les modèles à être **calibrés**.`,
    }
  },
}

const softmax: MathExercise = {
  id: 'ml-softmax',
  title: 'Softmax et entropie croisée',
  skill: 'pᵢ = e^zᵢ / Σ e^zⱼ',
  level: 2,
  generate: (r) => {
    const z = r.pick([[2, 1, 0], [1, 0, -1], [3, 1, 1], [2, 0, 0], [0, 1, 3]])
    const k = r.int(0, 2)
    const exps = z.map((v) => Math.exp(v))
    const s = exps.reduce((a, b) => a + b, 0)
    const p = exps.map((e) => e / s)
    return {
      params: { z, k },
      statement: md`Un réseau sort les **logits** $z = (${z.join(', ')})$ pour 3 classes.

1. Quelle probabilité la softmax donne-t-elle à la classe ${k + 1} ?
2. Si la vraie classe est la ${k + 1}, quelle est la perte d'entropie croisée ?

Tu peux taper une expression, comme e^2 / (e^2 + e + 1).`,
      fields: [field(`$p_${k + 1}$`, p[k], 3), field('Entropie croisée', -Math.log(p[k]), 3)],
      hint: md`$$\mathrm{softmax}(z)_i = \frac{e^{z_i}}{\sum_j e^{z_j}} \qquad L = -\ln p_{\text{vraie classe}}$$`,
      solution: md`$e^{z} \approx (${exps.map((e) => num(e, 3)).join(' ;\\ ')})$, de somme $${num(s, 3)}$.

$$p_${k + 1} = \frac{e^{${z[k]}}}{${z.map((v) => `e^{${v}}`).join(' + ')}} \approx \frac{${num(exps[k], 4)}}{${num(s, 4)}} \approx ${num(p[k], 4)}$$

$$L = -\ln(${num(p[k], 4)}) \approx ${num(-Math.log(p[k]), 4)}$$

Ajouter la même constante à tous les logits ne change pas la softmax : on soustrait le maximum pour éviter les dépassements numériques.`,
    }
  },
}

const entropy: MathExercise = {
  id: 'ml-entropy',
  title: 'Entropie et impureté de Gini',
  skill: 'H = −Σ p log₂ p, Gini = 1 − Σ p²',
  level: 2,
  generate: (r) => {
    const counts = r.pick([[4, 4], [4, 2, 2], [2, 2, 2, 2], [6, 2], [4, 2, 1, 1], [8, 0], [3, 1]])
    const n = counts.reduce((a, b) => a + b, 0)
    const ps = counts.filter((c) => c > 0).map((c) => c / n)
    const h = -ps.reduce((a, p) => a + p * Math.log2(p), 0)
    return {
      params: { counts },
      statement: md`Un nœud d'arbre de décision contient ${n} exemples répartis en ${counts.length} classes : ${counts.join(', ')}.

Calcule l'**entropie** (en bits) et l'**impureté de Gini** du nœud.`,
      fields: [field('Entropie $H$', h + 0, 3), field('Gini', 1 - ps.reduce((a, p) => a + p * p, 0), 3)],
      hint: md`$H = -\sum_k p_k \log_2 p_k$ (avec $0 \log 0 = 0$) et $\mathrm{Gini} = 1 - \sum_k p_k^2$, où $p_k$ est la proportion de la classe $k$.`,
      solution: md`Proportions : ${counts.map((c) => `$\\frac{${c}}{${n}}$`).join(', ')}.

$$H = -\left(${ps.map((p) => `${num(p)} \\log_2 ${num(p)}`).join(' + ')}\right) = ${num(h + 0, 4)} \text{ bits}$$

$$\mathrm{Gini} = 1 - \left(${ps.map((p) => `${num(p)}^2`).join(' + ')}\right) = ${num(1 - ps.reduce((a, p) => a + p * p, 0), 4)}$$

Les deux valent 0 pour un nœud **pur** et sont maximales quand les classes sont équilibrées (1 bit et 0,5 pour deux classes).`,
    }
  },
}

const giniSplit: MathExercise = {
  id: 'ml-gini-split',
  title: 'Choisir une coupure d’arbre',
  skill: 'Gini pondéré et gain',
  level: 3,
  generate: (r) => {
    const lp = r.int(3, 7)
    const ln = r.int(0, 3)
    const rp = r.int(0, 3)
    const rn = r.int(3, 7)
    const g = (a: number, b: number) => 1 - (a / (a + b)) ** 2 - (b / (a + b)) ** 2
    const nl = lp + ln
    const nr = rp + rn
    const n = nl + nr
    const parent = g(lp + rp, ln + rn)
    const after = (nl / n) * g(lp, ln) + (nr / n) * g(rp, rn)
    return {
      params: { lp, ln, rp, rn },
      statement: md`Un nœud contient ${lp + rp} positifs et ${ln + rn} négatifs. La coupure « âge < 30 » les sépare en :

- à gauche : ${lp} positifs, ${ln} négatifs ;
- à droite : ${rp} positifs, ${rn} négatifs.

Calcule le Gini du nœud parent, le Gini **pondéré** après la coupure, puis le **gain**.`,
      fields: [field('Gini parent', parent, 3), field('Gini pondéré après', after, 3), field('Gain', parent - after, 3)],
      hint: md`$\mathrm{Gini} = 1 - p_+^2 - p_-^2$. Après la coupure, on pondère par la taille des enfants : $\dfrac{n_g}{n}\mathrm{Gini}_g + \dfrac{n_d}{n}\mathrm{Gini}_d$. Le gain est la baisse d'impureté.`,
      solution: md`Parent : $1 - \left(\frac{${lp + rp}}{${n}}\right)^2 - \left(\frac{${ln + rn}}{${n}}\right)^2 \approx ${num(parent, 4)}$.

Gauche : $1 - \left(\frac{${lp}}{${nl}}\right)^2 - \left(\frac{${ln}}{${nl}}\right)^2 \approx ${num(g(lp, ln), 4)}$ ; droite : $1 - \left(\frac{${rp}}{${nr}}\right)^2 - \left(\frac{${rn}}{${nr}}\right)^2 \approx ${num(g(rp, rn), 4)}$.

$$\text{Pondéré} = \frac{${nl}}{${n}} \times ${num(g(lp, ln), 4)} + \frac{${nr}}{${n}} \times ${num(g(rp, rn), 4)} \approx ${num(after, 4)} \qquad \text{Gain} \approx ${num(parent - after, 4)}$$

L'arbre teste toutes les coupures possibles et garde celle qui maximise ce gain.`,
    }
  },
}

const ridge: MathExercise = {
  id: 'ml-ridge',
  title: 'Régularisation L2 (weight decay)',
  skill: 'L + λ‖w‖², gradient 2λw',
  level: 2,
  generate: (r) => {
    const w = [r.pick([-3, -2, -1, 1, 2, 3]), r.pick([-2, -1, 1, 2, 4]), r.pick([-1, 1, 3])]
    const lambda = r.pick([0.01, 0.05, 0.1])
    const mse = r.pick([1.2, 0.8, 2.5])
    const g = r.pick([0.5, -0.4, 1.0])
    const eta = 0.1
    const pen = lambda * w.reduce((a, x) => a + x * x, 0)
    const w1 = w[0] - eta * (g + 2 * lambda * w[0])
    return {
      params: { w, lambda, mse, g },
      statement: md`Un modèle a les poids $w = (${w.join(', ')})$ et une MSE de ${num(mse)}. On ajoute une pénalité **Ridge** : $L_{tot} = \mathrm{MSE} + \lambda\,\|w\|_2^2$ avec $\lambda = ${num(lambda)}$.

1. Quelle est la pénalité, et la perte totale ?
2. Le gradient de la MSE par rapport à $w_1$ vaut ${num(g)}. Avec $\eta = ${num(eta)}$, que devient $w_1$ après un pas de descente sur $L_{tot}$ ?`,
      fields: [field('Pénalité $\\lambda\\|w\\|^2$', pen, 3), field('$L_{tot}$', mse + pen, 3), field('Nouveau $w_1$', w1, 3)],
      hint: md`$\|w\|_2^2 = \sum_i w_i^2$, et $\dfrac{\partial}{\partial w_1}\lambda\|w\|_2^2 = 2\lambda w_1$. Le pas est $w_1 \leftarrow w_1 - \eta\,(g + 2\lambda w_1)$.`,
      solution: md`$$\lambda\|w\|^2 = ${num(lambda)} \times (${w.map((x) => `${x < 0 ? `(${x})` : x}^2`).join(' + ')}) = ${num(lambda)} \times ${w.reduce((a, x) => a + x * x, 0)} = ${num(pen)}$$

$$L_{tot} = ${num(mse)} + ${num(pen)} = ${num(mse + pen)}$$

$$w_1 \leftarrow ${w[0]} - ${num(eta)} \times (${num(g)} + 2 \times ${num(lambda)} \times ${w[0] < 0 ? `(${w[0]})` : w[0]}) = ${num(w1, 4)}$$

Le terme $-2\eta\lambda w_1$ « rétrécit » le poids vers 0 à chaque pas : d'où le nom de **weight decay**.`,
    }
  },
}

export const mlmathChapter: Chapter = {
  id: 'mlmath',
  title: 'Les maths du ML',
  emoji: '🤖',
  summary: 'Métriques, log-loss, softmax, entropie, Gini, régularisation.',
  lesson: md`## Métriques de classification

À partir de la **matrice de confusion** (VP, FP, FN, VN) :

| Métrique | Formule | Question |
|---|---|---|
| Accuracy | $\frac{VP + VN}{N}$ | quelle part de bonnes réponses ? |
| Précision | $\frac{VP}{VP + FP}$ | quand le modèle dit « positif », a-t-il raison ? |
| Rappel (sensibilité) | $\frac{VP}{VP + FN}$ | trouve-t-il tous les positifs ? |
| Spécificité | $\frac{VN}{VN + FP}$ | reconnaît-il les négatifs ? |
| F1 | $\frac{2PR}{P + R}$ | compromis précision / rappel |

Sur des classes **déséquilibrées**, l'accuracy est trompeuse : prédire toujours la classe majoritaire donne 99 % si 1 % des cas sont positifs.

## Métriques de régression

$$\mathrm{MSE} = \frac{1}{n}\sum (y_i - \hat{y}_i)^2 \qquad \mathrm{RMSE} = \sqrt{\mathrm{MSE}} \qquad \mathrm{MAE} = \frac{1}{n}\sum |y_i - \hat{y}_i|$$
$$R^2 = 1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2}$$

## Probabilités prédites et pertes

**Sigmoïde** (binaire) : $p = \sigma(z) = \frac{1}{1 + e^{-z}}$. **Softmax** (multi-classe) : $p_i = \frac{e^{z_i}}{\sum_j e^{z_j}}$.

**Log-loss** (entropie croisée binaire) :
$$L = -\frac{1}{n}\sum_i \big[y_i \ln p_i + (1 - y_i)\ln(1 - p_i)\big]$$
**Entropie croisée** multi-classe : $L = -\ln p_{\text{vraie classe}}$. C'est l'opposé de la log-vraisemblance : minimiser la perte revient à faire du **maximum de vraisemblance**.

## Arbres de décision

Impureté d'un nœud de proportions $p_k$ :
$$H = -\sum_k p_k \log_2 p_k \qquad \mathrm{Gini} = 1 - \sum_k p_k^2$$
Une coupure est choisie pour maximiser le **gain** : impureté du parent moins l'impureté **pondérée** des enfants.

## Régularisation

$$L_{\text{Ridge}} = L + \lambda\|w\|_2^2 \qquad L_{\text{Lasso}} = L + \lambda\|w\|_1$$
Le gradient de la pénalité L2 est $2\lambda w$ : chaque pas rapproche les poids de 0 (*weight decay*). Plus $\lambda$ est grand, plus le modèle est simple (biais ↑, variance ↓).

## Exemple résolu

$VP = 40$, $FP = 10$, $FN = 20$ : précision $= 40/50 = 0{,}8$, rappel $= 40/60 \approx 0{,}667$, $F_1 = \frac{2 \times 40}{2 \times 40 + 10 + 20} = \frac{80}{110} \approx 0{,}727$.`,
  formulas: [
    { name: 'Précision et rappel', tex: md`P = \frac{VP}{VP + FP} \qquad R = \frac{VP}{VP + FN}` },
    { name: 'F1', tex: md`F_1 = \frac{2PR}{P + R} = \frac{2\,VP}{2\,VP + FP + FN}` },
    { name: 'R²', tex: md`R^2 = 1 - \frac{SS_{res}}{SS_{tot}}` },
    { name: 'Log-loss', tex: md`L = -\frac{1}{n}\sum_i \big[y_i \ln p_i + (1 - y_i)\ln(1 - p_i)\big]` },
    { name: 'Softmax', tex: md`p_i = \frac{e^{z_i}}{\sum_j e^{z_j}}` },
    { name: 'Entropie et Gini', tex: md`H = -\sum_k p_k \log_2 p_k \qquad \mathrm{Gini} = 1 - \sum_k p_k^2` },
    { name: 'Ridge', tex: md`L + \lambda\|w\|_2^2, \quad \nabla = \nabla L + 2\lambda w` },
  ],
  exercises: [
    metrics,
    regression,
    imbalance,
    r2,
    logLoss,
    softmax,
    entropy,
    giniSplit,
    ridge,
    formulaQuiz('ml-formulas', 'Les bonnes formules', [
      {
        q: 'Le **rappel** d’un classifieur vaut :',
        correct: md`$\dfrac{VP}{VP + FN}$`,
        wrong: [md`$\dfrac{VP}{VP + FP}$`, md`$\dfrac{VP + VN}{N}$`, md`$\dfrac{VN}{VN + FP}$`],
      },
      {
        q: 'La softmax d’un vecteur de logits $z$ est :',
        correct: md`$p_i = \dfrac{e^{z_i}}{\sum_j e^{z_j}}$`,
        wrong: [md`$p_i = \dfrac{z_i}{\sum_j z_j}$`, md`$p_i = \dfrac{1}{1 + e^{-z_i}}$`, md`$p_i = \dfrac{e^{z_i}}{\prod_j e^{z_j}}$`],
      },
      {
        q: 'Pour un exemple de classe $y = 0$ prédit avec $p = P(y = 1)$, la log-loss vaut :',
        correct: md`$-\ln(1 - p)$`,
        wrong: [md`$-\ln p$`, md`$\ln(1 - p)$`, md`$-(1 - p)\ln p$`],
      },
      {
        q: 'L’impureté de Gini d’un nœud est :',
        correct: md`$1 - \sum_k p_k^2$`,
        wrong: [md`$\sum_k p_k^2$`, md`$-\sum_k p_k \log_2 p_k$`, md`$1 - \max_k p_k$`],
      },
      {
        q: 'Le $R^2$ d’un modèle qui prédit toujours la moyenne de $y$ vaut :',
        correct: '0',
        wrong: ['1', '−1', '0,5'],
      },
      {
        q: 'La régularisation qui peut mettre des poids **exactement** à zéro est :',
        correct: md`L1 (Lasso) : $\lambda\|w\|_1$`,
        wrong: [md`L2 (Ridge) : $\lambda\|w\|_2^2$`, 'le dropout', 'l’early stopping'],
      },
    ]),
  ],
}
