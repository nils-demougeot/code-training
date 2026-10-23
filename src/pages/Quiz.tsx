import clsx from 'clsx'
import { ArrowRight, Flame, Play, RotateCcw, Timer, Trophy, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CodeBlock, Markdown } from '@/components/Markdown'
import { DomainChip, PageHeader, ProgressBar } from '@/components/ui'
import { DOMAIN_ORDER, quizQuestions } from '@/lib/content'
import { DOMAINS } from '@/lib/domains'
import { useProgress } from '@/lib/progress'
import type { Domain, QuizQuestion } from '@/lib/types'

const SECONDS = 20

function pickQuestions(domain: Domain | null, n: number): QuizQuestion[] {
  const seen = useProgress.getState().p.quiz.seen
  const pool = quizQuestions.filter((q) => !domain || q.domain === domain)
  // Favour unseen and previously missed questions, with some randomness.
  const weight = (q: QuizQuestion) => {
    const s = seen[q.id]
    if (!s) return 3
    return 1 + s.wrong * 2 - Math.min(s.right, 3) * 0.3
  }
  return pool
    .map((q) => ({ q, k: Math.random() * Math.max(0.3, weight(q)) }))
    .sort((a, b) => b.k - a.k)
    .slice(0, n)
    .map((x) => x.q)
}

interface Answer {
  q: QuizQuestion
  choice: number | null
  correct: boolean
  points: number
}

export default function Quiz() {
  const [params] = useSearchParams()
  const quickN = Number(params.get('n')) || 0
  const [domain, setDomain] = useState<Domain | null>(null)
  const [count, setCount] = useState(10)
  const [game, setGame] = useState<QuizQuestion[] | null>(() => (quickN ? pickQuestions(null, quickN) : null))
  const p = useProgress((s) => s.p)

  const counts = useMemo(
    () => Object.fromEntries(DOMAIN_ORDER.map((d) => [d, quizQuestions.filter((q) => q.domain === d).length])),
    [],
  )

  if (game) return <Game key={game.map((q) => q.id).join()} questions={game} onRestart={() => setGame(pickQuestions(domain, count))} onExit={() => setGame(null)} />

  return (
    <div>
      <PageHeader
        icon={<Zap className="size-6" />}
        title="Quiz éclair"
        subtitle="Prédis la sortie d’un snippet en 20 secondes. Idéal pour fixer les pièges de syntaxe et les concepts."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="section-title mb-3">Thème</div>
          <div className="flex flex-wrap gap-2">
            <ThemeButton active={!domain} onClick={() => setDomain(null)} label="Tout mélanger" n={quizQuestions.length} />
            {DOMAIN_ORDER.filter((d) => counts[d] > 0).map((d) => (
              <ThemeButton key={d} active={domain === d} onClick={() => setDomain(d)} label={DOMAINS[d].label} n={counts[d]} color={DOMAINS[d].color} />
            ))}
          </div>
          <div className="section-title mt-6 mb-3">Nombre de questions</div>
          <div className="flex gap-2">
            {[5, 10, 20].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={clsx('btn px-5', count === n ? 'btn-primary' : 'btn-ghost')}
              >
                {n}
              </button>
            ))}
          </div>
          <button className="btn btn-primary mt-8 px-6 py-3 text-base" onClick={() => setGame(pickQuestions(domain, count))}>
            <Play className="size-5" />
            Lancer la partie
          </button>
        </div>
        <div className="card space-y-4 p-6">
          <div className="section-title">Records</div>
          <Record icon={<Trophy className="size-5 text-warn" />} label="Meilleur score" value={p.quiz.bestScore.toLocaleString('fr-FR')} />
          <Record icon={<Flame className="size-5 text-orange-400" />} label="Meilleur combo" value={`×${p.quiz.bestCombo}`} />
          <Record
            icon={<Zap className="size-5 text-accent-2" />}
            label="Précision globale"
            value={p.quiz.answered ? `${Math.round((p.quiz.correct / p.quiz.answered) * 100)} %` : '—'}
          />
          <p className="pt-2 text-xs text-faint">
            Règles : 100 points par bonne réponse + bonus de rapidité, multipliés par ton combo. Les questions ratées
            reviennent plus souvent.
          </p>
        </div>
      </div>
    </div>
  )
}

function ThemeButton({ active, onClick, label, n, color }: { active: boolean; onClick: () => void; label: string; n: number; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-xl border px-4 py-2 text-left text-sm transition',
        active ? 'border-accent/50 bg-accent/15' : 'border-line bg-white/[0.02] hover:border-line-strong',
      )}
    >
      <div className="font-medium" style={{ color: active ? undefined : color }}>
        {label}
      </div>
      <div className="text-[11px] text-faint">{n} questions</div>
    </button>
  )
}

function Record({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-xl bg-white/[0.04]">{icon}</div>
      <div>
        <div className="text-xs text-muted">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  )
}

