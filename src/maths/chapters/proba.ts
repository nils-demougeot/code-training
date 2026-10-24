import { binom, field, frac, num, type Chapter, type MathExercise } from '../core'
import { formulaQuiz } from './formulaQuiz'

const md = String.raw

const union: MathExercise = {
  id: 'p-union',
  title: 'Union de deux événements',
  skill: 'P(A ∪ B), complémentaire',
  level: 1,
  generate: (r) => {
    const a = r.int(6, 14) * 0.05
    const b = r.int(4, 12) * 0.05
    const lo = Math.max(0, Math.round((a + b - 1) * 20)) + 1
    const hi = Math.round(Math.min(a, b) * 20) - 1
    const ab = r.int(lo, Math.max(lo, hi)) * 0.05
    const u = a + b - ab
    return {
      params: { a, b, ab },
      statement: md`Sur un site, ${num(a * 100)} % des visiteurs arrivent depuis un **mobile** (événement $A$), ${num(b * 100)} % **cliquent** sur la bannière ($B$), et ${num(ab * 100)} % font les deux.

1. Quelle proportion des visiteurs est sur mobile **ou** clique ?
2. Quelle proportion n'est **ni** sur mobile **ni** ne clique ?`,
      fields: [field('$P(A \\cup B)$', u, 2), field('$P(\\overline{A} \\cap \\overline{B})$', 1 - u, 2)],
      hint: md`$P(A \cup B) = P(A) + P(B) - P(A \cap B)$ : on retire l'intersection, comptée deux fois.

« Ni A ni B » est le **complémentaire** de « A ou B ».`,
      solution: md`$$P(A \cup B) = ${num(a)} + ${num(b)} - ${num(ab)} = ${num(u)}$$

$$P(\overline{A} \cap \overline{B}) = 1 - P(A \cup B) = ${num(1 - u)}$$

(loi de De Morgan : $\overline{A \cup B} = \overline{A} \cap \overline{B}$).`,
    }
  },
}

const atLeastOne: MathExercise = {
  id: 'p-at-least-one',
  title: 'Au moins une panne',
  skill: 'Complémentaire et indépendance',
  level: 1,
  generate: (r) => {
    const n = r.int(2, 6)
    const p = r.pick([0.01, 0.02, 0.05, 0.1, 0.2])
    const ans = 1 - (1 - p) ** n
    return {
      params: { n, p },
      statement: md`Un pipeline de données dépend de **${n} services** indépendants. Chacun tombe en panne un jour donné avec une probabilité $p = ${num(p)}$.

Quelle est la probabilité qu'**au moins un** service tombe en panne ce jour-là ?`,
      fields: [field('$P(\\text{au moins une panne})$', ans, 3)],
      hint: md`« Au moins un » = complémentaire de « aucun ». Pour des événements indépendants, $P(\text{aucun}) = \prod P(\text{pas de panne}) = (1-p)^n$.`,
      solution: md`$$P(\text{aucune panne}) = (1 - ${num(p)})^{${n}} = ${num((1 - p) ** n, 4)}$$

$$P(\text{au moins une}) = 1 - ${num((1 - p) ** n, 4)} = ${num(ans, 4)}$$

C'est pour ça qu'un système avec beaucoup de dépendances tombe souvent en panne, même si chacune est fiable.`,
    }
  },
}

const counting: MathExercise = {
  id: 'p-counting',
  title: 'Combinaisons et arrangements',
  skill: 'C(n, k) et n!/(n−k)!',
  level: 1,
  generate: (r) => {
    const n = r.int(5, 12)
    const k = r.int(2, 4)
    const c = binom(n, k)
    const a = c * [1, 1, 2, 6, 24][k]
    return {
      params: { n, k },
      statement: md`Tu as **${n} variables** candidates pour un modèle.

1. De combien de façons peux-tu en choisir **${k}** (l'ordre ne compte pas) ?
2. Et si tu dois les **classer** de la 1ʳᵉ à la ${k}ᵉ place par importance (l'ordre compte) ?`,
      fields: [field('Combinaisons $\\binom{n}{k}$', c, 0), field('Arrangements', a, 0)],
      hint: md`Arrangements (ordre important) : $\dfrac{n!}{(n-k)!} = n(n-1)\cdots(n-k+1)$.

Combinaisons (ordre sans importance) : on divise par les $k!$ ordres possibles, $\dbinom{n}{k} = \dfrac{n!}{k!\,(n-k)!}$.`,
      solution: md`Arrangements : $${Array.from({ length: k }, (_, i) => n - i).join(' \\times ')} = ${a}$.

Combinaisons : $\dbinom{${n}}{${k}} = \dfrac{${a}}{${k}!} = \dfrac{${a}}{${[1, 1, 2, 6, 24][k]}} = ${c}$.`,
    }
  },
}

