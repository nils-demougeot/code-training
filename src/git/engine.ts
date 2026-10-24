// A small Git + GitHub simulator: commits are full snapshots of a few text files, so status,
// merges (with conflicts), rebases, cherry-picks, stashes and pushes behave like the real thing
// at the scale of a lesson. Pure functions over a serializable state: the UI keeps a history of
// states for "undo", and scripts/git-levels-check.mjs replays every level's solution.

export type Tree = Record<string, string>

export interface Commit {
  id: string
  parents: string[]
  message: string
  tree: Tree
  /** Creation order, used for stable layouts and "most recent" choices. */
  order: number
}

export interface Repo {
  commits: Record<string, Commit>
  branches: Record<string, string>
  tags: Record<string, string>
  head: { branch: string | null; detached: string | null }
}

export interface MergeState {
  theirs: string
  theirsName: string
  conflicts: string[]
}

export interface Local extends Repo {
  work: Tree
  index: Tree
  /** Remote-tracking refs: "origin/main" → commit id. */
  tracking: Record<string, string>
  /** Local branch → remote branch name it tracks (on origin). */
  upstream: Record<string, string>
  merge: MergeState | null
  stash: { work: Tree; index: Tree; base: string | null; message: string }[]
}

export interface PullRequest {
  id: number
  head: string
  base: string
  title: string
  state: 'open' | 'merged'
}

export interface GitState {
  local: Local
  /** origin, hosted on GitHub. null when the lesson has no remote. */
  remote: Repo | null
  prs: PullRequest[]
  counter: number
}

export type Tone = 'out' | 'err' | 'ok' | 'warn' | 'muted' | 'info'
export interface Line {
  text: string
  tone?: Tone
}

export interface ExecResult {
  state: GitState
  lines: Line[]
  /** The UI clears the terminal. */
  clear?: boolean
}

class GitError extends Error {}

// ---------------------------------------------------------------- helpers

const clone = <T>(x: T): T => structuredClone(x)

function hashFor(n: number): string {
  let x = Math.imul(n + 7, 2654435761) >>> 0
  x = (x ^ (x >>> 15)) >>> 0
  x = Math.imul(x, 2246822519) >>> 0
  x = (x ^ (x >>> 13)) >>> 0
  return x.toString(16).padStart(8, '0').slice(0, 7)
}

function newCommit(s: GitState, repo: Repo, parents: string[], message: string, tree: Tree): Commit {
  let id = hashFor(s.counter)
  while (s.local.commits[id] || s.remote?.commits[id]) id = hashFor(++s.counter)
  const commit: Commit = { id, parents, message, tree: clone(tree), order: s.counter++ }
  repo.commits[id] = commit
  return commit
}

export function headId(repo: Repo): string | null {
  return repo.head.branch ? repo.branches[repo.head.branch] ?? null : repo.head.detached
}

export function ancestors(repo: Repo, id: string | null): Set<string> {
  const seen = new Set<string>()
  const stack = id ? [id] : []
  while (stack.length) {
    const c = stack.pop()!
    if (seen.has(c) || !repo.commits[c]) continue
    seen.add(c)
    stack.push(...repo.commits[c].parents)
  }
  return seen
}

export function isAncestor(repo: Repo, a: string, b: string): boolean {
  return ancestors(repo, b).has(a)
}

function mergeBase(repo: Repo, a: string, b: string): string | null {
  const common = [...ancestors(repo, a)].filter((c) => ancestors(repo, b).has(c))
  if (!common.length) return null
  return common.sort((x, y) => repo.commits[y].order - repo.commits[x].order)[0]
}

function treeOf(repo: Repo, id: string | null): Tree {
  return id ? repo.commits[id]?.tree ?? {} : {}
}

function sameTree(a: Tree, b: Tree): boolean {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => k in b && a[k] === b[k])
}

function changedFiles(a: Tree, b: Tree): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((f) => a[f] !== b[f]).sort()
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

/** Three-way merge of whole files: conflicts when both sides changed the same file differently. */
function threeWay(base: Tree, ours: Tree, theirs: Tree, oursName: string, theirsName: string) {
  const out: Tree = {}
  const conflicts: string[] = []
  for (const f of new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])) {
    const b = base[f]
    const o = ours[f]
    const t = theirs[f]
    let v: string | undefined
    if (o === t) v = o
    else if (o === b) v = t
    else if (t === b) v = o
    else {
      conflicts.push(f)
      v = `<<<<<<< ${oursName}\n${o ?? ''}\n=======\n${t ?? ''}\n>>>>>>> ${theirsName}`
    }
    if (v !== undefined) out[f] = v
  }
  return { tree: out, conflicts: conflicts.sort() }
}

function short(repo: Repo, id: string) {
  const c = repo.commits[id]
  return `${id} ${c?.message ?? ''}`
}

function tokenize(input: string): string[] {
  const out: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(input))) out.push(m[1] ?? m[2] ?? m[3])
  return out
}

// ---------------------------------------------------------------- state construction

export function emptyState(): GitState {
  return {
    local: {
      commits: {}, branches: {}, tags: {}, head: { branch: 'main', detached: null },
      work: {}, index: {}, tracking: {}, upstream: {}, merge: null, stash: [],
    },
    remote: null,
    prs: [],
    counter: 0,
  }
}

/** Builder used by the lessons to prepare a starting repository. */
export class Setup {
  s: GitState = emptyState()

  /** Commits the given file contents (added or modified) on the current branch. */
  commit(message: string, files: Tree = {}): this {
    Object.assign(this.s.local.work, files)
    this.run('git add -A', `git commit -m "${message}"`)
    return this
  }

  run(...commands: string[]): this {
    for (const c of commands) {
      const r = exec(this.s, c)
      const err = r.lines.find((l) => l.tone === 'err')
      if (err) throw new Error(`setup « ${c} » : ${err.text}`)
      this.s = r.state
    }
    return this
  }

  /** Uncommitted modifications in the working directory. */
  work(files: Tree): this {
    Object.assign(this.s.local.work, files)
    return this
  }

  /** Publishes the local repository as origin (as if it had been cloned from GitHub). */
  publish(): this {
    const l = this.s.local
    this.s.remote = { commits: clone(l.commits), branches: clone(l.branches), tags: clone(l.tags), head: { branch: 'main', detached: null } }
    for (const [b, id] of Object.entries(l.branches)) {
      l.tracking[`origin/${b}`] = id
      l.upstream[b] = b
    }
    return this
  }

  /** A teammate pushes a commit on origin/<branch> (the local repo does not see it yet). */
  teammate(branch: string, message: string, files: Tree): this {
    const r = this.s.remote!
    const parent = r.branches[branch]
    const tree = { ...treeOf(r, parent), ...files }
    const c = newCommit(this.s, r, parent ? [parent] : [], message, tree)
    r.branches[branch] = c.id
    return this
  }
}

// ---------------------------------------------------------------- refs

