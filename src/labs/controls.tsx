import clsx from 'clsx'
import type { ReactNode } from 'react'

export function Control({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        {value !== undefined && <span className="font-mono text-fg">{value}</span>}
      </div>
      {children}
    </div>
  )
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-black/20 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex-1 rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition',
            value === o.value ? 'bg-white/10 text-fg' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  min, max, step, value, onChange,
}: {
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[#8b5cf6]"
    />
  )
}

export function Metric({ label, value, tone }: { label: string; value: ReactNode; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] text-faint">{label}</div>
      <div
        className={clsx(
          'font-mono text-sm font-semibold',
          tone === 'ok' && 'text-ok',
          tone === 'warn' && 'text-warn',
          tone === 'bad' && 'text-bad',
        )}
      >
        {value}
      </div>
    </div>
  )
}

/** Square canvas for decision boundaries / loss surfaces. */
export function PlotCanvas({
  canvasRef,
  size = 420,
  onClick,
  children,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement>
  size?: number
  onClick?: (x: number, y: number) => void
  children?: ReactNode
}) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[460px] overflow-hidden rounded-2xl border border-line bg-[#0a0d14]">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="size-full"
        onClick={
          onClick
            ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                onClick((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height)
              }
            : undefined
        }
      />
      {children}
    </div>
  )
}
