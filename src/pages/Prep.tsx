import clsx from 'clsx'
import {
  ArrowRight, Bot, Briefcase, CheckCircle2, ChevronDown, Code2, Layers, MessageSquareText, Mic, Sigma, Trophy,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DifficultyBadge, PageHeader, ProgressBar } from '@/components/ui'
import { GENAI_CHAPTERS } from '@/genai'
import { explainDecks, exercises, missions } from '@/lib/content'
import { useProgress } from '@/lib/progress'
import { savedExplainRun } from './ExplainPage'
import { rankFor, savedMissionRun } from './MissionPage'

/** What the interviews typically assess, and where to train each part. */
const PILLARS: { title: string; icon: ReactNode; what: string; train: { to: string; label: string }[] }[] = [
  {
    title: 'Client problem-solving',
    icon: <Briefcase className="size-5" />,
    what: 'Understand a vague business request, ask the right questions, frame the problem, choose a pragmatic approach and size its value.',
    train: [{ to: '#missions', label: 'Client missions' }],
  },
  {
    title: 'Communication',
    icon: <MessageSquareText className="size-5" />,
    what: 'Explain a model, a metric or a limitation to people who are not technical, answer pushback calmly, lead with the "so what".',
    train: [{ to: '#explain', label: 'Explain it simply' }],
  },
  {
    title: 'GenAI and ML knowledge',
    icon: <Bot className="size-5" />,
    what: 'LLMs, prompting, RAG, evaluation, agents, cost; plus the classic ML and statistics behind most client projects.',
    train: [
      { to: '/genai', label: 'GenAI Academy' },
      { to: '/maths', label: 'Maths & stats (FR)' },
    ],
  },
  {
    title: 'Hands-on coding',
    icon: <Code2 className="size-5" />,
    what: 'Write clean Python and pandas under time pressure, build and evaluate a model, retrieve documents for a RAG system.',
    train: [
      { to: '/exercices?domain=genai', label: 'GenAI code exercises' },
      { to: '/competitions/rag', label: 'RAG competition' },
      { to: '/entretien', label: 'Mock coding interview' },
    ],
  },
]

const PLAN: { day: string; tasks: { text: string; to: string }[] }[] = [
  {
    day: 'Week 1: foundations',
    tasks: [
      { text: 'GenAI Academy chapters 1 to 4 (LLMs, prompting, embeddings, RAG)', to: '/genai' },
      { text: 'Missions 1 and 2, then read every debrief', to: '#missions' },
      { text: 'Explain-it-simply: ML & GenAI concepts deck', to: '#explain' },
      { text: '15 minutes of GenAI flashcards per day', to: '/memoire' },
    ],
  },
  {
    day: 'Week 2: client-ready',
    tasks: [
      { text: 'GenAI Academy chapters 5 to 7 (evaluation, agents, production) and their bosses', to: '/genai' },
      { text: 'All remaining missions, then replay until you reach Project Leader', to: '#missions' },
      { text: 'Metrics and pushback decks, writing exercises included', to: '#explain' },
      { text: 'RAG competition (silver medal) and 3 GenAI code exercises', to: '/competitions/rag' },
    ],
  },
  {
    day: 'Last days',
    tasks: [
      { text: 'A timed mock coding interview', to: '/entretien' },
      { text: 'Replay your weakest mission out loud, as if the interviewer were the client', to: '#missions' },
      { text: 'Prepare 3 STAR stories (below) and say them out loud', to: '#star' },
    ],
  },
]

