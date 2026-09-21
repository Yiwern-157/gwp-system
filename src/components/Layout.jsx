import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const NAV_ITEMS = [
  { to: '/sku-requests', label: 'SKU Request', tag: null },
  { to: '/planned-gwp', label: 'Planned GWP', tag: 'M+1' },
  { to: '/leftover-stock', label: 'Leftover Stock', tag: null },
  { to: '/forecast-gwp', label: 'Forecast GWP', tag: 'M2+M4' },
  { to: '/analysis', label: 'Analysis', tag: null },
  { to: '/reference', label: 'Reference', tag: null },
]

export default function Layout({ profile, children }) {
  const navigate = useNavigate()
  const location = useLocation()

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/')

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          GWP System
        </Link>
        <nav className="topnav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={isActive(item.to) ? 'nav-active' : ''}
            >
              {item.tag && <span className="nav-tag">{item.tag}</span>}
              {item.label}
            </Link>
          ))}
          {profile?.role === 'Admin' && (
            <Link to="/admin" className={isActive('/admin') ? 'nav-active' : ''}>
              Admin
            </Link>
          )}
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
