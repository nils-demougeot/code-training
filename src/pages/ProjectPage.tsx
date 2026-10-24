import clsx from 'clsx'
import { ArrowLeft, CheckCircle2, ChevronRight, Eye, Lightbulb, PartyPopper } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { docLibForDomain } from '@/components/DocBrowser'
import { CodeBlock, Markdown } from '@/components/Markdown'
import { TestCard } from '@/components/OutputPanel'
import { DifficultyBadge, DomainChip, Empty } from '@/components/ui'
import { SplitPane, Workspace } from '@/components/Workspace'
import { projectById, setupOf } from '@/lib/content'
import { runCode, runTests } from '@/lib/engine'
import { useProgress } from '@/lib/progress'
import type { Project, RunResult, TestResult } from '@/lib/types'
import { celebrate } from './ExercisePage'

export default function ProjectPage() {
  const { id = '' } = useParams()
  const project = projectById.get(id)
  if (!project) return <div className="p-10"><Empty title="Projet introuvable" /></div>
  return <ProjectView key={project.id} project={project} />
}

function ProjectView({ project }: { project: Project }) {
  const saved = useProgress((s) => s.p.projects[project.id])
  const completeSteps = useProgress((s) => s.completeProjectSteps)
  const [code, setCode] = useState(() => saved?.code || project.starter)
  const [result, setResult] = useState<RunResult | null>(null)
  const [stepResults, setStepResults] = useState<TestResult[][] | null>(null)
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<'run' | 'test' | null>(null)
  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const [hints, setHints] = useState<Record<number, number>>({})
  const [showSolution, setShowSolution] = useState(false)
  const stepsDone = saved?.stepsDone ?? []
  const current = project.steps.findIndex((_, i) => !stepsDone.includes(i))
  const [open, setOpen] = useState<number>(current === -1 ? 0 : current)
  const setup = useMemo(() => setupOf(project), [project])
  const requireLocal = project.engine === 'local'

  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const onChange = (v: string) => {
    setCode(v)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => useProgress.getState().saveProjectCode(project.id, v), 800)
  }
  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const onRun = useCallback(async () => {
    if (running) return
    setRunning(true)
    setMode('run')
    // Example calls of the open step are evaluated too, so results show without print().
    const step = project.steps[open] ?? project.steps[0]
    const examples = step.tests.flatMap((t) => (t.call && !t.hidden ? [t.call] : []))
    setResult(
      await runCode(code, { setup, requireLocal, examples, onProgress: setProgressMsg, timeoutMs: requireLocal ? 300_000 : 60_000 }),
    )
    setRunning(false)
  }, [code, running, setup, requireLocal, project, open])

  const onSubmit = useCallback(async () => {
    if (running) return
    setRunning(true)
    setMode('test')
    const owners: number[] = []
    const tests = project.steps.flatMap((s, i) =>
      s.tests.map((t) => {
        owners.push(i)
        return { ...t, name: `Étape ${i + 1} · ${t.name ?? t.call ?? 'test'}` }
      }),
    )
    const res = await runTests(
      { code, solution: project.solution, setup, tests },
      { requireLocal, onProgress: setProgressMsg, timeoutMs: requireLocal ? 300_000 : 90_000 },
    )
    setRunning(false)
    setResult(res.tests ? { ...res, tests: [] } : res)
    if (!res.tests) return
    const grouped = project.steps.map((_, i) => res.tests!.filter((_, k) => owners[k] === i))
    setStepResults(grouped)
    const passedSteps = grouped.map((g, i) => (g.length && g.every((t) => t.passed) ? i : -1)).filter((i) => i >= 0)
    const fresh = passedSteps.filter((i) => !stepsDone.includes(i))
    if (fresh.length) {
      useProgress.getState().saveProjectCode(project.id, code)
      completeSteps(project.id, passedSteps)
      celebrate()
      const nextOpen = project.steps.findIndex((_, i) => !passedSteps.includes(i) && !stepsDone.includes(i))
      if (nextOpen >= 0) setOpen(nextOpen)
    }
  }, [code, running, project, setup, requireLocal, stepsDone, completeSteps])

  const allDone = stepsDone.length === project.steps.length

  const left = (
    <div className="h-full overflow-y-auto px-5 py-5">
      <Link to="/projets" className="mb-3 inline-flex items-center gap-1 text-xs text-faint hover:text-fg">
        <ArrowLeft className="size-3.5" />
        Projets
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">{project.title}</h1>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <DomainChip domain={project.domain} />
        <DifficultyBadge difficulty={project.difficulty} />
      </div>
      <Markdown className="mt-4">{project.intro}</Markdown>

      <div className="mt-6 space-y-2">
        {project.steps.map((s, i) => {
          const done = stepsDone.includes(i)
          const isOpen = open === i
          const results = stepResults?.[i]
          return (
            <div key={i} className={clsx('rounded-2xl border', isOpen ? 'border-accent/30 bg-white/[0.02]' : 'border-line')}>
              <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setOpen(isOpen ? -1 : i)}>
                <div className={clsx('flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold', done ? 'bg-ok/15 text-ok' : i === current ? 'bg-accent/20 text-accent' : 'bg-white/[0.05] text-faint')}>
                  {done ? <CheckCircle2 className="size-4" /> : i + 1}
                </div>
                <span className="flex-1 text-sm font-medium">{s.title}</span>
                {results && (
                  <span className={clsx('text-xs', results.every((t) => t.passed) ? 'text-ok' : 'text-bad')}>
                    {results.filter((t) => t.passed).length}/{results.length}
                  </span>
                )}
                <ChevronRight className={clsx('size-4 text-faint transition', isOpen && 'rotate-90')} />
              </button>
              {isOpen && (
                <div className="space-y-3 border-t border-line p-4">
                  <Markdown>{s.instructions}</Markdown>
                  {s.hints.slice(0, hints[i] ?? 0).map((h, k) => (
                    <div key={k} className="rounded-xl border border-warn/20 bg-warn/[0.04] p-3">
                      <Markdown>{h}</Markdown>
                    </div>
                  ))}
                  {(hints[i] ?? 0) < s.hints.length && (
                    <button className="btn btn-quiet px-2 py-1 text-xs" onClick={() => setHints((h) => ({ ...h, [i]: (h[i] ?? 0) + 1 }))}>
                      <Lightbulb className="size-3.5 text-warn" />
                      Indice
                    </button>
                  )}
                  {results && (
                    <div className="space-y-2">
                      {results.map((t, k) => (
                        <TestCard key={`${k}-${t.passed}`} t={{ ...t, name: t.name.replace(/^Étape \d+ · /, '') }} index={k} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {allDone && (
        <div className="mt-6 rounded-2xl border border-ok/30 bg-ok/[0.06] p-5 animate-pop">
          <div className="flex items-center gap-2 font-semibold text-ok">
            <PartyPopper className="size-5" />
            Projet terminé !
          </div>
          <Markdown className="mt-2">{project.outro}</Markdown>
        </div>
      )}

      <div className="mt-6">
        <button className="btn btn-quiet px-2 py-1 text-xs" onClick={() => setShowSolution(!showSolution)}>
          <Eye className="size-3.5" />
          {showSolution ? 'Masquer' : 'Voir'} une solution complète
        </button>
        {showSolution && <CodeBlock code={project.solution} className="mt-2 text-xs" />}
      </div>
    </div>
  )

  return (
    <SplitPane
      storageKey="ct.split.project"
      initial={0.4}
      left={left}
      right={
        <Workspace
          code={code}
          onChange={onChange}
          onRun={onRun}
          onSubmit={onSubmit}
          submitLabel="Vérifier les étapes"
          onReset={() => {
            if (confirm('Revenir au code de départ du projet ? Ton code actuel sera perdu.')) onChange(project.starter)
          }}
          running={running}
          mode={mode}
          result={result}
          progress={progressMsg}
          docLib={docLibForDomain(project.domain, requireLocal)}
        />
      }
    />
  )
}
