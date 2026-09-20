import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Layout({ profile, children }) {
  const navigate = useNavigate()

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          GWP System
        </Link>
        <nav className="topnav">
          <Link to="/sku-requests">SKU Request</Link>
          <Link to="/planned-gwp">Planned GWP</Link>
          <Link to="/leftover-stock">Leftover Stock</Link>
          <Link to="/forecast-gwp">Forecast GWP</Link>
          <Link to="/analysis">Analysis</Link>
          <Link to="/reference">Reference</Link>
          {profile?.role === 'Admin' && <Link to="/admin">Admin</Link>}
        </nav>
        <div className="user-chip">
          <span>
            {profile?.full_name || profile?.email || 'Signed in'} · {profile?.role || '—'}
          </span>
          <button className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
