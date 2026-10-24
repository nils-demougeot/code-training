import { create } from 'zustand'
import { exerciseById, exercises, projectById } from './content'
import { DIFFICULTY } from './domains'
import { schedule, scheduleAfterSolve, type Grade, type SrsState } from './srs'
import type { Domain } from './types'

// ---------------------------------------------------------------- data model

export interface ExerciseProgress {
  status: 'attempted' | 'solved'
  attempts: number
  firstSolvedAt?: number
  lastSolvedAt?: number
  bestTimeSec?: number
  hintsUsed: number
  solutionSeen?: boolean
  code?: string
  notes?: string
  /** Spaced repetition: when to re-solve this exercise from scratch. */
  review?: SrsState
  /** « Réécris de mémoire » successes and best time. */
  recalls?: number
  bestRecallSec?: number
  /** Passed the bonus (optimal complexity) tests at least once. */
  optimal?: boolean
  updatedAt: number
}

export interface ProjectProgress {
  code: string
  stepsDone: number[]
  completedAt?: number
  updatedAt: number
}

export type Medal = 'bronze' | 'silver' | 'gold'

/** Kaggle-style competition: notebook cells, steps passed, best hidden-test score. */
export const MEDALS: Medal[] = ['bronze', 'silver', 'gold']
export const MEDAL_LABEL: Record<Medal, string> = { bronze: 'de bronze', silver: 'd’argent', gold: 'd’or' }

export interface CompetitionProgress {
  cells: Record<string, string>
  stepsDone: string[]
  submissions: number
  best?: number
  medal?: Medal
  updatedAt: number
}

/** Maths exercise: best stars (0-3) and number of correct answers. */
export interface MathProgress {
  stars: number
  solved: number
  updatedAt: number
}

/** Maths chapter boss. */
export interface BossProgress {
  attempts: number
  beatenAt?: number
  /** Most lives left when beating it. */
  bestLives: number
}

/** Code blocks (Parsons): which modes were solved at least once. */
export interface ParsonsProgress {
  attempts: number
  solvedAt?: number
  /** Solved while also placing the indentation. */
  indent?: boolean
  /** Solved with distractor blocks mixed in. */
  traps?: boolean
  updatedAt: number
}

/** Git simulator missions. */
export interface GitLevelProgress {
  solvedAt: number
  /** Fewest commands typed to solve it. */
  bestCommands: number
}

export interface InterviewRecord {
  id: string
  date: number
  exerciseIds: string[]
  solved: string[]
  durationSec: number
  limitSec: number
}

export interface Progress {
  version: 1
  /** XP earned per local day (YYYY-MM-DD). Total XP is the sum. */
  activity: Record<string, number>
  exercises: Record<string, ExerciseProgress>
  cards: Record<string, SrsState>
  projects: Record<string, ProjectProgress>
  labs: Record<string, { done: string[]; updatedAt: number }>
  quiz: {
    answered: number
    correct: number
    bestCombo: number
    bestScore: number
    seen: Record<string, { right: number; wrong: number; last: number }>
  }
  interviews: InterviewRecord[]
  competitions: Record<string, CompetitionProgress>
  maths: Record<string, MathProgress>
  bosses: Record<string, BossProgress>
  parsons: Record<string, ParsonsProgress>
  git: Record<string, GitLevelProgress>
  badges: Record<string, number>
  updatedAt: number
}

export const emptyProgress = (): Progress => ({
  version: 1,
  activity: {},
  exercises: {},
  cards: {},
  projects: {},
  labs: {},
  quiz: { answered: 0, correct: 0, bestCombo: 0, bestScore: 0, seen: {} },
  interviews: [],
  competitions: {},
  maths: {},
  bosses: {},
  parsons: {},
  git: {},
  badges: {},
  updatedAt: 0,
})

// ---------------------------------------------------------------- dates, xp, levels

export function dayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function totalXp(p: Progress): number {
  return Object.values(p.activity).reduce((a, b) => a + b, 0)
}

