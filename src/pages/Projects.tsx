import { ArrowRight, CheckCircle2, Clock, Cpu, Rocket } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DifficultyBadge, DomainChip, PageHeader, ProgressBar } from '@/components/ui'
import { projects } from '@/lib/content'
import { DOMAINS } from '@/lib/domains'
import { useProgress } from '@/lib/progress'

export default function Projects() {
  const state = useProgress((s) => s.p.projects)
  return (
    <div>
      <PageHeader
        icon={<Rocket className="size-6" />}
        title="Projets"
        subtitle="Des projets guidés en plusieurs étapes, à faire sur une ou plusieurs sessions. Chaque étape a ses propres tests."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {projects.map((p, i) => {
          const st = state[p.id]
          const done = st?.stepsDone.length ?? 0
          const color = DOMAINS[p.domain].color
          return (
            <Link
              key={p.id}
              to={`/projets/${p.id}`}
              className="card card-hover group relative flex flex-col overflow-hidden p-6 animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full blur-3xl" style={{ background: `${color}1f` }} />
              <div className="relative flex flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <DomainChip domain={p.domain} />
                  <DifficultyBadge difficulty={p.difficulty} />
                  <span className="chip">
                    <Clock className="size-3" />~{p.hours} h
                  </span>
                  {p.engine === 'local' && (
                    <span className="chip text-warn">
                      <Cpu className="size-3" />
                      Runner local
                    </span>
                  )}
                  {st?.completedAt && <CheckCircle2 className="ml-auto size-5 text-ok" />}
                </div>
                <h2 className="mt-4 text-lg font-semibold">{p.title}</h2>
                <p className="mt-1 flex-1 text-sm text-muted">{p.summary}</p>
                <div className="mt-5 flex items-center gap-3 text-xs text-faint">
                  <ProgressBar value={done / p.steps.length} color={color} className="flex-1" height={5} />
                  {done}/{p.steps.length} étapes
                  <ArrowRight className="size-4 transition group-hover:translate-x-1 group-hover:text-fg" />
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
