import clsx from 'clsx'
import { useId, type ReactNode } from 'react'
import { DIFFICULTY, DOMAINS } from '@/lib/domains'
import type { Difficulty, Domain } from '@/lib/types'

export function DomainChip({ domain, className }: { domain: Domain; className?: string }) {
  const d = DOMAINS[domain]
  const Icon = d.icon
  return (
    <span
      className={clsx('chip', className)}
      style={{ color: d.color, borderColor: `${d.color}33`, background: `${d.color}12` }}
    >
      <Icon className="size-3" />
      {d.label}
    </span>
  )
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const d = DIFFICULTY[difficulty]
  return (
    <span className="chip" style={{ color: d.color, borderColor: `${d.color}33` }}>
      <span className="size-1.5 rounded-full" style={{ background: d.color }} />
      {d.label}
    </span>
  )
}

export function ProgressBar({
  value,
  color,
  className,
  height = 6,
}: {
  value: number
  color?: string
  className?: string
  height?: number
}) {
  return (
    <div className={clsx('overflow-hidden rounded-full bg-white/[0.06]', className)} style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          background: color ?? 'linear-gradient(90deg, #8b5cf6, #22d3ee)',
        }}
      />
    </div>
  )
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  color,
  children,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const id = useId()
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? `url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: T; label: ReactNode; disabled?: boolean }[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div className={clsx('flex gap-1 overflow-x-auto', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          disabled={t.disabled}
          onClick={() => onChange(t.id)}
          className={clsx(
            'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
            value === t.id ? 'bg-white/[0.08] text-fg' : 'text-muted hover:bg-white/[0.04] hover:text-fg',
            t.disabled && 'cursor-not-allowed opacity-40',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div className="flex items-center gap-4">
        {icon && (
          <div className="flex size-12 items-center justify-center rounded-2xl border border-line bg-gradient-to-br from-accent/25 to-accent-2/10 text-fg">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-muted">
        <span className="text-xs font-medium">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-2 text-faint">{icon}</div>}
      <div className="font-medium">{title}</div>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  )
}
