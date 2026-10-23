import { ArrowRight, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DomainChip, PageHeader } from '@/components/ui'
import { fiches } from '@/lib/content'

export default function Fiches() {
  return (
    <div>
      <PageHeader
        icon={<BookOpen className="size-6" />}
        title="Fiches"
        subtitle="Des synthèses courtes à relire avant un entretien : comparaisons, pièges et syntaxe essentielle."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {fiches.map((f, i) => (
          <Link
            key={f.id}
            to={`/fiches/${f.id}`}
            className="card card-hover group flex flex-col p-5 animate-fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <DomainChip domain={f.domain} className="self-start" />
            <h2 className="mt-3 font-semibold">{f.title}</h2>
            <p className="mt-1 flex-1 text-sm text-muted">{f.summary}</p>
            <span className="mt-4 flex items-center gap-1 text-xs font-medium text-accent">
              Lire
              <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
