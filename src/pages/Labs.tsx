import { ArrowRight, FlaskConical } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, ProgressBar } from '@/components/ui'
import { LABS } from '@/labs/registry'
import { useProgress } from '@/lib/progress'

export default function Labs() {
  const labs = useProgress((s) => s.p.labs)
  return (
    <div>
      <PageHeader
        icon={<FlaskConical className="size-6" />}
        title="Labs"
        subtitle="Pour comprendre concrètement ce qu’il se passe : manipule, observe, puis lis l’explication."
      />
      <div className="grid gap-5 md:grid-cols-2">
        {LABS.map((lab, i) => {
          const done = labs[lab.id]?.done.length ?? 0
          return (
            <Link
              key={lab.id}
              to={`/labs/${lab.id}`}
              className="card card-hover group relative overflow-hidden p-6 animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div
                className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full blur-3xl transition group-hover:scale-125"
                style={{ background: `${lab.color}26` }}
              />
              <div className="relative">
                <div className="text-4xl">{lab.emoji}</div>
                <h2 className="mt-4 text-lg font-semibold">{lab.title}</h2>
                <p className="mt-1 text-sm text-muted">{lab.summary}</p>
                <div className="mt-5 flex items-center gap-3 text-xs text-faint">
                  <ProgressBar value={done / lab.experiments.length} color={lab.color} className="flex-1" height={5} />
                  {done}/{lab.experiments.length} expériences
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
