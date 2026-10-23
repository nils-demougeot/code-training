import clsx from 'clsx'
import {
  Cloud, CloudOff, Cpu, Download, Github, Globe, Loader2, LogOut, Mail, RefreshCw, Settings, Trash2, Upload, UserCircle2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PageHeader, ProgressBar } from '@/components/ui'
import { checkRunner, initBrowserEngine, useEngine } from '@/lib/engine'
import {
  BADGES, emptyProgress, exportProgress, importProgress, levelInfo, streak, totalXp, useProgress,
} from '@/lib/progress'
import { useSettings } from '@/lib/settings'
import { signInWithEmail, signInWithGithub, signOut, syncConfigured, syncNow, useSync } from '@/lib/sync'

function Section({ id, title, icon, children }: { id?: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-6 p-6">
      <h2 className="mb-5 flex items-center gap-2 font-semibold">
        <span className="text-accent">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function Profile() {
  const location = useLocation()
  useEffect(() => {
    const id = location.hash.replace('#', '')
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [location.hash])

  return (
    <div>
      <PageHeader icon={<UserCircle2 className="size-6" />} title="Profil & réglages" />
      <div className="space-y-6">
        <ProfileCard />
        <SyncSection />
        <EngineSection />
        <PreferencesSection />
        <DataSection />
      </div>
    </div>
  )
}

function ProfileCard() {
  const p = useProgress((s) => s.p)
  const xp = totalXp(p)
  const lvl = levelInfo(xp)
  const st = streak(p)
  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-2xl font-bold text-white shadow-lg shadow-accent/30">
          {lvl.level}
        </div>
        <div className="min-w-48 flex-1">
          <div className="text-lg font-semibold">{lvl.title}</div>
          <div className="text-sm text-muted">
            {xp} XP · série actuelle {st.current} j · record {st.best} j
          </div>
          <ProgressBar value={lvl.ratio} className="mt-2 max-w-sm" />
        </div>
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {BADGES.map((b) => {
          const got = p.badges[b.id]
          return (
            <div key={b.id} className={clsx('flex items-center gap-3 rounded-xl border p-3', got ? 'border-accent/30 bg-accent/[0.06]' : 'border-line opacity-50')}>
              <span className={clsx('text-2xl', !got && 'grayscale')}>{b.emoji}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium">{b.label}</div>
                <div className="truncate text-xs text-muted">{b.description}</div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SyncSection() {
  const { session, status, lastSync, error } = useSync()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!syncConfigured) {
    return (
      <Section title="Compte & synchronisation" icon={<CloudOff className="size-5" />}>
        <p className="text-sm text-muted">
          La synchronisation n’est pas encore configurée : ta progression est sauvegardée dans ce navigateur. Pour la
          retrouver sur tous tes appareils, crée un projet Supabase gratuit puis renseigne{' '}
          <code className="rounded bg-white/5 px-1">VITE_SUPABASE_URL</code> et{' '}
          <code className="rounded bg-white/5 px-1">VITE_SUPABASE_ANON_KEY</code> (voir le README, section « Compte
          synchronisé »).
        </p>
      </Section>
    )
  }

  if (!session) {
    return (
      <Section title="Compte & synchronisation" icon={<Cloud className="size-5" />}>
        <p className="mb-4 text-sm text-muted">Connecte-toi pour synchroniser ta progression entre ordinateur et téléphone.</p>
        {sent ? (
          <div className="rounded-xl border border-ok/30 bg-ok/[0.06] p-4 text-sm">
            Lien de connexion envoyé à <strong>{email}</strong>. Ouvre-le sur cet appareil.
          </div>
        ) : (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              setErr(null)
              try {
                await signInWithEmail(email)
                setSent(true)
              } catch (ex) {
                setErr((ex as Error).message)
              }
              setBusy(false)
            }}
          >
            <input className="input max-w-xs" type="email" required placeholder="ton@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn-primary" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              Recevoir un lien magique
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => signInWithGithub().catch((ex) => setErr(ex.message))}>
              <Github className="size-4" />
              GitHub
            </button>
          </form>
        )}
        {err && <p className="mt-3 text-sm text-bad">{err}</p>}
      </Section>
    )
  }

  return (
    <Section title="Compte & synchronisation" icon={<Cloud className="size-5" />}>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <div className="text-sm">
            Connecté : <strong>{session.user.email}</strong>
          </div>
          <div className={clsx('text-xs', status === 'error' ? 'text-bad' : 'text-faint')}>
            {status === 'syncing'
              ? 'Synchronisation…'
              : status === 'error'
                ? `Erreur de synchro : ${error}`
                : lastSync
                  ? `Synchronisé à ${new Date(lastSync).toLocaleTimeString('fr-FR')}`
                  : 'Pas encore synchronisé'}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => syncNow()} disabled={status === 'syncing'}>
          <RefreshCw className={clsx('size-4', status === 'syncing' && 'animate-spin')} />
          Synchroniser
        </button>
        <button className="btn btn-quiet" onClick={() => signOut()}>
          <LogOut className="size-4" />
          Déconnexion
        </button>
      </div>
    </Section>
  )
}

function EngineSection() {
  const settings = useSettings()
  const { status, version, message, runner } = useEngine()
  const [checking, setChecking] = useState(false)

  const test = async () => {
    setChecking(true)
    await checkRunner()
    setChecking(false)
  }

  return (
    <Section id="moteur" title="Moteur d’exécution" icon={<Cpu className="size-5" />}>
      <div className="grid gap-3 md:grid-cols-2">
        <button
          onClick={() => {
            settings.update({ engine: 'browser' })
            initBrowserEngine().catch(() => {})
          }}
          className={clsx('rounded-2xl border p-4 text-left transition', settings.engine === 'browser' ? 'border-accent/50 bg-accent/10' : 'border-line hover:border-line-strong')}
        >
          <div className="flex items-center gap-2 font-medium">
            <Globe className="size-4" />
            Navigateur (Pyodide)
          </div>
          <p className="mt-1 text-xs text-muted">
            Python compilé en WebAssembly, exécuté sur le processeur de ta machine, dans un worker isolé. NumPy, Pandas,
            scikit-learn, matplotlib et SQLite inclus. Rien à installer, fonctionne aussi sur téléphone.
          </p>
          <div className="mt-2 text-xs text-faint">
            État : {status}
            {version && ` · Pyodide ${version}`}
            {message && ` · ${message}`}
          </div>
        </button>
        <button
          onClick={() => {
            settings.update({ engine: 'local' })
            test()
          }}
          className={clsx('rounded-2xl border p-4 text-left transition', settings.engine === 'local' ? 'border-accent/50 bg-accent/10' : 'border-line hover:border-line-strong')}
        >
          <div className="flex items-center gap-2 font-medium">
            <Cpu className="size-4" />
            Runner local (ton Python)
          </div>
          <p className="mt-1 text-xs text-muted">
            Exécute le code avec le Python installé sur ton ordinateur : PyTorch, GPU (CUDA / Apple MPS), toutes tes
            librairies, sans limite de mémoire. Requis pour les exercices PyTorch.
          </p>
          <div className="mt-2 text-xs text-faint">
            {runner?.reachable ? `Connecté · Python ${runner.info?.python}` : 'Non connecté'}
          </div>
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-line p-4">
        <div className="text-sm font-medium">Configurer le runner local</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted">
          <li>
            Clone le dépôt, puis dans un terminal : <code className="rounded bg-white/5 px-1">python runner/local_runner.py</code>
          </li>
          <li>Copie l’URL et le token affichés ci-dessous.</li>
          <li>
            Optionnel : <code className="rounded bg-white/5 px-1">pip install numpy pandas scikit-learn matplotlib torch</code>
          </li>
        </ol>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input className="input font-mono text-xs" value={settings.runnerUrl} onChange={(e) => settings.update({ runnerUrl: e.target.value })} placeholder="http://127.0.0.1:8765" />
          <input className="input font-mono text-xs" value={settings.runnerToken} onChange={(e) => settings.update({ runnerToken: e.target.value })} placeholder="token" type="password" />
          <button className="btn btn-ghost" onClick={test} disabled={checking}>
            {checking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Tester
          </button>
        </div>
        {runner && (
          <div className={clsx('mt-3 rounded-xl p-3 text-xs', runner.reachable ? 'bg-ok/[0.06] text-ok' : 'bg-bad/[0.06] text-bad')}>
            {runner.reachable && runner.info ? (
              <>
                Runner connecté · Python {runner.info.python} ·{' '}
                {Object.entries(runner.info.packages)
                  .map(([k, v]) => `${k} ${v ?? '✗'}`)
                  .join(' · ')}{' '}
                · GPU : {runner.info.cuda ? 'CUDA ✓' : runner.info.mps ? 'Apple MPS ✓' : 'aucun'}
              </>
            ) : (
              'Runner injoignable : vérifie qu’il tourne, l’URL et le token. (Safari bloque les appels vers localhost depuis un site https : utilise Chrome, Edge ou Firefox.)'
            )}
          </div>
        )}
      </div>
    </Section>
  )
}

function PreferencesSection() {
  const settings = useSettings()
  return (
    <Section title="Préférences" icon={<Settings className="size-5" />}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <div className="mb-2 text-sm text-muted">Taille de police de l’éditeur : {settings.editorFontSize}px</div>
          <input type="range" min={12} max={20} value={settings.editorFontSize} onChange={(e) => settings.update({ editorFontSize: Number(e.target.value) })} className="w-full accent-[#8b5cf6]" />
        </div>
        <div>
          <div className="mb-2 text-sm text-muted">Objectif quotidien : {settings.dailyGoalXp} XP</div>
          <input type="range" min={20} max={300} step={10} value={settings.dailyGoalXp} onChange={(e) => settings.update({ dailyGoalXp: Number(e.target.value) })} className="w-full accent-[#8b5cf6]" />
        </div>
      </div>
    </Section>
  )
}

function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <Section title="Données" icon={<Download className="size-5" />}>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-ghost"
          onClick={() => {
            const blob = new Blob([exportProgress()], { type: 'application/json' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `code-training-${new Date().toISOString().slice(0, 10)}.json`
            a.click()
            URL.revokeObjectURL(a.href)
          }}
        >
          <Download className="size-4" />
          Exporter ma progression
        </button>
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" />
          Importer
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              importProgress(await file.text())
              setMsg('Progression importée et fusionnée.')
            } catch (ex) {
              setMsg(`Import impossible : ${(ex as Error).message}`)
            }
          }}
        />
        <button
          className="btn btn-quiet ml-auto text-bad"
          onClick={() => {
            if (confirm('Effacer toute la progression de ce navigateur ? (Si tu es connecté, la copie distante sera fusionnée à la prochaine synchro.)')) {
              useProgress.getState().replace(emptyProgress())
              setMsg('Progression locale effacée.')
            }
          }}
        >
          <Trash2 className="size-4" />
          Réinitialiser
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
    </Section>
  )
}
