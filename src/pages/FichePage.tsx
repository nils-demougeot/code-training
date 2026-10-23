import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Markdown } from '@/components/Markdown'
import { DomainChip, Empty } from '@/components/ui'
import { ficheById, fiches } from '@/lib/content'

export default function FichePage() {
  const { id = '' } = useParams()
  const fiche = ficheById.get(id)
  if (!fiche) return <Empty title="Fiche introuvable" />
  const sections = [...fiche.body.matchAll(/^## (.+)$/gm)].map((m) => m[1])
  const index = fiches.findIndex((f) => f.id === id)
  const next = fiches[index + 1]

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_220px]">
      <article className="min-w-0 animate-fade-up">
        <Link to="/fiches" className="mb-4 inline-flex items-center gap-1 text-xs text-faint hover:text-fg">
          <ArrowLeft className="size-3.5" />
          Fiches
        </Link>
        <DomainChip domain={fiche.domain} />
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{fiche.title}</h1>
        <p className="mt-2 text-muted">{fiche.summary}</p>
        <div className="card mt-8 p-6 sm:p-8">
          <Markdown className="prose-base">{fiche.body}</Markdown>
        </div>
        {next && (
          <Link to={`/fiches/${next.id}`} className="card card-hover mt-6 block p-5">
            <div className="text-xs text-faint">Fiche suivante</div>
            <div className="font-medium">{next.title} →</div>
          </Link>
        )}
      </article>
      {sections.length > 1 && (
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <div className="section-title mb-3">Sommaire</div>
            <nav className="space-y-1.5 border-l border-line pl-3 text-sm">
              {sections.map((s) => (
                <div key={s} className="text-muted">
                  {s}
                </div>
              ))}
            </nav>
          </div>
        </aside>
      )}
    </div>
  )
}
