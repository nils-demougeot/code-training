import clsx from 'clsx'
import {
  ArrowRight, Calculator, CalendarDays, Check, ChevronDown, Delete, Flame, Heart, Lightbulb, RotateCcw, SkipForward, Target, Timer, Trophy, Volume2,
  VolumeX, X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PageHeader } from '@/components/ui'
import { celebrate } from '@/lib/celebrate'
import { useProgress } from '@/lib/progress'
import { DAILY_LEVELS, fr, isRight, LEVELS, levelById, TIPS, type Problem } from '@/mental/generators'
import { rng } from '@/maths/core'

// ---------------------------------------------------------------- modes

type Mode = 'sprint' | 'survival' | 'training' | 'daily'

const MODES: { id: Exclude<Mode, 'daily'>; label: string; icon: ReactNode; desc: string }[] = [
  { id: 'sprint', label: 'Sprint 60 s', icon: <Timer className="size-4" />, desc: 'Un maximum de calculs en une minute. Les combos multiplient les points.' },
  { id: 'survival', label: 'Survie', icon: <Heart className="size-4" />, desc: '3 vies, et le temps par calcul raccourcit à chaque bonne réponse.' },
  { id: 'training', label: 'Entraînement', icon: <Target className="size-4" />, desc: '15 calculs sans chrono, avec l’astuce à chaque erreur.' },
]

const SPRINT_MS = 60_000
const TRAINING_COUNT = 15
const today = () => new Date().toLocaleDateString('en-CA')
const daySeed = (d: string) => Number(d.replace(/-/g, ''))

/** Multiplier from the current combo: ×1, ×1.5 from 5 in a row, ×2 from 10, up to ×3. */
const comboMult = (combo: number) => Math.min(3, 1 + Math.floor(combo / 5) * 0.5)

// ---------------------------------------------------------------- sound

let audio: AudioContext | null = null
function beep(ok: boolean) {
  try {
    audio ??= new AudioContext()
    const o = audio.createOscillator()
    const g = audio.createGain()
    o.type = ok ? 'sine' : 'square'
    o.frequency.value = ok ? 880 : 160
    g.gain.setValueAtTime(ok ? 0.06 : 0.04, audio.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + (ok ? 0.12 : 0.25))
    o.connect(g).connect(audio.destination)
    o.start()
    o.stop(audio.currentTime + 0.26)
  } catch {
    /* no audio */
  }
}

function useSound() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem('mental-sound') !== 'off'
    } catch {
      return true
    }
  })
  const toggle = () =>
    setOn((v) => {
      try {
        localStorage.setItem('mental-sound', v ? 'off' : 'on')
      } catch {
        /* ignore */
      }
      return !v
    })
  return [on, toggle] as const
}

// ---------------------------------------------------------------- page

interface GameConfig {
  mode: Mode
  level: number
}

