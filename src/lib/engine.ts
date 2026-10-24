import { create } from 'zustand'
import { useSettings } from './settings'
import type { EvalResult, RunResult, TestCase } from './types'

const PYODIDE_URL: string =
  import.meta.env.VITE_PYODIDE_URL ?? 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'
const BASE = import.meta.env.BASE_URL

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'busy' | 'error'

interface EngineState {
  status: EngineStatus
  message: string | null
  version: string | null
  runner: { reachable: boolean; info: RunnerInfo | null; checkedAt: number } | null
  set: (patch: Partial<Omit<EngineState, 'set'>>) => void
}

export interface RunnerInfo {
  python: string
  packages: Record<string, string | null>
  cuda: boolean
  mps: boolean
}

export const useEngine = create<EngineState>((set) => ({
  status: 'idle',
  message: null,
  version: null,
  runner: null,
  set: (patch) => set(patch),
}))

// ---------------------------------------------------------------- payloads

export type Payload =
  | { mode: 'run'; code: string; setup?: string; examples?: string[] }
  | { mode: 'test'; code: string; solution?: string; setup?: string; tests: TestCase[] }
  | {
      mode: 'eval'
      answer: string
      reference: string
      setup?: string
      kind?: string
      var?: string
      loose?: boolean
    }

function sourcesOf(p: Payload): string[] {
  if (p.mode === 'eval') return [p.setup ?? '', p.reference, p.answer]
  if (p.mode === 'run') return [p.setup ?? '', p.code, ...(p.examples ?? [])]
  const tests = p.tests.map((t) => [t.call, t.expected, t.check].filter(Boolean).join('\n'))
  return [p.setup ?? '', p.code, p.solution ?? '', ...tests]
}

// ---------------------------------------------------------------- browser engine (Pyodide)

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  onProgress?: (msg: string) => void
}

let worker: Worker | null = null
let initPromise: Promise<void> | null = null
let nextId = 1
const pending = new Map<number, Pending>()

function spawnWorker(): Worker {
  const w = new Worker(`${BASE}pyodide-worker.js`)
  w.onmessage = (event) => {
    const { id, ok, progress, result, error, version } = event.data
    const p = pending.get(id)
    if (!p) return
    if (progress) {
      p.onProgress?.(progress)
      return
    }
    pending.delete(id)
    if (ok) p.resolve(result ?? version)
    else p.reject(new Error(error))
  }
  w.onerror = (event) => {
    useEngine.getState().set({ status: 'error', message: event.message || 'Le worker Python a planté.' })
  }
  return w
}

function call<T>(message: Record<string, unknown>, onProgress?: (m: string) => void): Promise<T> {
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress })
    worker!.postMessage({ id, ...message })
  })
}

/** Starts Pyodide (idempotent). Safe to call early to warm up the engine. */
export function initBrowserEngine(): Promise<void> {
  if (initPromise) return initPromise
  const { set } = useEngine.getState()
  set({ status: 'loading', message: 'Chargement de Python…' })
  worker = spawnWorker()
  initPromise = call<string>({
    type: 'init',
    indexURL: PYODIDE_URL,
    harnessURL: new URL(`${BASE}harness.py`, location.href).href,
  })
    .then((version) => set({ status: 'ready', message: null, version }))
    .catch((err: Error) => {
      initPromise = null
      worker?.terminate()
      worker = null
      set({ status: 'error', message: `Impossible de charger Python : ${err.message}` })
      throw err
    })
  return initPromise
}

function resetWorker(reason: string) {
  worker?.terminate()
  worker = null
  initPromise = null
  for (const p of pending.values()) p.reject(new Error(reason))
  pending.clear()
}

