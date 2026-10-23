import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { create } from 'zustand'
import { emptyProgress, mergeProgress, useProgress, type Progress } from './progress'

// Progress sync through Supabase (one JSON row per user, protected by row-level security).
// Without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY the app simply stays local-only.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const syncConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = syncConfigured
  ? createClient(url!, anonKey!, {
      // PKCE puts the auth code in the query string, which plays well with the hash router.
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
    })
  : null

type SyncStatus = 'off' | 'idle' | 'syncing' | 'error'

interface SyncState {
  session: Session | null
  status: SyncStatus
  lastSync: number | null
  error: string | null
}

export const useSync = create<SyncState>(() => ({
  session: null,
  status: syncConfigured ? 'idle' : 'off',
  lastSync: null,
  error: null,
}))

let applyingRemote = false
let pushTimer: ReturnType<typeof setTimeout> | undefined
let inFlight: Promise<void> | null = null

async function pullMergePush(): Promise<void> {
  const session = useSync.getState().session
  if (!supabase || !session) return
  useSync.setState({ status: 'syncing', error: null })
  try {
    const { data, error } = await supabase
      .from('progress')
      .select('data')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (error) throw error
    const remote = (data?.data as Progress | undefined) ?? emptyProgress()
    const merged = mergeProgress(useProgress.getState().p, remote)
    applyingRemote = true
    useProgress.getState().replace(merged)
    applyingRemote = false
    const { error: upsertError } = await supabase
      .from('progress')
      .upsert({ user_id: session.user.id, data: merged, updated_at: new Date().toISOString() })
    if (upsertError) throw upsertError
    useSync.setState({ status: 'idle', lastSync: Date.now() })
  } catch (err) {
    applyingRemote = false
    useSync.setState({ status: 'error', error: (err as Error).message })
  }
}

/** Runs a sync now (coalesces concurrent requests). */
export function syncNow(): Promise<void> {
  if (inFlight) return inFlight
  inFlight = pullMergePush().finally(() => {
    inFlight = null
  })
  return inFlight
}

export function initSync() {
  if (!supabase) return
  supabase.auth.getSession().then(({ data }) => {
    useSync.setState({ session: data.session })
    if (data.session) syncNow()
    // After a magic-link / OAuth redirect, drop the one-time ?code= from the address bar.
    const url = new URL(location.href)
    if (url.searchParams.has('code')) {
      url.searchParams.delete('code')
      history.replaceState(null, '', url.pathname + url.search + url.hash)
    }
  })
  supabase.auth.onAuthStateChange((event, session) => {
    useSync.setState({ session })
    if (event === 'SIGNED_IN') syncNow()
  })
  // Debounced push after local changes.
  useProgress.subscribe((state, prev) => {
    if (applyingRemote || state.p === prev.p || !useSync.getState().session) return
    clearTimeout(pushTimer)
    pushTimer = setTimeout(syncNow, 4000)
  })
  // Pick up progress made on another device when coming back to the tab.
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && useSync.getState().session) syncNow()
  })
}

export async function signInWithEmail(email: string) {
  if (!supabase) throw new Error('Synchronisation non configurée')
  const redirectTo = location.origin + location.pathname
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
  if (error) throw error
}

export async function signInWithGithub() {
  if (!supabase) throw new Error('Synchronisation non configurée')
  const redirectTo = location.origin + location.pathname
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } })
  if (error) throw error
}

export async function signOut() {
  await supabase?.auth.signOut()
  useSync.setState({ session: null, lastSync: null })
}