function resolve(s: GitState, ref: string): string {
  const l = s.local
  const m = /^(.+?)((?:[~^]\d*)*)$/.exec(ref)!
  let base = m[1]
  let id: string | undefined
  if (base === 'HEAD' || base === '@') id = headId(l) ?? undefined
  else if (l.branches[base]) id = l.branches[base]
  else if (l.tags[base]) id = l.tags[base]
  else if (l.tracking[base]) id = l.tracking[base]
  else if (/^[0-9a-f]{4,}$/.test(base)) {
    const hits = Object.keys(l.commits).filter((c) => c.startsWith(base))
    if (hits.length > 1) throw new GitError(`error: short object ID ${base} is ambiguous`)
    id = hits[0]
  }
  if (!id) throw new GitError(`fatal: ambiguous argument '${ref}': unknown revision or path not in the working tree.`)
  for (const op of m[2].match(/[~^]\d*/g) ?? []) {
    const n = op.length > 1 ? Number(op.slice(1)) : 1
    if (op[0] === '~') {
      for (let i = 0; i < n; i++) {
        id = l.commits[id!].parents[0]
        if (!id) throw new GitError(`fatal: '${ref}' : ce commit n'a pas assez d'ancêtres.`)
      }
    } else {
      id = l.commits[id!].parents[n - 1]
      if (!id) throw new GitError(`fatal: '${ref}' : parent introuvable.`)
    }
  }
  base = id!
  return base
}

function dirtyFiles(l: Local): string[] {
  const head = treeOf(l, headId(l))
  return [...new Set([...changedFiles(head, l.index), ...changedFiles(l.index, l.work)])]
}

function isClean(l: Local) {
  const head = treeOf(l, headId(l))
  return sameTree(head, l.index) && sameTree(l.index, l.work)
}

/** Moves HEAD to `target`, carrying uncommitted changes when they do not collide (like git). */
function checkoutTree(l: Local, target: string | null) {
  const from = treeOf(l, headId(l))
  const to = treeOf(l, target)
  const dirty = dirtyFiles(l)
  const blocked = dirty.filter((f) => from[f] !== to[f])
  if (blocked.length) {
    throw new GitError(
      `error: Your local changes to the following files would be overwritten by checkout:\n\t${blocked.join('\n\t')}\nPlease commit your changes or stash them before you switch branches.\nAborting`,
    )
  }
  const work = clone(to)
  const index = clone(to)
  for (const f of dirty) {
    if (f in l.work) work[f] = l.work[f]
    else delete work[f]
    if (f in l.index) index[f] = l.index[f]
    else delete index[f]
  }
  l.work = work
  l.index = index
}

function setHead(l: Local, branch: string | null, detached: string | null) {
  l.head = { branch, detached: branch ? null : detached }
}

function moveCurrent(l: Local, id: string) {
  if (l.head.branch) l.branches[l.head.branch] = id
  else l.head.detached = id
}

function decorations(s: GitState, id: string): string {
  const l = s.local
  const parts: string[] = []
  for (const [b, c] of Object.entries(l.branches)) {
    if (c !== id) continue
    parts.push(l.head.branch === b ? `HEAD -> ${b}` : b)
  }
  if (!l.head.branch && l.head.detached === id) parts.unshift('HEAD')
  for (const [t, c] of Object.entries(l.tracking)) if (c === id) parts.push(t)
  for (const [t, c] of Object.entries(l.tags)) if (c === id) parts.push(`tag: ${t}`)
  return parts.length ? ` (${parts.join(', ')})` : ''
}

// ---------------------------------------------------------------- commands

type Out = Line[]
const say = (out: Out, text: string, tone: Tone = 'out') => out.push({ text, tone })

function gitStatus(s: GitState, out: Out) {
  const l = s.local
  const id = headId(l)
  if (l.head.branch) say(out, `On branch ${l.head.branch}`)
  else say(out, `HEAD detached at ${id}`, 'warn')
  const up = l.head.branch ? l.upstream[l.head.branch] : undefined
  const tracked = up ? l.tracking[`origin/${up}`] : undefined
  if (up && tracked && id) {
    const ahead = [...ancestors(l, id)].filter((c) => !ancestors(l, tracked).has(c)).length
    const behind = [...ancestors(l, tracked)].filter((c) => !ancestors(l, id).has(c)).length
    if (ahead && behind) say(out, `Your branch and 'origin/${up}' have diverged, and have ${ahead} and ${behind} different commits each.`, 'warn')
    else if (ahead) say(out, `Your branch is ahead of 'origin/${up}' by ${plural(ahead, 'commit')}.\n  (use "git push" to publish your local commits)`)
    else if (behind) say(out, `Your branch is behind 'origin/${up}' by ${plural(behind, 'commit')}, and can be fast-forwarded.\n  (use "git pull" to update your local branch)`, 'warn')
    else say(out, `Your branch is up to date with 'origin/${up}'.`)
  }
  if (l.merge) {
    say(out, l.merge.conflicts.length ? 'You have unmerged paths.\n  (fix conflicts and run "git commit")\n  (use "git merge --abort" to abort the merge)' : 'All conflicts fixed but you are still merging.\n  (use "git commit" to conclude merge)', 'warn')
  }
  const head = treeOf(l, id)
  const staged = changedFiles(head, l.index).filter((f) => !l.merge?.conflicts.includes(f))
  const unmerged = l.merge?.conflicts ?? []
  const unstaged = changedFiles(l.index, l.work).filter((f) => f in l.index && !unmerged.includes(f))
  const untracked = Object.keys(l.work).filter((f) => !(f in l.index) && !(f in head)).sort()
  const kind = (f: string, before: Tree, after: Tree) => (!(f in before) ? 'new file:   ' : !(f in after) ? 'deleted:    ' : 'modified:   ')
  if (staged.length) {
    say(out, 'Changes to be committed:\n  (use "git restore --staged <file>..." to unstage)')
    for (const f of staged) say(out, `\t${kind(f, head, l.index)}${f}`, 'ok')
  }
  if (unmerged.length) {
    say(out, 'Unmerged paths:\n  (use "git add <file>..." to mark resolution)')
    for (const f of unmerged) say(out, `\tboth modified:   ${f}`, 'err')
  }
  if (unstaged.length) {
    say(out, 'Changes not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n  (use "git restore <file>..." to discard changes in working directory)')
    for (const f of unstaged) say(out, `\t${kind(f, l.index, l.work)}${f}`, 'err')
  }
  if (untracked.length) {
    say(out, 'Untracked files:\n  (use "git add <file>..." to include in what will be committed)')
    for (const f of untracked) say(out, `\t${f}`, 'err')
  }
  if (!staged.length && !unstaged.length && !untracked.length && !unmerged.length) say(out, 'nothing to commit, working tree clean')
}

