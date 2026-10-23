import clsx from 'clsx'
import { ArrowLeft, Check, CheckCircle2, HelpCircle, Loader2, PartyPopper, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CodeEditor } from '@/components/CodeEditor'
import { CodeBlock, Markdown } from '@/components/Markdown'
import { DomainChip, Empty, ProgressBar } from '@/components/ui'
import { cards as allCards, decks } from '@/lib/content'
import { evalAnswer } from '@/lib/engine'
import { useProgress } from '@/lib/progress'
import { dueCards, newCards } from '@/lib/recommend'
import { GRADES, previewIntervals, type Grade } from '@/lib/srs'
import type { EvalResult, FlashCard } from '@/lib/types'

const NEW_PER_SESSION = 10

function buildQueue(deck: string | null, cram: boolean): FlashCard[] {
  const p = useProgress.getState().p
  if (deck && cram) return allCards.filter((c) => c.deck === deck)
  const due = dueCards(p).filter((c) => !deck || c.deck === deck)
  const fresh = newCards(p, deck ?? undefined).slice(0, NEW_PER_SESSION)
  return [...due.sort((a, b) => p.cards[a.id].due - p.cards[b.id].due), ...fresh]
}

export default function Review() {
  const [params] = useSearchParams()
  const deck = params.get('deck')
  const cram = params.get('cram') === '1'
  const [queue, setQueue] = useState<FlashCard[]>(() => buildQueue(deck, cram))
  const [index, setIndex] = useState(0)
  const [stats, setStats] = useState({ right: 0, wrong: 0, xp: 0 })
  const total = useMemo(() => new Set(queue.map((c) => c.id)).size, [queue])
  const deckMeta = deck ? decks.find((d) => d.id === deck) : null

  useEffect(() => {
    setQueue(buildQueue(deck, cram))
    setIndex(0)
    setStats({ right: 0, wrong: 0, xp: 0 })
  }, [deck, cram])

  const card = queue[index]

  const onGraded = (grade: Grade, correct: boolean) => {
    setStats((s) => ({ right: s.right + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1), xp: s.xp + (correct ? 3 : 1) }))
    // A failed card comes back at the end of the session (once).
    if (grade === 0 && queue.filter((c) => c.id === card.id).length < 2) setQueue((q) => [...q, card])
    setIndex((i) => i + 1)
  }

  if (!queue.length) {
    return (
      <div className="mx-auto max-w-2xl">
        <BackLink />
        <Empty icon={<CheckCircle2 className="size-8 text-ok" />} title="Rien à réviser pour l’instant">
          Toutes tes cartes sont à jour. Reviens plus tard ou{' '}
          <Link to={deck ? `/memoire/revision?deck=${deck}&cram=1` : '/memoire'} className="text-accent">
            {deck ? 'revois tout le paquet' : 'choisis un paquet'}
          </Link>
          .
        </Empty>
      </div>
    )
  }

  if (!card) {
    const ratio = stats.right / Math.max(1, stats.right + stats.wrong)
    return (
      <div className="mx-auto max-w-xl">
        <div className="card p-8 text-center animate-pop">
          <PartyPopper className="mx-auto size-10 text-accent" />
          <h1 className="mt-4 text-2xl font-semibold">Session terminée !</h1>
          <p className="mt-1 text-sm text-muted">
            {total} carte{total > 1 ? 's' : ''} · {Math.round(ratio * 100)} % de bonnes réponses · +{stats.xp} XP
          </p>
          <ProgressBar value={ratio} className="mx-auto mt-5 max-w-xs" color="#34d399" />
          <p className="mx-auto mt-5 max-w-sm text-xs text-faint">
            Les cartes ratées reviendront dans 10 minutes, les autres dans quelques jours. Plus tu les réussis, plus
            l’intervalle s’allonge.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link to="/memoire" className="btn btn-ghost">
              Paquets
            </Link>
            <Link to="/" className="btn btn-primary">
              Tableau de bord
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-4">
        <BackLink />
        <div className="flex-1">
          <ProgressBar value={index / queue.length} />
        </div>
        <span className="text-xs text-faint">
          {Math.min(index + 1, queue.length)}/{queue.length}
        </span>
      </div>
      {deckMeta && <div className="mb-3 text-xs text-faint">Paquet : {deckMeta.title}{cram && ' · révision complète'}</div>}
      <CardView key={`${card.id}-${index}`} card={card} onGraded={onGraded} />
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/memoire" className="btn btn-quiet px-2 py-1 text-xs">
      <ArrowLeft className="size-4" />
      Quitter
    </Link>
  )
}

