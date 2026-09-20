import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import Login from './pages/Login'
import Layout from './components/Layout'
import Home from './pages/Home'
import SkuRequestList from './pages/SkuRequestList'
import SkuRequestDetail from './pages/SkuRequestDetail'

export default function App() {
  const { session, profile, loading } = useAuth()

  if (loading) return <div className="center-screen">Loading…</div>
  if (!session) return <Login />

  return (
    <Layout profile={profile}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sku-requests" element={<SkuRequestList />} />
        <Route path="/sku-requests/new" element={<SkuRequestDetail profile={profile} isNew />} />
        <Route path="/sku-requests/:id" element={<SkuRequestDetail profile={profile} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
