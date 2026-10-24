import { parse } from 'yaml'
import { parsonsEligible, toBlocks } from './parsons'
import type { Competition, Deck, DocLibrary, Domain, Exercise, Fiche, FlashCard, ParsonsProblem, Project, QuizQuestion } from './types'

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

const docFiles = import.meta.glob('/content/docs/*.yaml', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>
const competitionFiles = import.meta.glob('/content/competitions/*.yaml', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>
const parsonsFiles = import.meta.glob('/content/parsons/*.yaml', {
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

export const DOMAIN_ORDER: Domain[] = ['python', 'numpy', 'pandas', 'sql', 'stats', 'ml', 'dl', 'algo', 'git']

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

/** Domains that have code exercises (git is practised in its own simulator). */
export const EXERCISE_DOMAINS: Domain[] = DOMAIN_ORDER.filter((d) => exercises.some((e) => e.domain === d))

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

/** Documentation libraries, in file-name order (01-python.yaml, 02-numpy.yaml…). */
export const docLibraries: DocLibrary[] = Object.entries(docFiles)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, raw]) => parse(raw) as DocLibrary)
export const docLibraryById = new Map(docLibraries.map((l) => [l.id, l]))

const COMPETITION_ORDER = ['aurora', 'apparts', 'velos']
export const competitions: Competition[] = Object.values(competitionFiles)
  .map((raw) => parse(raw) as Competition)
  .sort((a, b) => COMPETITION_ORDER.indexOf(a.id) - COMPETITION_ORDER.indexOf(b.id))
export const competitionById = new Map(competitions.map((c) => [c.id, c]))

/** Code-blocks problems: written ones first, then every eligible exercise. */
export const parsonsProblems: ParsonsProblem[] = [
  ...Object.values(parsonsFiles).map((raw) => {
    const d = parse(raw) as Omit<ParsonsProblem, 'source'>
    return { ...d, distractors: d.distractors ?? [], source: 'parsons' as const }
  }),
  ...exercises
    .filter((e) => e.engine !== 'local' && !e.parsons?.skip && parsonsEligible(toBlocks(e.solution, e.language)))
    .map((e) => ({
      id: e.id,
      title: e.title,
      domain: e.domain,
      difficulty: e.difficulty,
      statement: e.statement,
      solution: e.solution,
      setup: e.setup,
      shared: e.shared,
      language: e.language,
      tests: e.tests.filter((t) => !t.bonus),
      distractors: e.parsons?.distractors ?? [],
      explanation: e.explanation,
      source: 'exercise' as const,
    })),
].sort(
  (a, b) =>
    DOMAIN_ORDER.indexOf(a.domain) - DOMAIN_ORDER.indexOf(b.domain) ||
    (a.source === b.source ? 0 : a.source === 'parsons' ? -1 : 1) ||
    DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty],
)
export const parsonsById = new Map(parsonsProblems.map((p) => [p.id, p]))