function gitAdd(s: GitState, args: string[], out: Out) {
  const l = s.local
  if (!args.length) throw new GitError('Nothing specified, nothing added.\nhint: Maybe you wanted to say \'git add .\'?')
  const all = args.includes('.') || args.includes('-A') || args.includes('--all')
  const files = all ? [...new Set([...Object.keys(l.work), ...Object.keys(l.index)])] : args
  for (const f of files) {
    if (f in l.work) l.index[f] = l.work[f]
    else if (f in l.index) delete l.index[f]
    else throw new GitError(`fatal: pathspec '${f}' did not match any files`)
    if (l.merge?.conflicts.includes(f)) {
      if (l.work[f]?.includes('<<<<<<<')) say(out, `attention : ${f} contient encore des marqueurs de conflit.`, 'warn')
      l.merge.conflicts = l.merge.conflicts.filter((c) => c !== f)
    }
  }
}

function makeCommit(s: GitState, message: string, amend: boolean, out: Out) {
  const l = s.local
  const parent = headId(l)
  if (l.merge?.conflicts.length) {
    throw new GitError(`error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add <file>'\n\t${l.merge.conflicts.join('\n\t')}`)
  }
  if (amend) {
    if (!parent) throw new GitError('fatal: You have nothing to amend.')
    const old = l.commits[parent]
    const c = newCommit(s, l, old.parents, message || old.message, l.index)
    moveCurrent(l, c.id)
    say(out, `[${l.head.branch ?? 'detached HEAD'} ${c.id}] ${c.message}`, 'ok')
    say(out, `(le commit ${old.id} est remplacé par ${c.id} : nouveau hash, même parent)`, 'muted')
    return
  }
  const parents = parent ? [parent] : []
  if (l.merge) parents.push(l.merge.theirs)
  if (!l.merge && sameTree(treeOf(l, parent), l.index)) {
    const hasWork = !sameTree(l.index, l.work)
    throw new GitError(hasWork ? 'no changes added to commit (use "git add" and/or "git commit -a")' : 'nothing to commit, working tree clean')
  }
  const msg = message || (l.merge ? `Merge branch '${l.merge.theirsName}'` : '')
  const c = newCommit(s, l, parents, msg, l.index)
  const n = changedFiles(treeOf(l, parent), l.index).length
  moveCurrent(l, c.id)
  l.merge = null
  say(out, `[${l.head.branch ?? 'detached HEAD'}${parent ? '' : ' (root-commit)'} ${c.id}] ${c.message}`, 'ok')
  say(out, ` ${plural(n, 'file')} changed`, 'muted')
}

function gitCommit(s: GitState, args: string[], out: Out) {
  const l = s.local
  let message = ''
  let amend = false
  let all = false
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '-m' || a === '--message') message = args[++i] ?? ''
    else if (a === '-am' || a === '-a') {
      all = true
      if (a === '-am') message = args[++i] ?? ''
    } else if (a === '--amend') amend = true
    else if (a === '--no-edit') continue
  }
  if (all) for (const f of Object.keys(l.index)) {
    if (f in l.work) l.index[f] = l.work[f]
    else delete l.index[f]
  }
  if (!message && !amend && !l.merge) {
    throw new GitError('Ajoute un message avec -m "…" (dans ce simulateur, il n\'y a pas d\'éditeur de texte).')
  }
  makeCommit(s, message, amend, out)
}

function gitBranch(s: GitState, args: string[], out: Out) {
  const l = s.local
  if (!args.length || args[0] === '-a' || args[0] === '--all' || args[0] === '-v' || args[0] === '-vv') {
    for (const b of Object.keys(l.branches).sort()) {
      const current = l.head.branch === b
      const extra = args[0]?.startsWith('-v') ? ` ${l.branches[b]} ${l.commits[l.branches[b]].message}${l.upstream[b] ? ` [origin/${l.upstream[b]}]` : ''}` : ''
      say(out, `${current ? '* ' : '  '}${b}${extra}`, current ? 'ok' : 'out')
    }
    if (!l.head.branch) say(out, `* (HEAD detached at ${l.head.detached})`, 'warn')
    if (args[0] === '-a' || args[0] === '--all') for (const t of Object.keys(l.tracking).sort()) say(out, `  remotes/${t}`, 'err')
    return
  }
  if (args[0] === '-d' || args[0] === '-D') {
    const name = args[1]
    if (!l.branches[name]) throw new GitError(`error: branch '${name}' not found.`)
    if (l.head.branch === name) throw new GitError(`error: Cannot delete branch '${name}' checked out at '~/projet'`)
    const head = headId(l)
    if (args[0] === '-d' && head && !isAncestor(l, l.branches[name], head)) {
      throw new GitError(`error: The branch '${name}' is not fully merged.\nIf you are sure you want to delete it, run 'git branch -D ${name}'.`)
    }
    say(out, `Deleted branch ${name} (was ${l.branches[name]}).`, 'ok')
    delete l.branches[name]
    delete l.upstream[name]
    return
  }
  if (args[0] === '-m') {
    const [from, to] = args.length >= 3 ? [args[1], args[2]] : [l.head.branch!, args[1]]
    if (!l.branches[from]) throw new GitError(`error: branch '${from}' not found.`)
    l.branches[to] = l.branches[from]
    delete l.branches[from]
    if (l.head.branch === from) l.head.branch = to
    return
  }
  const name = args[0]
  if (!/^[\w./-]+$/.test(name)) throw new GitError(`fatal: '${name}' is not a valid branch name.`)
  if (l.branches[name]) throw new GitError(`fatal: A branch named '${name}' already exists.`)
  const at = args[1] ? resolve(s, args[1]) : headId(l)
  if (!at) throw new GitError("fatal: Not a valid object name: 'main'.")
  l.branches[name] = at
}

function switchTo(s: GitState, target: string, create: boolean, out: Out) {
  const l = s.local
  if (create) {
    if (l.branches[target]) throw new GitError(`fatal: a branch named '${target}' already exists`)
    const at = headId(l)
    if (!at) throw new GitError('fatal: aucun commit sur cette branche pour l\'instant.')
    l.branches[target] = at
    setHead(l, target, null)
    say(out, `Switched to a new branch '${target}'`, 'ok')
    return
  }
  if (l.branches[target]) {
    if (l.head.branch === target) {
      say(out, `Already on '${target}'`)
      return
    }
    checkoutTree(l, l.branches[target])
    setHead(l, target, null)
    say(out, `Switched to branch '${target}'`, 'ok')
    return
  }
  if (l.tracking[`origin/${target}`]) {
    // git's "DWIM": create a local branch tracking the remote one.
    checkoutTree(l, l.tracking[`origin/${target}`])
    l.branches[target] = l.tracking[`origin/${target}`]
    l.upstream[target] = target
    setHead(l, target, null)
    say(out, `branch '${target}' set up to track 'origin/${target}'.\nSwitched to a new branch '${target}'`, 'ok')
    return
  }
  throw new GitError(`fatal: invalid reference: ${target}`)
}

