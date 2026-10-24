import clsx from 'clsx'
import { ArrowRight, BookOpen, CheckCircle2, Circle, FlaskConical, GitBranch, Layers, Terminal, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, ProgressBar } from '@/components/ui'
import { cards, ficheById, quizQuestions } from '@/lib/content'
import { useProgress } from '@/lib/progress'
import { CHAPTERS, LEVELS } from '@/git/levels'

export default function GitHome() {
  const done = useProgress((s) => s.p.git ?? {})
  const solved = LEVELS.filter((l) => done[l.id]).length
  const next = LEVELS.find((l) => !done[l.id])
  const fiche = ficheById.get('git')
  const nCards = cards.filter((c) => c.domain === 'git').length
  const nQuiz = quizQuestions.filter((q) => q.domain === 'git').length
  let n = 0

  return (
    <div>
      <PageHeader
        icon={<GitBranch className="size-6" />}
        title="Git & GitHub"
        subtitle="Un vrai terminal simulé : tu tapes les commandes, tu vois le graphe des commits, l’index et GitHub réagir en direct. Des missions guidées, puis un bac à sable."
      />

      <div className="mb-8 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="card flex flex-col justify-between gap-4 p-6">
          <div>
            <div className="section-title mb-1">Progression</div>
            <div className="text-3xl font-semibold">
              {solved}
              <span className="text-base text-faint"> / {LEVELS.length} missions</span>
            </div>
            <ProgressBar value={solved / LEVELS.length} className="mt-3" height={6} />
          </div>
          <div className="flex flex-wrap gap-2">
            {next && (
              <Link to={`/git/${next.id}`} className="btn btn-primary px-4 py-2">
                {solved ? 'Continuer' : 'Commencer'} : {next.title}
                <ArrowRight className="size-4" />
              </Link>
            )}
            <Link to="/git/bac-a-sable" className="btn btn-ghost px-4 py-2">
              <Terminal className="size-4" />
              Bac à sable
            </Link>
          </div>
        </div>
        <div className="grid gap-2">
          {fiche && <Side to={`/fiches/${fiche.id}`} icon={<BookOpen className="size-4" />} title="Antisèche Git" text="Les commandes par situation, sur une page." />}
          <Side to="/memoire" icon={<Layers className="size-4" />} title={`${nCards} cartes`} text="Les commandes à connaître par cœur." />
          <Side to="/quiz?domain=git" icon={<Zap className="size-4" />} title={`${nQuiz} questions`} text="Merge, rebase, reset, revert : les différences." />
        </div>
      </div>

      <div className="space-y-8">
        {CHAPTERS.map((ch) => (
          <section key={ch.id}>
            <div className="mb-3">
              <h2 className="font-semibold">{ch.title}</h2>
              <p className="text-xs text-muted">{ch.text}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {LEVELS.filter((l) => l.chapter === ch.id).map((l) => {
                n++
                const ok = !!done[l.id]
                return (
                  <Link key={l.id} to={`/git/${l.id}`} className={clsx('card card-hover group flex items-start gap-3 p-4')}>
                    <span className={clsx('flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs', ok ? 'bg-ok/15 text-ok' : 'bg-white/5 text-muted')}>
                      {ok ? <CheckCircle2 className="size-4" /> : n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium group-hover:text-fg">{l.title}</div>
                      <div className="mt-1 truncate font-mono text-[11px] text-faint">{l.solution.filter((c) => c.startsWith('git ') || c.startsWith('gh ')).map((c) => c.split(' ').slice(0, 2).join(' ')).filter((c, i, a) => a.indexOf(c) === i).join(' · ')}</div>
                    </div>
                    {ok ? <span className="chip py-0 text-[10px] text-ok">{done[l.id].bestCommands} cmd</span> : <Circle className="size-4 text-faint/50" />}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
        <Link to="/git/bac-a-sable" className="card card-hover flex items-center gap-4 p-5">
          <FlaskConical className="size-6 text-accent" />
          <div className="flex-1">
            <div className="font-medium">Bac à sable</div>
            <div className="text-xs text-muted">Un dépôt avec un remote GitHub, pour essayer n’importe quelle commande. La commande <code>collegue</code> simule un collègue qui pousse.</div>
          </div>
          <ArrowRight className="size-4 text-faint" />
        </Link>
      </div>
    </div>
  )
}

function Side({ to, icon, title, text }: { to: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link to={to} className="card card-hover flex items-center gap-3 p-4">
      <span className="text-accent">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="truncate text-xs text-muted">{text}</div>
      </div>
      <ArrowRight className="size-4 text-faint" />
    </Link>
  )
}
