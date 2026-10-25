import { Sparkles } from 'lucide-react'
import { useEffect } from 'react'
import { useProgress, type Reward } from '@/lib/progress'

function Toast({ r }: { r: Reward }) {
  const dismiss = useProgress((s) => s.dismissReward)
  useEffect(() => {
    const t = setTimeout(() => dismiss(r.id), r.badge ? 5000 : 2800)
    return () => clearTimeout(t)
  }, [r, dismiss])

  if (r.badge) {
    return (
      <button
        onClick={() => dismiss(r.id)}
        className="pointer-events-auto flex w-72 items-center gap-3 rounded-2xl border border-accent/40 bg-panel-2/95 p-3 text-left shadow-2xl shadow-accent/20 backdrop-blur animate-pop"
      >
        <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent/30 to-accent-2/20 text-2xl">
          {r.badge.emoji}
        </div>
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-accent uppercase">Badge débloqué</div>
          <div className="font-semibold">{r.badge.label}</div>
          <div className="text-xs text-muted">{r.badge.description}</div>
        </div>
      </button>
    )
  }
  return (
    <button
      onClick={() => dismiss(r.id)}
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-line-strong bg-panel-2/95 py-1.5 pr-4 pl-2 text-sm shadow-xl backdrop-blur animate-pop"
    >
      <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-accent to-accent-2 px-2 py-0.5 text-xs font-bold text-white">
        <Sparkles className="size-3" />+{r.xp} XP
      </span>
      <span className="max-w-48 truncate text-muted">{r.label}</span>
    </button>
  )
}

export function RewardToasts() {
  const rewards = useProgress((s) => s.rewards)
  // Small per-card XP gains are frequent: only show meaningful rewards.
  const visible = rewards.filter((r) => r.badge || r.xp >= 10)
  return (
    <div className="pointer-events-none fixed right-4 bottom-20 z-[60] flex flex-col items-end gap-2">
      {visible.map((r) => (
        <Toast key={r.id} r={r} />
      ))}
    </div>
  )
}