function gitCheckout(s: GitState, args: string[], out: Out) {
  const l = s.local
  if (args[0] === '--ours' || args[0] === '--theirs') {
    if (!l.merge) throw new GitError(`error: --${args[0].slice(2)} n'a de sens que pendant un merge en conflit.`)
    const files = args.slice(1).filter((a) => a !== '--')
    const side = args[0] === '--ours' ? headId(l) : l.merge.theirs
    for (const f of files) {
      if (!l.merge.conflicts.includes(f) && !(f in l.work)) throw new GitError(`error: pathspec '${f}' did not match any file(s) known to git`)
      const v = treeOf(l, side)[f]
      if (v === undefined) delete l.work[f]
      else l.work[f] = v
    }
    say(out, `Version ${args[0] === '--ours' ? 'de ta branche (ours)' : 'de l\'autre branche (theirs)'} gardée pour ${files.join(', ')}. N'oublie pas : git add`, 'ok')
    return
  }
  if (args[0] === '-b') return switchTo(s, args[1], true, out)
  if (args[0] === '--') return gitRestore(s, args.slice(1), out)
  const target = args[0]
  if (!target) throw new GitError('usage: git checkout <branch> | -b <new-branch> | <commit>')
  if (l.branches[target] || l.tracking[`origin/${target}`]) return switchTo(s, target, false, out)
  const id = resolve(s, target)
  checkoutTree(l, id)
  setHead(l, null, id)
  say(out, `Note: switching to '${target}'.\n\nYou are in 'detached HEAD' state. You can look around, make experimental\nchanges and commit them, and you can discard any commits you make in this\nstate without impacting any branches by switching back to a branch.\n\nHEAD is now at ${short(l, id)}`, 'warn')
}

function gitSwitch(s: GitState, args: string[], out: Out) {
  if (args[0] === '-c' || args[0] === '-C' || args[0] === '--create') return switchTo(s, args[1], true, out)
  if (args[0] === '--detach' || args[0] === '-d') return gitCheckout(s, [args[1]], out)
  if (!args[0]) throw new GitError('fatal: missing branch or commit argument')
  if (args[0] === '-') throw new GitError('Précise le nom de la branche dans ce simulateur.')
  const l = s.local
  if (!l.branches[args[0]] && !l.tracking[`origin/${args[0]}`]) {
    throw new GitError(`fatal: invalid reference: ${args[0]}\nhint: pour créer la branche : git switch -c ${args[0]}`)
  }
  switchTo(s, args[0], false, out)
}

function gitRestore(s: GitState, args: string[], out: Out) {
  const l = s.local
  const staged = args.includes('--staged') || args.includes('-S')
  const files = args.filter((a) => !a.startsWith('-'))
  if (!files.length) throw new GitError('fatal: you must specify path(s) to restore')
  const head = treeOf(l, headId(l))
  const expand = files.includes('.') ? [...new Set([...Object.keys(l.work), ...Object.keys(l.index), ...Object.keys(head)])] : files
  for (const f of expand) {
    if (staged) {
      if (f in head) l.index[f] = head[f]
      else delete l.index[f]
    } else {
      if (!(f in l.index) && !(f in l.work)) throw new GitError(`error: pathspec '${f}' did not match any file(s) known to git`)
      if (f in l.index) l.work[f] = l.index[f]
      else if (!files.includes('.')) throw new GitError(`error: pathspec '${f}' did not match any file(s) known to git`)
    }
  }
  say(out, staged ? `Fichier(s) retiré(s) de l'index : ${files.join(', ')}` : `Modifications annulées : ${files.join(', ')}`, 'muted')
}

function fastForward(s: GitState, to: string) {
  const l = s.local
  const from = treeOf(l, headId(l))
  const target = treeOf(l, to)
  checkoutTree(l, to)
  moveCurrent(l, to)
  return changedFiles(from, target)
}

function gitMerge(s: GitState, args: string[], out: Out) {
  const l = s.local
  if (args[0] === '--abort') {
    if (!l.merge) throw new GitError('fatal: There is no merge to abort (MERGE_HEAD missing).')
    const head = treeOf(l, headId(l))
    l.work = clone(head)
    l.index = clone(head)
    l.merge = null
    say(out, 'Merge annulé : retour à l\'état d\'avant le merge.', 'muted')
    return
  }
  if (l.merge) throw new GitError('error: Merging is not possible because you have unmerged files.')
  const noFf = args.includes('--no-ff')
  const name = args.find((a) => !a.startsWith('-'))
  if (!name) throw new GitError('fatal: No remote for the current branch.')
  const theirs = resolve(s, name)
  const ours = headId(l)!
  if (isAncestor(l, theirs, ours)) {
    say(out, 'Already up to date.')
    return
  }
  if (!isClean(l)) throw new GitError('error: Your local changes would be overwritten by merge.\nPlease commit your changes or stash them before you merge.\nAborting')
  if (isAncestor(l, ours, theirs) && !noFf) {
    const files = fastForward(s, theirs)
    say(out, `Updating ${ours}..${theirs}\nFast-forward`)
    for (const f of files) say(out, ` ${f}`, 'muted')
    return
  }
  const base = mergeBase(l, ours, theirs)
  const r = threeWay(treeOf(l, base), treeOf(l, ours), treeOf(l, theirs), 'HEAD', name)
  if (r.conflicts.length) {
    l.work = r.tree
    const clean = { ...r.tree }
    for (const f of r.conflicts) clean[f] = treeOf(l, ours)[f] ?? ''
    l.index = clean
    l.merge = { theirs, theirsName: name, conflicts: r.conflicts }
    for (const f of r.conflicts) say(out, `Auto-merging ${f}\nCONFLICT (content): Merge conflict in ${f}`, 'err')
    say(out, 'Automatic merge failed; fix conflicts and then commit the result.', 'err')
    return
  }
  l.work = r.tree
  l.index = clone(r.tree)
  const c = newCommit(s, l, [ours, theirs], `Merge branch '${name}'`, r.tree)
  moveCurrent(l, c.id)
  say(out, `Merge made by the 'ort' strategy.`, 'ok')
  for (const f of changedFiles(treeOf(l, ours), r.tree)) say(out, ` ${f}`, 'muted')
}

/** Replays `commits` (oldest first) on top of `onto`. Returns the new tip, or throws on conflict. */
function replay(s: GitState, repo: Repo, commits: string[], onto: string, out?: Out): string {
  let tip = onto
  for (const id of commits) {
    const c = repo.commits[id]
    const parentTree = treeOf(repo, c.parents[0] ?? null)
    const r = threeWay(parentTree, treeOf(repo, tip), c.tree, 'HEAD', id)
    if (r.conflicts.length) {
      throw new GitError(
        `CONFLICT (content): Merge conflict in ${r.conflicts.join(', ')}\nerror: could not apply ${short(repo, id)}\n` +
          '(Simulateur : la résolution de conflits pendant un rebase n\'est pas simulée. Dans un vrai dépôt : corrige le fichier, git add, puis git rebase --continue.)',
      )
    }
    const n = newCommit(s, repo, [tip], c.message, r.tree)
    out && say(out, `  ${id} → ${n.id} ${c.message}`, 'muted')
    tip = n.id
  }
  return tip
}

function commitsToReplay(repo: Repo, from: string, upstream: string): string[] {
  const exclude = ancestors(repo, upstream)
  return [...ancestors(repo, from)]
    .filter((c) => !exclude.has(c) && repo.commits[c].parents.length <= 1)
    .sort((a, b) => repo.commits[a].order - repo.commits[b].order)
}

