import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

function recommendation(avgUtil, leftover) {
  if (leftover > 0) return { text: 'Use leftover first', tone: 'warning' }
  if (avgUtil >= 0.85) return { text: 'Increase next round', tone: 'danger' }
  if (avgUtil <= 0.4) return { text: 'Reduce / reconsider', tone: 'muted' }
  return { text: 'Maintain', tone: 'success' }
}

function DashboardTab() {
  const navigate = useNavigate()
  const [country, setCountry] = useState(COUNTRIES[0])
  const [perIsku, setPerIsku] = useState([])
  const [leftoverUrgentCount, setLeftoverUrgentCount] = useState(0)
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
      .select(
        'isku, actual_sold_qty_sets, requested_qty_sets, created_at, planned_gwp_bundling!inner(country)'
      )
      .eq('planned_gwp_bundling.country', country)
      .not('actual_sold_qty_sets', 'is', null)
      .order('created_at', { ascending: false })

    const { data: leftoverRows } = await supabase
      .from('leftover_stock_pool')
      .select('isku, item_name, unused_qty_sets, urgency')
      .eq('country', country)

    const leftoverByIsku = {}
    let urgentCount = 0
    let total = 0
    for (const r of leftoverRows || []) {
      leftoverByIsku[r.isku] = (leftoverByIsku[r.isku] || 0) + r.unused_qty_sets
      total += r.unused_qty_sets
      if (r.urgency === 'Urgent') urgentCount++
    }
    setLeftoverUrgentCount(urgentCount)
    setLeftoverTotal(total)

    const { data: refs } = await supabase.from('reference').select('sku_code, item_name')
    const nameOf = (code) => refs?.find((r) => r.sku_code === code)?.item_name || code

    const byIsku = {}
    for (const l of lines || []) {
      if (!byIsku[l.isku]) byIsku[l.isku] = []
      byIsku[l.isku].push(l)
    }

    const rows = Object.entries(byIsku).map(([isku, campaigns]) => {
      const withRate = campaigns.filter((c) => c.requested_qty_sets > 0)
      const avgUtil =
        withRate.length > 0
          ? withRate.reduce((s, c) => s + Number(c.actual_sold_qty_sets) / Number(c.requested_qty_sets), 0) /
            withRate.length
          : 0
      const recent = campaigns.slice(0, 3)
      const suggestedNext = Math.round(
        recent.reduce((s, c) => s + Number(c.actual_sold_qty_sets), 0) / recent.length
      )
      const leftover = leftoverByIsku[isku] || 0
      return {
        isku,
        itemName: nameOf(isku),
        campaignCount: campaigns.length,
        avgUtil,
        suggestedNext,
        leftover,
        rec: recommendation(avgUtil, leftover),
      }
    })

    rows.sort((a, b) => b.campaignCount - a.campaignCount)
    setPerIsku(rows)
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
        <>
          <div className="card-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="module-card">
              <div className="module-desc">Total leftover in {country}</div>
              <div style={{ fontSize: '22px', fontWeight: 500 }}>{leftoverTotal} sets</div>
            </div>
            <div className="module-card">
              <div className="module-desc">Urgent leftover (≤3 months to expiry)</div>
              <div style={{ fontSize: '22px', fontWeight: 500, color: leftoverUrgentCount > 0 ? 'var(--danger)' : 'inherit' }}>
                {leftoverUrgentCount}
              </div>
              {leftoverUrgentCount > 0 && (
                <button className="link-btn" onClick={() => navigate('/leftover-stock')}>
                  Go clear it →
                </button>
              )}
            </div>
            <div className="module-card">
              <div className="module-desc">ISKUs with completed campaign history</div>
              <div style={{ fontSize: '22px', fontWeight: 500 }}>{perIsku.length}</div>
            </div>
          </div>

          <h3>Planning table — what to do with the next request</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>ISKU</th>
                <th>Item</th>
                <th>Campaigns</th>
                <th>Avg utilization</th>
                <th>Current leftover</th>
                <th>Suggested next qty</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {perIsku.map((r) => (
                <tr key={r.isku}>
                  <td className="mono">{r.isku}</td>
                  <td>{r.itemName}</td>
                  <td>{r.campaignCount}</td>
                  <td>{Math.round(r.avgUtil * 100)}%</td>
                  <td style={{ color: r.leftover > 0 ? 'var(--warning)' : 'inherit' }}>
                    {r.leftover > 0 ? `${r.leftover} sets` : '—'}
                  </td>
                  <td>{r.suggestedNext} sets</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: `var(--${r.rec.tone === 'muted' ? 'surface-2' : r.rec.tone + '-bg'})`,
                        color: `var(--${r.rec.tone === 'muted' ? 'text-muted' : r.rec.tone})`,
                      }}
                    >
                      {r.rec.text}
                    </span>
                  </td>
                </tr>
              ))}
              {perIsku.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted">
                    No completed campaigns with actual sales yet for {country}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="hint" style={{ marginTop: '10px' }}>
            "Suggested next qty" is the average actual sold across the last up to 3 campaigns for
            that ISKU — the same logic Forecast GWP uses. "Use leftover first" beats any other
            recommendation, since there's already unused stock sitting in the warehouse.
          </p>
        </>
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
