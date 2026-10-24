import { rng } from '@/labs/ml'

type Rng = ReturnType<typeof rng>

export interface Puzzle {
  id: string
  emoji: string
  title: string
  question: string
  kind: 'percent' | 'number'
  /** Exact answer: a probability in [0, 1] for "percent", a value for "number". */
  answer: number
  /** Slider range for "number" puzzles. */
  range?: [number, number]
  log?: boolean
  unit?: string
  /** One random trial. Returns null when the trial does not count (conditional probability). */
  trial: (r: Rng) => number | null
  estimator: 'mean' | 'median'
  /** What the simulation estimates, and its exact value (defaults to the answer). */
  simLabel: string
  simTarget?: number
  trials: number
  explain: string
}

const normal = (r: Rng) => r.normal()

/** Two-proportion z-test on simulated conversions (normal approximation of the binomial). */
function abTestSignificant(r: Rng, n: number, pA: number, pB: number): boolean {
  const convA = n * pA + Math.sqrt(n * pA * (1 - pA)) * normal(r)
  const convB = n * pB + Math.sqrt(n * pB * (1 - pB)) * normal(r)
  const a = convA / n
  const b = convB / n
  const p = (convA + convB) / (2 * n)
  const z = (b - a) / Math.sqrt(p * (1 - p) * (2 / n))
  return Math.abs(z) > 1.959964
}

