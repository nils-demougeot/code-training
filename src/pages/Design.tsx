import clsx from 'clsx'
import { ArrowRight, Boxes, CheckCircle2, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DifficultyBadge, PageHeader, ProgressBar } from '@/components/ui'
import { designCases } from '@/lib/content'
import { useProgress } from '@/lib/progress'
import type { DesignCase } from '@/lib/types'

export const DESIGN_FRAMEWORK = [
  { title: 'Cadrage et métriques', text: 'Objectif business, formulation ML, métrique offline et online.' },
  { title: 'Données et labels', text: 'Sources, définition du label, fuites, biais, découpage temporel.' },
  { title: 'Features et modèle', text: 'Signaux prédictifs, baseline simple, puis modèle plus riche.' },
  { title: 'Évaluation', text: 'Validation offline, A/B test, analyse par segment.' },
  { title: 'Production', text: 'Latence, batch ou temps réel, monitoring, drift, boucles de rétroaction.' },
]

/** Share (0..1) of key points ticked over the steps already revealed. */
export function designScore(c: DesignCase, checked: Record<string, number[]> | undefined): number {
  const total = c.steps.reduce((a, s) => a + s.points.length, 0)
  const got = c.steps.reduce((a, s) => a + (checked?.[s.id]?.length ?? 0), 0)
  return total ? got / total : 0
}

export default function Design() {
  const state = useProgress((s) => s.p.design ?? {})
  return (
    <div>
      <PageHeader
        icon={<Boxes className="size-6" />}
        title="Design ML"
        subtitle="Les questions « conçois un système de… » des entretiens ML. Réponds étape par étape, puis compare avec les points clés attendus."
      />

      <section className="card mb-8 p-6">
        <div className="section-title mb-4">Le cadre à dérouler en entretien</div>
        <div className="grid gap-3 md:grid-cols-5">
          {DESIGN_FRAMEWORK.map((f, i) => (
            <div key={f.title} className="rounded-xl border border-line bg-white/[0.02] p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-lg bg-accent/20 text-xs font-semibold text-accent">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{f.title}</span>
              </div>
              <p className="text-xs text-muted">{f.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-faint">
          Réflexe : toujours partir du besoin métier et d’une baseline simple, puis complexifier. L’intervieweur évalue ta
          structure et tes compromis, pas un « bon » modèle unique.
        </p>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {designCases.map((c, i) => {
          const st = state[c.id]
          const revealed = st?.revealed.length ?? 0
          return (
            <Link
              key={c.id}
              to={`/design/${c.id}`}
              className="card card-hover group flex flex-col p-6 animate-fade-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <DifficultyBadge difficulty={c.difficulty} />
                <span className="chip">
                  <Clock className="size-3" />~{c.minutes} min
                </span>
                {st?.completedAt && (
                  <span className="chip ml-auto text-ok">
                    <CheckCircle2 className="size-3" />
                    {Math.round(designScore(c, st.checked) * 100)} % des points clés
                  </span>
                )}
              </div>
              <h2 className="mt-4 text-lg font-semibold">{c.title}</h2>
              <div className="text-xs text-faint">{c.company}</div>
              <p className="mt-2 flex-1 text-sm text-muted">{c.summary}</p>
              <div className={clsx('mt-5 flex items-center gap-3 text-xs text-faint')}>
                <ProgressBar value={revealed / c.steps.length} className="flex-1" height={5} />
                {revealed}/{c.steps.length} étapes
                <ArrowRight className="size-4 transition group-hover:translate-x-1 group-hover:text-fg" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