function Game({ questions, onRestart, onExit }: { questions: QuizQuestion[]; onRestart: () => void; onExit: () => void }) {
  const quizAnswer = useProgress((s) => s.quizAnswer)
  const quizFinish = useProgress((s) => s.quizFinish)
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [choice, setChoice] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const [left, setLeft] = useState(SECONDS)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [score, setScore] = useState(0)
  const q = questions[i]
  const done = i >= questions.length

  const answer = useCallback(
    (c: number | null) => {
      if (locked || !q) return
      const correct = c === q.answer
      const newCombo = correct ? combo + 1 : 0
      const points = correct ? Math.round((100 + left * 5) * (1 + Math.min(newCombo - 1, 10) * 0.1)) : 0
      setChoice(c)
      setLocked(true)
      setCombo(newCombo)
      setBestCombo((b) => Math.max(b, newCombo))
      setScore((s) => s + points)
      setAnswers((a) => [...a, { q, choice: c, correct, points }])
      quizAnswer(q.id, correct, newCombo)
    },
    [locked, q, combo, left, quizAnswer],
  )

  const next = useCallback(() => {
    setI((x) => x + 1)
    setChoice(null)
    setLocked(false)
    setLeft(SECONDS)
  }, [])

  useEffect(() => {
    if (locked || done) return
    if (left <= 0) {
      answer(null)
      return
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => clearTimeout(t)
  }, [left, locked, done, answer])

  useEffect(() => {
    if (done) quizFinish(score, bestCombo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return
      const n = Number(e.key)
      if (!locked && n >= 1 && n <= (q?.choices.length ?? 0)) answer(n - 1)
      if (locked && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [locked, q, answer, next, done])

  if (done) {
    const right = answers.filter((a) => a.correct).length
    const missed = answers.filter((a) => !a.correct)
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="card p-8 text-center animate-pop">
          <Trophy className="mx-auto size-10 text-warn" />
          <div className="mt-3 text-4xl font-semibold tracking-tight">{score.toLocaleString('fr-FR')}</div>
          <div className="mt-1 text-sm text-muted">
            {right}/{answers.length} bonnes réponses · meilleur combo ×{bestCombo}
          </div>
          <div className="mt-6 flex justify-center gap-2">
            <button className="btn btn-ghost" onClick={onExit}>
              Changer de thème
            </button>
            <button className="btn btn-primary" onClick={onRestart}>
              <RotateCcw className="size-4" />
              Rejouer
            </button>
          </div>
        </div>
        {missed.length > 0 && (
          <div>
            <div className="section-title mb-3">À revoir</div>
            <div className="space-y-3">
              {missed.map(({ q: m, choice: c }) => (
                <div key={m.id} className="card p-5">
                  <div className="mb-2 text-sm font-medium">{m.question}</div>
                  {m.code && <CodeBlock code={m.code} className="mb-3 text-xs" />}
                  <div className="mb-2 flex flex-wrap gap-2 text-xs">
                    {c !== null && <span className="rounded-lg bg-bad/10 px-2 py-1 font-mono text-bad">{m.choices[c]}</span>}
                    <span className="rounded-lg bg-ok/10 px-2 py-1 font-mono text-ok">{m.choices[m.answer]}</span>
                  </div>
                  <Markdown className="text-muted">{m.explain}</Markdown>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="text-center">
          <Link to="/" className="text-sm text-muted hover:text-fg">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-4 text-sm">
        <button className="btn btn-quiet px-2 py-1 text-xs" onClick={onExit}>
          Quitter
        </button>
        <span className="text-faint">
          {i + 1}/{questions.length}
        </span>
        <div className="flex-1" />
        <span className={clsx('flex items-center gap-1 font-semibold transition', combo > 1 ? 'text-orange-400' : 'text-faint')}>
          <Flame className="size-4" />×{combo}
        </span>
        <span className="font-mono font-semibold">{score.toLocaleString('fr-FR')}</span>
      </div>
      <div className="mb-5 flex items-center gap-2">
        <Timer className={clsx('size-4', left <= 5 && !locked ? 'text-bad' : 'text-faint')} />
        <ProgressBar
          value={left / SECONDS}
          className="flex-1"
          color={left <= 5 ? '#f87171' : left <= 10 ? '#fbbf24' : undefined}
        />
      </div>

      <div key={q.id} className="card p-6 animate-fade-up">
        <div className="mb-3 flex items-center gap-2">
          <DomainChip domain={q.domain} />
          <span className="chip">{q.topic}</span>
        </div>
        <div className="mb-4 text-lg font-medium">{q.question}</div>
        {q.code && <CodeBlock code={q.code} className="mb-5" />}
        <div className="grid gap-2 sm:grid-cols-2">
          {q.choices.map((c, idx) => {
            const isAnswer = idx === q.answer
            const isChosen = idx === choice
            return (
              <button
                key={idx}
                disabled={locked}
                onClick={() => answer(idx)}
                className={clsx(
                  'flex items-start gap-3 rounded-xl border px-4 py-3 text-left font-mono text-sm whitespace-pre-wrap transition',
                  !locked && 'border-line bg-white/[0.02] hover:border-accent/50 hover:bg-accent/[0.06]',
                  locked && isAnswer && 'border-ok/50 bg-ok/10 text-ok',
                  locked && isChosen && !isAnswer && 'border-bad/50 bg-bad/10 text-bad animate-shake',
                  locked && !isAnswer && !isChosen && 'border-line opacity-40',
                )}
              >
                <span className="kbd mt-0.5 shrink-0">{idx + 1}</span>
                <span className="break-all">{c}</span>
              </button>
            )
          })}
        </div>
        {locked && (
          <div className="mt-5 animate-fade-up">
            <div className={clsx('mb-2 text-sm font-semibold', choice === q.answer ? 'text-ok' : 'text-bad')}>
              {choice === q.answer
                ? `Bien vu ! +${answers[answers.length - 1]?.points ?? 0} pts`
                : choice === null
                  ? 'Temps écoulé !'
                  : 'Raté !'}
            </div>
            <Markdown className="text-muted">{q.explain}</Markdown>
            <button className="btn btn-primary mt-4" onClick={next}>
              {i + 1 < questions.length ? 'Question suivante' : 'Voir le résultat'}
              <ArrowRight className="size-4" />
              <span className="kbd border-white/20 text-white/70">Entrée</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
