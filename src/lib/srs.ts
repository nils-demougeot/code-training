// Spaced repetition (SM-2 variant). Used for syntax flashcards and for re-solving exercises.

export interface SrsState {
  due: number
  /** Interval in days. 0 = learning step. */
  interval: number
  ease: number
  reps: number
  lapses: number
  last: number
}

/** 0 = À revoir, 1 = Difficile, 2 = Bien, 3 = Facile */
export type Grade = 0 | 1 | 2 | 3

export const GRADES: { grade: Grade; label: string; key: string }[] = [
  { grade: 0, label: 'À revoir', key: '1' },
  { grade: 1, label: 'Difficile', key: '2' },
  { grade: 2, label: 'Bien', key: '3' },
  { grade: 3, label: 'Facile', key: '4' },
]

const DAY = 86_400_000
const MINUTE = 60_000

export function schedule(prev: SrsState | undefined, grade: Grade, now = Date.now()): SrsState {
  const s: SrsState = prev
    ? { ...prev }
    : { due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0, last: now }
  s.last = now

  if (grade === 0) {
    s.lapses += prev ? 1 : 0
    s.reps = 0
    s.interval = 0
    s.ease = Math.max(1.3, s.ease - 0.2)
    s.due = now + 10 * MINUTE
    return s
  }

  s.reps += 1
  if (grade === 1) s.ease = Math.max(1.3, s.ease - 0.15)
  if (grade === 3) s.ease = Math.min(3.2, s.ease + 0.15)

  let interval: number
  if (s.reps === 1) interval = grade === 1 ? 1 : grade === 2 ? 1 : 4
  else if (s.reps === 2) interval = grade === 1 ? 2 : grade === 2 ? 3 : 6
  else {
    const factor = grade === 1 ? 1.2 : grade === 2 ? s.ease : s.ease * 1.3
    interval = Math.max(s.interval + 1, Math.round(s.interval * factor))
  }
  s.interval = Math.min(interval, 365)
  s.due = now + s.interval * DAY
  return s
}

/** First review after solving an exercise: the solve itself counts as the first repetition,
 *  so the gaps start at a few days (Laborieux 2 j, Correct 3 j, Facile 6 j). */
export function scheduleAfterSolve(grade: Grade, now = Date.now()): SrsState {
  return schedule({ due: now, interval: 1, ease: 2.5, reps: 1, lapses: 0, last: now }, grade, now)
}

export function isDue(s: SrsState | undefined, now = Date.now()): boolean {
  return !!s && s.due <= now
}

/** A card is "mastered" once its interval reaches three weeks. */
export function isMastered(s: SrsState | undefined): boolean {
  return !!s && s.interval >= 21
}

export function formatInterval(days: number): string {
  if (days <= 0) return '10 min'
  if (days === 1) return '1 jour'
  if (days < 30) return `${days} jours`
  if (days < 365) return `${Math.round(days / 30)} mois`
  return '1 an'
}

/** Preview of the interval each grade would give, shown on the grade buttons. */
export function previewIntervals(prev: SrsState | undefined): string[] {
  return ([0, 1, 2, 3] as Grade[]).map((g) => formatInterval(schedule(prev, g).interval))
}