export default function Mental() {
  const [mode, setMode] = useState<Exclude<Mode, 'daily'>>('sprint')
  const [game, setGame] = useState<GameConfig | null>(null)
  const [sound, toggleSound] = useSound()
  const mental = useProgress((s) => s.p.mental) ?? {}
  const totalCorrect = Object.values(mental).reduce((a, m) => a + m.correct, 0)
  const bestCombo = Object.values(mental).reduce((a, m) => Math.max(a, m.bestCombo), 0)
  const dailyDone = mental[`daily:${today()}`]
  const dailyStreak = useMemo(() => {
    let n = 0
    const d = new Date()
    if (!mental[`daily:${today()}`]) d.setDate(d.getDate() - 1)
    while (mental[`daily:${d.toLocaleDateString('en-CA')}`]) {
      n++
      d.setDate(d.getDate() - 1)
    }
    return n
  }, [mental])

  return (
    <div>
      <PageHeader
        icon={<Calculator className="size-6" />}
        title="Calcul mental"
        subtitle="Des tables jusqu’aux ordres de grandeur d’un entretien de cas. Joue au clavier sur ordinateur, ou avec le pavé numérique sur téléphone."
      />

      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <MiniStat label="Bonnes réponses" value={totalCorrect} />
        <MiniStat label="Meilleur combo" value={bestCombo} />
        <button onClick={toggleSound} className="card card-hover flex items-center gap-2 p-3 text-left sm:gap-3 sm:p-4" aria-pressed={sound}>
          {sound ? <Volume2 className="size-5 shrink-0 text-accent" /> : <VolumeX className="size-5 shrink-0 text-faint" />}
          <div className="min-w-0">
            <div className="text-[11px] text-faint sm:text-xs">Son</div>
            <div className="font-semibold">{sound ? 'Activé' : 'Coupé'}</div>
          </div>
        </button>
      </div>

      <button
        onClick={() => setGame({ mode: 'daily', level: 0 })}
        className="card card-hover group relative mb-6 flex w-full items-center gap-4 overflow-hidden p-5 text-left"
        data-daily
      >
        <div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-accent/20 blur-3xl" />
        <span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white sm:flex">
          <CalendarDays className="size-6" />
        </span>
        <div className="relative min-w-0 flex-1">
          <div className="flex items-center gap-2 font-semibold">
            <CalendarDays className="size-4 text-accent sm:hidden" />
            Défi du jour
          </div>
          <div className="text-sm text-muted">10 calculs de difficulté croissante, les mêmes pour tout le monde aujourd’hui. Plus tu vas vite, plus tu marques.</div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs">
            {dailyDone ? <span className="text-ok">Fait aujourd’hui : {dailyDone.best} pts</span> : <span className="text-warn">Pas encore joué aujourd’hui</span>}
            {dailyStreak > 0 && (
              <span className="flex items-center gap-1 text-orange-400">
                <Flame className="size-3.5" /> {dailyStreak} jour{dailyStreak > 1 ? 's' : ''} d’affilée
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="relative size-5 shrink-0 text-faint transition group-hover:translate-x-1 group-hover:text-fg" />
      </button>

      <div className="section-title mb-3">Mode de jeu</div>
      <div className="mb-6 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Mode de jeu">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={mode === m.id}
            data-mode={m.id}
            onClick={() => setMode(m.id)}
            className={clsx(
              'rounded-xl border p-3 text-left transition',
              mode === m.id ? 'border-accent/60 bg-accent/10' : 'border-line hover:border-line-strong',
            )}
          >
            <div className={clsx('flex items-center gap-1.5 text-sm font-medium', mode === m.id && 'text-accent')}>
              {m.icon}
              {m.label}
            </div>
            <div className="mt-1 hidden text-xs text-muted sm:block">{m.desc}</div>
          </button>
        ))}
      </div>
      <p className="-mt-4 mb-6 text-xs text-muted sm:hidden">{MODES.find((m) => m.id === mode)!.desc}</p>

      <div className="section-title mb-3">Niveau</div>
      <div className="mb-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {LEVELS.map((l) => {
          const rec = mental[`${mode}:${l.id}`]
          return (
            <button
              key={l.id}
              data-level={l.id}
              onClick={() => setGame({ mode, level: l.id })}
              className="card card-hover group flex items-center gap-4 p-4 text-left"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-2xl">{l.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] text-faint">Niv. {l.id}</span>
                  <span className="font-semibold">{l.name}</span>
                </div>
                <div className="text-xs text-muted">{l.desc}</div>
                <div className="mt-1 flex items-center gap-3 text-xs">
                  <span className="font-mono text-faint">{l.sample}</span>
                  {rec && (
                    <span className="ml-auto flex items-center gap-1 text-warn">
                      <Trophy className="size-3.5" /> {rec.best}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="section-title mb-3">Les astuces à connaître</div>
      <div className="grid gap-2 md:grid-cols-2">
        {Object.entries(TIPS).map(([k, t]) => (
          <Tip key={k} title={t.title} text={t.text} />
        ))}
      </div>

      {game && <Game key={`${game.mode}-${game.level}`} config={game} sound={sound} onExit={() => setGame(null)} onReplay={() => setGame({ ...game })} />}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="card p-3 sm:p-4">
      <div className="truncate text-[11px] text-faint sm:text-xs">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function Tip({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card">
      <button className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Lightbulb className="size-4 shrink-0 text-warn" />
        <span className="flex-1">{title}</span>
        <ChevronDown className={clsx('size-4 text-faint transition', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-line px-3 py-2.5 text-sm text-muted">{text}</div>}
    </div>
  )
}

// ---------------------------------------------------------------- game

interface Answered {
  p: Problem
  typed: string
  ok: boolean
  ms: number
}

interface Feedback {
  ok: boolean
  problem: Problem
  typed: string
}

function Game({ config, sound, onExit, onReplay }: { config: GameConfig; sound: boolean; onExit: () => void; onReplay: () => void }) {
  const { mode } = config
  const finishMental = useProgress((s) => s.finishMental)
  // The record before this game (the store is updated when the game ends).
  const [prevBest] = useState(() => useProgress.getState().p.mental?.[keyOf(config)]?.best)

  // Question i is a pure function of a seed (the date for the daily challenge), so it never changes on re-render.
  const [seed] = useState(() => (mode === 'daily' ? daySeed(today()) : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0))
  const [qIndex, setQIndex] = useState(0)
  const current = useMemo(() => {
    const lvl = levelById.get(mode === 'daily' ? DAILY_LEVELS[Math.min(qIndex, DAILY_LEVELS.length - 1)] : config.level)!
    const before = qIndex > 0 ? lvl.gen(rng(seed + (qIndex - 1) * 7919)).text : ''
    // Avoid showing the same question twice in a row.
    for (let t = 0; ; t++) {
      const p = lvl.gen(rng(seed + qIndex * 7919 + t * 104729))
      if (p.text !== before || t >= 4) return { p, lvl }
    }
  }, [mode, config.level, seed, qIndex])
  const [typed, setTyped] = useState('')
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [lives, setLives] = useState(3)
  const [history, setHistory] = useState<Answered[]>([])
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [floats, setFloats] = useState<{ id: number; text: string }[]>([])
  const [shake, setShake] = useState(0)
  const [flash, setFlash] = useState(0)
  const [ended, setEnded] = useState(false)
  const [result, setResult] = useState<{ xp: number; record: boolean } | null>(null)
  const [countdown, setCountdown] = useState(3)
  const [startedAt, setStartedAt] = useState(0)
  const [qStart, setQStart] = useState(0)
  const [now, setNow] = useState(Date.now())

  const correctCount = history.filter((h) => h.ok).length
  const lvl = current.lvl
  const surviveLimit = lvl.seconds * 1000 * Math.max(0.35, 0.96 ** correctCount)
  const playing = countdown === 0 && !ended

  // 3, 2, 1, go!
  useEffect(() => {
    if (countdown === 0) return
    const t = setTimeout(() => {
      if (countdown === 1) {
        const n = Date.now()
        setStartedAt(n)
        setQStart(n)
      }
      setCountdown((c) => c - 1)
    }, 550)
    return () => clearTimeout(t)
  }, [countdown])

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [playing])

  const next = useCallback(() => {
    setQIndex((i) => i + 1)
    setTyped('')
    setFeedback(null)
    setQStart(Date.now())
  }, [])

  const end = useCallback(() => setEnded(true), [])

  const fail = useCallback(
    (typedValue: string) => {
      if (feedback || !playing) return
      const p = current.p
      setHistory((h) => [...h, { p, typed: typedValue, ok: false, ms: Date.now() - qStart }])
      setCombo(0)
      setShake((s) => s + 1)
      setFeedback({ ok: false, problem: p, typed: typedValue })
      if (sound) beep(false)
      navigator.vibrate?.(90)
      const done = mode === 'daily' ? history.length + 1 >= DAILY_LEVELS.length : mode === 'training' ? history.length + 1 >= TRAINING_COUNT : false
      if (mode === 'survival') {
        const left = lives - 1
        setLives(left)
        setTimeout(left <= 0 ? end : next, 1100)
      } else if (mode === 'training') {
        // Waits for "Continue".
      } else {
        setTimeout(done ? end : next, 900)
      }
    },
    [feedback, playing, current, qStart, sound, mode, history.length, lives, end, next],
  )

  const succeed = useCallback(
    (typedValue: string) => {
      const p = current.p
      const ms = Date.now() - qStart
      const c = combo + 1
      const pts = mode === 'daily' ? Math.max(20, Math.round(100 - ms / 250)) : Math.round(10 * current.lvl.weight * comboMult(combo))
      setHistory((h) => [...h, { p, typed: typedValue, ok: true, ms }])
      setScore((s) => s + pts)
      setCombo(c)
      setBestCombo((b) => Math.max(b, c))
      setFlash((f) => f + 1)
      const id = Date.now() + Math.random()
      setFloats((f) => [...f, { id, text: `+${pts}` }])
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 800)
      if (sound) beep(true)
      navigator.vibrate?.(12)
      const n = history.length + 1
      if ((mode === 'daily' && n >= DAILY_LEVELS.length) || (mode === 'training' && n >= TRAINING_COUNT)) end()
      else next()
    },
    [current, qStart, combo, mode, sound, history.length, end, next],
  )

  const press = useCallback(
    (key: string) => {
      if (!playing) return
      if (feedback) {
        if (mode === 'training' && (key === 'enter' || key === 'skip')) {
          if (history.length >= TRAINING_COUNT) end()
          else next()
        }
        return
      }
      if (key === 'enter') {
        if (typed) fail(typed)
        return
      }
      if (key === 'skip') return fail('')
      let t = typed
      if (key === 'back') t = t.slice(0, -1)
      else if (key === '-') t = t.startsWith('-') ? t.slice(1) : `-${t}`
      else if (key === ',') t = t.includes(',') ? t : `${t || '0'},`
      else if (/^\d$/.test(key) && t.replace(/[-,]/g, '').length < 9) t += key
      setTyped(t)
      // Correct answers are accepted as soon as they are typed.
      if (isRight(t, current.p.answer)) succeed(t)
    },
    [playing, feedback, mode, history.length, typed, current, end, next, fail, succeed],
  )

  // Physical keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key
      let key: string | null = null
      if (/^\d$/.test(k)) key = k
      else if (k === 'Backspace') key = 'back'
      else if (k === 'Enter' || k === '=') key = 'enter'
      else if (k === '-' || k === '_') key = '-'
      else if (k === ',' || k === '.') key = ','
      else if (k === 'Tab') key = 'skip'
      else if (k === 'Escape') {
        onExit()
        return
      }
      if (key) {
        e.preventDefault()
        press(key)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, onExit])

  // Clocks: the sprint ends after 60 s, a survival question times out.
  useEffect(() => {
    if (!playing) return
    if (mode === 'sprint' && now - startedAt >= SPRINT_MS) end()
    else if (mode === 'survival' && !feedback && now - qStart >= surviveLimit) fail(typed)
  }, [now, playing, mode, startedAt, qStart, surviveLimit, feedback, typed, end, fail])

  // Save once.
  useEffect(() => {
    if (!ended || result) return
    const r = finishMental(keyOf(config), { score, correct: correctCount, combo: bestCombo })
    setResult(r)
    if (r.record || (prevBest === undefined && correctCount > 0)) celebrate()
  }, [ended, result, finishMental, config, score, correctCount, bestCombo, prevBest])

  // Lock the page behind the overlay.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const title = mode === 'daily' ? 'Défi du jour' : `${lvl.emoji} ${lvl.name} · ${MODES.find((m) => m.id === mode)!.label}`
  const sprintLeft = Math.max(0, SPRINT_MS - (now - startedAt))
  const timeShare = mode === 'sprint' ? sprintLeft / SPRINT_MS : mode === 'survival' ? Math.max(0, 1 - (now - qStart) / surviveLimit) : null
  const progress = mode === 'daily' ? `${Math.min(history.length + 1, DAILY_LEVELS.length)} / ${DAILY_LEVELS.length}` : mode === 'training' ? `${Math.min(history.length + 1, TRAINING_COUNT)} / ${TRAINING_COUNT}` : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" data-game={mode}>
      <div className="pointer-events-none absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col px-4">
        {/* Top bar */}
        <div className="flex items-center gap-3 py-3">
          <button onClick={onExit} className="btn-quiet btn -ml-2 px-2" aria-label="Quitter">
            <X className="size-5" />
          </button>
          <div className="min-w-0 flex-1 truncate text-center text-sm text-muted">{title}</div>
          <div className="w-9" />
        </div>

        {!ended ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <div className="font-semibold tabular-nums" data-points={score}>
                {score} <span className="text-xs font-normal text-faint">pts</span>
              </div>
              {mode === 'survival' && (
                <div className="flex gap-1" aria-label={`${lives} vies`}>
                  {[0, 1, 2].map((i) => (
                    <Heart key={i} className={clsx('size-5 transition', i < lives ? 'fill-bad text-bad' : 'text-white/15')} />
                  ))}
                </div>
              )}
              {mode === 'sprint' && <div className="font-mono tabular-nums text-muted">{Math.ceil(sprintLeft / 1000)} s</div>}
              {progress && <div className="text-muted tabular-nums">{progress}</div>}
              <div className={clsx('flex items-center gap-1 tabular-nums', combo >= 5 ? 'text-orange-400' : 'text-faint')} data-combo={combo}>
                <Flame className={clsx('size-4', combo >= 10 && 'animate-pulse')} />
                {combo}
                {comboMult(combo) > 1 && mode !== 'daily' && <span className="text-xs">×{comboMult(combo)}</span>}
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              {timeShare !== null && (
                <div
                  className={clsx('h-full rounded-full transition-[width] duration-100 ease-linear', timeShare > 0.3 ? 'bg-gradient-to-r from-accent to-accent-2' : 'bg-bad')}
                  style={{ width: `${timeShare * 100}%` }}
                />
              )}
            </div>

            {/* Question */}
            <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center py-4">
              {countdown > 0 ? (
                <div key={countdown} className="text-7xl font-bold text-accent animate-pop">
                  {countdown}
                </div>
              ) : (
                <>
                  <div
                    key={current.p.text + history.length}
                    className={clsx(
                      'text-center font-semibold tracking-tight tabular-nums animate-pop',
                      current.p.text.length > 22 ? 'text-2xl sm:text-3xl' : current.p.text.length > 12 ? 'text-4xl sm:text-5xl' : 'text-6xl sm:text-7xl',
                    )}
                    data-question={current.p.text}
                    data-answer={current.p.answer}
                  >
                    {current.p.text}
                  </div>
                  <div
                    key={`a${shake}-${flash}`}
                    className={clsx(
                      'mt-6 flex h-16 min-w-[10rem] items-center justify-center rounded-2xl border px-5 text-4xl font-semibold tabular-nums',
                      feedback ? (feedback.ok ? 'border-ok' : 'border-bad text-bad animate-shake') : 'border-line-strong bg-white/[0.03]',
                      flash > 0 && !feedback && 'animate-flash',
                    )}
                    data-typed={typed}
                  >
                    {typed.replace('-', '−') || <span className="text-white/15">?</span>}
                    {!feedback && <span className="ml-0.5 h-8 w-0.5 animate-pulse bg-accent" />}
                    {current.p.unit && <span className="ml-2 text-lg font-normal text-faint">{current.p.unit}</span>}
                  </div>
                  {floats.map((f) => (
                    <span key={f.id} className="pointer-events-none absolute top-1/2 left-1/2 text-2xl font-bold text-ok animate-float-up">
                      {f.text}
                    </span>
                  ))}
                  <div className="mt-3 min-h-[4.5rem] text-center text-sm" aria-live="polite">
                    {feedback && !feedback.ok && (
                      <div className="animate-fade-up" data-feedback>
                        <div>
                          {feedback.problem.text} = <b className="text-ok">{fr(feedback.problem.answer)}</b>
                          {feedback.problem.unit && ` ${feedback.problem.unit}`}
                        </div>
                        {mode === 'training' && (
                          <div className="mx-auto mt-2 max-w-sm rounded-xl border border-warn/25 bg-warn/[0.05] p-2.5 text-left text-xs text-muted">
                            <b className="text-warn">💡 {TIPS[feedback.problem.kind].title}</b> · {TIPS[feedback.problem.kind].text}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <Keypad onPress={press} trainingWait={mode === 'training' && !!feedback} />
            <div className="hidden pb-3 text-center text-[11px] text-faint lg:block">
              Clavier : chiffres, <kbd className="kbd">,</kbd> <kbd className="kbd">-</kbd> <kbd className="kbd">Entrée</kbd> valider, <kbd className="kbd">Tab</kbd> passer,{' '}
              <kbd className="kbd">Échap</kbd> quitter
            </div>
          </>
        ) : (
          <Results
            mode={mode}
            score={score}
            history={history}
            bestCombo={bestCombo}
            prevBest={prevBest}
            result={result}
            onReplay={onReplay}
            onExit={onExit}
          />
        )}
      </div>
    </div>
  )
}

const keyOf = (c: GameConfig) => (c.mode === 'daily' ? `daily:${today()}` : `${c.mode}:${c.level}`)

function Keypad({ onPress, trainingWait }: { onPress: (k: string) => void; trainingWait: boolean }) {
  const btn = (key: string, label: ReactNode, cls = '') => (
    <button
      key={key}
      data-key={key}
      onPointerDown={(e) => {
        e.preventDefault()
        onPress(key)
      }}
      className={clsx(
        'flex h-14 select-none items-center justify-center rounded-2xl text-2xl font-medium transition active:scale-95 sm:h-16',
        'touch-manipulation',
        cls || 'bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.16]',
      )}
    >
      {label}
    </button>
  )
  if (trainingWait) {
    return (
      <div className="pb-4">
        <button
          data-key="continue"
          onPointerDown={(e) => {
            e.preventDefault()
            onPress('enter')
          }}
          className="btn btn-primary h-14 w-full touch-manipulation text-lg"
        >
          Continuer <ArrowRight className="size-5" />
        </button>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-2 pb-4" data-keypad>
      {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((d) => btn(d, d))}
      {btn(',', ',')}
      {btn('0', '0')}
      {btn('back', <Delete className="size-6" />, 'bg-white/[0.03] text-muted hover:bg-white/[0.08]')}
      {btn('-', '±', 'bg-white/[0.03] text-muted hover:bg-white/[0.08] text-xl')}
      {btn('skip', <span className="flex items-center gap-1 text-sm">Passer <SkipForward className="size-4" /></span>, 'bg-white/[0.03] text-muted hover:bg-white/[0.08]')}
      {btn('enter', <Check className="size-7" />, 'bg-gradient-to-br from-accent to-accent-2 text-white')}
    </div>
  )
}

function Results({
  mode,
  score,
  history,
  bestCombo,
  prevBest,
  result,
  onReplay,
  onExit,
}: {
  mode: Mode
  score: number
  history: Answered[]
  bestCombo: number
  prevBest?: number
  result: { xp: number; record: boolean } | null
  onReplay: () => void
  onExit: () => void
}) {
  const ok = history.filter((h) => h.ok)
  const accuracy = history.length ? Math.round((ok.length / history.length) * 100) : 0
  const avg = ok.length ? ok.reduce((a, h) => a + h.ms, 0) / ok.length / 1000 : 0
  const mistakes = history.filter((h) => !h.ok)
  const verdict =
    accuracy >= 95 && ok.length >= 10 ? 'Machine à calculer 🤖' : accuracy >= 85 ? 'Très solide 💪' : accuracy >= 65 ? 'Pas mal, encore un effort 👍' : 'Revois les astuces et rejoue 📚'
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-6" data-results>
      <div className="py-4 text-center animate-pop">
        {result?.record && <div className="mb-2 inline-block rounded-full bg-warn/15 px-3 py-1 text-sm font-semibold text-warn">🏆 Nouveau record !</div>}
        <div className="text-6xl font-bold tabular-nums" data-final-score={score}>
          {score}
        </div>
        <div className="text-sm text-muted">points{prevBest !== undefined && !result?.record && ` · record ${prevBest}`}</div>
        <div className="mt-2 font-medium">{verdict}</div>
        {!!result?.xp && <div className="mt-1 text-sm text-accent-2">+{result.xp} XP</div>}
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <ResultStat label="Bonnes réponses" value={`${ok.length} / ${history.length}`} />
        <ResultStat label="Précision" value={`${accuracy} %`} />
        <ResultStat label="Temps moyen" value={`${avg.toFixed(1).replace('.', ',')} s`} />
        <ResultStat label="Meilleur combo" value={bestCombo} />
      </div>
      {mistakes.length > 0 && (
        <div className="mt-5">
          <div className="section-title mb-2">À retravailler</div>
          <ul className="space-y-2">
            {mistakes.map((m, i) => (
              <li key={i} className="rounded-xl border border-line bg-white/[0.02] p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {m.p.text} = <span className="text-ok">{fr(m.p.answer)}</span>
                    {m.p.unit && ` ${m.p.unit}`}
                  </span>
                  <span className="text-xs text-bad">{m.typed ? `tu as répondu ${m.typed.replace('-', '−')}` : mode === 'survival' ? 'temps écoulé ou passé' : 'passé'}</span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  💡 <b>{TIPS[m.p.kind].title}</b> · {TIPS[m.p.kind].text}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-6 grid grid-cols-2 gap-2">
        {mode !== 'daily' ? (
          <button className="btn btn-primary h-12 justify-center" onClick={onReplay} data-replay>
            <RotateCcw className="size-4" /> Rejouer
          </button>
        ) : (
          <div className="flex items-center justify-center text-center text-xs text-muted">Nouveau défi demain !</div>
        )}
        <button className="btn btn-ghost h-12 justify-center" onClick={onExit}>
          Niveaux
        </button>
      </div>
    </div>
  )
}

function ResultStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-3">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-faint">{label}</div>
    </div>
  )
}

