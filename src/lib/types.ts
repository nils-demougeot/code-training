export type Domain = 'python' | 'numpy' | 'pandas' | 'sql' | 'ml' | 'dl' | 'algo'
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
