import clsx from 'clsx'
import {
  BookMarked, BookOpen, Bot, Briefcase, Calculator, ChevronDown, MessageSquareText, Trophy, Users, Code2, Cpu, Sigma, GitBranch, Flame, FlaskConical, Globe, LayoutDashboard, Layers, Menu, Mic, Puzzle, Rocket, Search,
  UserCircle2, X, Zap,
} from 'lucide-react'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cards } from '@/lib/content'
import { useEngine } from '@/lib/engine'
import { levelInfo, streak, totalXp, useProgress } from '@/lib/progress'
import { useSettings } from '@/lib/settings'
import { AskClaude } from './AskClaude'
import { CommandPalette } from './CommandPalette'
import { RewardToasts } from './RewardToasts'

export function useDueCards(): number {
  const p = useProgress((s) => s.p)
  return useMemo(() => {
    const now = Date.now()
    return cards.filter((c) => p.cards[c.id] && p.cards[c.id].due <= now).length
  }, [p])
}

type NavItem = { to: string; label: string; icon: typeof Code2; badge?: 'cards' }

/** The menu, grouped by purpose. Groups can be folded; the one holding the current page stays open. */
const NAV_GROUPS: { id: string; label: string; items: NavItem[] }[] = [
  {
    id: 'bcg',
    label: 'Prépa BCG X',
    items: [
      { to: '/prep', label: 'Vue d’ensemble', icon: Briefcase },
      { to: '/missions', label: 'Missions client', icon: Users },
      { to: '/explain', label: 'Explain it simply', icon: MessageSquareText },
      { to: '/genai', label: 'GenAI Academy', icon: Bot },
      { to: '/calcul', label: 'Calcul mental', icon: Calculator },
    ],
  },
  {
    id: 'code',
    label: 'Coder',
    items: [
      { to: '/exercices', label: 'Exercices', icon: Code2 },
      { to: '/blocs', label: 'Blocs de code', icon: Puzzle },
      { to: '/memoire', label: 'Mémoire', icon: Layers, badge: 'cards' },
      { to: '/quiz', label: 'Quiz éclair', icon: Zap },
      { to: '/entretien', label: 'Entretien blanc', icon: Mic },
    ],
  },
  {
    id: 'learn',
    label: 'Apprendre',
    items: [
      { to: '/maths', label: 'Maths', icon: Sigma },
      { to: '/labs', label: 'Labs', icon: FlaskConical },
      { to: '/fiches', label: 'Fiches', icon: BookOpen },
      { to: '/git', label: 'Git & GitHub', icon: GitBranch },
      { to: '/doc', label: 'Documentation', icon: BookMarked },
    ],
  },
  {
    id: 'practice',
    label: 'Mettre en pratique',
    items: [
      { to: '/projets', label: 'Projets', icon: Rocket },
      { to: '/competitions', label: 'Compétitions', icon: Trophy },
    ],
  },
]

const isActive = (to: string, path: string) => (to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`))

function useFolded() {
  const [folded, setFolded] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('nav-folded') ?? '[]')
    } catch {
      return []
    }
  })
  const toggle = (id: string) =>
    setFolded((f) => {
      const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id]
      try {
        localStorage.setItem('nav-folded', JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  return [folded, toggle] as const
}

function Logo() {
  // Each instance needs its own gradient id: the sidebar copy is hidden on mobile, and a
  // url(#id) pointing into a display:none subtree renders nothing.
  const gradientId = useId()
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex size-9 items-center justify-center rounded-xl border border-line bg-panel-2">
        <svg viewBox="0 0 64 64" className="size-6">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#8b5cf6" />
              <stop offset="1" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <path d="M24 20 12 32l12 12M40 20l12 12-12 12" fill="none" stroke={`url(#${gradientId})`} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="32" cy="32" r="4" fill="#22d3ee" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">Code Training</div>
        <div className="text-[11px] text-faint">Python · Data · IA</div>
      </div>
    </div>
  )
}

export function EnginePill({ compact }: { compact?: boolean }) {
  const { status, runner } = useEngine()
  const engine = useSettings((s) => s.engine)
  const local = engine === 'local'
  const color = local
    ? runner?.reachable ? '#34d399' : '#fbbf24'
    : { idle: '#5b6378', loading: '#fbbf24', ready: '#34d399', busy: '#22d3ee', error: '#f87171' }[status]
  const label = local
    ? runner?.reachable ? 'Runner local' : 'Runner local ?'
    : { idle: 'Python en veille', loading: 'Chargement…', ready: 'Python prêt', busy: 'Exécution…', error: 'Python en erreur' }[status]
  return (
    <NavLink
      to="/profil#moteur"
      className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-white/5 hover:text-fg"
      title="Moteur d'exécution"
    >
      {local ? <Cpu className="size-3.5" /> : <Globe className="size-3.5" />}
      {!compact && <span>{label}</span>}
      <span className="relative flex size-2">
        {(status === 'busy' || status === 'loading') && !local && (
          <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ background: color }} />
        )}
        <span className="relative inline-flex size-2 rounded-full" style={{ background: color }} />
      </span>
    </NavLink>
  )
}