export const PUZZLES: Puzzle[] = [
  {
    id: 'birthday',
    emoji: '🎂',
    title: 'Le paradoxe des anniversaires',
    question: 'Dans une classe de **23 élèves**, quelle est la probabilité qu’au moins deux d’entre eux soient nés le même jour de l’année ?',
    kind: 'percent',
    answer: 0.5073,
    trial: (r) => {
      const seen = new Set<number>()
      for (let i = 0; i < 23; i++) {
        const d = Math.floor(r.next() * 365)
        if (seen.has(d)) return 1
        seen.add(d)
      }
      return 0
    },
    estimator: 'mean',
    simLabel: 'Classes de 23 élèves simulées',
    trials: 20_000,
    explain: `**50,7 %.** L’intuition se trompe parce qu’elle pense « quelqu’un né le même jour que *moi* ». Or on compare **toutes les paires** : 23 × 22 / 2 = **253 paires**.

On calcule le contraire, « tous différents » :
$$P = 1 - \\frac{365}{365} \\times \\frac{364}{365} \\times \\dots \\times \\frac{343}{365} \\approx 0{,}507$$

Leçon pour la data : le nombre de comparaisons grandit en n², d’où les **collisions de hash** et les **faux positifs** quand on teste beaucoup de paires.

\`\`\`python
rng = np.random.default_rng(0)
days = rng.integers(0, 365, size=(100_000, 23))
np.mean([len(set(row)) < 23 for row in days])
\`\`\``,
  },
  {
    id: 'your-birthday',
    emoji: '🎁',
    title: 'Quelqu’un né le même jour que toi',
    question: 'Combien de personnes faut-il réunir pour avoir **au moins 50 % de chances** que l’une d’elles soit née **le même jour que toi** ?',
    kind: 'number',
    answer: 253,
    range: [10, 1000],
    log: true,
    unit: 'personnes',
    trial: (r) => {
      // Number of people met until a match: geometric with p = 1/365.
      let n = 1
      while (r.next() >= 1 / 365) n++
      return n
    },
    estimator: 'median',
    simLabel: 'Nombre de personnes rencontrées avant de trouver ton jumeau d’anniversaire (médiane)',
    trials: 6_000,
    explain: `**253 personnes**, onze fois plus qu’au défi précédent : ici chaque personne n’a qu’**une** chance sur 365 de « matcher » avec toi, il n’y a pas de paires entre les autres.

$$1 - \\left(\\tfrac{364}{365}\\right)^n \\ge 0{,}5 \\iff n \\ge \\frac{\\ln 0{,}5}{\\ln(364/365)} \\approx 252{,}7$$

C’est une **loi géométrique** : la médiane (253) est bien plus petite que la moyenne (365).`,
  },
  {
    id: 'monty-hall',
    emoji: '🚪',
    title: 'Le problème de Monty Hall',
    question: 'Trois portes : une voiture derrière l’une, des chèvres derrière les autres. Tu choisis la porte 1. Le présentateur, **qui sait où est la voiture**, ouvre une porte avec une chèvre. Si tu **changes** de porte, quelle est ta probabilité de gagner ?',
    kind: 'percent',
    answer: 2 / 3,
    trial: (r) => {
      const car = Math.floor(r.next() * 3)
      const pick = 0
      // Switching wins exactly when the first pick was wrong.
      return car !== pick ? 1 : 0
    },
    estimator: 'mean',
    simLabel: 'Parties jouées en changeant de porte',
    trials: 20_000,
    explain: `**2/3.** Ton premier choix a 1 chance sur 3 d’être bon, et le présentateur ne change rien à ça. Les 2/3 restants se concentrent sur **l’autre porte fermée**, car le présentateur a éliminé une chèvre **en connaissance de cause**.

Version intuitive : avec 100 portes, tu en choisis une, il ouvre 98 chèvres. Garderais-tu la tienne ?

Leçon : l’information n’est pas neutre quand **le processus qui la génère** dépend de ce qu’on cherche (biais de sélection).`,
  },
  {
    id: 'screening',
    emoji: '🧪',
    title: 'Le test de dépistage',
    question: 'Une maladie touche **1 %** de la population. Le test détecte **99 %** des malades, mais donne un résultat positif à **5 %** des personnes saines. Ton test est **positif**. Quelle est la probabilité que tu sois malade ?',
    kind: 'percent',
    answer: 1 / 6,
    trial: (r) => {
      const sick = r.next() < 0.01
      const positive = sick ? r.next() < 0.99 : r.next() < 0.05
      if (!positive) return null
      return sick ? 1 : 0
    },
    estimator: 'mean',
    simLabel: 'Personnes testées positives : part de vrais malades',
    trials: 120_000,
    explain: `**Environ 17 %** seulement : c’est le **théorème de Bayes** et l’oubli du **taux de base**.

Sur 10 000 personnes : 100 malades → 99 positifs ; 9 900 saines → 495 faux positifs. Parmi les 594 positifs, seuls 99 sont malades :
$$P(M \\mid +) = \\frac{0{,}01 \\times 0{,}99}{0{,}01 \\times 0{,}99 + 0{,}99 \\times 0{,}05} \\approx 0{,}167$$

En ML, c’est exactement la **precision** d’un classifieur sur une classe rare : un bon recall et 5 % de faux positifs donnent une precision médiocre quand la classe est rare (fraude, maladie). Le lab **Bayes** le montre visuellement.`,
  },
  {
    id: 'dice-six',
    emoji: '🎲',
    title: 'Au moins un 6',
    question: 'Tu lances un dé **4 fois**. Quelle est la probabilité d’obtenir **au moins un 6** ?',
    kind: 'percent',
    answer: 1 - (5 / 6) ** 4,
    trial: (r) => {
      for (let i = 0; i < 4; i++) if (Math.floor(r.next() * 6) === 5) return 1
      return 0
    },
    estimator: 'mean',
    simLabel: 'Séries de 4 lancers',
    trials: 20_000,
    explain: `**51,8 %.** Le réflexe « 4 × 1/6 = 66 % » est faux : on compterait plusieurs fois les cas avec deux 6 (et avec 7 lancers on dépasserait 100 %).

Le bon réflexe pour « au moins un » : passer par le **complémentaire**.
$$P(\\text{au moins un } 6) = 1 - P(\\text{aucun } 6) = 1 - \\left(\\tfrac56\\right)^4 \\approx 0{,}518$$

Historiquement, c’est le pari du chevalier de Méré, qui a lancé Pascal et Fermat dans la théorie des probabilités.`,
  },
  {
    id: 'five-heads',
    emoji: '🪙',
    title: 'Exactement la moitié',
    question: 'Tu lances une pièce équilibrée **10 fois**. Quelle est la probabilité d’obtenir **exactement 5 piles** ?',
    kind: 'percent',
    answer: 252 / 1024,
    trial: (r) => {
      let heads = 0
      for (let i = 0; i < 10; i++) if (r.next() < 0.5) heads++
      return heads === 5 ? 1 : 0
    },
    estimator: 'mean',
    simLabel: 'Séries de 10 lancers',
    trials: 20_000,
    explain: `**24,6 %.** 5 piles est le résultat **le plus probable**, mais il reste minoritaire : la masse se répartit sur 4, 5, 6 et au-delà.

C’est la **loi binomiale** :
$$P(X = 5) = \\binom{10}{5} \\left(\\tfrac12\\right)^{10} = \\frac{252}{1024}$$

Avec 1 000 lancers, P(exactement 500) tombe à 2,5 %. Ce qui converge, c’est la **proportion** de piles vers 50 % (loi des grands nombres), pas le **nombre exact**.

\`\`\`python
from scipy import stats
stats.binom(n=10, p=0.5).pmf(5)
\`\`\``,
  },
  {
    id: 'streak',
    emoji: '🔥',
    title: 'La série improbable',
    question: 'Tu lances une pièce **100 fois**. Quelle est la probabilité d’observer au moins **6 résultats identiques d’affilée** (6 piles ou 6 faces consécutifs) ?',
    kind: 'percent',
    answer: 0.8068,
    trial: (r) => {
      let prev = -1
      let run = 0
      for (let i = 0; i < 100; i++) {
        const x = r.next() < 0.5 ? 1 : 0
        run = x === prev ? run + 1 : 1
        prev = x
        if (run >= 6) return 1
      }
      return 0
    },
    estimator: 'mean',
    simLabel: 'Séries de 100 lancers',
    trials: 12_000,
    explain: `**81 %.** Le hasard produit **beaucoup plus de séries** qu’on ne l’imagine. Quand on demande à des gens d’inventer une suite « aléatoire », ils alternent trop et n’écrivent presque jamais 6 fois la même chose : c’est un test classique pour repérer de fausses données.

Leçon : une série de 6 semaines où une métrique monte n’est pas forcément une tendance. Méfie-toi de « la main chaude ».

Calcul exact par programmation dynamique sur la longueur de la série en cours, ou par simulation.`,
  },
  {
    id: 'multiple-tests',
    emoji: '🔬',
    title: 'Vingt tests sans effet',
    question: 'Tu testes **20 variantes** d’un bouton qui n’ont en réalité **aucun effet**, chacune avec un test au seuil α = 5 %. Quelle est la probabilité qu’**au moins un test** soit « significatif » ?',
    kind: 'percent',
    answer: 1 - 0.95 ** 20,
    trial: (r) => {
      for (let i = 0; i < 20; i++) if (r.next() < 0.05) return 1
      return 0
    },
    estimator: 'mean',
    simLabel: 'Campagnes de 20 tests sans effet',
    trials: 20_000,
    explain: `**64 %.** Sous l’hypothèse nulle, la p-value est **uniforme** : chaque test a 5 % de chances d’être un faux positif. Avec 20 tests :
$$1 - 0{,}95^{20} \\approx 0{,}64$$

C’est le problème des **comparaisons multiples** (et du *p-hacking*). Remèdes : correction de **Bonferroni** (α / 20), contrôle du taux de fausses découvertes (Benjamini-Hochberg), ou un test confirmatoire sur de nouvelles données.`,
  },
  {
    id: 'coupons',
    emoji: '🃏',
    title: 'L’album de cartes',
    question: 'Chaque paquet de céréales contient une carte parmi **10 cartes** différentes, au hasard. Combien de paquets faut-il acheter **en moyenne** pour compléter la collection ?',
    kind: 'number',
    answer: 29.29,
    range: [10, 100],
    unit: 'paquets',
    trial: (r) => {
      const got = new Set<number>()
      let n = 0
      while (got.size < 10) {
        got.add(Math.floor(r.next() * 10))
        n++
      }
      return n
    },
    estimator: 'mean',
    simLabel: 'Collections complétées (moyenne des paquets achetés)',
    trials: 8_000,
    explain: `**≈ 29,3 paquets**, trois fois plus que 10. Les dernières cartes sont les plus dures : quand il en manque une seule, il faut en moyenne **10 paquets** pour la trouver.

C’est le **problème du collectionneur de coupons** : on additionne les espérances de lois géométriques,
$$E = 10 \\left(\\tfrac{1}{10} + \\tfrac{1}{9} + \\dots + \\tfrac11\\right) = 10 \\cdot H_{10} \\approx 29{,}3$$

En data : combien de requêtes aléatoires pour couvrir tout un catalogue, combien d’échantillons pour voir toutes les classes rares.`,
  },
  {
    id: 'two-children',
    emoji: '👧',
    title: 'Le paradoxe des deux enfants',
    question: 'Une famille a **deux enfants**. Tu sais qu’**au moins l’un des deux est un garçon**. Quelle est la probabilité que les **deux** soient des garçons ?',
    kind: 'percent',
    answer: 1 / 3,
    trial: (r) => {
      const a = r.next() < 0.5
      const b = r.next() < 0.5
      if (!a && !b) return null
      return a && b ? 1 : 0
    },
    estimator: 'mean',
    simLabel: 'Familles avec au moins un garçon : part avec deux garçons',
    trials: 20_000,
    explain: `**1/3**, pas 1/2. Familles possibles, équiprobables : GG, GF, FG, FF. « Au moins un garçon » élimine seulement FF, il reste **GG, GF, FG** : un cas sur trois.

Si l’on savait que **l’aîné** est un garçon, la réponse serait 1/2 (il ne resterait que GG et GF). La façon dont on obtient l’information change la probabilité conditionnelle : c’est un piège classique d’entretien.`,
  },
  {
    id: 'ab-sample-size',
    emoji: '📈',
    title: 'Taille d’un A/B test',
    question: 'Ton taux de conversion est de **10 %**. Tu veux détecter un passage à **11 %** avec un test bilatéral (α = 5 %) et une **puissance de 80 %**. Combien d’utilisateurs faut-il **par groupe** ?',
    kind: 'number',
    answer: 14751,
    range: [100, 200_000],
    log: true,
    unit: 'par groupe',
    trial: (r) => (abTestSignificant(r, 14751, 0.1, 0.11) ? 1 : 0),
    estimator: 'mean',
    simLabel: 'A/B tests simulés avec 14 751 utilisateurs par groupe : part qui détecte l’effet (la puissance)',
    simTarget: 0.8,
    trials: 6_000,
    explain: `**≈ 14 750 par groupe**, soit près de 30 000 utilisateurs. Détecter un petit effet demande beaucoup de données, car la taille nécessaire varie en **1 / effet²** : viser +2 points au lieu de +1 divise l’échantillon par 4.

$$n \\approx \\frac{\\left(z_{1-\\alpha/2}\\sqrt{2\\bar p(1-\\bar p)} + z_{1-\\beta}\\sqrt{p_1(1-p_1)+p_2(1-p_2)}\\right)^2}{(p_2 - p_1)^2}$$

La simulation confirme : avec cette taille, environ **80 %** des tests détectent l’effet (la **puissance**). Les 20 % restants sont des faux négatifs. Le lab **A/B test** permet de jouer avec ces paramètres.

\`\`\`python
from statsmodels.stats.power import NormalIndPower
from statsmodels.stats.proportion import proportion_effectsize
NormalIndPower().solve_power(proportion_effectsize(0.11, 0.10), alpha=0.05, power=0.8)
\`\`\``,
  },
]

export const puzzleById = new Map(PUZZLES.map((p) => [p.id, p]))

/** 0–3 stars depending on how close the guess is. */
export function starsFor(p: Puzzle, guess: number): number {
  if (p.kind === 'percent') {
    const d = Math.abs(guess - p.answer) * 100
    return d <= 5 ? 3 : d <= 12 ? 2 : d <= 25 ? 1 : 0
  }
  const ratio = Math.max(guess, p.answer) / Math.max(1e-9, Math.min(guess, p.answer))
  return ratio <= 1.15 ? 3 : ratio <= 1.5 ? 2 : ratio <= 2.5 ? 1 : 0
}

export function formatAnswer(p: Puzzle, v: number): string {
  if (p.kind === 'percent') return `${(v * 100).toFixed(1).replace('.', ',')} %`
  return `${v >= 100 ? Math.round(v).toLocaleString('fr-FR') : v.toFixed(1).replace('.', ',')}${p.unit ? ` ${p.unit}` : ''}`
}