const conditional: MathExercise = {
  id: 'p-conditional',
  title: 'Probabilité conditionnelle sur un tableau',
  skill: 'P(A | B) = P(A ∩ B) / P(B)',
  level: 2,
  generate: (r) => {
    const freeChurn = r.int(20, 60)
    const freeStay = r.int(100, 300)
    const premChurn = r.int(5, 25)
    const premStay = r.int(80, 200)
    const free = freeChurn + freeStay
    const churn = freeChurn + premChurn
    return {
      params: { freeChurn, freeStay, premChurn, premStay },
      statement: md`Des clients d'une application, selon leur offre et s'ils se sont désabonnés (*churn*) :

| | Churn | Reste | Total |
|---|---|---|---|
| **Gratuit** | ${freeChurn} | ${freeStay} | ${free} |
| **Premium** | ${premChurn} | ${premStay} | ${premChurn + premStay} |

1. Quelle est la probabilité qu'un client **gratuit** parte ?
2. Parmi les clients **partis**, quelle proportion était gratuite ?`,
      fields: [field('$P(\\text{churn} \\mid \\text{gratuit})$', freeChurn / free, 3), field('$P(\\text{gratuit} \\mid \\text{churn})$', freeChurn / churn, 3)],
      hint: md`$P(A \mid B) = \dfrac{P(A \cap B)}{P(B)}$ : on se restreint à la **ligne** ou à la **colonne** de la condition.

Attention, $P(A \mid B) \neq P(B \mid A)$ en général.`,
      solution: md`On se place dans la ligne « Gratuit » : $P(\text{churn} \mid \text{gratuit}) = \dfrac{${freeChurn}}{${free}} \approx ${num(freeChurn / free, 4)}$.

On se place dans la colonne « Churn » : $P(\text{gratuit} \mid \text{churn}) = \dfrac{${freeChurn}}{${churn}} \approx ${num(freeChurn / churn, 4)}$.

Mêmes clients au numérateur, mais pas le même dénominateur.`,
    }
  },
}

const totalProb: MathExercise = {
  id: 'p-total',
  title: 'Probabilités totales et Bayes',
  skill: 'Formule des probabilités totales',
  level: 2,
  generate: (r) => {
    const s = r.pick([0.6, 0.65, 0.7, 0.75, 0.8])
    const d1 = r.pick([0.01, 0.02, 0.03])
    const d2 = r.pick([0.04, 0.05, 0.06, 0.08])
    const pd = s * d1 + (1 - s) * d2
    const post = (s * d1) / pd
    return {
      params: { s, d1, d2 },
      statement: md`Une usine reçoit ses capteurs de deux fournisseurs : ${num(s * 100)} % viennent de **F1**, le reste de **F2**. Le taux de défaut est de ${num(d1 * 100)} % chez F1 et ${num(d2 * 100)} % chez F2.

1. Quelle est la probabilité qu'un capteur pris au hasard soit défectueux ?
2. Un capteur est défectueux : quelle est la probabilité qu'il vienne de **F1** ?`,
      fields: [field('$P(D)$', pd, 4), field('$P(F_1 \\mid D)$', post, 3)],
      hint: md`Probabilités totales : $P(D) = P(D \mid F_1)P(F_1) + P(D \mid F_2)P(F_2)$.

Bayes : $P(F_1 \mid D) = \dfrac{P(D \mid F_1)\,P(F_1)}{P(D)}$.`,
      solution: md`$$P(D) = ${num(d1)} \times ${num(s)} + ${num(d2)} \times ${num(1 - s)} = ${num(s * d1, 4)} + ${num((1 - s) * d2, 4)} = ${num(pd, 4)}$$

$$P(F_1 \mid D) = \frac{${num(s * d1, 4)}}{${num(pd, 4)}} \approx ${num(post, 4)}$$

F1 fournit la majorité des capteurs mais, comme il est plus fiable, il ne représente que ${num(post * 100, 1)} % des défauts.`,
    }
  },
}

