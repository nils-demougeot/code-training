import { ArrowRight, BookOpen, Code2, Dices, FlaskConical, Layers, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, ProgressBar } from '@/components/ui'
import { labById } from '@/labs/registry'
import { cards, exercises, quizQuestions } from '@/lib/content'
import { useProgress } from '@/lib/progress'
import { PuzzleView, Stars } from '@/stats/PuzzleView'
import { PUZZLES, type Puzzle } from '@/stats/puzzles'

const STATS_LABS = ['clt', 'ab-test', 'bayes']

export default function Stats() {
  const p = useProgress((s) => s.p)
  const [open, setOpen] = useState<Puzzle | null>(null)
  const solved = PUZZLES.filter((z) => (p.puzzles?.[z.id]?.stars ?? 0) > 0).length
  const stars = PUZZLES.reduce((a, z) => a + (p.puzzles?.[z.id]?.stars ?? 0), 0)
  const statsExercises = exercises.filter((e) => e.domain === 'stats')
  const exDone = statsExercises.filter((e) => p.exercises[e.id]?.status === 'solved').length
  const nCards = cards.filter((c) => c.domain === 'stats').length
  const nQuiz = quizQuestions.filter((q) => q.domain === 'stats').length

  return (
    <div>
      <PageHeader
        icon={<Dices className="size-6" />}
        title="Probas & stats"
        subtitle="Devine d'abord avec ton intuition, puis laisse la simulation trancher. Les maths derrière les A/B tests, les intervalles de confiance et Bayes, sans formules inutiles."
      />

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="section-title">Défis d'intuition</div>
            <p className="text-sm text-muted">Place le curseur sur ta réponse, puis regarde 10 000 expériences simulées converger vers la vérité.</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span>
              {solved}/{PUZZLES.length} tentés · {stars}/{PUZZLES.length * 3} ★
            </span>
            <ProgressBar value={stars / (PUZZLES.length * 3)} className="w-32" height={5} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PUZZLES.map((z, i) => {
            const best = p.puzzles?.[z.id]?.stars ?? 0
            return (
              <button
                key={z.id}
                onClick={() => setOpen(z)}
                className="card card-hover group flex flex-col p-5 text-left animate-fade-up"
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{z.emoji}</span>
                  <Stars n={best} size="size-3.5" />
                </div>
                <h3 className="mt-3 font-semibold">{z.title}</h3>
                <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted">{z.question.replace(/\*\*|`/g, '')}</p>
                <span className="mt-4 flex items-center gap-1 text-xs text-accent">
                  {best ? 'Rejouer' : 'Deviner'}
                  <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="mb-8">
        <div className="section-title mb-3">Labs interactifs</div>
        <div className="grid gap-4 md:grid-cols-3">
          {STATS_LABS.map((id) => labById.get(id)).filter((l) => l !== undefined).map((l) => (
            <Link key={l.id} to={`/labs/${l.id}`} className="card card-hover group flex flex-col p-5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{l.emoji}</span>
                <FlaskConical className="ml-auto size-4 text-faint" />
              </div>
              <h3 className="mt-3 font-semibold">{l.title}</h3>
              <p className="mt-1 flex-1 text-sm text-muted">{l.summary}</p>
              <span className="mt-4 text-xs text-faint">{l.experiments.length} expériences guidées</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-title mb-3">S'entraîner</div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TrainLink
            to="/exercices?domain=stats"
            icon={<Code2 className="size-5" />}
            title="Exercices de code"
            text={`${exDone}/${statsExercises.length} résolus : Bayes, bootstrap, A/B test, Monte-Carlo…`}
            progress={statsExercises.length ? exDone / statsExercises.length : 0}
          />
          <TrainLink to="/quiz?domain=stats" icon={<Zap className="size-5" />} title="Quiz éclair" text={`${nQuiz} questions de concepts : p-value, TCL, pièges classiques.`} />
          <TrainLink to="/memoire" icon={<Layers className="size-5" />} title="Cartes mémoire" text={`${nCards} cartes : formules et syntaxe scipy / NumPy, en répétition espacée.`} />
          <TrainLink to="/fiches/stats" icon={<BookOpen className="size-5" />} title="Fiche de révision" text="Lois, intervalles, tests, checklist A/B et pièges d'entretien sur une page." />
        </div>
      </section>

      {open && <PuzzleView key={open.id} puzzle={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function TrainLink({ to, icon, title, text, progress }: { to: string; icon: React.ReactNode; title: string; text: string; progress?: number }) {
  return (
    <Link to={to} className="card card-hover group flex flex-col p-5">
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <ArrowRight className="ml-auto size-4 text-faint transition group-hover:translate-x-1 group-hover:text-fg" />
      </div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-muted">{text}</p>
      {progress !== undefined && <ProgressBar value={progress} className="mt-4" height={4} />}
    </Link>
  )
}
