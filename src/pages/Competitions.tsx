import clsx from 'clsx'
import { ArrowRight, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DifficultyBadge, PageHeader, ProgressBar } from '@/components/ui'
import { competitions } from '@/lib/content'
import { MEDAL_LABEL, useProgress, type Medal } from '@/lib/progress'
import type { Competition } from '@/lib/types'

export const MEDAL_EMOJI: Record<Medal, string> = { bronze: '🥉', silver: '🥈', gold: '🥇' }

/** Formats a score with the precision that matters for its metric. */
export function formatScore(c: Competition, score: number): string {
  return score.toLocaleString('fr-FR', { maximumFractionDigits: c.higher_is_better ? 4 : 2, minimumFractionDigits: c.higher_is_better ? 4 : 1 })
}

export function medalFor(c: Competition, score: number): Medal | undefined {
  const better = (a: number, b: number) => (c.higher_is_better ? a >= b : a <= b)
  return better(score, c.medals.gold) ? 'gold' : better(score, c.medals.silver) ? 'silver' : better(score, c.medals.bronze) ? 'bronze' : undefined
}

export default function Competitions() {
  const p = useProgress((s) => s.p)
  return (
    <div>
      <PageHeader
        icon={<Trophy className="size-6" />}
        title="Compétitions"
        subtitle="Des problèmes façon Kaggle : un jeu de données à explorer, un notebook guidé étape par étape, puis une soumission notée sur un test caché. Décroche le bronze, l’argent… ou l’or."
      />
      <div className="grid gap-5 lg:grid-cols-3">
        {competitions.map((c, i) => {
          const cp = p.competitions?.[c.id]
          const done = cp?.stepsDone.length ?? 0
          return (
            <Link
              key={c.id}
              to={`/competitions/${c.id}`}
              className="card card-hover group flex flex-col overflow-hidden animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
              data-competition={c.id}
            >
              <div className="relative flex h-28 items-center justify-center bg-gradient-to-br from-accent/20 via-white/[0.02] to-cyan-400/10 text-6xl">
                {c.emoji}
                {cp?.medal && <span className="absolute top-3 right-3 text-3xl" title={`Médaille ${MEDAL_LABEL[cp.medal]}`}>{MEDAL_EMOJI[cp.medal]}</span>}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <span className="chip">{c.task}</span>
                  <span className="chip">{c.metric_label}</span>
                  <DifficultyBadge difficulty={c.difficulty} />
                </div>
                <h3 className="text-lg font-semibold">{c.title}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{c.summary}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted">
                  <span>
                    {done}/{c.steps.length} étapes
                  </span>
                  {cp?.best !== undefined ? (
                    <span className={clsx(cp.medal ? 'text-warn' : 'text-faint')}>
                      Meilleur score : {formatScore(c, cp.best)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-accent">
                      {done ? 'Continuer' : 'Commencer'}
                      <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
                    </span>
                  )}
                </div>
                <ProgressBar value={done / c.steps.length} className="mt-2" height={4} />
              </div>
            </Link>
          )
        })}
      </div>
      <div className="card mt-8 p-5 text-sm text-muted">
        <div className="section-title mb-2">Comment ça marche</div>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Lis l’histoire et le dictionnaire des données, puis avance cellule par cellule : explorer, nettoyer, créer des variables, valider, modéliser, soumettre.</li>
          <li>Chaque cellule s’exécute avec les précédentes, comme un notebook. Une étape validée débloque la suivante.</li>
          <li>Ta soumission est notée sur un test dont tu ne vois jamais les réponses. Améliore ton modèle et resoumets autant que tu veux pour monter au classement.</li>
        </ol>
      </div>
    </div>
  )
}