function gitRebase(s: GitState, args: string[], out: Out) {
  const l = s.local
  if (args[0] === '--continue' || args[0] === '--abort') throw new GitError('Aucun rebase en cours.')
  if (args[0] === '-i' || args[0] === '--interactive') throw new GitError('Le rebase interactif n\'est pas simulé : utilise reset --soft puis un nouveau commit pour regrouper des commits.')
  const name = args[0]
  if (!name) throw new GitError('fatal: no upstream configured. Précise la branche : git rebase main')
  if (!isClean(l)) throw new GitError('error: cannot rebase: You have unstaged changes.\nerror: Please commit or stash them.')
  const onto = resolve(s, name)
  const head = headId(l)!
  if (isAncestor(l, onto, head)) {
    say(out, `Current branch ${l.head.branch ?? 'HEAD'} is up to date.`)
    return
  }
  if (isAncestor(l, head, onto)) {
    fastForward(s, onto)
    say(out, `Successfully rebased and updated refs/heads/${l.head.branch}. (fast-forward)`, 'ok')
    return
  }
  const todo = commitsToReplay(l, head, onto)
  say(out, `Rejeu de ${plural(todo.length, 'commit')} sur ${name} :`, 'muted')
  const before = clone(l)
  try {
    const tip = replay(s, l, todo, onto, out)
    checkoutTree(l, tip)
    moveCurrent(l, tip)
  } catch (err) {
    Object.assign(l, before)
    throw err
  }
  say(out, `Successfully rebased and updated refs/heads/${l.head.branch ?? 'HEAD'}.`, 'ok')
}

function gitReset(s: GitState, args: string[], out: Out) {
  const l = s.local
  const mode = args.find((a) => a === '--soft' || a === '--hard' || a === '--mixed') ?? '--mixed'
  const target = resolve(s, args.find((a) => !a.startsWith('-')) ?? 'HEAD')
  if (l.merge && mode !== '--hard') throw new GitError('Un merge est en cours : git merge --abort d\'abord.')
  moveCurrent(l, target)
  l.merge = null
  const tree = treeOf(l, target)
  if (mode !== '--soft') l.index = clone(tree)
  if (mode === '--hard') {
    l.work = clone(tree)
    say(out, `HEAD is now at ${short(l, target)}`, 'ok')
  } else {
    say(out, mode === '--soft' ? `HEAD déplacé sur ${target} : les changements des commits annulés restent dans l'index.` : `Unstaged changes after reset (HEAD sur ${target}).`, 'muted')
  }
}

function applyCommit(s: GitState, id: string, inverse: boolean): Tree {
  const l = s.local
  const c = l.commits[id]
  if (c.parents.length > 1) throw new GitError(`error: commit ${id} is a merge but no -m option was given.`)
  const parent = treeOf(l, c.parents[0] ?? null)
  const [base, theirs] = inverse ? [c.tree, parent] : [parent, c.tree]
  const r = threeWay(base, treeOf(l, headId(l)), theirs, 'HEAD', id)
  if (r.conflicts.length) {
    throw new GitError(`CONFLICT (content): Merge conflict in ${r.conflicts.join(', ')}\n(Simulateur : cette opération provoquerait un conflit, elle est annulée.)`)
  }
  return r.tree
}

function gitRevert(s: GitState, args: string[], out: Out) {
  const l = s.local
  if (!isClean(l)) throw new GitError('error: your local changes would be overwritten by revert.')
  const id = resolve(s, args.find((a) => !a.startsWith('-')) ?? '')
  const tree = applyCommit(s, id, true)
  const c = newCommit(s, l, [headId(l)!], `Revert "${l.commits[id].message}"`, tree)
  l.work = clone(tree)
  l.index = clone(tree)
  moveCurrent(l, c.id)
  say(out, `[${l.head.branch ?? 'detached HEAD'} ${c.id}] ${c.message}`, 'ok')
}

function gitCherryPick(s: GitState, args: string[], out: Out) {
  const l = s.local
  if (!isClean(l)) throw new GitError('error: your local changes would be overwritten by cherry-pick.')
  const refs = args.filter((a) => !a.startsWith('-'))
  if (!refs.length) throw new GitError('usage: git cherry-pick <commit>...')
  for (const ref of refs) {
    const id = resolve(s, ref)
    const tree = applyCommit(s, id, false)
    const c = newCommit(s, l, [headId(l)!], l.commits[id].message, tree)
    l.work = clone(tree)
    l.index = clone(tree)
    moveCurrent(l, c.id)
    say(out, `[${l.head.branch ?? 'detached HEAD'} ${c.id}] ${c.message}`, 'ok')
  }
}

function gitLog(s: GitState, args: string[], out: Out) {
  const l = s.local
  const oneline = args.includes('--oneline')
  const all = args.includes('--all')
  const ref = args.find((a) => !a.startsWith('-'))
  const starts = all ? [...Object.values(l.branches), ...Object.values(l.tracking), headId(l)].filter(Boolean) as string[] : [ref ? resolve(s, ref) : headId(l)].filter(Boolean) as string[]
  if (!starts.length) throw new GitError(`fatal: your current branch '${l.head.branch}' does not have any commits yet`)
  const seen = new Set<string>()
  for (const st of starts) for (const c of ancestors(l, st)) seen.add(c)
  const list = [...seen].sort((a, b) => l.commits[b].order - l.commits[a].order)
  for (const id of list) {
    const c = l.commits[id]
    const deco = decorations(s, id)
    if (oneline) {
      out.push({ text: `${id}${deco} ${c.message}`, tone: 'out' })
    } else {
      say(out, `commit ${id}${deco}`, 'warn')
      if (c.parents.length > 1) say(out, `Merge: ${c.parents.join(' ')}`)
      say(out, `\n    ${c.message}\n`)
    }
  }
}

function gitDiff(s: GitState, args: string[], out: Out) {
  const l = s.local
  const staged = args.includes('--staged') || args.includes('--cached')
  const [a, b] = staged ? [treeOf(l, headId(l)), l.index] : [l.index, l.work]
  const files = changedFiles(a, b).filter((f) => staged || f in l.index)
  if (!files.length) return say(out, staged ? '(rien dans l\'index)' : '(aucune modification non indexée)', 'muted')
  for (const f of files) {
    say(out, `diff --git a/${f} b/${f}`, 'info')
    const before = (a[f] ?? '').split('\n')
    const after = (b[f] ?? '').split('\n')
    for (const line of before) if (!after.includes(line) && line) say(out, `-${line}`, 'err')
    for (const line of after) if (!before.includes(line) && line) say(out, `+${line}`, 'ok')
  }
}

