import { useMemo } from 'react'
import { dayKey } from '@/lib/progress'

/** GitHub-style activity heatmap (XP per day). */
export function Heatmap({ activity, weeks = 26 }: { activity: Record<string, number>; weeks?: number }) {
  const { columns, months } = useMemo(() => {
    const today = new Date()
    const start = new Date(today)
    // Align on Monday, `weeks` weeks back.
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (weeks - 1) * 7)
    const cols: { key: string; xp: number; future: boolean }[][] = []
    const monthLabels: { col: number; label: string }[] = []
    const cursor = new Date(start)
    for (let w = 0; w < weeks; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const key = dayKey(cursor)
        if (d === 0 && cursor.getDate() <= 7) {
          monthLabels.push({ col: w, label: cursor.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') })
        }
        col.push({ key, xp: activity[key] ?? 0, future: cursor > today })
        cursor.setDate(cursor.getDate() + 1)
      }
      cols.push(col)
    }
    return { columns: cols, months: monthLabels }
  }, [activity, weeks])

  const level = (xp: number) => (xp <= 0 ? 0 : xp < 20 ? 1 : xp < 50 ? 2 : xp < 100 ? 3 : 4)
  const colors = ['rgb(255 255 255 / 0.05)', '#3b2f6e', '#5b3fb8', '#8b5cf6', '#22d3ee']
  const cell = 12
  const gap = 3

  return (
    <div className="overflow-x-auto">
      <svg width={weeks * (cell + gap) + 24} height={7 * (cell + gap) + 18} className="block">
        {months.map((m) => (
          <text key={`${m.col}-${m.label}`} x={24 + m.col * (cell + gap)} y={9} className="fill-faint text-[9px]">
            {m.label}
          </text>
        ))}
        {['L', '', 'M', '', 'V', '', ''].map((l, i) => (
          <text key={i} x={0} y={18 + i * (cell + gap) + 9} className="fill-faint text-[9px]">
            {l}
          </text>
        ))}
        {columns.map((col, w) =>
          col.map((c, d) =>
            c.future ? null : (
              <rect
                key={c.key}
                x={24 + w * (cell + gap)}
                y={16 + d * (cell + gap)}
                width={cell}
                height={cell}
                rx={3}
                fill={colors[level(c.xp)]}
              >
                <title>{`${new Date(c.key + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} : ${c.xp} XP`}</title>
              </rect>
            ),
          ),
        )}
      </svg>
    </div>
  )
}

/** Radar chart of mastery per domain (values in 0..1). */
export function Radar({ axes, size = 260 }: { axes: { label: string; value: number; color: string }[]; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 42
  const n = axes.length
  const point = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v] as const
  }
  const poly = axes.map((a, i) => point(i, Math.max(0.04, a.value)).join(',')).join(' ')
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px]">
      <defs>
        <linearGradient id="radar-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.45" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((lvl) => (
        <polygon
          key={lvl}
          points={axes.map((_, i) => point(i, lvl).join(',')).join(' ')}
          fill="none"
          stroke="rgb(255 255 255 / 0.07)"
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, 1)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgb(255 255 255 / 0.06)" />
      })}
      <polygon points={poly} fill="url(#radar-fill)" stroke="#a78bfa" strokeWidth={1.5} strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = point(i, Math.max(0.04, a.value))
        const [lx, ly] = point(i, 1.22)
        return (
          <g key={a.label}>
            <circle cx={x} cy={y} r={3} fill={a.color} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-muted text-[10px] font-medium">
              {a.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Minimal line chart (used by labs for loss / accuracy curves). */
export function LineChart({
  series,
  height = 140,
  yMin,
  yMax,
  xLabel,
  yLabel,
  markers,
}: {
  series: { values: number[]; color: string; label: string; dashed?: boolean }[]
  height?: number
  yMin?: number
  yMax?: number
  xLabel?: string
  yLabel?: string
  markers?: { x: number; label: string }[]
}) {
  const width = 420
  const pad = { l: 34, r: 8, t: 8, b: 22 }
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v))
  const lo = yMin ?? (all.length ? Math.min(...all) : 0)
  const hi = yMax ?? (all.length ? Math.max(...all) : 1)
  const span = hi - lo || 1
  const n = Math.max(2, ...series.map((s) => s.values.length))
  const x = (i: number) => pad.l + (i / (n - 1)) * (width - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / span) * (height - pad.t - pad.b)
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(2))
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={width - pad.r} y1={y(lo + t * span)} y2={y(lo + t * span)} stroke="rgb(255 255 255 / 0.06)" />
          <text x={pad.l - 4} y={y(lo + t * span)} textAnchor="end" dominantBaseline="middle" className="fill-faint text-[9px]">
            {fmt(lo + t * span)}
          </text>
        </g>
      ))}
      {markers?.map((m) => (
        <g key={m.label}>
          <line x1={x(m.x)} x2={x(m.x)} y1={pad.t} y2={height - pad.b} stroke="#fbbf24" strokeDasharray="3 3" strokeOpacity={0.6} />
          <text x={x(m.x) + 3} y={pad.t + 8} className="fill-warn text-[9px]">{m.label}</text>
        </g>
      ))}
      {series.map((s) =>
        s.values.length > 1 ? (
          <polyline
            key={s.label}
            fill="none"
            stroke={s.color}
            strokeWidth={1.8}
            strokeDasharray={s.dashed ? '4 3' : undefined}
            strokeLinejoin="round"
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          />
        ) : null,
      )}
      {xLabel && (
        <text x={width - pad.r} y={height - 4} textAnchor="end" className="fill-faint text-[9px]">
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text x={pad.l + 4} y={pad.t + 8} className="fill-faint text-[9px]">
          {yLabel}
        </text>
      )}
    </svg>
  )
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: i.color, opacity: i.dashed ? 0.6 : 1 }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}
