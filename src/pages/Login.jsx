import { supabase } from '../supabaseClient'

export default function Login() {
  const signIn = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>GWP Request &amp; Inventory System</h1>
        <p className="text-secondary">Sign in with your company Google account to continue.</p>
        <button className="btn btn-accent" onClick={signIn}>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