const bayesTest: MathExercise = {
  id: 'p-bayes-test',
  title: 'Le test médical (Bayes)',
  skill: 'Théorème de Bayes, faux positifs',
  level: 3,
  generate: (r) => {
    const prev = r.pick([0.001, 0.005, 0.01, 0.02, 0.05])
    const se = r.pick([0.9, 0.95, 0.99])
    const sp = r.pick([0.9, 0.95, 0.98, 0.99])
    const pos = se * prev + (1 - sp) * (1 - prev)
    const ans = (se * prev) / pos
    return {
      params: { prev, se, sp },
      statement: md`Une maladie touche ${num(prev * 100, 2)} % de la population. Un test la détecte chez ${num(se * 100)} % des malades (**sensibilité**) et donne un résultat négatif chez ${num(sp * 100)} % des personnes saines (**spécificité**).

1. Quelle est la probabilité qu'un test soit positif ?
2. Ton test est **positif** : quelle est la probabilité que tu sois malade ?`,
      fields: [field('$P(+)$', pos, 4), field('$P(M \\mid +)$', ans, 3)],
      hint: md`$$P(M \mid +) = \frac{P(+ \mid M)\,P(M)}{P(+ \mid M)\,P(M) + P(+ \mid \overline{M})\,P(\overline{M})}$$
avec $P(+ \mid \overline{M}) = 1 - \text{spécificité}$ (faux positifs).`,
      solution: md`Vrais positifs : $${num(se)} \times ${num(prev)} = ${num(se * prev, 5)}$. Faux positifs : $${num(1 - sp)} \times ${num(1 - prev)} = ${num((1 - sp) * (1 - prev), 5)}$.

$$P(+) = ${num(se * prev, 5)} + ${num((1 - sp) * (1 - prev), 5)} = ${num(pos, 5)}$$

$$P(M \mid +) = \frac{${num(se * prev, 5)}}{${num(pos, 5)}} \approx ${num(ans, 4)}$$

Quand la maladie est rare, les faux positifs (nombreux parmi les très nombreux sains) peuvent l'emporter : c'est le **paradoxe des faux positifs**. Même chose pour un détecteur de fraude sur des données déséquilibrées.`,
    }
  },
}

const dice: MathExercise = {
  id: 'p-dice',
  title: 'Somme de deux dés',
  skill: 'Dénombrer des cas équiprobables',
  level: 1,
  generate: (r) => {
    const s = r.int(3, 11)
    const t = r.int(7, 11)
    const eq = 6 - Math.abs(s - 7)
    let ge = 0
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b >= t) ge++
    return {
      params: { s, t },
      statement: md`On lance deux dés équilibrés à 6 faces.

1. Quelle est la probabilité que la somme vaille **${s}** ?
2. Quelle est la probabilité que la somme soit **au moins ${t}** ?

Tu peux répondre par une fraction, par exemple 5/36.`,
      fields: [field(`$P(S = ${s})$`, eq / 36, 3), field(`$P(S \\geq ${t})$`, ge / 36, 3)],
      hint: md`Il y a $6 \times 6 = 36$ couples $(d_1, d_2)$ équiprobables : $P = \dfrac{\text{cas favorables}}{36}$.`,
      solution: md`Couples de somme ${s} : ${Array.from({ length: 6 }, (_, i) => i + 1).filter((a) => s - a >= 1 && s - a <= 6).map((a) => `(${a},${s - a})`).join(', ')}, soit ${eq} cas : $P(S = ${s}) = ${frac(eq, 36)} \approx ${num(eq / 36, 4)}$.

Sommes $\geq ${t}$ : ${Array.from({ length: 13 - t }, (_, i) => t + i).map((v) => `${6 - Math.abs(v - 7)}`).join(' + ')} $= ${ge}$ cas, donc $P(S \geq ${t}) = ${frac(ge, 36)} \approx ${num(ge / 36, 4)}$.`,
    }
  },
}

