import type { Chapter, MathExercise } from './core'
import { calculusChapter } from './chapters/calculus'
import { inferenceChapter } from './chapters/inference'
import { linalgChapter } from './chapters/linalg'
import { mlmathChapter } from './chapters/mlmath'
import { probaChapter } from './chapters/proba'
import { randomChapter } from './chapters/random'

export * from './core'
export { displayMath } from '../lib/mathText'

export const CHAPTERS: Chapter[] = [probaChapter, randomChapter, inferenceChapter, linalgChapter, calculusChapter, mlmathChapter]

export const chapterById = new Map(CHAPTERS.map((c) => [c.id, c]))

export const mathExerciseById = new Map<string, { exercise: MathExercise; chapter: Chapter }>(
  CHAPTERS.flatMap((chapter) => chapter.exercises.map((exercise) => [exercise.id, { exercise, chapter }] as const)),
)

/** The boss draws its rounds among the chapter's exercises, except those marked `boss: false`. */
export const BOSS_ROUNDS = 5
export const BOSS_LIVES = 3

export function bossPool(chapter: Chapter): MathExercise[] {
  return chapter.exercises.filter((e) => e.boss !== false)
}
