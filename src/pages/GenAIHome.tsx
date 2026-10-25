import { ArrowRight, Bot, BookOpen, Code2, Crown, Layers, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, ProgressBar } from '@/components/ui'
import { GENAI_CHAPTERS } from '@/genai'
import { cards, competitions, exercises } from '@/lib/content'
import { useProgress } from '@/lib/progress'
import { Stars } from '@/maths/MathPlayer'
import { FormulaSheet } from './Maths'

export default function GenAIHome() {
  const p = useProgress((s) => s.p)
  const [sheet, setSheet] = useState(false)
  const code = exercises.filter((e) => e.domain === 'genai')
  const codeDone = code.filter((e) => p.exercises[e.id]?.status === 'solved').length
  const nCards = cards.filter((c) => c.domain === 'genai').length
  const rag = competitions.find((c) => c.id === 'rag')
  const total = GENAI_CHAPTERS.reduce((a, c) => a + c.exercises.length * 3, 0)
  const stars = GENAI_CHAPTERS.reduce((a, c) => a + c.exercises.reduce((b, e) => b + (p.maths?.[e.id]?.stars ?? 0), 0), 0)

  return (
    <div lang="en">
      <PageHeader
        icon={<Bot className="size-6" />}
        title="GenAI Academy"
        subtitle="From zero to client-ready on large language models: how they work, prompting, embeddings, RAG, evaluation and safety, agents, and cost. Each chapter has a lesson, explained quizzes, small calculations and a boss. In English, like the interview."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs text-faint">Stars</div>
          <div className="mt-1 text-xl font-semibold">
            {stars} / {total}
          </div>
          <ProgressBar value={total ? stars / total : 0} className="mt-2" height={4} />
        </div>
        <div className="card p-4">
          <div className="text-xs text-faint">Bosses defeated</div>
          <div className="mt-1 text-xl font-semibold">
            {GENAI_CHAPTERS.filter((c) => p.bosses?.[c.id]?.beatenAt).length} / {GENAI_CHAPTERS.length}
          </div>
          <ProgressBar value={GENAI_CHAPTERS.filter((c) => p.bosses?.[c.id]?.beatenAt).length / Math.max(1, GENAI_CHAPTERS.length)} className="mt-2" height={4} />
        </div>
        <button onClick={() => setSheet(true)} className="card card-hover flex items-center gap-3 p-4 text-left">
          <BookOpen className="size-5 text-accent" />
          <div className="flex-1">
            <div className="font-medium">Cheat sheet</div>
            <div className="text-xs text-muted">Key formulas and rules of thumb</div>
          </div>
          <ArrowRight className="size-4 text-faint" />
        </button>
      </div>

      <section className="mb-10">
        <div className="section-title mb-3">Chapters (in order)</div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {GENAI_CHAPTERS.map((c, i) => {
            const st = c.exercises.reduce((a, e) => a + (p.maths?.[e.id]?.stars ?? 0), 0)
            const boss = p.bosses?.[c.id]
            return (
              <Link key={c.id} to={`/genai/${c.id}`} className="card card-hover group flex flex-col p-5 animate-fade-up" style={{ animationDelay: `${i * 40}ms` }} data-chapter={c.id}>
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-white/[0.04] text-2xl">{c.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-faint">Chapter {i + 1}</div>
                    <h3 className="font-semibold">{c.title}</h3>
                  </div>
                  {boss?.beatenAt && <Crown className="ml-auto size-5 text-warn" aria-label="Boss defeated" />}
                </div>
                <p className="mt-3 flex-1 text-sm text-muted">{c.summary}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted">
                  <Stars n={Math.round((st / (c.exercises.length * 3)) * 3)} size="size-3" lang="en" />
                  <span>
                    {st}/{c.exercises.length * 3} ★
                  </span>
                  <span className="ml-auto text-faint">{boss?.beatenAt ? 'Boss defeated' : 'Boss to beat'}</span>
                </div>
                <ProgressBar value={st / (c.exercises.length * 3)} className="mt-2" height={4} />
              </Link>
            )
          })}
        </div>
      </section>

      <section>
        <div className="section-title mb-3">Hands-on</div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <HandsOn
            to="/exercices?domain=genai"
            icon={<Code2 className="size-5" />}
            title="Code exercises"
            text={`${codeDone}/${code.length} solved: chunking, retrieval, BM25, recall@k, parsing LLM output, tool calls, guardrails…`}
          />
          <HandsOn to="/memoire" icon={<Layers className="size-5" />} title="Flashcards" text={`${nCards} GenAI vocabulary cards with spaced repetition.`} />
          {rag && <HandsOn to={`/competitions/${rag.id}`} icon={<Trophy className="size-5" />} title={rag.title} text={rag.summary} />}
        </div>
      </section>

      {sheet && <FormulaSheet chapters={GENAI_CHAPTERS} title="Cheat sheet" closeLabel="Close" onClose={() => setSheet(false)} />}
    </div>
  )
}

function HandsOn({ to, icon, title, text }: { to: string; icon: React.ReactNode; title: string; text: string }) {
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
