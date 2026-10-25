import type { Rng } from '@/maths/core'

/** A mental-arithmetic question. `expr` recomputes the answer in Python (checked by the validator). */
export interface Problem {
  text: string
  answer: number
  expr: string
  /** Key of the trick shown after a mistake. */
  kind: TipKey
  /** Unit of the expected answer, shown next to the input (e.g. "M€", "%"). */
  unit?: string
}

export interface Level {
  id: number
  name: string
  emoji: string
  desc: string
  sample: string
  /** Points multiplier. */
  weight: number
  /** Seconds per question at the start of a survival game. */
  seconds: number
  gen: (r: Rng) => Problem
}

/** French number formatting: thin space for thousands, decimal comma. */
export function fr(x: number) {
  const [int, dec] = String(Math.abs(Number(x.toFixed(3)))).split('.')
  const grouped = int.length > 4 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : int
  return (x < 0 ? '−' : '') + grouped + (dec ? `,${dec}` : '')
}

const round = (x: number) => Math.round(x * 1000) / 1000

function add(r: Rng, lo: number, hi: number): Problem {
  const a = r.int(lo, hi)
  const b = r.int(lo, hi)
  return { text: `${fr(a)} + ${fr(b)}`, answer: a + b, expr: `${a} + ${b}`, kind: 'add' }
}

function sub(r: Rng, lo: number, hi: number): Problem {
  let a = r.int(lo, hi)
  let b = r.int(lo, hi)
  if (a === b) a += r.int(1, 9)
  if (a < b) [a, b] = [b, a]
  return { text: `${fr(a)} − ${fr(b)}`, answer: a - b, expr: `${a} - ${b}`, kind: 'sub' }
}

function mul(a: number, b: number, kind: TipKey = 'mul'): Problem {
  return { text: `${fr(a)} × ${fr(b)}`, answer: a * b, expr: `${a} * ${b}`, kind }
}

