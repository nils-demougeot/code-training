export type Domain = 'python' | 'numpy' | 'pandas' | 'sql' | 'stats' | 'ml' | 'dl' | 'genai' | 'algo' | 'git'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface TestCase {
  name?: string
  /** Python expression evaluated in the user's namespace. */
  call?: string
  /** Python expression for the expected value (evaluated with the reference solution). */
  expected?: string
  /** Free-form Python assertions, with access to the user's namespace and `ref`. */
  check?: string
  hidden?: boolean
  /** Bonus test (e.g. optimal complexity): failing it does not block validation. */
  bonus?: boolean
  strict?: boolean
  unordered?: boolean
  rtol?: number
  atol?: number
}

export interface Exercise {
  id: string
  title: string
  domain: Domain
  difficulty: Difficulty
  minutes: number
  tags: string[]
  /** "browser" (Pyodide) by default; "local" requires the local runner (e.g. PyTorch). */
  engine?: 'browser' | 'local'
  interview?: boolean
  /** "sql": the editor holds a SQL query, wrapped into Python as QUERY before execution. */
  language?: 'python' | 'sql'
  /** Name of a file in content/shared/ prepended to `setup` (e.g. a demo database). */
  shared?: string
  statement: string
  starter: string
  solution: string
  setup?: string
  tests: TestCase[]
  hints: string[]
  explanation: string
  cards?: string[]
  /** Optimal complexity, checked by bonus tests. */
  complexity?: { target: string; note: string }
  /** Brute-force reference (validator only): must pass required tests and fail bonus tests. */
  naive?: string
  /** Typical mistakes (validator only): each must fail at least one required test. */
  wrong?: string[]
  /** Parsons (code blocks) version of the exercise. */
  parsons?: { skip?: boolean; distractors?: { line: string; replaces: string }[] }
}

export interface FlashCard {
  id: string
  deck: string
  domain: Domain
  prompt: string
  /** Reference answer (Python). */
  answer: string
  setup?: string
  /** expr (default): compare values; stmt: compare variable `var`; stdout: compare printed output;
   *  reveal: self-graded (no execution). */
  kind?: 'expr' | 'stmt' | 'stdout' | 'reveal'
  var?: string
  loose?: boolean
  note?: string
}

export interface Deck {
  id: string
  title: string
  domain: Domain
  description: string
  cards: FlashCard[]
}

export interface QuizQuestion {
  id: string
  domain: Domain
  topic: string
  /** Code snippet shown to the player (optional for concept questions). */
  code?: string
  question: string
  choices: string[]
  answer: number
  explain: string
  /** When true, choices[answer] must equal the stdout of `code` (checked by the validator). */
  verify?: boolean
}

export interface ProjectStep {
  title: string
  instructions: string
  tests: TestCase[]
  hints: string[]
}

export interface Project {
  id: string
  title: string
  domain: Domain
  difficulty: Difficulty
  hours: number
  summary: string
  intro: string
  engine?: 'browser' | 'local'
  shared?: string
  starter: string
  solution: string
  setup?: string
  steps: ProjectStep[]
  outro: string
}

export interface Fiche {
  id: string
  title: string
  domain: Domain
  summary: string
  body: string
}

// ---------------------------------------------------------------- engine results

export interface TestResult {
  name: string
  passed: boolean
  hidden: boolean
  bonus?: boolean
  input?: string
  got?: string
  expected?: string
  error?: string
  stdout?: string
  durationMs?: number
}

export interface RunResult {
  ok: boolean
  stdout?: string
  value?: string | null
  error?: string | null
  errorLine?: number | null
  figures?: string[]
  durationMs?: number
  tests?: TestResult[]
  passed?: number
  total?: number
  bonusPassed?: number
  bonusTotal?: number
  /** Run mode: stdout interleaved with the values of top-level expressions. */
  segments?: ({ kind: 'stdout'; text: string } | { kind: 'value'; line: number; text: string })[]
  /** Run mode: results of the exercise's example calls. */
  examples?: { call: string; value?: string; error?: string; stdout?: string }[]
  /** Set by the engine itself (timeout, worker crash, runner unreachable). */
  engineError?: string
}

export interface EvalResult {
  ok: boolean
  correct: boolean
  got: string | null
  expected: string | null
  error: string | null
  reason: string | null
  engineError?: string
}

// ---------------------------------------------------------------- documentation

