import { create } from 'zustand'

// Device-specific settings: never synced (a runner URL/token only makes sense on this machine).
export interface Settings {
  engine: 'browser' | 'local'
  runnerUrl: string
  runnerToken: string
  editorFontSize: number
  dailyGoalXp: number
}

const KEY = 'ct.settings.v1'

const defaults: Settings = {
  engine: 'browser',
  runnerUrl: 'http://127.0.0.1:8765',
  runnerToken: '',
  editorFontSize: 14,
  dailyGoalXp: 60,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch {
    return defaults
  }
}

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  update: (patch) => {
    set(patch)
    const { update: _ignored, ...rest } = { ...get() }
    try {
      localStorage.setItem(KEY, JSON.stringify(rest))
    } catch {
      /* storage unavailable: settings stay in memory */
    }
  },
}))
