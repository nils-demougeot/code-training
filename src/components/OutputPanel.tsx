import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, ChevronDown, EyeOff, Loader2, Terminal, XCircle } from 'lucide-react'
import { useState } from 'react'
import type { RunResult, TestResult } from '@/lib/types'

export function TestCard({ t, index }: { t: TestResult; index: number }) {
  const [open, setOpen] = useState(!t.passed)
  const title = t.hidden ? `Test caché n°${index + 1}` : t.name
  return (
    <div
      className={clsx(
        'rounded-xl border transition',
        t.passed ? 'border-ok/20 bg-ok/[0.04]' : 'border-bad/25 bg-bad/[0.05]',
      )}
    >
      <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm" onClick={() => setOpen(!open)}>
        {t.passed ? <CheckCircle2 className="size-4 shrink-0 text-ok" /> : <XCircle className="size-4 shrink-0 text-bad" />}
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {t.hidden && <EyeOff className="size-3.5 text-faint" />}
        {t.durationMs !== undefined && <span className="font-mono text-[10px] text-faint">{t.durationMs} ms</span>}
        <ChevronDown className={clsx('size-4 text-faint transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-line px-3 py-2.5 font-mono text-xs">
          {!t.hidden && t.input && <Field label="Entrée" value={t.input} />}
          {!t.hidden && t.expected !== undefined && <Field label="Attendu" value={t.expected} />}
          {!t.hidden && t.got !== undefined && (
            <Field label="Obtenu" value={t.got} tone={t.passed ? 'ok' : 'bad'} />
          )}
          {t.error && <Field label={t.passed ? 'Note' : 'Problème'} value={t.error} tone="bad" />}
          {!t.hidden && t.stdout && <Field label="print()" value={t.stdout} />}
          {t.hidden && !t.error && t.passed && <div className="text-faint">Validé ✓</div>}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
      <span className="pt-0.5 font-sans text-[11px] text-faint">{label}</span>
      <pre
        className={clsx(
          'overflow-x-auto rounded-lg bg-black/30 px-2 py-1 whitespace-pre-wrap',
          tone === 'ok' && 'text-ok',
          tone === 'bad' && 'text-bad',
        )}
      >
        {value}
      </pre>
    </div>
  )
}

export function OutputPanel({
  result,
  running,
  progress,
  mode,
}: {
  result: RunResult | null
  running: boolean
  progress?: string | null
  mode: 'run' | 'test' | null
}) {
  if (running) {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-sm text-muted">
        <Loader2 className="size-4 animate-spin text-accent" />
        {progress ?? (mode === 'test' ? 'Exécution des tests…' : 'Exécution…')}
      </div>
    )
  }
  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-faint">
        <Terminal className="size-5" />
        <div>
          <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">Entrée</kbd> pour exécuter ·{' '}
          <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">Maj</kbd> + <kbd className="kbd">Entrée</kbd> pour
          soumettre
        </div>
      </div>
    )
  }
  if (result.engineError) {
    return (
      <div className="m-3 flex gap-3 rounded-xl border border-warn/30 bg-warn/[0.06] p-3 text-sm text-warn">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div>{result.engineError}</div>
      </div>
    )
  }
  const tests = result.tests ?? []
  return (
    <div className="space-y-3 p-3">
      {!!result.total && (
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'text-sm font-semibold',
              result.passed === result.total ? 'text-ok' : 'text-bad',
            )}
          >
            {result.passed === result.total ? 'Tous les tests passent' : `${result.passed}/${result.total} tests réussis`}
          </div>
          <div className="flex gap-1">
            {tests.map((t, i) => (
              <span key={i} className={clsx('size-2 rounded-full', t.passed ? 'bg-ok' : 'bg-bad')} />
            ))}
          </div>
          {!tests.length && <span className="text-xs text-faint">détail par étape à gauche</span>}
          {result.durationMs !== undefined && (
            <span className="ml-auto font-mono text-[10px] text-faint">{result.durationMs} ms</span>
          )}
        </div>
      )}
      {result.error && (
        <pre className="overflow-x-auto rounded-xl border border-bad/25 bg-bad/[0.06] p-3 font-mono text-xs whitespace-pre-wrap text-bad">
          {result.error}
        </pre>
      )}
      {(result.stdout || result.value) && (
        <div className="overflow-hidden rounded-xl border border-line bg-black/30">
          <div className="border-b border-line px-3 py-1 text-[10px] font-semibold tracking-wider text-faint uppercase">
            Sortie
          </div>
          <pre className="max-h-72 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap text-[#c0caf5]">
            {result.stdout}
            {result.value && <span className="text-accent-2">{(result.stdout ? '\n' : '') + '→ ' + result.value}</span>}
          </pre>
        </div>
      )}
      {result.figures?.map((f, i) => (
        <img key={i} src={`data:image/png;base64,${f}`} className="max-w-full rounded-xl border border-line" alt={`Figure ${i + 1}`} />
      ))}
      {tests.map((t, i) => (
        <TestCard key={`${i}-${t.name}-${t.passed}`} t={t} index={i} />
      ))}
      {!result.total && !result.error && !result.stdout && !result.value && !result.figures?.length && (
        <div className="text-sm text-faint">Exécuté sans sortie. Ajoute un print() ou termine par une expression.</div>
      )}
    </div>
  )
}