export interface DocEntry {
  name: string
  signature?: string
  description: string
  example?: string
  /** false for examples that cannot run in the browser (PyTorch). */
  run?: boolean
}

export interface DocLibrary {
  id: string
  title: string
  domain: Domain
  /** Prepended to every example when it is run (imports, sample data). */
  setup?: string
  /** content/shared/<name>.py prepended to setup (e.g. the demo SQLite database). */
  shared?: string
  language?: 'python' | 'sql'
  sections: { title: string; entries: DocEntry[] }[]
}

// ---------------------------------------------------------------- ML competitions

export interface CompetitionStep {
  id: string
  title: string
  goal: string
  instructions: string
  starter: string
  solution: string
  hints: string[]
  tests: TestCase[]
  explanation: string
}

/** Kaggle-style competition: a story, a dataset, a guided notebook and a hidden test set. */
export interface Competition {
  id: string
  title: string
  emoji: string
  difficulty: Difficulty
  task: string
  metric: string
  metric_label: string
  higher_is_better: boolean
  shared: string
  summary: string
  story: string
  data: string
  medals: { bronze: number; silver: number; gold: number }
  leaderboard: { name: string; score: number }[]
  submission: { id: string; target: string }
  steps: CompetitionStep[]
  /** Model cell that reaches gold (checked by the validator, never shown). */
  gold?: string
}

// ---------------------------------------------------------------- Parsons (code blocks)

export interface ParsonsProblem {
  id: string
  title: string
  domain: Domain
  difficulty: Difficulty
  statement: string
  solution: string
  setup?: string
  shared?: string
  language?: 'python' | 'sql'
  tests: TestCase[]
  distractors: { line: string; replaces: string }[]
  explanation?: string
  /** Derived from an exercise (same id), or written for the blocks mode (content/parsons). */
  source: 'exercise' | 'parsons'
}

// ---------------------------------------------------------------- client missions (case simulator)

export type QuestionValue = 'key' | 'useful' | 'weak' | 'off'

export interface MissionQuestion {
  id: string
  text: string
  value: QuestionValue
  /** What the client answers. */
  answer: string
  /** Facts added to the notes when this question is asked. */
  reveals?: string[]
  /** Why this question is (or is not) a good one, shown in the debrief. */
  why: string
}

export interface MissionOption {
  text: string
  /** Single/multi choice: whether this option is right. */
  correct?: boolean
  /** Approach / pitch: how good the option is. */
  verdict?: 'best' | 'ok' | 'bad'
  feedback: string
}

export interface MissionChoice {
  id: string
  question: string
  multi?: boolean
  options: MissionOption[]
}

export interface MissionValueField {
  label: string
  answer: number
  /** Python expression over `numbers`, checked by the validator against `answer`. */
  formula: string
  decimals: number
  unit?: string
}

export interface Mission {
  id: string
  title: string
  emoji: string
  industry: string
  difficulty: Difficulty
  minutes: number
  /** What the mission trains (shown on the card). */
  skills: string[]
  client: { name: string; role: string; company: string }
  /** The client's opening request, as they say it. */
  brief: string
  /** What you know before the meeting. */
  context: string
  discovery: { budget: number; intro: string; questions: MissionQuestion[] }
  facts: { id: string; text: string }[]
  framing: MissionChoice[]
  approach: MissionChoice
  plan: { question: string; steps: string[]; explanation: string }
  value: { intro: string; numbers: Record<string, number>; fields: MissionValueField[]; solution: string }
  pitch: MissionChoice
  debrief: string
}

/** "Explain it simply": communication drills for non-technical audiences. */
export interface ExplainOption {
  text: string
  verdict: 'best' | 'ok' | 'bad'
  feedback: string
}

export interface ExplainItem {
  id: string
  /** Short label of the drill type, e.g. "Pick the best explanation". */
  kind: 'explain' | 'metric' | 'pushback' | 'so-what'
  /** Who you are talking to, e.g. "Head of Sales, no technical background". */
  audience: string
  /** The situation and the question, in Markdown. */
  prompt: string
  options: ExplainOption[]
  takeaway: string
}

export interface ExplainWrite {
  id: string
  audience: string
  prompt: string
  /** Self-check list shown after writing. */
  checklist: string[]
  /** A strong answer to compare with. */
  model: string
  /** Suggested maximum length in words. */
  maxWords?: number
}

export interface ExplainDeck {
  id: string
  title: string
  emoji: string
  summary: string
  items: ExplainItem[]
  write: ExplainWrite[]
}