function div(r: Rng, divisor: [number, number], quotient: [number, number]): Problem {
  const b = r.int(...divisor)
  const q = r.int(...quotient)
  return { text: `${fr(b * q)} ÷ ${b}`, answer: q, expr: `${b * q} // ${b}`, kind: 'div' }
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

export const LEVELS: Level[] = [
  {
    id: 1,
    name: 'Échauffement',
    emoji: '🐣',
    desc: 'Additions et soustractions jusqu’à 40',
    sample: '17 + 8',
    weight: 1,
    seconds: 8,
    gen: (r) => (r.next() < 0.55 ? add(r, 2, 20) : sub(r, 2, 40)),
  },
  {
    id: 2,
    name: 'Tables',
    emoji: '✖️',
    desc: 'Tables de 2 à 12 et divisions exactes',
    sample: '7 × 8',
    weight: 1.5,
    seconds: 7,
    gen: (r) => (r.next() < 0.65 ? mul(r.int(2, 12), r.int(2, 12)) : div(r, [2, 12], [2, 12])),
  },
  {
    id: 3,
    name: 'Intermédiaire',
    emoji: '🧮',
    desc: 'Deux chiffres : +, −, × un chiffre, ÷, × 5',
    sample: '47 + 38',
    weight: 2,
    seconds: 11,
    gen: (r) => {
      const k = r.int(0, 4)
      if (k === 0) return add(r, 11, 99)
      if (k === 1) return sub(r, 11, 99)
      if (k === 2) return mul(r.int(12, 99), r.int(3, 9))
      if (k === 3) return div(r, [3, 9], [11, 40])
      return mul(r.int(12, 98), 5, 'mul5')
    },
  },
  {
    id: 4,
    name: 'Avancé',
    emoji: '🚀',
    desc: '2 chiffres × 2 chiffres, carrés, × 11, × 25, trois chiffres',
    sample: '23 × 14',
    weight: 3,
    seconds: 15,
    gen: (r) => {
      const k = r.int(0, 5)
      if (k === 0) return mul(r.int(12, 49), r.int(11, 19), 'mul2d')
      if (k === 1) {
        const a = r.next() < 0.4 ? r.int(1, 9) * 10 + 5 : r.int(11, 30)
        return { text: `${a}²`, answer: a * a, expr: `${a} ** 2`, kind: a % 10 === 5 ? 'square5' : 'square' }
      }
      if (k === 2) return mul(r.int(12, 99), 11, 'mul11')
      if (k === 3) return mul(r.int(4, 40), 25, 'mul25')
      if (k === 4) return add(r, 101, 999)
      return sub(r, 101, 999)
    },
  },
  {
    id: 5,
    name: 'Pourcentages',
    emoji: '💯',
    desc: 'Pourcentages, fractions, variations',
    sample: '15 % de 240',
    weight: 3,
    seconds: 15,
    gen: (r) => {
      const k = r.int(0, 3)
      if (k === 0) {
        const p = r.pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75])
        const step = 100 / gcd(p, 100)
        const y = step * r.int(Math.ceil(20 / step), Math.floor(800 / step))
        return { text: `${p} % de ${fr(y)}`, answer: (p * y) / 100, expr: `${p} * ${y} / 100`, kind: 'pct' }
      }
      if (k === 1) {
        const d = r.pick([2, 3, 4, 5, 8, 10])
        const n = r.int(1, d - 1)
        const y = d * r.int(3, 40)
        const g = gcd(n, d)
        return { text: `${n / g}/${d / g} de ${fr(y)}`, answer: (n * y) / d, expr: `${n} * ${y} / ${d}`, kind: 'fraction' }
      }
      if (k === 2) {
        const a = r.pick([20, 40, 50, 80, 120, 200, 250, 400, 500])
        const p = r.pick([-50, -25, -20, -10, 10, 20, 25, 50, 100, 150])
        const b = (a * (100 + p)) / 100
        return { text: `De ${fr(a)} à ${fr(b)} : variation en %`, answer: p, expr: `(${b} - ${a}) / ${a} * 100`, kind: 'growth', unit: '%' }
      }
      const a = r.pick([40, 60, 80, 120, 150, 200, 240, 300])
      const p = r.pick([-25, -20, -10, 10, 20, 25, 50])
      return { text: `${fr(a)} ${p > 0 ? '+' : '−'} ${Math.abs(p)} %`, answer: (a * (100 + p)) / 100, expr: `${a} * (100 + ${p}) / 100`, kind: 'pctchange' }
    },
  },
  {
    id: 6,
    name: 'Consultant',
    emoji: '💼',
    desc: 'Ordres de grandeur d’un entretien de cas : M, k€, part de marché, règle de 72',
    sample: '60 M × 25 % × 40 €',
    weight: 4,
    seconds: 22,
    gen: (r) => {
      const k = r.int(0, 4)
      if (k === 0) {
        const a = r.pick([1.2, 2.4, 3.2, 4.5, 6, 8, 12, 15, 24, 40, 60, 80])
        const p = r.pick([5, 10, 15, 20, 25, 30, 40, 50])
        return { text: `${fr(a)} M × ${p} %`, answer: round((a * p) / 100), expr: `${a} * ${p} / 100`, kind: 'big', unit: 'M' }
      }
      if (k === 1) {
        const pop = r.pick([10, 20, 40, 60, 80])
        const share = r.pick([10, 20, 25, 50])
        const price = r.pick([2, 5, 10, 20, 40, 50, 100])
        return {
          text: `${pop} M clients × ${share} % × ${price} €`,
          answer: round((pop * share * price) / 100),
          expr: `${pop} * ${share} / 100 * ${price}`,
          kind: 'sizing',
          unit: 'M€',
        }
      }
      if (k === 2) {
        const a = r.pick([800, 1000, 1200, 1500, 2000, 2500])
        const d = r.pick([200, 220, 250])
        return { text: `${fr(a)} € × ${d} jours`, answer: round((a * d) / 1000), expr: `${a} * ${d} / 1000`, kind: 'big', unit: 'k€' }
      }
      if (k === 3) {
        const d = r.pick([3, 4, 5, 6, 8, 12, 20, 25, 30, 40, 50])
        const q = r.int(5, 60)
        return { text: `${fr(d * q)} k€ ÷ ${d}`, answer: q, expr: `${d * q} / ${d}`, kind: 'bigdiv', unit: 'k€' }
      }
      const rate = r.pick([2, 3, 4, 6, 8, 9, 12, 18, 24])
      return { text: `À ${rate} % par an, doubler prend… (règle de 72)`, answer: 72 / rate, expr: `72 / ${rate}`, kind: 'rule72', unit: 'ans' }
    },
  },
]

