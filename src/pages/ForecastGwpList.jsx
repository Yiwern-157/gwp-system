import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { COUNTRIES, fetchPicklist } from '../lib/picklists'

export default function ForecastGwpList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [countryFilter, setCountryFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [picFilter, setPicFilter] = useState('')
  const [platforms, setPlatforms] = useState([])

  useEffect(() => {
    fetchPicklist('planned_gwp_platform').then(setPlatforms).catch(console.error)
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryFilter, platformFilter])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('forecast_gwp')
      .select('*, requestor:requestor_id(full_name)')
      .order('target_month', { ascending: false }) // newest first, oldest at the bottom
      .order('created_at', { ascending: false })
    if (countryFilter) query = query.eq('country', countryFilter)
    if (platformFilter) query = query.eq('platform', platformFilter)
    const { data, error } = await query
    if (!error) setRows(data)
    setLoading(false)
  }

  const filtered = rows.filter(
    (r) =>
      !picFilter ||
      (r.requestor?.full_name || '').toLowerCase().includes(picFilter.toLowerCase())
  )

  const graduationColors = {
    'Not Ready': { bg: 'var(--surface-2)', color: 'var(--text-secondary)' },
    'Reminder Sent': { bg: 'var(--warning-bg)', color: 'var(--warning)' },
    Submitted: { bg: 'var(--success-bg)', color: 'var(--success)' },
  }
  const matchColors = {
    Matched: { bg: 'var(--success-bg)', color: 'var(--success)' },
    Unmatched: { bg: 'var(--danger-bg)', color: 'var(--danger)' },
  }

  return (
    <div>
      <div className="toolbar">
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
          <option value="">Country: All</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
          <option value="">Platform: All</option>
          {platforms.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          placeholder="PIC name"
          value={picFilter}
          onChange={(e) => setPicFilter(e.target.value)}
        />
        <Link className="btn btn-accent" to="/forecast-gwp/new" style={{ marginLeft: 'auto' }}>
          + New forecast
        </Link>
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Campaign month</th>
              <th>Country/platform</th>
              <th>ISKU</th>
              <th>PIC</th>
              <th>Confirmed qty</th>
              <th>Breakdown</th>
              <th>Graduation</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} onClick={() => navigate(`/forecast-gwp/${r.id}`)}>
                <td>{r.target_month}</td>
                <td>
                  {r.country} · {r.platform}
                </td>
                <td className="mono">{r.isku}</td>
                <td>{r.requestor?.full_name || '—'}</td>
                <td>{r.confirmed_qty_sets ?? '—'} sets</td>
                <td>
                  {r.status === 'Canceled' ? (
                    <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      Canceled
                    </span>
                  ) : (
                    <span className="badge" style={{ ...matchColors[r.match_status] }}>
                      {r.match_status}
                    </span>
                  )}
                </td>
                <td>
                  <span className="badge" style={{ ...graduationColors[r.graduation_status] }}>
                    {r.graduation_status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted">
                  No forecasts match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