function gitStash(s: GitState, args: string[], out: Out) {
  const l = s.local
  const sub = args[0] ?? 'push'
  if (sub === 'list') {
    l.stash.forEach((st, i) => say(out, `stash@{${i}}: ${st.message}`))
    if (!l.stash.length) say(out, '(aucun stash)', 'muted')
    return
  }
  if (sub === 'pop' || sub === 'apply') {
    const st = l.stash[0]
    if (!st) throw new GitError('No stash entries found.')
    const head = treeOf(l, headId(l))
    const r = threeWay(treeOf(l, st.base), head, st.work, 'HEAD', 'stash')
    if (r.conflicts.length) throw new GitError(`CONFLICT : le stash touche ${r.conflicts.join(', ')}, modifié entre-temps.`)
    l.work = r.tree
    const idx = threeWay(treeOf(l, st.base), head, st.index, 'HEAD', 'stash')
    l.index = idx.conflicts.length ? clone(head) : idx.tree
    if (sub === 'pop') l.stash.shift()
    say(out, `Modifications du stash réappliquées${sub === 'pop' ? ' (stash supprimé)' : ''}.`, 'ok')
    gitStatus(s, out)
    return
  }
  if (sub === 'push' || sub === 'save' || sub === '-m') {
    if (isClean(l)) {
      say(out, 'No local changes to save')
      return
    }
    const msgIndex = args.indexOf('-m')
    const head = headId(l)
    l.stash.unshift({
      work: clone(l.work), index: clone(l.index), base: head,
      message: msgIndex >= 0 ? `On ${l.head.branch}: ${args[msgIndex + 1]}` : `WIP on ${l.head.branch}: ${head ? short(l, head) : ''}`,
    })
    l.work = clone(treeOf(l, head))
    l.index = clone(treeOf(l, head))
    say(out, `Saved working directory and index state ${l.stash[0].message}`, 'ok')
    return
  }
  throw new GitError(`git stash ${sub} : sous-commande non simulée (push, pop, apply, list).`)
}

function gitTag(s: GitState, args: string[], out: Out) {
  const l = s.local
  const pos = args.filter((a) => !a.startsWith('-'))
  if (!pos.length) {
    for (const t of Object.keys(l.tags).sort()) say(out, t)
    return
  }
  const name = args.includes('-a') ? args[args.indexOf('-a') + 1] : pos[0]
  const rest = pos.filter((p) => p !== name && args[args.indexOf(p) - 1] !== '-m')
  if (l.tags[name]) throw new GitError(`fatal: tag '${name}' already exists`)
  l.tags[name] = rest[0] ? resolve(s, rest[0]) : headId(l)!
}

function gitShow(s: GitState, args: string[], out: Out) {
  const l = s.local
  const id = resolve(s, args[0] ?? 'HEAD')
  const c = l.commits[id]
  say(out, `commit ${id}${decorations(s, id)}`, 'warn')
  say(out, `\n    ${c.message}\n`)
  const parent = treeOf(l, c.parents[0] ?? null)
  for (const f of changedFiles(parent, c.tree)) say(out, `${!(f in parent) ? 'A' : !(f in c.tree) ? 'D' : 'M'}\t${f}`, 'info')
}

// ---------------------------------------------------------------- remote

function requireRemote(s: GitState): Repo {
  if (!s.remote) throw new GitError("fatal: 'origin' does not appear to be a git repository\nfatal: Could not read from remote repository.")
  return s.remote
}

function copyCommits(from: Repo, to: Repo, tip: string) {
  for (const id of ancestors(from, tip)) if (!to.commits[id]) to.commits[id] = clone(from.commits[id])
}

function gitFetch(s: GitState, out: Out, quiet = false) {
  const r = requireRemote(s)
  const l = s.local
  const lines: string[] = []
  for (const [b, id] of Object.entries(r.branches)) {
    copyCommits(r, l, id)
    const key = `origin/${b}`
    const old = l.tracking[key]
    if (old === id) continue
    lines.push(old ? `   ${old}..${id}  ${b.padEnd(10)} -> ${key}` : ` * [new branch]      ${b.padEnd(10)} -> ${key}`)
    l.tracking[key] = id
  }
  for (const key of Object.keys(l.tracking)) {
    if (!r.branches[key.slice('origin/'.length)]) delete l.tracking[key]
  }
  if (!quiet) {
    if (lines.length) say(out, 'From github.com:toi/projet', 'muted')
    for (const line of lines) say(out, line, 'info')
  }
}

function gitPull(s: GitState, args: string[], out: Out) {
  const l = s.local
  requireRemote(s)
  const rebase = args.includes('--rebase')
  const pos = args.filter((a) => !a.startsWith('-'))
  const branch = pos[1] ?? (l.head.branch ? l.upstream[l.head.branch] : undefined)
  if (!branch) {
    throw new GitError(`There is no tracking information for the current branch.\nPlease specify which branch you want to merge with.\n\n    git pull origin ${l.head.branch ?? '<branch>'}\n\nIf you wish to set tracking information for this branch you can do so with:\n\n    git branch --set-upstream-to=origin/${l.head.branch} ${l.head.branch}`)
  }
  gitFetch(s, out)
  const ref = `origin/${branch}`
  if (!l.tracking[ref]) throw new GitError(`fatal: couldn't find remote ref ${branch}`)
  if (rebase) gitRebase(s, [ref], out)
  else gitMerge(s, [ref], out)
}

function gitPush(s: GitState, args: string[], out: Out) {
  const r = requireRemote(s)
  const l = s.local
  const force = args.includes('--force') || args.includes('-f') || args.includes('--force-with-lease')
  const setUp = args.includes('-u') || args.includes('--set-upstream')
  if (args.includes('--tags')) {
    for (const [t, id] of Object.entries(l.tags)) {
      copyCommits(l, r, id)
      if (!r.tags[t]) say(out, ` * [new tag]         ${t} -> ${t}`, 'info')
      r.tags[t] = id
    }
    return
  }
  const pos = args.filter((a) => !a.startsWith('-'))
  if (pos[0] && pos[0] !== 'origin') throw new GitError(`fatal: '${pos[0]}' does not appear to be a git repository`)
  let localName = pos[1] ?? l.head.branch
  let remoteName: string | undefined
  if (localName?.includes(':')) [localName, remoteName] = localName.split(':')
  if (!localName) throw new GitError('fatal: You are not currently on a branch.')
  if (l.tags[localName] && !l.branches[localName]) {
    copyCommits(l, r, l.tags[localName])
    r.tags[localName] = l.tags[localName]
    say(out, ` * [new tag]         ${localName} -> ${localName}`, 'info')
    return
  }
  if (!pos[1] && !l.upstream[localName] && !setUp) {
    throw new GitError(`fatal: The current branch ${localName} has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream origin ${localName}\n`)
  }
  remoteName = remoteName ?? (pos[1] ? localName : l.upstream[localName] ?? localName)
  const tip = l.branches[localName]
  if (!tip) throw new GitError(`error: src refspec ${localName} does not match any`)
  const remoteTip = r.branches[remoteName]
  if (remoteTip === tip) {
    say(out, 'Everything up-to-date')
  } else {
    if (remoteTip && !isAncestor({ ...l, commits: { ...l.commits, ...r.commits } }, remoteTip, tip) && !force) {
      throw new GitError(
        `To github.com:toi/projet.git\n ! [rejected]        ${localName} -> ${remoteName} (fetch first)\nerror: failed to push some refs to 'github.com:toi/projet.git'\nhint: Updates were rejected because the remote contains work that you do not\nhint: have locally. This is usually caused by another repository pushing to\nhint: the same ref. Integrate the remote changes (e.g. 'git pull ...') before\nhint: pushing again.`,
      )
    }
    copyCommits(l, r, tip)
    r.branches[remoteName] = tip
    say(out, 'To github.com:toi/projet.git', 'muted')
    say(out, remoteTip ? `   ${remoteTip}..${tip}  ${localName} -> ${remoteName}${force ? ' (forced update)' : ''}` : ` * [new branch]      ${localName} -> ${remoteName}`, 'info')
  }
  l.tracking[`origin/${remoteName}`] = tip
  if (setUp) {
    l.upstream[localName] = remoteName
    say(out, `branch '${localName}' set up to track 'origin/${remoteName}'.`, 'muted')
  }
}

