import clsx from 'clsx'
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Eye, Lightbulb, Target, Terminal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Markdown } from '@/components/Markdown'
import { Empty } from '@/components/ui'
import { SplitPane } from '@/components/Workspace'
import { useProgress } from '@/lib/progress'
import { exec, type GitState } from '@/git/engine'
import { GitGraph, localRefs, remoteRefs } from '@/git/GitGraph'
import { GitLab } from '@/git/GitLab'
import { CHAPTERS, LEVELS, levelById, sandboxState, type GitLevel } from '@/git/levels'
import { celebrate } from '@/lib/celebrate'

const SANDBOX = 'bac-a-sable'

export default function GitLevelPage() {
  const { id } = useParams()
  if (id === SANDBOX) return <Sandbox />
  const level = id ? levelById.get(id) : undefined
  if (!level) {
    return (
      <Empty icon={<Terminal className="size-6" />} title="Mission introuvable">
        <Link to="/git" className="btn btn-ghost mt-4">Retour à Git</Link>
      </Empty>
    )
  }
  return <Level key={level.id} level={level} />
}

function Level({ level }: { level: GitLevel }) {
  const navigate = useNavigate()
  const [state, setState] = useState<GitState>(level.setup)
  const [commands, setCommands] = useState(0)
  const [hints, setHints] = useState(0)
  const [showSolution, setShowSolution] = useState(false)
  const [showGoal, setShowGoal] = useState(false)
  const [won, setWon] = useState<{ xp: number } | null>(null)
  const solveGitLevel = useProgress((s) => s.solveGitLevel)
  const solvedBefore = useProgress((s) => s.p.git?.[level.id])
  const inputRef = useRef<HTMLInputElement>(null)

  const status = level.goals.map((g) => g.check(state))
  const allDone = status.every(Boolean)

  useEffect(() => {
    if (allDone && !won) {
      setWon({ xp: solveGitLevel(level.id, Math.max(commands, 1)) })
      celebrate()
    }
  }, [allDone, won, commands, level.id, solveGitLevel])

  const goalState = useMemo(() => level.solution.reduce((s, c) => exec(s, c).state, level.setup()), [level])
  const index = LEVELS.findIndex((l) => l.id === level.id)
  const next = LEVELS[index + 1]
  const chapter = CHAPTERS.find((c) => c.id === level.chapter)

  const fill = (cmd: string) => {
    const el = inputRef.current
    if (!el) return
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(el, cmd)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.focus()
  }

  const left = (
    <div className="flex h-full min-w-0 flex-col">
      <div className="border-b border-line px-5 pt-4 pb-3">
        <button className="mb-2 flex items-center gap-1 text-xs text-faint hover:text-fg" onClick={() => navigate('/git')}>
          <ArrowLeft className="size-3.5" />
          Git & GitHub · {chapter?.title}
        </button>
        <h1 className="flex items-start gap-2 text-xl font-semibold tracking-tight">
          {solvedBefore && <CheckCircle2 className="mt-1 size-5 shrink-0 text-ok" />}
          <span>
            <span className="mr-2 font-mono text-sm text-faint">{index + 1}.</span>
            {level.title}
          </span>
        </h1>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <Markdown>{level.intro}</Markdown>

        <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Target className="size-4 text-accent" />
            Objectifs
            <button className="btn btn-quiet ml-auto px-2 py-0.5 text-xs" onClick={() => setShowGoal((v) => !v)}>
              <Eye className="size-3.5" />
              {showGoal ? 'Masquer' : 'Voir'} le résultat attendu
            </button>
          </div>
          <ul className="space-y-1.5">
            {level.goals.map((g, i) => (
              <li key={g.text} className={clsx('flex items-start gap-2 text-sm transition', status[i] ? 'text-ok' : 'text-muted')}>
                {status[i] ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <Circle className="mt-0.5 size-4 shrink-0 text-faint" />}
                {g.text}
              </li>
            ))}
          </ul>
          {showGoal && (
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              <div className="text-[11px] text-faint">Graphe une fois la mission réussie (les hash peuvent différer) :</div>
              <GitGraph repo={goalState.local} refs={localRefs(goalState.local)} />
              {goalState.remote && (
                <>
                  <div className="text-[11px] text-faint">GitHub :</div>
                  <GitGraph repo={goalState.remote} refs={remoteRefs(goalState.remote)} />
                </>
              )}
            </div>
          )}
        </div>

        {won && (
          <div className="rounded-2xl border border-ok/30 bg-ok/[0.06] p-4 animate-fade-up">
            <div className="flex flex-wrap items-center gap-3">
              <CheckCircle2 className="size-6 text-ok" />
              <div className="flex-1">
                <div className="font-semibold">Mission réussie !</div>
                <div className="text-xs text-muted">
                  {won.xp ? `+${won.xp} XP · ` : ''}
                  {commands} commande{commands > 1 ? 's' : ''} (solution de référence : {level.solution.length})
                </div>
              </div>
              {next ? (
                <Link to={`/git/${next.id}`} className="btn btn-primary px-3 py-1.5 text-xs">
                  Mission suivante
                  <ArrowRight className="size-3.5" />
                </Link>
              ) : (
                <Link to="/git/bac-a-sable" className="btn btn-primary px-3 py-1.5 text-xs">
                  Bac à sable
                  <ArrowRight className="size-3.5" />
                </Link>
              )}
            </div>
            <div className="mt-3 border-t border-ok/20 pt-3">
              <Markdown>{level.explanation}</Markdown>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {level.hints.slice(0, hints).map((h, i) => (
            <div key={i} className="flex gap-2 rounded-xl border border-warn/25 bg-warn/[0.05] p-3 text-sm">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-warn" />
              <Markdown>{h}</Markdown>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {hints < level.hints.length && (
              <button className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => setHints((h) => h + 1)}>
                <Lightbulb className="size-3.5" />
                Indice {hints + 1}/{level.hints.length}
              </button>
            )}
            <button className="btn btn-quiet px-3 py-1.5 text-xs" onClick={() => setShowSolution((v) => !v)}>
              <Eye className="size-3.5" />
              {showSolution ? 'Masquer' : 'Voir'} la solution
            </button>
          </div>
          {showSolution && (
            <div className="rounded-xl border border-line bg-black/30 p-3">
              <div className="mb-1.5 text-[11px] text-faint">Clique sur une commande pour la copier dans le terminal :</div>
              {level.solution.map((c, i) => (
                <button key={i} className="block w-full rounded px-1.5 py-0.5 text-left font-mono text-xs text-[#c0caf5] hover:bg-white/5" onClick={() => fill(c)}>
                  <span className="text-faint">$ </span>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <SplitPane
      storageKey="ct.split.git"
      initial={0.34}
      left={left}
      right={
        <GitLab
          state={state}
          inputRef={inputRef}
          onState={(s) => setState(s)}
          onCommand={() => setCommands((n) => n + 1)}
          onReset={() => {
            setState(level.setup())
            setCommands(0)
          }}
          welcome="Tape git status pour commencer. Flèche ↑ : commande précédente · Tab : complétion · help : aide."
        />
      }
    />
  )
}

function Sandbox() {
  const [state, setState] = useState<GitState>(sandboxState)
  const left = (
    <div className="h-full space-y-4 overflow-y-auto px-5 py-5">
      <Link to="/git" className="flex items-center gap-1 text-xs text-faint hover:text-fg">
        <ArrowLeft className="size-3.5" />
        Git & GitHub
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">Bac à sable</h1>
      <Markdown>{`Un dépôt cloné depuis GitHub, avec deux commits. Essaie librement : rien ne peut casser (**Annuler** revient d'une commande en arrière).

Idées :
- crée deux branches qui modifient le même fichier, merge-les, provoque un conflit ;
- compare \`git merge\` et \`git rebase\` sur la même situation (avec **Annuler** entre les deux) ;
- tape \`collegue\` pour qu'un collègue pousse sur \`origin/main\`, puis essaie \`git push\` ;
- ouvre une PR : \`git switch -c feature\`, \`edit app.py\`, \`git commit -am "…"\`, \`git push -u origin feature\`, \`gh pr create\`, \`gh pr merge\`.

Fichiers : \`edit fichier\` simule une modification, \`touch\` crée, \`cat\` affiche.`}</Markdown>
    </div>
  )
  return (
    <SplitPane
      storageKey="ct.split.git"
      initial={0.3}
      left={left}
      right={<GitLab state={state} onState={(s) => setState(s)} onReset={() => setState(sandboxState())} welcome="Bac à sable : tape help pour la liste des commandes." />}
    />
  )
}
