import clsx from 'clsx'
import { Check, Copy, ExternalLink, Eye, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { buildPrompt, claudeUrl, useAskStore } from '@/lib/askClaude'

const DEFAULT_SUGGESTIONS = ['Explique-moi ce sujet simplement', 'Pose-moi 3 questions d’entretien là-dessus']

/** Floating "Ask Claude" button: sends the page context and the user's question to claude.ai. */
export function AskClaude() {
  const ctx = useAskStore((s) => s.ctx)
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [preview, setPreview] = useState(false)
  const [status, setStatus] = useState<'copied' | 'opened' | null>(null)
  const location = useLocation()
  const area = useRef<HTMLTextAreaElement>(null)
  const en = !!ctx?.english

  useEffect(() => {
    setQuestion('')
    setStatus(null)
    setOpen(false)
  }, [location.pathname])
  useEffect(() => {
    if (open) setTimeout(() => area.current?.focus(), 50)
  }, [open])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const prompt = useMemo(() => buildPrompt(ctx, question, location.pathname), [ctx, question, location.pathname])
  const suggestions = ctx?.suggestions ?? DEFAULT_SUGGESTIONS

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      return true
    } catch {
      return false
    }
  }
  const send = async () => {
    // Open first (still inside the click), then copy as a fallback in case the pre-fill is ignored.
    window.open(claudeUrl(prompt), '_blank', 'noopener')
    await copy()
    setStatus('opened')
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border border-accent/40 bg-panel/90 px-3.5 py-2.5 text-sm font-medium shadow-lg shadow-black/40 backdrop-blur transition hover:border-accent hover:bg-panel-2"
          aria-label="Demander à Claude"
          data-ask-claude
        >
          <Sparkles className="size-4 text-accent" />
          <span className="hidden sm:inline">Demander à Claude</span>
          {ctx && <span className="size-1.5 rounded-full bg-ok" title="Le contexte de la page sera envoyé" />}
        </button>
      )}
      {open && (
        <div
          className="fixed inset-x-2 bottom-2 z-50 flex max-h-[85dvh] flex-col rounded-2xl border border-line-strong bg-panel shadow-2xl shadow-black/60 animate-fade-up sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[26rem]"
          role="dialog"
          aria-label="Demander à Claude"
          data-ask-panel
        >
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Sparkles className="size-4 text-accent" />
            <div className="flex-1 font-medium">Demander à Claude</div>
            <button className="text-muted hover:text-fg" onClick={() => setOpen(false)} aria-label="Fermer">
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            <div className="rounded-xl border border-line bg-white/[0.02] p-3 text-xs text-muted">
              {ctx ? (
                <>
                  <div className="mb-1 text-fg">
                    Contexte envoyé : <b>{ctx.kind}</b> · {ctx.title}
                  </div>
                  <div>{ctx.sections.filter((s) => s.content.trim()).map((s) => s.label).join(' · ')}</div>
                </>
              ) : (
                <div>Aucun exercice ouvert : seule la page actuelle est mentionnée.</div>
              )}
              <button className="mt-2 flex items-center gap-1 text-accent hover:underline" onClick={() => setPreview((p) => !p)}>
                <Eye className="size-3.5" /> {preview ? 'Masquer le prompt' : 'Voir le prompt complet'}
              </button>
              {preview && <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2 font-mono text-[11px] text-muted">{prompt}</pre>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuestion(s)}
                  className={clsx('chip text-xs hover:border-accent/50 hover:text-fg', question === s && 'border-accent/60 text-fg')}
                >
                  {s}
                </button>
              ))}
            </div>
            <textarea
              ref={area}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send()
              }}
              rows={3}
              placeholder={en ? 'Your question (optional)…' : 'Ta question (facultatif)…'}
              className="w-full resize-y rounded-xl border border-line bg-black/30 p-3 outline-none focus:border-accent/50"
              data-ask-question
            />
            {status === 'opened' && (
              <div className="rounded-xl border border-ok/30 bg-ok/[0.06] p-2.5 text-xs text-muted" data-ask-status>
                Claude s’est ouvert dans un nouvel onglet avec ta question. Le prompt est aussi copié : s’il n’apparaît pas, colle-le (Ctrl+V).
              </div>
            )}
            {status === 'copied' && (
              <div className="rounded-xl border border-ok/30 bg-ok/[0.06] p-2.5 text-xs text-muted" data-ask-status>
                Prompt copié : colle-le dans Claude (Ctrl+V).
              </div>
            )}
          </div>
          <div className="flex gap-2 border-t border-line p-3">
            <button className="btn btn-primary flex-1 justify-center py-2.5" onClick={send} data-ask-send>
              <ExternalLink className="size-4" /> Ouvrir dans Claude
            </button>
            <button
              className="btn btn-ghost px-3"
              onClick={async () => setStatus((await copy()) ? 'copied' : null)}
              title="Copier le prompt"
              aria-label="Copier le prompt"
            >
              {status === 'copied' ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}
            </button>
          </div>
          <div className="px-4 pb-3 text-[11px] text-faint">Utilise ton forfait Claude (claude.ai) : aucune clé ni frais d’API.</div>
        </div>
      )}
    </>
  )
}