function NavItemLink({ item: { to, label, icon: Icon, badge }, due, onNavigate }: { item: NavItem; due: number; onNavigate?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          'group relative flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm font-medium transition',
          isActive ? 'bg-white/[0.07] text-fg' : 'text-muted hover:bg-white/[0.035] hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-accent to-accent-2" />}
          <Icon className={clsx('size-[18px]', isActive ? 'text-accent' : 'text-faint group-hover:text-muted')} />
          <span className="flex-1">{label}</span>
          {badge === 'cards' && due > 0 && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">{due}</span>}
        </>
      )}
    </NavLink>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const p = useProgress((s) => s.p)
  const location = useLocation()
  const [folded, toggleFolded] = useFolded()
  const due = useDueCards()
  const xp = totalXp(p)
  const lvl = levelInfo(xp)
  const st = streak(p)

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-5 pb-5">
        <Logo />
      </div>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('open-palette'))}
        className="mx-3 mb-4 flex items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3 py-2 text-sm text-faint transition hover:border-line-strong hover:text-muted"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Rechercher…</span>
        <kbd className="kbd">Ctrl K</kbd>
      </button>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-2" aria-label="Navigation">
        <NavItemLink item={{ to: '/', label: 'Accueil', icon: LayoutDashboard }} due={due} onNavigate={onNavigate} />
        {NAV_GROUPS.map((g) => {
          const holdsCurrent = g.items.some((i) => isActive(i.to, location.pathname))
          const open = holdsCurrent || !folded.includes(g.id)
          return (
            <div key={g.id} className="mt-3" data-nav-group={g.id}>
              <button
                onClick={() => !holdsCurrent && toggleFolded(g.id)}
                className="flex w-full items-center gap-1 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-faint hover:text-muted"
                aria-expanded={open}
              >
                <span className="flex-1 text-left">{g.label}</span>
                <ChevronDown className={clsx('size-3.5 transition', !open && '-rotate-90', holdsCurrent && 'opacity-0')} />
              </button>
              {open && (
                <div className="mt-0.5 space-y-0.5">
                  {g.items.map((item) => (
                    <NavItemLink key={item.to} item={item} due={due} onNavigate={onNavigate} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className="space-y-2 p-3">
        <EnginePill />
        <NavLink
          to="/profil"
          onClick={onNavigate}
          className="block rounded-2xl border border-line bg-white/[0.02] p-3 transition hover:border-line-strong"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-sm font-bold text-white">
              {lvl.level}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>{lvl.title}</span>
                <span className={clsx('flex items-center gap-1 text-xs', st.activeToday ? 'text-orange-400' : 'text-faint')}>
                  <Flame className="size-3.5" />
                  {st.current}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${lvl.ratio * 100}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-faint">
                {xp} XP · {lvl.span - lvl.into} avant niv. {lvl.level + 1}
              </div>
            </div>
          </div>
        </NavLink>
      </div>
    </div>
  )
}

export function Layout({ children }: { children?: ReactNode }) {
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()
  const p = useProgress((s) => s.p)
  const st = streak(p)
  // Full-height workspaces (editor pages) manage their own scrolling.
  const workspace = /^\/(exercices|projets|entretien)\/.+/.test(location.pathname) || location.pathname === '/entretien/session'

  useEffect(() => setDrawer(false), [location.pathname])

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-panel/60 backdrop-blur lg:block">
        <SidebarContent />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-panel animate-fade-up">
            <button className="btn-quiet btn absolute top-4 right-3 px-2" onClick={() => setDrawer(false)} aria-label="Fermer">
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-panel/60 px-4 py-3 backdrop-blur lg:hidden">
          <button className="btn-quiet btn px-2" onClick={() => setDrawer(true)} aria-label="Menu">
            <Menu className="size-5" />
          </button>
          <Logo />
          <div className="flex items-center gap-1">
            <span className={clsx('flex items-center gap-1 text-sm', st.activeToday ? 'text-orange-400' : 'text-faint')}>
              <Flame className="size-4" />
              {st.current}
            </span>
            <NavLink to="/profil" className="btn-quiet btn px-2" aria-label="Profil">
              <UserCircle2 className="size-5" />
            </NavLink>
          </div>
        </header>
        <main className={clsx('min-h-0 flex-1', workspace ? 'overflow-hidden' : 'overflow-y-auto')}>
          {workspace ? (
            children ?? <Outlet />
          ) : (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children ?? <Outlet />}</div>
          )}
        </main>
      </div>
      <RewardToasts />
      <CommandPalette />
      <AskClaude />
    </div>
  )
}
