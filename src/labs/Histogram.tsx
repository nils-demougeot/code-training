import { useMemo } from 'react'

/** SVG histogram of `values` over [lo, hi], with an optional density curve overlay. */
export function Histogram({
  values,
  lo,
  hi,
  bins = 40,
  color = '#8b5cf6',
  density,
  markers,
  height = 170,
}: {
  values: number[]
  lo: number
  hi: number
  bins?: number
  color?: string
  /** Probability density to overlay (same x units). */
  density?: (x: number) => number
  markers?: { x: number; color: string; label?: string }[]
  height?: number
}) {
  const width = 420
  const pad = { l: 6, r: 6, t: 8, b: 18 }
  const { counts, binW } = useMemo(() => {
    const c = new Array(bins).fill(0)
    const w = (hi - lo) / bins
    for (const v of values) {
      const i = Math.floor((v - lo) / w)
      if (i >= 0 && i < bins) c[i]++
    }
    return { counts: c, binW: w }
  }, [values, lo, hi, bins])
  const n = Math.max(1, values.length)
  // Bars are drawn as densities so that the overlay curve matches.
  const dens = counts.map((c) => c / n / binW)
  const curve = density ? Array.from({ length: 120 }, (_, i) => lo + ((hi - lo) * i) / 119).map((x) => [x, density(x)] as const) : []
  const maxY = Math.max(1e-9, ...dens, ...curve.map(([, y]) => y)) * 1.1
  const x = (v: number) => pad.l + ((v - lo) / (hi - lo)) * (width - pad.l - pad.r)
  const y = (v: number) => height - pad.b - (v / maxY) * (height - pad.t - pad.b)
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {dens.map((d, i) => (
        <rect
          key={i}
          x={x(lo + i * binW) + 0.5}
          y={y(d)}
          width={Math.max(0.5, x(lo + (i + 1) * binW) - x(lo + i * binW) - 1)}
          height={Math.max(0, height - pad.b - y(d))}
          fill={color}
          opacity={0.7}
          rx={1.5}
        />
      ))}
      {curve.length > 0 && (
        <polyline
          fill="none"
          stroke="#fbbf24"
          strokeWidth={2}
          points={curve.map(([cx, cy]) => `${x(cx)},${y(cy)}`).join(' ')}
        />
      )}
      {markers?.map((m) => (
        <g key={`${m.label}-${m.x}`}>
          <line x1={x(m.x)} x2={x(m.x)} y1={pad.t} y2={height - pad.b} stroke={m.color} strokeDasharray="4 3" />
          {m.label && (
            <text x={x(m.x) + 3} y={pad.t + 9} className="text-[9px]" fill={m.color}>
              {m.label}
            </text>
          )}
        </g>
      ))}
      <line x1={pad.l} x2={width - pad.r} y1={height - pad.b} y2={height - pad.b} stroke="rgb(255 255 255 / 0.15)" />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <text key={t} x={x(lo + t * (hi - lo))} y={height - 4} textAnchor={t === 0 ? 'start' : t === 1 ? 'end' : 'middle'} className="fill-faint text-[9px]">
          {fmt(lo + t * (hi - lo))}
        </text>
      ))}
    </svg>
  )
}

export function normalPdf(mu: number, sigma: number) {
  return (x: number) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI))
}

/** Standard normal CDF (Abramowitz–Stegun approximation, error < 1e-7). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}
