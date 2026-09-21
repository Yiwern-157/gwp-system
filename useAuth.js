import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  // Only true for the very first load. Supabase re-confirms the session
  // whenever the tab regains focus (its own safety behavior) — without this
  // distinction, every tab-switch would flash the whole app back to a
  // "Loading…" screen and unmount whatever page (and unsaved form) was open.
  const [initializing, setInitializing] = useState(true)
  const loadedUserId = useRef(null)

  useEffect(() => {
    let active = true

    async function loadProfileIfNeeded(currentSession) {
      if (!currentSession?.user) {
        loadedUserId.current = null
        if (active) setProfile(null)
        return
      }
      // Same user as already loaded (e.g. just a background token refresh) —
      // nothing to do, and importantly, nothing to re-render around.
      if (loadedUserId.current === currentSession.user.id) return

      loadedUserId.current = currentSession.user.id
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .single()

      if (error) {
        // The on_auth_user_created trigger may not have landed yet on a brand-new sign-in.
        await new Promise((r) => setTimeout(r, 700))
        ;({ data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentSession.user.id)
          .single())
      }
      if (active) setProfile(error ? null : data)
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfileIfNeeded(data.session)
      if (active) setInitializing(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!active) return
      setSession(newSession)
      await loadProfileIfNeeded(newSession)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return { session, profile, loading: initializing }
}
