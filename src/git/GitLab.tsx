import clsx from 'clsx'
import { CornerDownLeft, FileText, GitPullRequest, Github, HardDrive, Layers, RotateCcw, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { COMMANDS, exec, headId, type GitState, type Line } from './engine'
import { GitGraph, localRefs, remoteRefs } from './GitGraph'

interface Entry {
  command?: string
  prompt?: string
  lines: Line[]
}

const TONE: Record<string, string> = {
  out: 'text-[#c0caf5]',
  err: 'text-[#f7768e]',
  ok: 'text-[#9ece6a]',
  warn: 'text-[#e0af68]',
  muted: 'text-faint',
  info: 'text-[#7dcfff]',
}

function promptOf(s: GitState) {
  const l = s.local
  const where = l.head.branch ?? `${l.head.detached ?? ''}…`
  return `~/projet (${where}${l.merge ? '|MERGING' : ''})`
}

/** Interactive Git playground: terminal + visual state. Controlled by the parent (state + onState). */
export function GitLab({
  state,
  onState,
  onCommand,
  onReset,
  welcome,
  inputRef,
}: {
  state: GitState
  onState: (s: GitState, command: string) => void
  onCommand?: (command: string) => void
  onReset: () => void
  welcome?: string
  inputRef?: React.RefObject<HTMLInputElement>
}) {
  const [entries, setEntries] = useState<Entry[]>(() => (welcome ? [{ lines: [{ text: welcome, tone: 'muted' }] }] : []))
  const [history, setHistory] = useState<GitState[]>([])
  const [input, setInput] = useState('')
  const [cmdHistory, setCmdHistory] = useState<string[]>([])
  const [cursor, setCursor] = useState(-1)
  const ownRef = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? ownRef
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [entries])

  const run = (command: string) => {
    const prompt = promptOf(state)
    const r = exec(state, command)
    if (r.clear) {
      setEntries([])
    } else {
      setEntries((e) => [...e.slice(-150), { command, prompt, lines: r.lines }])
    }
    if (command.trim()) {
      setCmdHistory((h) => [...h, command].slice(-100))
      onCommand?.(command)
    }
    if (r.state !== state) {
      setHistory((h) => [...h, state].slice(-50))
      onState(r.state, command)
    }
    setCursor(-1)
  }

  const undo = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    onState(prev, '(annuler)')
    setEntries((e) => [...e, { lines: [{ text: '↶ Dernière commande annulée (état précédent restauré).', tone: 'muted' }] }])
  }

  const completions = useMemo(() => {
    const l = state.local
    return [
      ...COMMANDS,
      ...Object.keys(l.branches),
      ...Object.keys(l.tracking),
      ...Object.keys(l.tags),
      ...Object.keys(l.work),
    ]
  }, [state])

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      run(input)
      setInput('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!cmdHistory.length) return
      const c = cursor < 0 ? cmdHistory.length - 1 : Math.max(0, cursor - 1)
      setCursor(c)
      setInput(cmdHistory[c])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (cursor < 0) return
      const c = cursor + 1
      if (c >= cmdHistory.length) {
        setCursor(-1)
        setInput('')
      } else {
        setCursor(c)
        setInput(cmdHistory[c])
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      // Complete the whole line against commands, else the last word against refs and files.
      const full = COMMANDS.filter((c) => c.startsWith(input) && c !== input)
      if (input && full.length === 1) return setInput(full[0] + ' ')
      if (input && full.length > 1) {
        // Like a shell: extend to the longest common prefix of the candidates.
        let prefix = full[0]
        for (const c of full) while (!c.startsWith(prefix)) prefix = prefix.slice(0, -1)
        if (prefix.length > input.length) return setInput(prefix)
      }
      const words = input.split(' ')
      const last = words[words.length - 1]
      if (!last) return
      const hits = [...new Set(completions)].filter((c) => !c.includes(' ') && c.startsWith(last))
      if (hits.length === 1) setInput([...words.slice(0, -1), hits[0]].join(' ') + ' ')
      else if (hits.length > 1) {
        setEntries((en) => [...en, { lines: [{ text: hits.join('   '), tone: 'muted' }] }])
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setEntries([])
    }
  }

  const l = state.local
  const remote = state.remote

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="text-xs text-faint">Tape tes commandes dans le terminal. <code>help</code> liste tout ce qui est simulé.</span>
        <div className="ml-auto flex gap-1.5">
          <button className="btn btn-quiet px-2 py-1 text-xs" onClick={undo} disabled={!history.length} title="Revenir à l’état d’avant la dernière commande">
            <Undo2 className="size-3.5" />
            Annuler
          </button>
          <button
            className="btn btn-quiet px-2 py-1 text-xs"
            onClick={() => {
              setHistory([])
              setEntries(welcome ? [{ lines: [{ text: welcome, tone: 'muted' }] }] : [])
              onReset()
            }}
            title="Repartir de l’état initial"
          >
            <RotateCcw className="size-3.5" />
            Recommencer
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div className={clsx('grid gap-3', remote && '2xl:grid-cols-2')}>
          <Panel icon={<HardDrive className="size-3.5" />} title="Ton dépôt local" sub={l.head.branch ? `HEAD → ${l.head.branch}` : 'HEAD détachée'}>
            <GitGraph repo={l} refs={localRefs(l)} />
          </Panel>
          {remote && (
            <Panel icon={<Github className="size-3.5" />} title="GitHub · origin" sub="github.com/toi/projet" tone="remote">
              <GitGraph repo={remote} refs={remoteRefs(remote)} />
              {state.prs.length > 0 && (
                <div className="mt-2 space-y-1.5 border-t border-line pt-2">
                  {state.prs.map((pr) => (
                    <div key={pr.id} className="flex items-center gap-2 text-xs">
                      <GitPullRequest className={clsx('size-3.5', pr.state === 'merged' ? 'text-[#a78bfa]' : 'text-ok')} />
                      <span className="font-medium">#{pr.id} {pr.title}</span>
                      <span className="font-mono text-faint">{pr.head} → {pr.base}</span>
                      <span className={clsx('chip ml-auto py-0 text-[10px]', pr.state === 'merged' ? 'text-[#a78bfa]' : 'text-ok')}>
                        {pr.state === 'merged' ? 'Merged' : 'Open'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}
        </div>
        <Areas state={state} />
      </div>

      <div className="flex h-[38%] min-h-48 flex-col border-t border-line bg-[#0b0d14]" onClick={() => ref.current?.focus()}>
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[12.5px] leading-relaxed">
          {entries.map((e, i) => (
            <div key={i} className="mb-1">
              {e.command !== undefined && (
                <div>
                  <span className="text-[#7aa2f7]">{e.prompt}</span> <span className="text-faint">$</span> <span className="text-fg">{e.command}</span>
                </div>
              )}
              {e.lines.map((line, j) => (
                <pre key={j} className={clsx('whitespace-pre-wrap break-words', TONE[line.tone ?? 'out'])}>
                  {line.text}
                </pre>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-white/5 px-3 py-2 font-mono text-[12.5px]">
          <span className="shrink-0 text-[#7aa2f7]">{promptOf(state)}</span>
          <span className="text-faint">$</span>
          <input
            ref={ref}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-faint"
            placeholder="git status"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label="Commande"
          />
          <CornerDownLeft className="size-3.5 text-faint" />
        </div>
      </div>
    </div>
  )
}

function Panel({ icon, title, sub, children, tone }: { icon: React.ReactNode; title: string; sub?: string; children: React.ReactNode; tone?: 'remote' }) {
  return (
    <div className={clsx('rounded-2xl border p-3', tone === 'remote' ? 'border-[#30363d] bg-[#0d1117]' : 'border-line bg-white/[0.02]')}>
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-fg">
          {icon}
          {title}
        </span>
        {sub && <span className="font-mono text-[11px] text-faint">{sub}</span>}
      </div>
      {children}
    </div>
  )
}

/** The three areas: working directory, index (staging), last commit. */
function Areas({ state }: { state: GitState }) {
  const l = state.local
  const head = (headId(l) && l.commits[headId(l)!]?.tree) || {}
  const conflicts = new Set(l.merge?.conflicts ?? [])
  const all = [...new Set([...Object.keys(l.work), ...Object.keys(l.index), ...Object.keys(head)])].sort()

  const workStatus = (f: string) =>
    !(f in l.work) ? (f in l.index ? 'supprimé' : null)
    : conflicts.has(f) || l.work[f].includes('<<<<<<<') ? 'conflit'
    : !(f in l.index) && !(f in head) ? 'non suivi'
    : l.work[f] !== l.index[f] ? 'modifié'
    : 'ok'
  const indexStatus = (f: string) =>
    !(f in l.index) ? (f in head ? 'supprimé' : null) : l.index[f] !== head[f] ? (f in head ? 'modifié' : 'nouveau') : 'ok'

  const cols = [
    { title: 'Répertoire de travail', hint: 'tes fichiers', icon: <FileText className="size-3.5" />, status: workStatus },
    { title: 'Index (staging)', hint: 'git add →', icon: <Layers className="size-3.5" />, status: indexStatus },
    { title: 'Dernier commit (HEAD)', hint: 'git commit →', icon: <HardDrive className="size-3.5" />, status: (f: string) => (f in head ? 'ok' : null) },
  ]
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {cols.map((c) => (
        <div key={c.title} className="rounded-xl border border-line bg-white/[0.02] p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted">
            {c.icon}
            {c.title}
            <span className="ml-auto font-mono text-[10px] text-faint">{c.hint}</span>
          </div>
          <div className="space-y-1">
            {all.map((f) => {
              const st = c.status(f)
              if (!st) return null
              return (
                <div key={f} className="flex items-center gap-1.5 font-mono text-[11.5px]" title={st}>
                  <span
                    className={clsx(
                      'size-1.5 shrink-0 rounded-full',
                      st === 'ok' ? 'bg-white/25' : st === 'conflit' ? 'bg-bad' : st === 'non suivi' ? 'bg-faint' : st === 'nouveau' || (c.title.startsWith('Index') && st === 'modifié') ? 'bg-ok' : 'bg-warn',
                    )}
                  />
                  <span className={clsx('truncate', st === 'supprimé' && 'line-through opacity-60')}>{f}</span>
                  {st !== 'ok' && <span className="ml-auto shrink-0 text-[10px] text-faint">{st}</span>}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