export default function Prep() {
  const p = useProgress((s) => s.p)
  const genaiCode = exercises.filter((e) => e.domain === 'genai')
  const missionsDone = missions.filter((m) => p.missions?.[m.id]?.completedAt).length
  const decksDone = explainDecks.filter((d) => p.explain?.[d.id]?.completedAt).length
  const bosses = GENAI_CHAPTERS.filter((c) => p.bosses?.[c.id]?.beatenAt).length

  return (
    <div lang="en">
      <PageHeader
        icon={<Briefcase className="size-6" />}
        title="BCG X Prep"
        subtitle="Forward Deployed AI Scientist: you build AI solutions with clients, on their data and in their processes. The interviews test whether you can understand a business problem, design something that works and explain it simply, not only code. Everything here is in English."
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Client missions" value={`${missionsDone} / ${missions.length}`} share={missionsDone / Math.max(1, missions.length)} />
        <Kpi label="Explain decks" value={`${decksDone} / ${explainDecks.length}`} share={decksDone / Math.max(1, explainDecks.length)} />
        <Kpi label="GenAI bosses" value={`${bosses} / ${GENAI_CHAPTERS.length}`} share={bosses / GENAI_CHAPTERS.length} />
        <Kpi
          label="GenAI code exercises"
          value={`${genaiCode.filter((e) => p.exercises[e.id]?.status === 'solved').length} / ${genaiCode.length}`}
          share={genaiCode.filter((e) => p.exercises[e.id]?.status === 'solved').length / Math.max(1, genaiCode.length)}
        />
      </div>

      <section className="mb-10">
        <div className="section-title mb-3">What the interviews look for</div>
        <div className="grid gap-4 md:grid-cols-2">
          {PILLARS.map((pl) => (
            <div key={pl.title} className="card p-5">
              <div className="flex items-center gap-2 text-accent">
                {pl.icon}
                <h3 className="font-semibold text-fg">{pl.title}</h3>
              </div>
              <p className="mt-2 text-sm text-muted">{pl.what}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {pl.train.map((t) => (
                  <HubLink key={t.to} to={t.to} className="chip hover:border-accent/50 hover:text-fg">
                    {t.label} <ArrowRight className="size-3" />
                  </HubLink>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-faint">
          Typical stages are a recruiter screen, a case-style interview with a business problem, a technical interview (coding, ML/GenAI concepts) and fit
          questions. Formats change between offices and years: ask your recruiter what yours will be.
        </p>
      </section>

      <section id="missions" className="mb-10 scroll-mt-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div className="section-title">Client missions</div>
          <span className="text-xs text-faint">Case simulator: discovery, framing, approach, plan, value, pitch</span>
        </div>
        <MissionGrid />
      </section>

      <section id="explain" className="mb-10 scroll-mt-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div className="section-title">Explain it simply</div>
          <span className="text-xs text-faint">Pick the clearest answer, then write your own</span>
        </div>
        <DeckGrid />
      </section>

      <section className="mb-10">
        <div className="section-title mb-3">A two-week plan</div>
        <div className="grid gap-4 lg:grid-cols-3">
          {PLAN.map((w) => (
            <div key={w.day} className="card p-5">
              <h3 className="font-semibold">{w.day}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {w.tasks.map((t) => (
                  <li key={t.text}>
                    <HubLink to={t.to} className="flex gap-2 text-muted hover:text-fg">
                      <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-accent" />
                      {t.text}
                    </HubLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="star" className="mb-10 scroll-mt-4">
        <div className="section-title mb-3">Playbooks</div>
        <div className="space-y-3">
          <Playbook title="The client discovery checklist">
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                <b>Objective</b>: "If this works, what changes for you in six months? How do you measure it today?"
              </li>
              <li>
                <b>Process</b>: "Walk me through what happens today, step by step. Where does the time go?"
              </li>
              <li>
                <b>Users</b>: "Who will use the output, and what will they do differently?"
              </li>
              <li>
                <b>Data</b>: "What data exists, how much, how far back, is the outcome recorded?"
              </li>
              <li>
                <b>Constraints</b>: legal and privacy, IT systems, deadlines, what must stay human.
              </li>
              <li>
                <b>Baseline</b>: "What have you tried? What is the current performance?"
              </li>
              <li>
                <b>Value</b>: volumes × time or money per case × share you can realistically improve.
              </li>
            </ol>
            <p className="mt-2">Avoid opening with the technology ("which model?"), the budget, or anything you could have read before the meeting.</p>
          </Playbook>
          <Playbook title="Answer like a consultant: the pyramid principle">
            <p>
              Start with the <b>answer</b>, then give 2 or 3 <b>reasons</b>, then the <b>details</b> only if asked. Example: "We recommend starting with
              routing, not automatic answers. Three reasons: it is where the delay comes from, we can measure it on your history, and it avoids compliance
              risks. Next step: a 4-week test."
            </p>
            <p className="mt-2">
              For a metric, always add the "so what": not "precision is 0.82" but "when the model flags a claim, it is right 8 times out of 10, so investigators
              waste far less time".
            </p>
          </Playbook>
          <Playbook title="Structuring a case answer out loud">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Restate the problem and the objective in one sentence; ask 2–3 clarifying questions.</li>
              <li>Announce your structure: "I would look at the business objective, the data, the approach, then risks and value."</li>
              <li>Propose the simplest approach that could work, and a baseline to beat.</li>
              <li>Say how you would evaluate it offline, then in a pilot.</li>
              <li>Name the main risks (data quality, privacy, adoption) and how to mitigate them.</li>
              <li>Size the value with explicit assumptions; say which one is the most uncertain.</li>
              <li>Conclude with a recommendation and a next step.</li>
            </ol>
          </Playbook>
          <Playbook title="Behavioural questions: the STAR method">
            <p>
              <b>S</b>ituation (one sentence of context), <b>T</b>ask (your responsibility), <b>A</b>ction (what <i>you</i> did, with "I", in 2–4 concrete
              steps), <b>R</b>esult (a number if possible, and what you learned). Aim for about 90 seconds.
            </p>
            <p className="mt-2">Prepare three stories you can adapt:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>A technical project you are proud of (and a trade-off you made).</li>
              <li>A time you explained something complex to a non-expert, or convinced someone.</li>
              <li>A failure or a conflict in a team, and what you changed afterwards.</li>
            </ul>
            <p className="mt-2">And have a crisp answer to "Why BCG X, and why this role?": client impact, building things that are actually used, variety of industries.</p>
          </Playbook>
        </div>
      </section>

      <section>
        <div className="section-title mb-3">Also useful</div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Resource to="/genai" icon={<Bot className="size-5" />} title="GenAI Academy" text="7 chapters with lessons, explained quizzes, calculations and bosses." />
          <Resource to="/competitions/rag" icon={<Trophy className="size-5" />} title="RAG competition" text="Build the retrieval step of a support assistant and earn a medal." />
          <Resource to="/memoire" icon={<Layers className="size-5" />} title="Flashcards" text="GenAI vocabulary with spaced repetition." />
          <Resource to="/entretien" icon={<Mic className="size-5" />} title="Mock interview" text="Timed coding session, like the technical round." />
          <Resource to="/maths" icon={<Sigma className="size-5" />} title="Maths & stats" text="Probabilities, tests and metrics behind the business cases (in French)." />
        </div>
      </section>
    </div>
  )
}

/** The client missions, with the best score or the step reached in an unfinished run. */
export function MissionGrid() {
  const p = useProgress((s) => s.p)
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {missions.map((m, i) => {
        const mp = p.missions?.[m.id]
        const run = savedMissionRun(p.caseRuns, m.id)
        return (
          <Link
            key={m.id}
            to={`/missions/${m.id}`}
            className="card card-hover flex flex-col p-5 animate-fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
            data-mission={m.id}
          >
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-white/[0.04] text-2xl">{m.emoji}</span>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-faint">
                  {i + 1}. {m.industry}
                </div>
                <h3 className="font-semibold">{m.title}</h3>
              </div>
              {run ? (
                <span className="ml-auto shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent" data-in-progress>
                  Step {run.step + 1}/8
                </span>
              ) : (
                mp?.completedAt && <CheckCircle2 className="ml-auto size-5 shrink-0 text-ok" />
              )}
            </div>
            <p className="mt-3 flex-1 text-sm text-muted">
              {m.client.role}, {m.client.company}.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {m.skills.slice(0, 3).map((s) => (
                <span key={s} className="chip text-[11px]">
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted">
              <DifficultyBadge difficulty={m.difficulty} lang="en" />
              <span>~{m.minutes} min</span>
              {mp && (
                <span className="ml-auto text-warn">
                  {rankFor(mp.best).emoji} {mp.best}/100
                </span>
              )}
            </div>
          </Link>
        )
      })}
    </div>  )
}

export function DeckGrid() {
  const p = useProgress((s) => s.p)
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {explainDecks.map((d) => {
        const dp = p.explain?.[d.id]
        const run = savedExplainRun(p.caseRuns, d.id)
        return (
          <Link key={d.id} to={`/explain/${d.id}`} className="card card-hover flex items-start gap-4 p-5" data-deck={d.id}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-2xl">{d.emoji}</span>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{d.title}</h3>
              <p className="mt-1 text-sm text-muted">{d.summary}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-faint">
                <span>{d.items.length} situations</span>
                <span>{d.write.length} writing drills</span>
                {run ? (
                  <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-accent" data-in-progress>
                    In progress
                  </span>
                ) : (
                  dp && <span className="ml-auto text-warn">Best {dp.best}/100</span>
                )}
              </div>
            </div>
          </Link>
        )
      })}
    </div>  )
}

/** /missions: the list of client missions. */
export function MissionsPage() {
  return (
    <div lang="en">
      <PageHeader
        icon={<Briefcase className="size-6" />}
        title="Client missions"
        subtitle="Case simulator: ask the client the right questions, frame the problem, choose an approach, plan the work, size the value and write the summary. Your progress is saved at every answer."
      />
      <MissionGrid />
    </div>
  )
}

/** /explain: the list of explain-it-simply decks. */
export function ExplainListPage() {
  return (
    <div lang="en">
      <PageHeader
        icon={<MessageSquareText className="size-6" />}
        title="Explain it simply"
        subtitle="Pick the clearest way to explain a model, a metric or a limitation to a non-technical audience, then write your own answer. Your progress is saved at every answer."
      />
      <DeckGrid />
    </div>
  )
}

function Kpi({ label, value, share }: { label: string; value: string; share: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      <ProgressBar value={share} className="mt-2" height={4} />
    </div>
  )
}

/** Links to an anchor on this page or to another route. */
function HubLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  if (to.startsWith('#')) {
    return (
      <button type="button" className={clsx('text-left', className)} onClick={() => document.getElementById(to.slice(1))?.scrollIntoView({ behavior: 'smooth' })}>
        {children}
      </button>
    )
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  )
}

function Playbook({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card">
      <button className="flex w-full items-center justify-between gap-3 p-4 text-left font-medium" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {title}
        <ChevronDown className={clsx('size-4 text-faint transition', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-line p-4 text-sm leading-relaxed text-muted [&_b]:text-fg">{children}</div>}
    </div>
  )
}

function Resource({ to, icon, title, text }: { to: string; icon: ReactNode; title: string; text: string }) {
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
