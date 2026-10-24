// Personal labels the learner puts on exercises to sort them into lists.

export type LabelId = 'todo' | 'rework' | 'hard' | 'easy' | 'favorite'

export interface LabelDef {
  id: LabelId
  label: string
  emoji: string
  color: string
  hint: string
}

export const LABELS: LabelDef[] = [
  { id: 'todo', label: 'À faire', emoji: '📌', color: '#60a5fa', hint: 'Mis de côté pour plus tard (retiré automatiquement une fois résolu)' },
  { id: 'rework', label: 'À retravailler', emoji: '🔁', color: '#f97316', hint: 'Réussi, mais pas encore maîtrisé' },
  { id: 'hard', label: 'Difficile', emoji: '🔥', color: '#f87171', hint: 'M’a donné du fil à retordre' },
  { id: 'easy', label: 'Facile', emoji: '✅', color: '#34d399', hint: 'Acquis' },
  { id: 'favorite', label: 'Favori', emoji: '⭐', color: '#fbbf24', hint: 'Un classique à garder sous la main' },
]

export const labelById = new Map(LABELS.map((l) => [l.id, l]))

/** Labels that contradict each other: setting one removes the others. */
const EXCLUSIVE: Partial<Record<LabelId, LabelId[]>> = {
  easy: ['hard', 'rework'],
  hard: ['easy'],
  rework: ['easy'],
}

export function toggled(current: LabelId[], id: LabelId): LabelId[] {
  if (current.includes(id)) return current.filter((x) => x !== id)
  const drop = EXCLUSIVE[id] ?? []
  return [...current.filter((x) => !drop.includes(x)), id].sort((a, b) => LABELS.findIndex((l) => l.id === a) - LABELS.findIndex((l) => l.id === b))
}