function gitRemote(s: GitState, args: string[], out: Out) {
  requireRemote(s)
  if (args.includes('-v')) {
    say(out, 'origin\tgit@github.com:toi/projet.git (fetch)\norigin\tgit@github.com:toi/projet.git (push)')
  } else say(out, 'origin')
}

// ---------------------------------------------------------------- GitHub CLI

function ghPr(s: GitState, args: string[], out: Out) {
  const r = requireRemote(s)
  const sub = args[0]
  const opt = (name: string) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  if (sub === 'list') {
    const open = s.prs.filter((p) => p.state === 'open')
    if (!open.length) say(out, 'no open pull requests in toi/projet', 'muted')
    for (const p of open) say(out, `#${p.id}\t${p.title}\t${p.head} → ${p.base}`)
    return
  }
  if (sub === 'create') {
    const head = opt('--head') ?? opt('-H') ?? s.local.head.branch
    const base = opt('--base') ?? opt('-B') ?? 'main'
    if (!head || !r.branches[head]) {
      throw new GitError(`aborted: you must first push the current branch to a remote, or use the --head flag\n(git push -u origin ${head ?? '<branche>'})`)
    }
    if (!r.branches[base]) throw new GitError(`base branch '${base}' not found on origin`)
    if (isAncestor(r, r.branches[head], r.branches[base])) throw new GitError(`pull request create failed: No commits between ${base} and ${head}`)
    if (s.prs.some((p) => p.state === 'open' && p.head === head && p.base === base)) throw new GitError(`a pull request for branch "${head}" into branch "${base}" already exists`)
    const title = opt('--title') ?? opt('-t') ?? r.commits[r.branches[head]].message
    const pr: PullRequest = { id: s.prs.length + 1, head, base, title, state: 'open' }
    s.prs.push(pr)
    say(out, `Creating pull request for ${head} into ${base} in toi/projet\n\nhttps://github.com/toi/projet/pull/${pr.id}`, 'ok')
    return
  }
  if (sub === 'merge') {
    const n = args[1] && /^\d+$/.test(args[1].replace('#', '')) ? Number(args[1].replace('#', '')) : undefined
    const pr = n ? s.prs.find((p) => p.id === n) : s.prs.find((p) => p.state === 'open' && p.head === s.local.head.branch) ?? s.prs.find((p) => p.state === 'open')
    if (!pr) throw new GitError('no pull requests found')
    if (pr.state !== 'open') throw new GitError(`Pull request #${pr.id} is already merged`)
    const squash = args.includes('--squash') || args.includes('-s')
    const rebase = args.includes('--rebase') || args.includes('-r')
    const head = r.branches[pr.head]
    const base = r.branches[pr.base]
    const mb = mergeBase(r, head, base)
    const merged = threeWay(treeOf(r, mb), treeOf(r, base), treeOf(r, head), pr.base, pr.head)
    if (merged.conflicts.length) {
      throw new GitError(`X Pull request #${pr.id} is not mergeable: the merge commit cannot be cleanly created.\nRésous le conflit en local : git pull origin ${pr.base} (ou git merge), corrige, commit, push.`)
    }
    if (squash) {
      const c = newCommit(s, r, [base], `${pr.title} (#${pr.id})`, merged.tree)
      r.branches[pr.base] = c.id
    } else if (rebase) {
      r.branches[pr.base] = replay(s, r, commitsToReplay(r, head, base), base)
    } else {
      const c = newCommit(s, r, [base, head], `Merge pull request #${pr.id} from toi/${pr.head}`, merged.tree)
      r.branches[pr.base] = c.id
    }
    pr.state = 'merged'
    say(out, `✓ ${squash ? 'Squashed and merged' : rebase ? 'Rebased and merged' : 'Merged'} pull request #${pr.id} (${pr.title})`, 'ok')
    if (args.includes('--delete-branch') || args.includes('-d')) {
      delete r.branches[pr.head]
      say(out, `✓ Deleted branch ${pr.head} on origin`, 'ok')
    }
    say(out, `→ Pense à mettre ton dépôt local à jour : git switch ${pr.base} puis git pull`, 'muted')
    return
  }
  throw new GitError('gh pr : sous-commandes simulées : create, list, merge')
}

// ---------------------------------------------------------------- shell

const SHELL_HELP = `Commandes disponibles dans ce terminal :

  Fichiers   ls · cat <fichier> · touch <fichier> · edit <fichier> · rm <fichier>
             echo "texte" > <fichier>  (ou >> pour ajouter une ligne)
  Git        status · add · restore · commit · log · diff · show
             branch · switch · checkout · merge · rebase · reset · revert
             cherry-pick · stash · tag · fetch · pull · push · remote
  GitHub     gh pr create · gh pr list · gh pr merge
  Divers     clear · help · collegue (un collègue pousse un commit sur origin/main)

edit <fichier> simule une modification (ajoute une ligne) ; sur un fichier en conflit,
elle résout le conflit en gardant les deux versions. Pour garder un seul côté :
git checkout --ours <fichier> (ta branche) ou --theirs <fichier> (l'autre branche).`