export const probaChapter: Chapter = {
  id: 'proba',
  title: 'Probabilités',
  emoji: '🎲',
  summary: 'Union, complémentaire, conditionnelles, Bayes et dénombrement.',
  lesson: md`## Le vocabulaire

- Une **expérience aléatoire** a un ensemble de résultats possibles $\Omega$ (l'univers).
- Un **événement** $A$ est un sous-ensemble de $\Omega$ ; sa probabilité vérifie $0 \le P(A) \le 1$ et $P(\Omega) = 1$.
- Si les résultats sont **équiprobables** : $P(A) = \dfrac{|A|}{|\Omega|}$ (cas favorables sur cas possibles).

## Les règles de calcul

**Complémentaire** : $P(\overline{A}) = 1 - P(A)$. Le réflexe pour « au moins un » : $P(\text{au moins un}) = 1 - P(\text{aucun})$.

**Union** : $P(A \cup B) = P(A) + P(B) - P(A \cap B)$. Si $A$ et $B$ sont **incompatibles** ($A \cap B = \emptyset$), les probabilités s'additionnent.

**Probabilité conditionnelle** : la probabilité de $A$ *sachant* que $B$ est réalisé,
$$P(A \mid B) = \frac{P(A \cap B)}{P(B)}$$
On restreint l'univers à $B$. En général $P(A \mid B) \neq P(B \mid A)$ (« la plupart des malades toussent » ≠ « la plupart des gens qui toussent sont malades »).

**Indépendance** : $A$ et $B$ sont indépendants si $P(A \cap B) = P(A)\,P(B)$, c'est-à-dire $P(A \mid B) = P(A)$.

**Probabilités totales** : si $B_1, \dots, B_k$ partitionnent $\Omega$,
$$P(A) = \sum_i P(A \mid B_i)\,P(B_i)$$

**Théorème de Bayes** : il « retourne » une conditionnelle,
$$P(B \mid A) = \frac{P(A \mid B)\,P(B)}{P(A)}$$
$P(B)$ est le **prior**, $P(A \mid B)$ la **vraisemblance**, $P(B \mid A)$ le **posterior**.

## Dénombrer

| Situation | Formule | Exemple |
|---|---|---|
| Ordonner $n$ objets | $n!$ | 4 tâches : $4! = 24$ ordres |
| Choisir $k$ parmi $n$, **ordre important** | $\dfrac{n!}{(n-k)!}$ | podium de 3 parmi 10 : $720$ |
| Choisir $k$ parmi $n$, ordre sans importance | $\dbinom{n}{k} = \dfrac{n!}{k!\,(n-k)!}$ | 3 variables parmi 10 : $120$ |

## Exemple résolu

*1 % des transactions sont frauduleuses. Un modèle signale 90 % des fraudes et 5 % des transactions normales. Une transaction est signalée : probabilité de fraude ?*

$$P(F \mid S) = \frac{0{,}9 \times 0{,}01}{0{,}9 \times 0{,}01 + 0{,}05 \times 0{,}99} = \frac{0{,}009}{0{,}0585} \approx 0{,}154$$

Seulement 15 % des alertes sont de vraies fraudes : c'est la **précision** du modèle, et elle s'effondre quand la classe positive est rare.`,
  formulas: [
    { name: 'Complémentaire', tex: md`P(\overline{A}) = 1 - P(A)` },
    { name: 'Union', tex: md`P(A \cup B) = P(A) + P(B) - P(A \cap B)` },
    { name: 'Conditionnelle', tex: md`P(A \mid B) = \frac{P(A \cap B)}{P(B)}` },
    { name: 'Indépendance', tex: md`P(A \cap B) = P(A)\,P(B)` },
    { name: 'Probabilités totales', tex: md`P(A) = \sum_i P(A \mid B_i)\,P(B_i)` },
    { name: 'Bayes', tex: md`P(B \mid A) = \frac{P(A \mid B)\,P(B)}{P(A)}` },
    { name: 'Combinaisons', tex: md`\binom{n}{k} = \frac{n!}{k!\,(n-k)!}` },
  ],
  exercises: [
    union,
    atLeastOne,
    dice,
    counting,
    conditional,
    totalProb,
    bayesTest,
    formulaQuiz('p-formulas', 'Les bonnes formules', [
      {
        q: 'Deux événements $A$ et $B$ sont **indépendants** si et seulement si :',
        correct: md`$P(A \cap B) = P(A)\,P(B)$`,
        wrong: [md`$P(A \cup B) = P(A) + P(B)$`, md`$P(A \cap B) = 0$`, md`$P(A \mid B) = P(B \mid A)$`],
      },
      {
        q: 'Le théorème de **Bayes** s’écrit :',
        correct: md`$P(B \mid A) = \dfrac{P(A \mid B)\,P(B)}{P(A)}$`,
        wrong: [md`$P(B \mid A) = \dfrac{P(A \mid B)\,P(A)}{P(B)}$`, md`$P(B \mid A) = P(A \mid B)\,P(A)\,P(B)$`, md`$P(B \mid A) = \dfrac{P(A \cap B)}{P(A)\,P(B)}$`],
      },
      {
        q: 'Deux événements **incompatibles** (qui ne peuvent pas se produire ensemble) vérifient :',
        correct: md`$P(A \cup B) = P(A) + P(B)$`,
        wrong: [md`$P(A \cap B) = P(A)\,P(B)$`, md`$P(A \cup B) = 1$`, md`$P(A \mid B) = P(A)$`],
      },
      {
        q: 'Le nombre de façons de choisir $k$ éléments parmi $n$ **sans tenir compte de l’ordre** est :',
        correct: md`$\dfrac{n!}{k!\,(n-k)!}$`,
        wrong: [md`$\dfrac{n!}{(n-k)!}$`, md`$n^k$`, md`$\dfrac{n!}{k!}$`],
      },
      {
        q: 'La probabilité d’obtenir **au moins un** succès en $n$ essais indépendants de probabilité $p$ est :',
        correct: md`$1 - (1-p)^n$`,
        wrong: [md`$n\,p$`, md`$1 - p^n$`, md`$(1-p)^n$`],
      },
      {
        q: 'Que vaut $P(A \mid B)$ ?',
        correct: md`$\dfrac{P(A \cap B)}{P(B)}$`,
        wrong: [md`$\dfrac{P(A \cap B)}{P(A)}$`, md`$P(A)\,P(B)$`, md`$\dfrac{P(A)}{P(B)}$`],
      },
    ]),
  ],
}

