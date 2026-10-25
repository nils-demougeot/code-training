import clsx from 'clsx'
import { ArrowRight, BookOpen, Code2, Crown, FlaskConical, Layers, Sigma, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Markdown } from '@/components/Markdown'
import { PageHeader, ProgressBar } from '@/components/ui'
import { labById } from '@/labs/registry'
import { cards, exercises, quizQuestions } from '@/lib/content'
import { useProgress } from '@/lib/progress'
import { CHAPTERS, type Chapter } from '@/maths'
import { Stars } from '@/maths/MathPlayer'

const LABS = ['clt', 'ab-test', 'bayes']

export default function Maths() {
  const p = useProgress((s) => s.p)
  const [sheet, setSheet] = useState(false)
  const statsExercises = exercises.filter((e) => e.domain === 'stats')
  const exDone = statsExercises.filter((e) => p.exercises[e.id]?.status === 'solved').length
  const totalEx = CHAPTERS.reduce((a, c) => a + c.exercises.length, 0)
  const totalStars = CHAPTERS.reduce((a, c) => a + c.exercises.reduce((b, e) => b + (p.maths?.[e.id]?.stars ?? 0), 0), 0)
  const bosses = CHAPTERS.filter((c) => p.bosses?.[c.id]?.beatenAt).length

  return (
    <div>
      <PageHeader
        icon={<Sigma className="size-6" />}
        title="Maths pour la data"
        subtitle="Les formules et les objets à connaître, puis à toi de calculer : des énoncés aux valeurs tirées au hasard, une correction pas à pas, et un boss à vaincre par chapitre."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Étoiles" value={`${totalStars} / ${totalEx * 3}`} progress={totalStars / (totalEx * 3)} />
        <Stat label="Boss vaincus" value={`${bosses} / ${CHAPTERS.length}`} progress={bosses / CHAPTERS.length} />
        <button onClick={() => setSheet(true)} className="card card-hover flex items-center gap-3 p-4 text-left">
          <BookOpen className="size-5 text-accent" />
          <div className="flex-1">
            <div className="font-medium">Formulaire</div>
            <div className="text-xs text-muted">Toutes les formules clés sur une page</div>
          </div>
          <ArrowRight className="size-4 text-faint" />
        </button>
      </div>

      <section className="mb-10">
        <div className="section-title mb-3">Chapitres</div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CHAPTERS.map((c, i) => {
            const stars = c.exercises.reduce((a, e) => a + (p.maths?.[e.id]?.stars ?? 0), 0)
            const boss = p.bosses?.[c.id]
            return (
              <Link
                key={c.id}
                to={`/maths/${c.id}`}
                className="card card-hover group flex flex-col p-5 animate-fade-up"
                style={{ animationDelay: `${i * 40}ms` }}
                data-chapter={c.id}
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-white/[0.04] text-2xl">{c.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-faint">Chapitre {i + 1}</div>
                    <h3 className="font-semibold">{c.title}</h3>
                  </div>
                  {boss?.beatenAt && <Crown className="ml-auto size-5 text-warn" aria-label="Boss vaincu" />}
                </div>
                <p className="mt-3 flex-1 text-sm text-muted">{c.summary}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted">
                  <Stars n={Math.round((stars / (c.exercises.length * 3)) * 3)} size="size-3" />
                  <span>
                    {stars}/{c.exercises.length * 3} ★
                  </span>
                  <span className={clsx('ml-auto', boss?.beatenAt ? 'text-warn' : 'text-faint')}>{boss?.beatenAt ? 'Boss vaincu' : 'Boss à vaincre'}</span>
                </div>
                <ProgressBar value={stars / (c.exercises.length * 3)} className="mt-2" height={4} />
              </Link>
            )
          })}
        </div>
      </section>

      <section className="mb-10">
        <div className="section-title mb-3">Visualiser</div>
        <div className="grid gap-4 md:grid-cols-3">
          {LABS.map((id) => labById.get(id)).filter((l) => l !== undefined).map((l) => (
            <Link key={l.id} to={`/labs/${l.id}`} className="card card-hover group flex flex-col p-5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{l.emoji}</span>
                <FlaskConical className="ml-auto size-4 text-faint" />
              </div>
              <h3 className="mt-3 font-semibold">{l.title}</h3>
              <p className="mt-1 flex-1 text-sm text-muted">{l.summary}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-title mb-3">Avec du code</div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TrainLink to="/exercices?domain=stats" icon={<Code2 className="size-5" />} title="Exercices de stats en Python" text={`${exDone}/${statsExercises.length} résolus : Bayes, bootstrap, A/B test, Monte-Carlo…`} />
          <TrainLink to="/quiz?domain=stats" icon={<Zap className="size-5" />} title="Quiz éclair" text={`${quizQuestions.filter((q) => q.domain === 'stats').length} questions : p-value, TCL, pièges classiques.`} />
          <TrainLink to="/memoire" icon={<Layers className="size-5" />} title="Cartes mémoire" text={`${cards.filter((c) => c.domain === 'stats').length} cartes de stats en répétition espacée.`} />
          <TrainLink to="/fiches/stats" icon={<BookOpen className="size-5" />} title="Fiche de révision" text="Lois, intervalles, tests et pièges d’entretien sur une page." />
        </div>
      </section>

      {sheet && <FormulaSheet onClose={() => setSheet(false)} />}
    </div>
  )
}

export function FormulaSheet({
  onClose,
  chapters = CHAPTERS,
  title = 'Formulaire',
  closeLabel = 'Fermer',
}: {
  onClose: () => void
  chapters?: Chapter[]
  title?: string
  closeLabel?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card my-8 w-full max-w-3xl p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn btn-quiet px-2 py-1 text-xs" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        <div className="space-y-6">
          {chapters.map((c) => (
            <div key={c.id}>
              <div className="section-title mb-2">
                {c.emoji} {c.title}
              </div>
              <div className="grid gap-2">
                {c.formulas.map((f) => (
                  <div key={f.name} className="rounded-xl border border-line bg-white/[0.02] px-4 py-2">
                    <div className="text-xs text-faint">{f.name}</div>
                    <Markdown className="[&_.katex-display]:my-1">{`$$${f.tex}$$`}</Markdown>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, progress }: { label: string; value: string; progress: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      <ProgressBar value={progress} className="mt-2" height={4} />
    </div>
  )
}

function TrainLink({ to, icon, title, text }: { to: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link to={to} className="card card-hover group flex flex-col p-5">
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <ArrowRight className="ml-auto size-4 text-faint transition group-hover:translate-x-1 group-hover:text-fg" />
      </div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-muted">{text}</p>
    </Link>
  )
}
