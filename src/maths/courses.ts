import { GENAI_CHAPTERS } from '../genai'
import type { Chapter, Lang } from './core'
import { CHAPTERS } from './index'

/** A course: chapters with a lesson, exercises and a boss, played with the same engine. */
export interface Course {
  id: 'maths' | 'genai'
  lang: Lang
  /** Route prefix of the chapters, e.g. /maths/<chapter>. */
  base: string
  home: string
  homeLabel: string
  chapters: Chapter[]
}

export const COURSES: Record<Course['id'], Course> = {
  maths: { id: 'maths', lang: 'fr', base: '/maths', home: '/maths', homeLabel: 'Maths pour la data', chapters: CHAPTERS },
  genai: { id: 'genai', lang: 'en', base: '/genai', home: '/genai', homeLabel: 'GenAI Academy', chapters: GENAI_CHAPTERS },
}