function CardView({ card, onGraded }: { card: FlashCard; onGraded: (g: Grade, correct: boolean) => void }) {
  const state = useProgress((s) => s.p.cards[card.id])
  const reviewCard = useProgress((s) => s.reviewCard)
  const [answer, setAnswer] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<EvalResult | null>(null)
  const [revealed, setRevealed] = useState(false)
  const selfGraded = card.kind === 'reveal'
  const intervals = previewIntervals(state)
  const correct = result?.correct ?? false
  const suggested: Grade = revealed && !result ? 0 : correct ? 2 : 0

  const check = useCallback(async () => {
    if (checking || revealed) return
    if (!answer.trim()) {
      setRevealed(true)
      return
    }
    setChecking(true)
    const res = await evalAnswer({
      answer, reference: card.answer, setup: card.setup, kind: card.kind, var: card.var, loose: card.loose,
    })
    setResult(res)
    setRevealed(true)
    setChecking(false)
  }, [answer, card, checking, revealed])

  // Once the answer is shown, keyboard focus leaves the editor so 1–4 / Enter grade the card.
  useEffect(() => {
    if (revealed && document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }, [revealed])

  const grade = useCallback(
    (g: Grade) => {
      const wasCorrect = selfGraded ? g >= 2 : correct
      reviewCard(card.id, g, wasCorrect)
      onGraded(g, wasCorrect)
    },
    [card.id, correct, onGraded, reviewCard, selfGraded],
  )

  useEffect(() => {
    if (!revealed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('.cm-editor, textarea, input')) return
      const g = GRADES.find((x) => x.key === e.key)
      // preventDefault: otherwise the key also lands in the next card's (auto-focused) editor.
      if (g) {
        e.preventDefault()
        grade(g.grade)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        grade(selfGraded ? 2 : suggested)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, grade, suggested, selfGraded])

  return (
    <div className={clsx('card overflow-hidden animate-fade-up', result && !correct && 'animate-shake')}>
      <div className="border-b border-line p-6">
        <div className="mb-3 flex items-center gap-2">
          <DomainChip domain={card.domain} />
          {!state && <span className="chip text-accent-2">Nouvelle</span>}
        </div>
        <div className="text-lg font-medium leading-snug">{card.prompt}</div>
        {card.setup && (
          <div className="mt-4">
            <div className="mb-1 text-[11px] font-medium text-faint">Contexte (déjà exécuté)</div>
            <CodeBlock code={card.setup} className="py-2 text-xs" />
          </div>
        )}
      </div>

      {!selfGraded && (
        <div className="border-b border-line bg-black/20">
          <div className="flex items-center justify-between px-4 pt-3 text-[11px] text-faint">
            <span>
              Ta réponse {card.kind === 'stmt' ? `(doit définir \`${card.var}\`)` : card.kind === 'stdout' ? '(ce qui sera affiché compte)' : '(une expression)'}
            </span>
            <span>
              <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">Entrée</kbd> pour vérifier
            </span>
          </div>
          <div className="min-h-[88px]">
            <CodeEditor
              value={answer}
              onChange={setAnswer}
              onRun={check}
              autoFocus
              lineNumbers={false}
              autocomplete={false}
              minHeight="88px"
              height="auto"
              placeholder="Tape la syntaxe de mémoire…"
            />
          </div>
        </div>
      )}

      <div className="p-5">
        {!revealed ? (
          <div className="flex flex-wrap gap-2">
            {selfGraded ? (
              <button className="btn btn-primary" onClick={() => setRevealed(true)}>
                Afficher la réponse
              </button>
            ) : (
              <>
                <button className="btn btn-primary" onClick={check} disabled={checking}>
                  {checking ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Vérifier
                </button>
                <button className="btn btn-quiet" onClick={() => setRevealed(true)}>
                  <HelpCircle className="size-4" />
                  Je ne sais pas
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {result && (
              <div
                className={clsx(
                  'rounded-xl border p-3 text-sm',
                  result.engineError
                    ? 'border-warn/30 bg-warn/[0.06] text-warn'
                    : correct
                      ? 'border-ok/30 bg-ok/[0.06]'
                      : 'border-bad/30 bg-bad/[0.06]',
                )}
              >
                {result.engineError ? (
                  result.engineError
                ) : (
                  <>
                    <div className={clsx('flex items-center gap-2 font-semibold', correct ? 'text-ok' : 'text-bad')}>
                      {correct ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                      {correct ? 'Correct !' : 'Pas tout à fait'}
                      {result.reason && <span className="font-normal text-muted">— {result.reason}</span>}
                    </div>
                    {result.error && (
                      <pre className="mt-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap text-bad">{result.error}</pre>
                    )}
                    {!correct && result.got !== null && (
                      <div className="mt-2 grid gap-1 font-mono text-xs">
                        <div>
                          <span className="text-faint">obtenu  </span>
                          {result.got}
                        </div>
                        <div>
                          <span className="text-faint">attendu </span>
                          {result.expected}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <div>
              <div className="mb-1 text-[11px] font-medium text-faint">Réponse de référence</div>
              <CodeBlock code={card.answer} />
            </div>
            {card.note && (
              <div className="rounded-xl bg-accent/[0.06] px-4 py-3">
                <Markdown>{card.note}</Markdown>
              </div>
            )}
            <div>
              <div className="mb-2 text-[11px] text-faint">
                {selfGraded ? 'Tu l’avais en tête ?' : 'À quel point c’était facile ?'} (touches 1–4, Entrée = suggestion)
              </div>
              <div className="grid grid-cols-4 gap-2">
                {GRADES.map((g, i) => (
                  <button
                    key={g.grade}
                    onClick={() => grade(g.grade)}
                    className={clsx(
                      'flex flex-col items-center rounded-xl border px-2 py-2 text-sm transition',
                      !selfGraded && g.grade === suggested
                        ? 'border-accent/50 bg-accent/15'
                        : 'border-line bg-white/[0.02] hover:border-line-strong',
                    )}
                  >
                    <span className={clsx('font-medium', g.grade === 0 && 'text-bad')}>
                      {g.grade === 0 && <X className="mr-1 inline size-3.5" />}
                      {g.label}
                    </span>
                    <span className="text-[10px] text-faint">
                      {intervals[i]} · <kbd className="font-mono">{g.key}</kbd>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
