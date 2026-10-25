import { useEffect } from 'react'
import { create } from 'zustand'
import type { RunResult } from './types'

/**
 * "Ask Claude": pages describe what the user is working on (statement, their code or answer, test
 * results), and the floating panel turns it into a prompt opened in claude.ai, so the conversation runs
 * on the user's own Claude plan with no API key and no API cost.
 */
export interface AskSection {
  label: string
  content: string
  /** Rendered as a fenced code block in this language. */
  code?: string
}

export interface AskContext {
  /** What kind of page, e.g. "Exercice Python", "BCG X client mission". */
  kind: string
  title: string
  sections: AskSection[]
  /** Answer in English (BCG X prep pages). */
  english?: boolean
  /** One-click questions shown in the panel. */
  suggestions?: string[]
}

interface AskStore {
  ctx: AskContext | null
  set: (ctx: AskContext | null) => void
}

export const useAskStore = create<AskStore>((set) => ({ ctx: null, set: (ctx) => set({ ctx }) }))

/** Registers the context of the current page (pass a memoised value, or null while loading). */
export function useAskContext(ctx: AskContext | null) {
  const set = useAskStore((s) => s.set)
  useEffect(() => {
    set(ctx)
  }, [ctx, set])
  useEffect(() => () => set(null), [set])
}

/** Visible test results, as text (hidden tests only say whether they pass). */
export function describeResult(r: RunResult | null): string {
  if (!r) return ''
  if (r.engineError) return `Erreur d'exécution : ${r.engineError}`
  const out: string[] = []
  if (r.tests?.length) {
    out.push(`${r.passed ?? 0}/${r.total ?? r.tests.length} tests passent.`)
    for (const t of r.tests.filter((t) => !t.passed).slice(0, 4)) {
      if (t.hidden) out.push(`- Un test caché échoue (${t.name}).`)
      else
        out.push(
          [`- Échec « ${t.name} »`, t.input && `entrée : ${t.input}`, t.expected && `attendu : ${t.expected}`, t.got && `obtenu : ${t.got}`, t.error && `erreur : ${t.error}`]
            .filter(Boolean)
            .join(' · '),
        )
    }
  }
  if (r.error) out.push(`Erreur :\n${r.error}`)
  if (!r.tests?.length && r.stdout) out.push(`Sortie :\n${r.stdout.slice(0, 1500)}`)
  return out.join('\n')
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}\n[…]` : s)

export function buildPrompt(ctx: AskContext | null, question: string, fallbackTitle: string): string {
  const en = !!ctx?.english
  const lines: string[] = []
  lines.push(
    en
      ? "I'm preparing for a BCG X Forward Deployed AI Scientist internship interview with my training app."
      : 'Je prépare un entretien de stage (BCG X, Forward Deployed AI Scientist) avec mon app d’entraînement.',
  )
  if (ctx) {
    lines.push(`${en ? 'Where I am' : 'Où j’en suis'} : ${ctx.kind} — ${ctx.title}`)
    for (const s of ctx.sections) {
      if (!s.content.trim()) continue
      lines.push('', `## ${s.label}`)
      lines.push(s.code !== undefined ? `\`\`\`${s.code}\n${clip(s.content.trimEnd(), 6000)}\n\`\`\`` : clip(s.content.trim(), 4000))
    }
  } else {
    lines.push(`Page : ${fallbackTitle}`)
  }
  lines.push('', `## ${en ? 'My question' : 'Ma question'}`)
  lines.push(
    question.trim() ||
      (en
        ? 'Help me make progress on this as a mentor would.'
        : 'Aide-moi à avancer, comme le ferait un mentor.'),
  )
  lines.push(
    '',
    en
      ? "Guide me step by step and explain the reasoning. Don't give me the full solution unless I ask for it explicitly. Answer in English."
      : 'Guide-moi pas à pas et explique le raisonnement. Ne me donne pas la solution complète sauf si je te la demande explicitement. Réponds en français.',
  )
  return lines.join('\n')
}

/** claude.ai pre-fills the message box from ?q= (undocumented: the prompt is also copied to the clipboard). */
export function claudeUrl(prompt: string) {
  const max = 7000
  return `https://claude.ai/new?q=${encodeURIComponent(prompt.length > max ? `${prompt.slice(0, max)}\n[…]` : prompt)}`
}
