import { parse } from 'yaml'
import type { Deck, Domain, Exercise, Fiche, FlashCard, Project, QuizQuestion } from './types'

// All learning content lives in /content as YAML (code blocks need no escaping there)
// and is bundled at build time.
const exerciseFiles = import.meta.glob('/content/exercises/**/*.yaml', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>
const deckFiles = import.meta.glob('/content/cards/*.yaml', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>
const quizFiles = import.meta.glob('/content/quiz/*.yaml', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>
const projectFiles = import.meta.glob('/content/projects/*.yaml', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>
const ficheFiles = import.meta.glob('/content/fiches/*.yaml', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

const sharedFiles = import.meta.glob('/content/shared/*.py', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

/** Shared Python setup snippets (content/shared/<name>.py). */
export const shared: Record<string, string> = Object.fromEntries(
  Object.entries(sharedFiles).map(([path, src]) => [path.split('/').pop()!.replace(/\.py$/, ''), src]),
)

/** Full setup for an exercise/project: shared snippet + own setup. */
export function setupOf(item: { shared?: string; setup?: string }): string {
  return [item.shared ? shared[item.shared] ?? '' : '', item.setup ?? ''].filter(Boolean).join('\n')
}

/** For SQL exercises the editor contains SQL: wrap it into a Python string. */
export function toPython(item: { language?: string }, code: string): string {
  return item.language === 'sql' ? `QUERY = ${JSON.stringify(code)}\n` : code
}

const DIFF_ORDER = { easy: 0, medium: 1, hard: 2 } as const

export const DOMAIN_ORDER: Domain[] = ['python', 'numpy', 'pandas', 'sql', 'ml', 'dl', 'algo']

export const exercises: Exercise[] = Object.values(exerciseFiles)
  .map((raw) => {
    const e = parse(raw) as Exercise
    return { ...e, tags: e.tags ?? [], hints: e.hints ?? [], tests: e.tests ?? [] }
  })
  .sort(
    (a, b) =>
      DOMAIN_ORDER.indexOf(a.domain) - DOMAIN_ORDER.indexOf(b.domain) ||
      DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty] ||
      a.minutes - b.minutes,
  )

export const exerciseById = new Map(exercises.map((e) => [e.id, e]))

export const decks: Deck[] = Object.values(deckFiles)
  .map((raw) => {
    const d = parse(raw) as Omit<Deck, 'cards'> & { cards: Omit<FlashCard, 'deck' | 'domain'>[] }
    return { ...d, cards: d.cards.map((c) => ({ ...c, deck: d.id, domain: d.domain })) }
  })
  .sort((a, b) => DOMAIN_ORDER.indexOf(a.domain) - DOMAIN_ORDER.indexOf(b.domain))

export const cards: FlashCard[] = decks.flatMap((d) => d.cards)
export const cardById = new Map(cards.map((c) => [c.id, c]))

export const quizQuestions: QuizQuestion[] = Object.values(quizFiles).flatMap((raw) => {
  const file = parse(raw) as { domain: Domain; questions: Omit<QuizQuestion, 'domain'>[] }
  return file.questions.map((q) => ({ ...q, domain: file.domain }))
})

export const projects: Project[] = Object.values(projectFiles)
  .map((raw) => parse(raw) as Project)
  .sort((a, b) => DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty])
export const projectById = new Map(projects.map((p) => [p.id, p]))

export const fiches: Fiche[] = Object.values(ficheFiles)
  .map((raw) => parse(raw) as Fiche)
  .sort((a, b) => DOMAIN_ORDER.indexOf(a.domain) - DOMAIN_ORDER.indexOf(b.domain))
export const ficheById = new Map(fiches.map((f) => [f.id, f]))
