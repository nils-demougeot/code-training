import { Binary, Brain, Database, Dices, FileCode2, Grid3x3, Network, Table2, type LucideIcon } from 'lucide-react'
import type { Difficulty, Domain } from './types'

export interface DomainMeta {
  label: string
  short: string
  description: string
  icon: LucideIcon
  /** CSS color used for accents (charts, chips, glows). */
  color: string
}

export const DOMAINS: Record<Domain, DomainMeta> = {
  python: {
    label: 'Python',
    short: 'PY',
    description: 'Listes, dicts, compréhensions, itérateurs, classes : la syntaxe sans hésiter.',
    icon: FileCode2,
    color: '#f5c451',
  },
  numpy: {
    label: 'NumPy',
    short: 'NP',
    description: 'ndarray, shapes, axes, broadcasting, vectorisation, algèbre linéaire.',
    icon: Grid3x3,
    color: '#4fb3ff',
  },
  pandas: {
    label: 'Pandas',
    short: 'PD',
    description: 'DataFrame, sélection, groupby, merge, pivot, nettoyage de données.',
    icon: Table2,
    color: '#a78bfa',
  },
  sql: {
    label: 'SQL',
    short: 'SQL',
    description: 'Requêtes, jointures, agrégats et window functions (SQLite).',
    icon: Database,
    color: '#2dd4bf',
  },
  stats: {
    label: 'Probas & stats',
    short: 'STA',
    description: 'Probabilités, simulations, tests statistiques, intervalles de confiance, A/B tests.',
    icon: Dices,
    color: '#a3e635',
  },
  ml: {
    label: 'Machine Learning',
    short: 'ML',
    description: 'scikit-learn, pipelines, validation, métriques, algos from scratch.',
    icon: Network,
    color: '#34d399',
  },
  dl: {
    label: 'Deep Learning',
    short: 'DL',
    description: 'Réseaux de neurones from scratch, backprop, PyTorch, entraînement.',
    icon: Brain,
    color: '#f472b6',
  },
  algo: {
    label: 'Algo & entretien',
    short: 'ALG',
    description: 'Structures de données et patterns classiques des entretiens de code.',
    icon: Binary,
    color: '#fb923c',
  },
}

export const DIFFICULTY: Record<Difficulty, { label: string; color: string; xp: number }> = {
  easy: { label: 'Facile', color: '#34d399', xp: 20 },
  medium: { label: 'Moyen', color: '#fbbf24', xp: 40 },
  hard: { label: 'Difficile', color: '#f87171', xp: 70 },
}