export const levelById = new Map(LEVELS.map((l) => [l.id, l]))

/** The daily challenge: 10 questions of increasing difficulty, the same for everyone on a given day. */
export const DAILY_LEVELS = [2, 2, 3, 3, 4, 4, 5, 5, 6, 6]

export type TipKey =
  | 'add' | 'sub' | 'mul' | 'div' | 'mul5' | 'mul2d' | 'square' | 'square5' | 'mul11' | 'mul25'
  | 'pct' | 'fraction' | 'growth' | 'pctchange' | 'big' | 'sizing' | 'bigdiv' | 'rule72'

export const TIPS: Record<TipKey, { title: string; text: string }> = {
  add: { title: 'Compléter à la dizaine', text: '47 + 38 : 47 + 3 = 50, puis 50 + 35 = 85. On arrondit un nombre, puis on ajoute le reste.' },
  sub: { title: 'Soustraire par étapes', text: '83 − 47 : 83 − 50 = 33, puis on rend les 3 enlevés en trop : 36.' },
  mul: { title: 'Les tables', text: 'Les plus ratées : 6 × 7 = 42, 6 × 8 = 48, 7 × 8 = 56, 8 × 9 = 72. Et a × b = b × a : 9 × 4 se lit 4 × 9.' },
  div: { title: 'La table à l’envers', text: '56 ÷ 7 : cherche 7 × ? = 56. Pour 252 ÷ 6 : 240 ÷ 6 = 40 et 12 ÷ 6 = 2, donc 42.' },
  mul5: { title: '× 5 = × 10 ÷ 2', text: '46 × 5 = 460 ÷ 2 = 230.' },
  mul2d: { title: 'Décomposer', text: '34 × 17 = 34 × 10 + 34 × 7 = 340 + 238 = 578. Ou 34 × 17 = 34 × 20 − 34 × 3.' },
  square: { title: 'Identité remarquable', text: '23² = 20² + 2 × 20 × 3 + 3² = 400 + 120 + 9 = 529.' },
  square5: { title: 'Carré d’un nombre finissant par 5', text: '65² : 6 × 7 = 42, puis on écrit 25 : 4225.' },
  mul11: { title: '× 11', text: '43 × 11 : on écarte 4 et 3 et on met leur somme au milieu : 473. Si la somme dépasse 9, on retient : 78 × 11 = 7|15|8 = 858.' },
  mul25: { title: '× 25 = × 100 ÷ 4', text: '36 × 25 = 3600 ÷ 4 = 900.' },
  pct: { title: 'Pourcentages par morceaux', text: '15 % de 240 = 10 % (24) + 5 % (12) = 36. Et x % de y = y % de x : 8 % de 50 = 50 % de 8 = 4.' },
  fraction: { title: 'Diviser puis multiplier', text: '3/4 de 120 : 120 ÷ 4 = 30, puis × 3 = 90.' },
  growth: { title: 'Variation en %', text: '(arrivée − départ) ÷ départ. De 80 à 100 : +20 sur 80, soit +25 %.' },
  pctchange: { title: 'Coefficient multiplicateur', text: '+25 % = × 1,25 ; −20 % = × 0,8. 80 + 25 % = 80 + 20 = 100.' },
  big: { title: 'Les zéros à part', text: 'Calcule sur les chiffres et garde l’unité : 3,2 M × 15 % = 3,2 × 0,15 = 0,48 M. 1 200 € × 250 = 300 000 € = 300 k€.' },
  sizing: { title: 'Taille de marché', text: '60 M × 25 % = 15 M clients, × 40 € = 600 M€. Enchaîne les multiplications en simplifiant d’abord les pourcentages.' },
  bigdiv: { title: 'Diviser en simplifiant', text: '450 ÷ 30 = 45 ÷ 3 = 15 : on enlève le même zéro des deux côtés.' },
  rule72: { title: 'Règle de 72', text: 'Un montant qui croît de r % par an double en environ 72 ÷ r ans : à 8 %, 9 ans.' },
}

/** Parses what the player typed ("−12", "0,48", "1 200"). */
export function parseTyped(s: string): number | null {
  const t = s.replace(/[\s ]/g, '').replace(',', '.').replace('−', '-')
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

export const isRight = (typed: string, answer: number) => {
  const v = parseTyped(typed)
  return v !== null && Math.abs(v - answer) < 1e-9
}