async function execBrowser<T>(payload: Payload, timeoutMs: number, onProgress?: (m: string) => void, extra: string[] = []) {
  await initBrowserEngine()
  const { set } = useEngine.getState()
  set({ status: 'busy' })
  // On timeout the worker is killed, which rejects the pending call with "timeout".
  let timer = setTimeout(() => resetWorker('timeout'), timeoutMs)
  try {
    const result = await call<T>({ type: 'exec', payload, sources: [...sourcesOf(payload), ...extra] }, (m) => {
      // Package downloads must not count against the user's time budget.
      clearTimeout(timer)
      timer = setTimeout(() => resetWorker('timeout'), timeoutMs + 60_000)
      onProgress?.(m)
    })
    set({ status: 'ready' })
    return result
  } catch (err) {
    if ((err as Error).message === 'timeout') {
      set({ status: 'loading', message: 'Redémarrage de Python…' })
      initBrowserEngine().catch(() => {})
    } else {
      set({ status: worker ? 'ready' : 'error' })
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------- local runner

export async function checkRunner(): Promise<boolean> {
  const { runnerUrl, runnerToken } = useSettings.getState()
  try {
    const res = await fetch(`${runnerUrl.replace(/\/$/, '')}/health`, {
      headers: { 'X-Runner-Token': runnerToken },
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) throw new Error(String(res.status))
    const info = (await res.json()) as RunnerInfo
    useEngine.getState().set({ runner: { reachable: true, info, checkedAt: Date.now() } })
    return true
  } catch {
    useEngine.getState().set({ runner: { reachable: false, info: null, checkedAt: Date.now() } })
    return false
  }
}

async function execLocal<T>(payload: Payload, timeoutMs: number): Promise<T> {
  const { runnerUrl, runnerToken } = useSettings.getState()
  const { set } = useEngine.getState()
  set({ status: 'busy' })
  try {
    const res = await fetch(`${runnerUrl.replace(/\/$/, '')}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Runner-Token': runnerToken },
      body: JSON.stringify({ payload, timeout: timeoutMs / 1000 }),
    })
    if (res.status === 401) throw new Error('runner-auth')
    if (res.status === 408) throw new Error('timeout')
    if (!res.ok) throw new Error(`runner-${res.status}`)
    return (await res.json()) as T
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'timeout' || msg === 'runner-auth' || msg.startsWith('runner-')) throw err
    throw new Error('runner-unreachable')
  } finally {
    set({ status: 'ready' })
  }
}

// ---------------------------------------------------------------- public API

export interface ExecOptions {
  timeoutMs?: number
  /** Forces the local runner (exercises that need PyTorch). */
  requireLocal?: boolean
  onProgress?: (msg: string) => void
  /** More code whose imports must be loaded first (e.g. notebook cells embedded in the setup). */
  importsFrom?: string[]
}

export function activeEngine(requireLocal = false): 'browser' | 'local' {
  return requireLocal || useSettings.getState().engine === 'local' ? 'local' : 'browser'
}

function engineErrorMessage(err: Error, engine: 'browser' | 'local', timeoutMs: number): string {
  switch (err.message) {
    case 'timeout':
      return `Temps dépassé (${Math.round(timeoutMs / 1000)} s). Boucle infinie ? Python a été redémarré.`
    case 'runner-unreachable':
      return 'Runner local injoignable. Lance `python runner/local_runner.py` puis vérifie l’URL dans les réglages.'
    case 'runner-auth':
      return 'Token du runner local invalide : copie celui affiché dans le terminal dans les réglages.'
    default:
      return engine === 'local' ? `Erreur du runner local : ${err.message}` : `Erreur du moteur Python : ${err.message}`
  }
}

// Executions are serialized: one Python interpreter, one job at a time.
let queue: Promise<unknown> = Promise.resolve()

function execute<T>(payload: Payload, opts: ExecOptions): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 15_000
  const engine = activeEngine(opts.requireLocal)
  const job = queue.then(() =>
    engine === 'local'
      ? execLocal<T>(payload, timeoutMs)
      : execBrowser<T>(payload, timeoutMs, opts.onProgress, opts.importsFrom),
  )
  queue = job.catch(() => {})
  return job
}

export async function runCode(
  code: string,
  opts: ExecOptions & { setup?: string; examples?: string[] } = {},
): Promise<RunResult> {
  try {
    return await execute<RunResult>({ mode: 'run', code, setup: opts.setup, examples: opts.examples }, opts)
  } catch (err) {
    const engine = activeEngine(opts.requireLocal)
    return { ok: false, engineError: engineErrorMessage(err as Error, engine, opts.timeoutMs ?? 15_000) }
  }
}

export async function runTests(
  args: { code: string; solution?: string; setup?: string; tests: TestCase[] },
  opts: ExecOptions = {},
): Promise<RunResult> {
  try {
    return await execute<RunResult>({ mode: 'test', ...args }, { timeoutMs: 20_000, ...opts })
  } catch (err) {
    const engine = activeEngine(opts.requireLocal)
    return { ok: false, engineError: engineErrorMessage(err as Error, engine, opts.timeoutMs ?? 20_000) }
  }
}

export async function evalAnswer(
  args: { answer: string; reference: string; setup?: string; kind?: string; var?: string; loose?: boolean },
  opts: ExecOptions = {},
): Promise<EvalResult> {
  try {
    return await execute<EvalResult>({ mode: 'eval', ...args }, { timeoutMs: 8_000, ...opts })
  } catch (err) {
    const engine = activeEngine(opts.requireLocal)
    return {
      ok: false, correct: false, got: null, expected: null, error: null, reason: null,
      engineError: engineErrorMessage(err as Error, engine, opts.timeoutMs ?? 8_000),
    }
  }
}