const LEVEL_TITLES = [
  'Débutant', 'Curieux', 'Apprenti', 'Junior', 'Junior+', 'Confirmé', 'Confirmé+',
  'Senior', 'Senior+', 'Lead', 'Staff', 'Principal', 'Légende',
]

/** Cumulative XP needed to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  return 50 * (level - 1) * level
}

export function levelInfo(xp: number) {
  let level = 1
  while (xp >= xpForLevel(level + 1)) level++
  const floor = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    into: xp - floor,
    span: next - floor,
    ratio: (xp - floor) / (next - floor),
  }
}

export function streak(p: Progress, today = new Date()): { current: number; best: number; activeToday: boolean } {
  const days = new Set(Object.entries(p.activity).filter(([, xp]) => xp > 0).map(([d]) => d))
  const activeToday = days.has(dayKey(today))
  let current = 0
  const cursor = new Date(today)
  if (!activeToday) cursor.setDate(cursor.getDate() - 1)
  while (days.has(dayKey(cursor))) {
    current++
    cursor.setDate(cursor.getDate() - 1)
  }
  let best = 0
  let run = 0
  let prev: Date | null = null
  for (const d of [...days].sort()) {
    const date = new Date(d + 'T12:00:00')
    run = prev && Math.round((date.getTime() - prev.getTime()) / 86_400_000) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = date
  }
  return { current, best: Math.max(best, current), activeToday }
}

export function exerciseXp(difficulty: keyof typeof DIFFICULTY, hintsUsed: number, solutionSeen: boolean): number {
  const base = DIFFICULTY[difficulty].xp
  if (solutionSeen) return Math.round(base * 0.25)
  return Math.round(base * Math.max(0.4, 1 - 0.2 * hintsUsed))
}

// ---------------------------------------------------------------- mastery

export function domainMastery(p: Progress, domain: Domain): { solved: number; total: number; ratio: number } {
  const list = exercises.filter((e) => e.domain === domain)
  const weight = { easy: 1, medium: 2, hard: 3 }
  let got = 0
  let max = 0
  let solved = 0
  for (const e of list) {
    max += weight[e.difficulty]
    if (p.exercises[e.id]?.status === 'solved') {
      got += weight[e.difficulty]
      solved++
    }
  }
  return { solved, total: list.length, ratio: max ? got / max : 0 }
}

// ---------------------------------------------------------------- badges

export interface BadgeDef {
  id: string
  label: string
  description: string
  emoji: string
  test: (p: Progress) => boolean
}

const solvedCount = (p: Progress) => Object.values(p.exercises).filter((e) => e.status === 'solved').length
const cardReviews = (p: Progress) => Object.values(p.cards).reduce((a, c) => a + c.reps + c.lapses, 0)

export const BADGES: BadgeDef[] = [
  { id: 'first-solve', emoji: '🌱', label: 'Premier sang', description: 'Résoudre un premier exercice', test: (p) => solvedCount(p) >= 1 },
  { id: 'solve-10', emoji: '🔟', label: 'Dizaine', description: 'Résoudre 10 exercices', test: (p) => solvedCount(p) >= 10 },
  { id: 'solve-30', emoji: '🏔️', label: 'Grimpeur', description: 'Résoudre 30 exercices', test: (p) => solvedCount(p) >= 30 },
  {
    id: 'no-hint-hard', emoji: '🧠', label: 'Sans filet', description: 'Résoudre un exercice difficile sans indice',
    test: (p) => Object.entries(p.exercises).some(([id, e]) => e.status === 'solved' && e.hintsUsed === 0 && !e.solutionSeen && exerciseById.get(id)?.difficulty === 'hard'),
  },
  { id: 'streak-3', emoji: '🔥', label: 'Échauffement', description: '3 jours d’affilée', test: (p) => streak(p).best >= 3 },
  { id: 'streak-7', emoji: '⚡', label: 'Semaine parfaite', description: '7 jours d’affilée', test: (p) => streak(p).best >= 7 },
  { id: 'streak-30', emoji: '💎', label: 'Discipline', description: '30 jours d’affilée', test: (p) => streak(p).best >= 30 },
  { id: 'cards-50', emoji: '🃏', label: 'Mémoire vive', description: '50 révisions de cartes', test: (p) => cardReviews(p) >= 50 },
  { id: 'cards-300', emoji: '🧬', label: 'Mémoire d’éléphant', description: '300 révisions de cartes', test: (p) => cardReviews(p) >= 300 },
  { id: 'combo-8', emoji: '🎯', label: 'Sniper', description: 'Combo de 8 au quiz', test: (p) => p.quiz.bestCombo >= 8 },
  { id: 'project-1', emoji: '🚀', label: 'Bâtisseur', description: 'Terminer un projet', test: (p) => Object.values(p.projects).some((x) => x.completedAt) },
  { id: 'lab-explorer', emoji: '🔬', label: 'Explorateur', description: 'Faire 5 expériences dans les labs', test: (p) => Object.values(p.labs).reduce((a, l) => a + l.done.length, 0) >= 5 },
  { id: 'interview-1', emoji: '🎤', label: 'Sur le gril', description: 'Terminer un entretien blanc', test: (p) => p.interviews.length >= 1 },
  {
    id: 'recall-5', emoji: '📸', label: 'Mémoire photographique', description: 'Réécrire 5 exercices de mémoire',
    test: (p) => Object.values(p.exercises).reduce((a, e) => a + (e.recalls ?? 0), 0) >= 5,
  },
  {
    id: 'optimal-3', emoji: '⚙️', label: 'Optimiseur', description: 'Atteindre la complexité optimale sur 3 exercices',
    test: (p) => Object.values(p.exercises).filter((e) => e.optimal).length >= 3,
  },
  {
    id: 'comp-medal', emoji: '🥉', label: 'Sur le podium', description: 'Décrocher une médaille en compétition',
    test: (p) => Object.values(p.competitions ?? {}).some((c) => c.medal),
  },
  {
    id: 'comp-gold', emoji: '🥇', label: 'Grandmaster', description: 'Décrocher une médaille d’or en compétition',
    test: (p) => Object.values(p.competitions ?? {}).some((c) => c.medal === 'gold'),
  },
  {
    id: 'maths-boss', emoji: '👾', label: 'Tueur de boss', description: 'Vaincre le boss d’un chapitre de maths',
    test: (p) => Object.values(p.bosses ?? {}).some((b) => b.beatenAt),
  },
  {
    id: 'maths-20', emoji: '🧠', label: 'Calculateur', description: 'Obtenir 3 étoiles à 20 exercices de maths',
    test: (p) => Object.values(p.maths ?? {}).filter((x) => x.stars >= 3).length >= 20,
  },
  {
    id: 'maths-bosses', emoji: '👑', label: 'Maître des maths', description: 'Vaincre les 6 boss de maths',
    test: (p) => Object.values(p.bosses ?? {}).filter((b) => b.beatenAt).length >= 6,
  },
  {
    id: 'parsons-10', emoji: '🧩', label: 'Assembleur', description: 'Remettre en ordre 10 programmes en blocs',
    test: (p) => Object.values(p.parsons ?? {}).filter((x) => x.solvedAt).length >= 10,
  },
  {
    id: 'parsons-traps', emoji: '🪤', label: 'Déjoue les pièges', description: 'Réussir 5 programmes en blocs avec indentation et pièges',
    test: (p) => Object.values(p.parsons ?? {}).filter((x) => x.indent && x.traps).length >= 5,
  },
  {
    id: 'git-5', emoji: '🌿', label: 'Brancheur', description: 'Réussir 5 missions Git',
    test: (p) => Object.keys(p.git ?? {}).length >= 5,
  },
  {
    id: 'git-github', emoji: '🐙', label: 'Pull request mergée', description: 'Réussir toutes les missions GitHub',
    test: (p) => ['pull-request', 'push-rejete', 'branche-collegue', 'conflit-pr'].every((id) => p.git?.[id]),
  },
  { id: 'xp-1000', emoji: '🏆', label: 'Millier', description: 'Atteindre 1 000 XP', test: (p) => totalXp(p) >= 1000 },
]

// ---------------------------------------------------------------- merge (sync between devices)

function newer<T extends { updatedAt: number }>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a) return b
  if (!b) return a
  return b.updatedAt > a.updatedAt ? b : a
}

function mergeRecords<T>(a: Record<string, T>, b: Record<string, T>, pick: (x: T | undefined, y: T | undefined) => T | undefined) {
  const out: Record<string, T> = {}
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const v = pick(a[k], b[k])
    if (v !== undefined) out[k] = v
  }
  return out
}

function minDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  return Math.min(a, b)
}

export function mergeProgress(local: Progress, remote: Progress): Progress {
  const r = { ...emptyProgress(), ...remote }
  return {
    version: 1,
    activity: mergeRecords(local.activity, r.activity, (x, y) => Math.max(x ?? 0, y ?? 0)),
    exercises: mergeRecords(local.exercises, r.exercises, (x, y) => {
      const n = newer(x, y)
      if (!n || !x || !y) return n
      const solved = x.status === 'solved' || y.status === 'solved'
      return {
        ...n,
        status: solved ? 'solved' : n.status,
        attempts: Math.max(x.attempts, y.attempts),
        hintsUsed: Math.max(x.hintsUsed, y.hintsUsed),
        firstSolvedAt: minDefined(x.firstSolvedAt, y.firstSolvedAt),
        bestTimeSec: minDefined(x.bestTimeSec, y.bestTimeSec),
        recalls: Math.max(x.recalls ?? 0, y.recalls ?? 0) || undefined,
        bestRecallSec: minDefined(x.bestRecallSec, y.bestRecallSec),
        optimal: x.optimal || y.optimal || undefined,
      }
    }),
    cards: mergeRecords(local.cards, r.cards, (x, y) => (!x ? y : !y ? x : y.last > x.last ? y : x)),
    projects: mergeRecords(local.projects, r.projects, (x, y) => {
      const n = newer(x, y)
      if (!n || !x || !y) return n
      return { ...n, stepsDone: [...new Set([...x.stepsDone, ...y.stepsDone])].sort((a, b) => a - b) }
    }),
    labs: mergeRecords(local.labs, r.labs, (x, y) => {
      if (!x || !y) return x ?? y
      return { done: [...new Set([...x.done, ...y.done])], updatedAt: Math.max(x.updatedAt, y.updatedAt) }
    }),
    quiz: {
      answered: Math.max(local.quiz.answered, r.quiz.answered),
      correct: Math.max(local.quiz.correct, r.quiz.correct),
      bestCombo: Math.max(local.quiz.bestCombo, r.quiz.bestCombo),
      bestScore: Math.max(local.quiz.bestScore, r.quiz.bestScore),
      seen: mergeRecords(local.quiz.seen, r.quiz.seen, (x, y) => (!x ? y : !y ? x : y.last > x.last ? y : x)),
    },
    interviews: [...new Map([...r.interviews, ...local.interviews].map((i) => [i.id, i])).values()]
      .sort((a, b) => b.date - a.date),
    competitions: mergeRecords(local.competitions ?? {}, r.competitions ?? {}, (x, y) => {
      if (!x || !y) return x ?? y
      const latest = y.updatedAt > x.updatedAt ? y : x
      const rank = (m?: Medal) => (m ? MEDALS.indexOf(m) + 1 : 0)
      return {
        cells: latest.cells,
        stepsDone: [...new Set([...x.stepsDone, ...y.stepsDone])],
        submissions: Math.max(x.submissions, y.submissions),
        best: rank(x.medal) >= rank(y.medal) ? x.best ?? y.best : y.best ?? x.best,
        medal: rank(x.medal) >= rank(y.medal) ? x.medal : y.medal,
        updatedAt: Math.max(x.updatedAt, y.updatedAt),
      }
    }),
    maths: mergeRecords(local.maths ?? {}, r.maths ?? {}, (x, y) =>
      !x || !y ? (x ?? y) : { stars: Math.max(x.stars, y.stars), solved: Math.max(x.solved, y.solved), updatedAt: Math.max(x.updatedAt, y.updatedAt) },
    ),
    bosses: mergeRecords(local.bosses ?? {}, r.bosses ?? {}, (x, y) =>
      !x || !y
        ? (x ?? y)
        : { attempts: Math.max(x.attempts, y.attempts), beatenAt: minDefined(x.beatenAt, y.beatenAt), bestLives: Math.max(x.bestLives, y.bestLives) },
    ),
    parsons: mergeRecords(local.parsons ?? {}, r.parsons ?? {}, (x, y) => {
      if (!x || !y) return x ?? y
      return {
        attempts: Math.max(x.attempts, y.attempts),
        solvedAt: minDefined(x.solvedAt, y.solvedAt),
        indent: x.indent || y.indent,
        traps: x.traps || y.traps,
        updatedAt: Math.max(x.updatedAt, y.updatedAt),
      }
    }),
    git: mergeRecords(local.git ?? {}, r.git ?? {}, (x, y) =>
      !x || !y ? x ?? y : { solvedAt: Math.min(x.solvedAt, y.solvedAt), bestCommands: Math.min(x.bestCommands, y.bestCommands) },
    ),
    badges: mergeRecords(local.badges, r.badges, minDefined),
    updatedAt: Math.max(local.updatedAt, r.updatedAt),
  }
}

// ---------------------------------------------------------------- store

const KEY = 'ct.progress.v1'

function loadLocal(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...emptyProgress(), ...JSON.parse(raw) }
  } catch {
    /* corrupted or unavailable storage: start fresh */
  }
  return emptyProgress()
}