function shell(s: GitState, cmd: string, args: string[], raw: string, out: Out): boolean {
  const l = s.local
  switch (cmd) {
    case 'ls':
      say(out, Object.keys(l.work).sort().join('  ') || '(dossier vide)')
      return true
    case 'cat': {
      const f = args[0]
      if (!(f in l.work)) throw new GitError(`cat: ${f}: No such file or directory`)
      for (const line of l.work[f].split('\n')) say(out, line, line.startsWith('<<<<<<<') || line.startsWith('>>>>>>>') || line === '=======' ? 'err' : 'out')
      return true
    }
    case 'touch':
      for (const f of args) if (!(f in l.work)) l.work[f] = ''
      return true
    case 'rm':
      for (const f of args.filter((a) => !a.startsWith('-'))) {
        if (!(f in l.work)) throw new GitError(`rm: cannot remove '${f}': No such file or directory`)
        delete l.work[f]
      }
      return true
    case 'edit':
    case 'nano':
    case 'vim':
    case 'code': {
      const f = args[0]
      if (!f) throw new GitError('usage: edit <fichier>')
      const current = l.work[f] ?? ''
      if (current.includes('<<<<<<<')) {
        const kept = current.split('\n').filter((x) => !/^(<<<<<<<|=======|>>>>>>>)/.test(x) && x !== '')
        l.work[f] = [...new Set(kept)].join('\n')
        say(out, `Conflit résolu dans ${f} (les deux versions sont gardées). N'oublie pas : git add ${f}`, 'ok')
      } else {
        const n = current ? current.split('\n').length + 1 : 1
        l.work[f] = current ? `${current}\nligne ${n} de ${f}` : `ligne 1 de ${f}`
        say(out, `${f} modifié.`, 'muted')
      }
      return true
    }
    case 'echo': {
      const m = /^echo\s+(?:"([^"]*)"|'([^']*)'|(.*?))\s*(>>?)\s*(\S+)\s*$/.exec(raw)
      if (!m) {
        say(out, args.join(' '))
        return true
      }
      const text = m[1] ?? m[2] ?? m[3] ?? ''
      const f = m[5]
      l.work[f] = m[4] === '>>' && l.work[f] ? `${l.work[f]}\n${text}` : text
      return true
    }
    case 'help':
      say(out, SHELL_HELP, 'muted')
      return true
    case 'collegue':
    case 'colleague': {
      const r = requireRemote(s)
      const branch = args[0] ?? 'main'
      const parent = r.branches[branch]
      const file = `notes-equipe.md`
      const tree = { ...treeOf(r, parent), [file]: `${treeOf(r, parent)[file] ? treeOf(r, parent)[file] + '\n' : ''}contribution ${s.counter}` }
      const c = newCommit(s, r, parent ? [parent] : [], 'Contribution d\'un collègue', tree)
      r.branches[branch] = c.id
      say(out, `Un collègue a poussé ${c.id} sur origin/${branch}. Ton dépôt ne le voit pas encore : git fetch.`, 'info')
      return true
    }
    case 'pwd':
      say(out, '/home/toi/projet')
      return true
  }
  return false
}

// ---------------------------------------------------------------- entry point

export function exec(state: GitState, input: string): ExecResult {
  const raw = input.trim()
  const out: Out = []
  if (!raw) return { state, lines: [] }
  if (raw === 'clear') return { state, lines: [], clear: true }
  const s = clone(state)
  const [cmd, ...args] = tokenize(raw)
  try {
    if (cmd === 'git') {
      const [sub, ...rest] = args
      switch (sub) {
        case 'status': gitStatus(s, out); break
        case 'add': gitAdd(s, rest, out); break
        case 'commit': gitCommit(s, rest, out); break
        case 'branch': gitBranch(s, rest, out); break
        case 'switch': gitSwitch(s, rest, out); break
        case 'checkout': gitCheckout(s, rest, out); break
        case 'restore': gitRestore(s, rest, out); break
        case 'merge': gitMerge(s, rest, out); break
        case 'rebase': gitRebase(s, rest, out); break
        case 'reset': gitReset(s, rest, out); break
        case 'revert': gitRevert(s, rest, out); break
        case 'cherry-pick': gitCherryPick(s, rest, out); break
        case 'log': gitLog(s, rest, out); break
        case 'diff': gitDiff(s, rest, out); break
        case 'show': gitShow(s, rest, out); break
        case 'stash': gitStash(s, rest, out); break
        case 'tag': gitTag(s, rest, out); break
        case 'fetch': gitFetch(s, out); break
        case 'pull': gitPull(s, rest, out); break
        case 'push': gitPush(s, rest, out); break
        case 'remote': gitRemote(s, rest, out); break
        case 'rm':
          for (const f of rest.filter((a) => !a.startsWith('-'))) {
            if (!(f in s.local.index)) throw new GitError(`fatal: pathspec '${f}' did not match any files`)
            delete s.local.work[f]
            delete s.local.index[f]
            say(out, `rm '${f}'`)
          }
          break
        case 'init':
          say(out, 'Ce dépôt est déjà initialisé (Reinitialized existing Git repository).', 'muted')
          break
        case 'clone':
          say(out, 'Ce dépôt a déjà été cloné depuis origin.', 'muted')
          break
        case undefined:
        case 'help':
          say(out, SHELL_HELP, 'muted')
          break
        default:
          throw new GitError(`git: '${sub}' is not a git command (ou n'est pas simulée ici). Tape help.`)
      }
    } else if (cmd === 'gh') {
      if (args[0] !== 'pr') throw new GitError('gh : seules les commandes gh pr … sont simulées.')
      ghPr(s, args.slice(1), out)
    } else if (!shell(s, cmd, args, raw, out)) {
      throw new GitError(`${cmd}: command not found (tape help)`)
    }
  } catch (err) {
    if (err instanceof GitError) return { state, lines: [{ text: err.message, tone: 'err' }] }
    throw err
  }
  return { state: s, lines: out }
}

/** Command names for autocompletion. */
export const COMMANDS = [
  'git status', 'git add', 'git commit -m', 'git log --oneline', 'git branch', 'git switch', 'git switch -c',
  'git checkout', 'git merge', 'git rebase', 'git reset', 'git revert', 'git cherry-pick', 'git stash', 'git stash pop',
  'git tag', 'git fetch', 'git pull', 'git push', 'git push -u origin', 'git restore', 'git restore --staged', 'git diff',
  'git show', 'gh pr create', 'gh pr merge', 'gh pr list', 'edit', 'cat', 'touch', 'ls', 'help', 'clear',
]

// ---------------------------------------------------------------- queries used by lesson goals

export const q = {
  head: (s: GitState) => headId(s.local),
  branch: (s: GitState) => s.local.head.branch,
  tip: (s: GitState, b: string) => s.local.branches[b],
  remoteTip: (s: GitState, b: string) => s.remote?.branches[b],
  commit: (s: GitState, id: string | null | undefined) => (id ? s.local.commits[id] ?? s.remote?.commits[id] : undefined),
  /** First-parent history of a local ref, newest first. */
  history: (s: GitState, id: string | null | undefined, repo: Repo = s.local): Commit[] => {
    const out: Commit[] = []
    let c = id ? repo.commits[id] : undefined
    while (c) {
      out.push(c)
      c = c.parents[0] ? repo.commits[c.parents[0]] : undefined
    }
    return out
  },
  clean: (s: GitState) => isClean(s.local),
  tree: (s: GitState, id: string | null | undefined) => treeOf(s.local, id ?? null),
  isAncestor: (s: GitState, a: string | undefined, b: string | undefined) => !!a && !!b && isAncestor(s.local, a, b),
  remoteHas: (s: GitState, b: string, file: string) => !!s.remote && file in treeOf(s.remote, s.remote.branches[b] ?? null),
  messages: (s: GitState, id: string | null | undefined) => q.history(s, id).map((c) => c.message),
}
