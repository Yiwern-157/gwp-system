import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function ForecastGwpList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('forecast_gwp')
      .select('*')
      .order('target_month', { ascending: false })
    if (!error) setRows(data)
    setLoading(false)
  }

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
              <th>Month</th>
              <th>Country/platform</th>
              <th>ISKU</th>
              <th>Confirmed qty</th>
              <th>Breakdown</th>
              <th>Graduation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => navigate(`/forecast-gwp/${r.id}`)}>
                <td>{r.target_month}</td>
                <td>
                  {r.country} · {r.platform}
                </td>
                <td className="mono">{r.isku}</td>
                <td>{r.confirmed_qty_sets ?? '—'} sets</td>
                <td>
                  <span className="badge" style={{ ...matchColors[r.match_status] }}>
                    {r.match_status}
                  </span>
                </td>
                <td>
                  <span className="badge" style={{ ...graduationColors[r.graduation_status] }}>
                    {r.graduation_status}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted">
                  No forecasts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
