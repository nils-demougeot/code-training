import { cards, DOMAIN_ORDER, exercises } from './content'
import { dayKey, domainMastery, type Progress } from './progress'
import type { Exercise } from './types'

const DIFF = { easy: 0, medium: 1, hard: 2 }

export function dueExerciseReviews(p: Progress, now = Date.now()): Exercise[] {
  return exercises
    .filter((e) => {
      const ep = p.exercises[e.id]
      return ep?.status === 'solved' && ep.review && ep.review.due <= now
    })
    .sort((a, b) => p.exercises[a.id].review!.due - p.exercises[b.id].review!.due)
}

/** Next unsolved exercise: weakest domain first, easiest first, short ones first. */
export function recommendExercise(p: Progress, opts: { maxMinutes?: number; exclude?: string[] } = {}): Exercise | undefined {
  const candidates = exercises.filter(
    (e) =>
      p.exercises[e.id]?.status !== 'solved' &&
      e.engine !== 'local' &&
      !opts.exclude?.includes(e.id) &&
      (opts.maxMinutes === undefined || e.minutes <= opts.maxMinutes),
  )
  if (!candidates.length) return undefined
  const mastery = Object.fromEntries(DOMAIN_ORDER.map((d) => [d, domainMastery(p, d).ratio]))
  return [...candidates].sort(
    (a, b) =>
      // In-progress exercises first: finish what was started.
      Number(!!p.exercises[b.id]) - Number(!!p.exercises[a.id]) ||
      DIFF[a.difficulty] - DIFF[b.difficulty] ||
      mastery[a.domain] - mastery[b.domain] ||
      a.minutes - b.minutes,
  )[0]
}

export function dueCards(p: Progress, now = Date.now()) {
  return cards.filter((c) => p.cards[c.id] && p.cards[c.id].due <= now)
}

export function newCards(p: Progress, deck?: string) {
  return cards.filter((c) => !p.cards[c.id] && (!deck || c.deck === deck))
}

export function todayStats(p: Progress) {
  const today = dayKey()
  const isToday = (t?: number) => !!t && dayKey(new Date(t)) === today
  return {
    xp: p.activity[today] ?? 0,
    cardsReviewed: Object.values(p.cards).filter((c) => isToday(c.last)).length,
    exercisesSolved: Object.values(p.exercises).filter((e) => isToday(e.lastSolvedAt)).length,
    quizAnswered: Object.values(p.quiz.seen).filter((s) => isToday(s.last)).length,
  }
}

export function inProgress(p: Progress): Exercise[] {
  return exercises
    .filter((e) => p.exercises[e.id]?.status === 'attempted' && p.exercises[e.id].code)
    .sort((a, b) => p.exercises[b.id].updatedAt - p.exercises[a.id].updatedAt)
    .slice(0, 4)
}
