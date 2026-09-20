import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly in the browser console instead of silently doing nothing,
  // which is the usual cause of "Sign in with Google" doing nothing.
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Set them in .env (local) or Netlify > Site settings > Environment variables.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
