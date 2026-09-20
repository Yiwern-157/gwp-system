import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import Login from './pages/Login'
import Layout from './components/Layout'
import Home from './pages/Home'
import SkuRequestList from './pages/SkuRequestList'
import SkuRequestDetail from './pages/SkuRequestDetail'
import PlannedGwpList from './pages/PlannedGwpList'
import PlannedGwpDetail from './pages/PlannedGwpDetail'
import PlannedGwpLineDetail from './pages/PlannedGwpLineDetail'
import LeftoverStockPool from './pages/LeftoverStockPool'
import ForecastGwpList from './pages/ForecastGwpList'
import ForecastGwpDetail from './pages/ForecastGwpDetail'
import AnalysisPage from './pages/AnalysisPage'
import ReferenceList from './pages/ReferenceList'
import AdminPage from './pages/AdminPage'

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

        <Route path="/planned-gwp" element={<PlannedGwpList />} />
        <Route path="/planned-gwp/new" element={<PlannedGwpDetail profile={profile} isNew />} />
        <Route path="/planned-gwp/:id" element={<PlannedGwpDetail profile={profile} />} />
        <Route path="/planned-gwp/:id/lines/:lineId" element={<PlannedGwpLineDetail profile={profile} />} />
        <Route path="/leftover-stock" element={<LeftoverStockPool />} />

        <Route path="/forecast-gwp" element={<ForecastGwpList />} />
        <Route path="/forecast-gwp/new" element={<ForecastGwpDetail profile={profile} isNew />} />
        <Route path="/forecast-gwp/:id" element={<ForecastGwpDetail profile={profile} />} />

        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/reference" element={<ReferenceList />} />
        <Route path="/admin" element={<AdminPage profile={profile} />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
