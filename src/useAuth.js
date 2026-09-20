import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let active = true

    async function loadProfile() {
      if (!session?.user) {
        if (active) {
          setProfile(null)
          setLoading(false)
        }
        return
      }
      // The on_auth_user_created trigger creates this row on first sign-in,
      // but there can be a brief moment where it hasn't landed yet — retry once.
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (error) {
        await new Promise((r) => setTimeout(r, 700))
        ;({ data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single())
      }

      if (active) {
        setProfile(error ? null : data)
        setLoading(false)
      }
    }

    setLoading(true)
    loadProfile()
    return () => {
      active = false
    }
  }, [session])

  return { session, profile, loading }
}
