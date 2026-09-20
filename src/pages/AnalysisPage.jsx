import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { COUNTRIES } from '../lib/picklists'

function GapCheckTab() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [grid, setGrid] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  async function load() {
    setLoading(true)
    const monthStart = `${month}-01`
    const [y, m] = month.split('-')
    const monthEnd = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10)

    const { data: planned } = await supabase
      .from('planned_gwp_bundling')
      .select('country, platform')
      .gte('promo_start_date', monthStart)
      .lte('promo_start_date', monthEnd)

    const { data: forecasts } = await supabase
      .from('forecast_gwp')
      .select('country, platform')
      .gte('target_month', monthStart)
      .lte('target_month', monthEnd)

    const rows = []
    for (const country of COUNTRIES) {
      const hasPlanned = (planned || []).some((p) => p.country === country)
      const hasForecast = (forecasts || []).some((f) => f.country === country)
      rows.push({ country, hasPlanned, hasForecast })
    }
    setGrid(rows)
    setLoading(false)
  }

  return (
    <div>
      <div className="toolbar">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Country</th>
              <th>M+1 Planned GWP submitted?</th>
              <th>Forecast GWP submitted?</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((r) => (
              <tr key={r.country}>
                <td>{r.country}</td>
                <td>
                  {r.hasPlanned ? (
                    <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                      Yes
                    </span>
                  ) : (
                    <span className="badge" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                      Missing
                    </span>
                  )}
                </td>
                <td>
                  {r.hasForecast ? (
                    <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                      Yes
                    </span>
                  ) : (
                    <span className="badge" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                      Missing
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="hint" style={{ marginTop: '10px' }}>
        Auto-computed from actual submissions — nobody has to remember to check a box.
      </p>
    </div>
  )
}

function DashboardTab() {
  const [country, setCountry] = useState(COUNTRIES[0])
  const [trend, setTrend] = useState([])
  const [leftoverTotal, setLeftoverTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country])

  async function load() {
    setLoading(true)
    const { data: lines } = await supabase
      .from('planned_gwp_bundling_lines')
      .select('actual_sold_qty_sets, requested_qty_sets, created_at, planned_gwp_bundling!inner(country)')
      .eq('planned_gwp_bundling.country', country)
      .not('actual_sold_qty_sets', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5)

    const rates = (lines || [])
      .filter((l) => l.requested_qty_sets > 0)
      .map((l) => Math.round((Number(l.actual_sold_qty_sets) / Number(l.requested_qty_sets)) * 100))
      .reverse()
    setTrend(rates)

    const { data: leftoverByCountry } = await supabase
      .from('planned_gwp_bundling')
      .select('id, planned_gwp_bundling_lines(unused_qty_sets)')
      .eq('country', country)
    const total = (leftoverByCountry || []).reduce(
      (sum, h) => sum + (h.planned_gwp_bundling_lines || []).reduce((s, l) => s + (l.unused_qty_sets || 0), 0),
      0
    )
    setLeftoverTotal(total)
    setLoading(false)
  }

  return (
    <div>
      <div className="toolbar">
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="module-card" style={{ maxWidth: '360px' }}>
          <div className="hint-inline">Utilization rate trend (last {trend.length} campaigns)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '44px', margin: '8px 0' }}>
            {trend.length === 0 ? (
              <span className="text-muted">No completed campaigns yet</span>
            ) : (
              trend.map((v, i) => (
                <div
                  key={i}
                  title={`${v}%`}
                  style={{
                    width: '14%',
                    height: `${Math.max(v, 5)}%`,
                    background: 'var(--accent)',
                    borderRadius: '2px',
                  }}
                />
              ))
            )}
          </div>
          <div className="text-secondary" style={{ fontSize: '13px' }}>
            Leftover stock: <strong style={{ color: leftoverTotal > 0 ? 'var(--warning)' : 'inherit' }}>{leftoverTotal} sets</strong>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AnalysisPage() {
  const [tab, setTab] = useState('gap')
  return (
    <div>
      <h1>Analysis</h1>
      <div className="action-row">
        <button className={`btn ${tab === 'gap' ? 'btn-accent' : ''}`} onClick={() => setTab('gap')}>
          Submission Gap Check
        </button>
        <button
          className={`btn ${tab === 'dash' ? 'btn-accent' : ''}`}
          onClick={() => setTab('dash')}
        >
          ComOps Dashboard
        </button>
      </div>
      {tab === 'gap' ? <GapCheckTab /> : <DashboardTab />}
    </div>
  )
}