export interface Reward {
  id: number
  xp: number
  label: string
  badge?: BadgeDef
}

interface ProgressStore {
  p: Progress
  rewards: Reward[]
  dismissReward: (id: number) => void
  replace: (p: Progress) => void
  saveExerciseCode: (id: string, code: string) => void
  recordAttempt: (id: string) => void
  takeHint: (id: string, index: number) => void
  seeSolution: (id: string) => void
  solveExercise: (id: string, timeSec: number) => number
  /** fresh: reschedule from scratch (right after a solve) instead of building on the previous review. */
  reviewExercise: (id: string, grade: Grade, fresh?: boolean) => void
  setNotes: (id: string, notes: string) => void
  recordRecall: (id: string, timeSec: number) => void
  markOptimal: (id: string) => void
  reviewCard: (id: string, grade: Grade, correct: boolean) => void
  quizAnswer: (id: string, correct: boolean, combo: number) => number
  quizFinish: (score: number, bestCombo: number) => void
  saveProjectCode: (id: string, code: string) => void
  completeProjectSteps: (id: string, steps: number[]) => void
  labExperiment: (lab: string, experiment: string) => void
  finishInterview: (record: InterviewRecord) => void
  grantXp: (xp: number, label: string) => void
  saveCompetitionCell: (id: string, stepId: string, code: string) => void
  /** Returns the XP earned (first time only). */
  completeCompetitionStep: (id: string, stepId: string) => number
  /** Records a scored submission; `better(a, b)` says whether score a beats score b. Returns the XP earned. */
  submitCompetition: (id: string, score: number, medal: Medal | undefined, better: (a: number, b: number) => boolean) => number
  /** Correct answer to a maths exercise; returns the XP earned. */
  solveMath: (id: string, stars: number) => number
  /** Boss fight finished (won or lost); returns the XP earned. */
  finishBoss: (chapter: string, won: boolean, lives: number) => number
  /** Returns the XP earned (only the first time). */
  solveGitLevel: (id: string, commands: number) => number
  attemptParsons: (id: string) => void
  /** Returns the XP earned (first solve, then each harder mode solved for the first time). */
  solveParsons: (id: string, mode: { indent: boolean; traps: boolean }) => number
}

let rewardId = 1

export const useProgress = create<ProgressStore>((set, get) => {
  /** Applies a mutation, awards XP and unlocks badges. */
  const commit = (mutate: (p: Progress) => void, xp = 0, label = '') => {
    const p: Progress = structuredClone(get().p)
    mutate(p)
    const rewards: Reward[] = []
    if (xp > 0) {
      const today = dayKey()
      p.activity[today] = (p.activity[today] ?? 0) + xp
      rewards.push({ id: rewardId++, xp, label })
    }
    for (const b of BADGES) {
      if (!p.badges[b.id] && b.test(p)) {
        p.badges[b.id] = Date.now()
        rewards.push({ id: rewardId++, xp: 0, label: b.label, badge: b })
      }
    }
    p.updatedAt = Date.now()
    set({ p, rewards: [...get().rewards, ...rewards].slice(-6) })
  }

  const competition = (p: Progress, id: string): CompetitionProgress => {
    p.competitions ??= {}
    return (p.competitions[id] ??= { cells: {}, stepsDone: [], submissions: 0, updatedAt: Date.now() })
  }

  const ex = (p: Progress, id: string): ExerciseProgress =>
    (p.exercises[id] ??= { status: 'attempted', attempts: 0, hintsUsed: 0, updatedAt: Date.now() })

  return {
    p: loadLocal(),
    rewards: [],
    dismissReward: (id) => set({ rewards: get().rewards.filter((r) => r.id !== id) }),
    replace: (p) => set({ p }),

    saveExerciseCode: (id, code) =>
      commit((p) => {
        const e = ex(p, id)
        e.code = code
        e.updatedAt = Date.now()
      }),

    recordAttempt: (id) =>
      commit((p) => {
        const e = ex(p, id)
        e.attempts += 1
        e.updatedAt = Date.now()
      }),

    takeHint: (id, index) =>
      commit((p) => {
        const e = ex(p, id)
        e.hintsUsed = Math.max(e.hintsUsed, index + 1)
        e.updatedAt = Date.now()
      }),

    seeSolution: (id) =>
      commit((p) => {
        const e = ex(p, id)
        e.solutionSeen = true
        e.updatedAt = Date.now()
      }),

    solveExercise: (id, timeSec) => {
      const def = exerciseById.get(id)
      const prev = get().p.exercises[id]
      const firstTime = prev?.status !== 'solved'
      const isReview = !firstTime && !!prev?.review && prev.review.due <= Date.now()
      let xp = 0
      if (def && firstTime) xp = exerciseXp(def.difficulty, prev?.hintsUsed ?? 0, !!prev?.solutionSeen)
      else if (def && isReview) xp = Math.round(DIFFICULTY[def.difficulty].xp / 2)
      commit(
        (p) => {
          const e = ex(p, id)
          const now = Date.now()
          e.status = 'solved'
          e.firstSolvedAt ??= now
          e.lastSolvedAt = now
          e.bestTimeSec = Math.min(e.bestTimeSec ?? Infinity, timeSec)
          // First success → come back in a few days and re-solve from memory.
          if (firstTime) e.review = scheduleAfterSolve(e.solutionSeen || e.hintsUsed > 1 ? 1 : 2)
          else if (isReview) e.review = schedule(e.review, 2)
          e.updatedAt = now
        },
        xp,
        def ? def.title : 'Exercice',
      )
      return xp
    },

    reviewExercise: (id, grade, fresh) =>
      commit((p) => {
        const e = ex(p, id)
        e.review = fresh ? scheduleAfterSolve(grade) : schedule(e.review, grade)
        e.updatedAt = Date.now()
      }),

    recordRecall: (id, timeSec) =>
      commit(
        (p) => {
          const e = ex(p, id)
          e.recalls = (e.recalls ?? 0) + 1
          e.bestRecallSec = Math.min(e.bestRecallSec ?? Infinity, timeSec)
          e.updatedAt = Date.now()
        },
        10,
        'Réécrit de mémoire',
      ),

    markOptimal: (id) => {
      if (get().p.exercises[id]?.optimal) return
      commit(
        (p) => {
          const e = ex(p, id)
          e.optimal = true
          e.updatedAt = Date.now()
        },
        10,
        'Complexité optimale',
      )
    },

    setNotes: (id, notes) =>
      commit((p) => {
        const e = ex(p, id)
        e.notes = notes
        e.updatedAt = Date.now()
      }),

    reviewCard: (id, grade, correct) =>
      commit(
        (p) => {
          p.cards[id] = schedule(p.cards[id], grade)
        },
        correct ? 3 : 1,
        'Carte révisée',
      ),

    quizAnswer: (id, correct, combo) => {
      const xp = correct ? 2 + Math.min(combo, 10) : 0
      commit(
        (p) => {
          p.quiz.answered += 1
          if (correct) p.quiz.correct += 1
          const s = (p.quiz.seen[id] ??= { right: 0, wrong: 0, last: 0 })
          if (correct) s.right += 1
          else s.wrong += 1
          s.last = Date.now()
          p.quiz.bestCombo = Math.max(p.quiz.bestCombo, combo)
        },
        xp,
        'Quiz',
      )
      return xp
    },

    quizFinish: (score, bestCombo) =>
      commit((p) => {
        p.quiz.bestScore = Math.max(p.quiz.bestScore, score)
        p.quiz.bestCombo = Math.max(p.quiz.bestCombo, bestCombo)
      }),

    saveProjectCode: (id, code) =>
      commit((p) => {
        const pr = (p.projects[id] ??= { code, stepsDone: [], updatedAt: Date.now() })
        pr.code = code
        pr.updatedAt = Date.now()
      }),

    completeProjectSteps: (id, steps) => {
      const def = projectById.get(id)
      const prev = get().p.projects[id]
      const fresh = steps.filter((s) => !prev?.stepsDone.includes(s))
      if (!fresh.length) return
      const done = new Set([...(prev?.stepsDone ?? []), ...steps])
      const finished = !!def && done.size === def.steps.length && !prev?.completedAt
      commit(
        (p) => {
          const pr = (p.projects[id] ??= { code: '', stepsDone: [], updatedAt: Date.now() })
          pr.stepsDone = [...done].sort((a, b) => a - b)
          if (finished) pr.completedAt = Date.now()
          pr.updatedAt = Date.now()
        },
        fresh.length * 50 + (finished ? 150 : 0),
        finished ? `Projet terminé : ${def!.title}` : `Étape validée : ${def?.title ?? ''}`,
      )
    },

    labExperiment: (lab, experiment) => {
      if (get().p.labs[lab]?.done.includes(experiment)) return
      commit(
        (p) => {
          const l = (p.labs[lab] ??= { done: [], updatedAt: Date.now() })
          l.done.push(experiment)
          l.updatedAt = Date.now()
        },
        15,
        'Expérience réalisée',
      )
    },

    finishInterview: (record) =>
      commit(
        (p) => {
          p.interviews = [record, ...p.interviews].slice(0, 50)
        },
        50 + record.solved.length * 30,
        'Entretien blanc terminé',
      ),

    grantXp: (xp, label) => commit(() => {}, xp, label),

    saveCompetitionCell: (id, stepId, code) =>
      commit((p) => {
        const c = competition(p, id)
        c.cells[stepId] = code
        c.updatedAt = Date.now()
      }),

    completeCompetitionStep: (id, stepId) => {
      if (get().p.competitions?.[id]?.stepsDone.includes(stepId)) return 0
      commit(
        (p) => {
          const c = competition(p, id)
          c.stepsDone.push(stepId)
          c.updatedAt = Date.now()
        },
        10,
        'Étape de compétition',
      )
      return 10
    },

    submitCompetition: (id, score, medal, better) => {
      const prev = get().p.competitions?.[id]
      const rank = (m?: Medal) => (m ? MEDALS.indexOf(m) + 1 : 0)
      // XP for each medal level reached for the first time.
      const xp = [0, 20, 40, 70][rank(medal)] - [0, 20, 40, 70][rank(prev?.medal)]
      commit(
        (p) => {
          const c = competition(p, id)
          c.submissions += 1
          if (c.best === undefined || better(score, c.best)) c.best = score
          if (rank(medal) > rank(c.medal)) c.medal = medal
          c.updatedAt = Date.now()
        },
        Math.max(0, xp),
        medal ? `Médaille ${MEDAL_LABEL[medal]}` : 'Soumission',
      )
      return Math.max(0, xp)
    },

    solveGitLevel: (id, commands) => {
      const prev = get().p.git?.[id]
      const xp = prev ? 0 : 15
      commit(
        (p) => {
          p.git ??= {}
          p.git[id] = { solvedAt: prev?.solvedAt ?? Date.now(), bestCommands: Math.min(prev?.bestCommands ?? Infinity, commands) }
        },
        xp,
        'Mission Git',
      )
      return xp
    },

    attemptParsons: (id) =>
      commit((p) => {
        p.parsons ??= {}
        const x = (p.parsons[id] ??= { attempts: 0, updatedAt: Date.now() })
        x.attempts += 1
        x.updatedAt = Date.now()
      }),

    solveParsons: (id, mode) => {
      const prev = get().p.parsons?.[id]
      const xp = (prev?.solvedAt ? 0 : 10) + (mode.indent && !prev?.indent ? 5 : 0) + (mode.traps && !prev?.traps ? 5 : 0)
      commit(
        (p) => {
          p.parsons ??= {}
          const x = (p.parsons[id] ??= { attempts: 0, updatedAt: Date.now() })
          x.solvedAt ??= Date.now()
          x.indent ||= mode.indent
          x.traps ||= mode.traps
          x.updatedAt = Date.now()
        },
        xp,
        'Programme en blocs',
      )
      return xp
    },

    solveMath: (id, stars) => {
      const prev = get().p.maths?.[id]
      // A little XP for every correct answer, more for improving one's best result.
      const xp = 2 + Math.max(0, stars - (prev?.stars ?? 0)) * 4
      commit(
        (p) => {
          p.maths ??= {}
          p.maths[id] = { stars: Math.max(stars, prev?.stars ?? 0), solved: (prev?.solved ?? 0) + 1, updatedAt: Date.now() }
        },
        xp,
        'Exercice de maths',
      )
      return xp
    },

    finishBoss: (chapter, won, lives) => {
      const prev = get().p.bosses?.[chapter]
      const xp = won && !prev?.beatenAt ? 50 : won ? 10 : 0
      commit(
        (p) => {
          p.bosses ??= {}
          p.bosses[chapter] = {
            attempts: (prev?.attempts ?? 0) + 1,
            beatenAt: prev?.beatenAt ?? (won ? Date.now() : undefined),
            bestLives: won ? Math.max(lives, prev?.bestLives ?? 0) : prev?.bestLives ?? 0,
          }
        },
        xp,
        'Boss de maths vaincu',
      )
      return xp
    },
  }
})

// Persist locally on every change.
useProgress.subscribe((state, prev) => {
  if (state.p === prev.p) return
  try {
    localStorage.setItem(KEY, JSON.stringify(state.p))
  } catch {
    /* quota exceeded or storage disabled */
  }
})

export function exportProgress(): string {
  return JSON.stringify(useProgress.getState().p, null, 2)
}

export function importProgress(json: string) {
  const parsed = JSON.parse(json) as Progress
  if (parsed.version !== 1 || typeof parsed.activity !== 'object') throw new Error('Fichier invalide')
  useProgress.getState().replace(mergeProgress(useProgress.getState().p, parsed))
}
