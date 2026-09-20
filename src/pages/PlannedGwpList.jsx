import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { COUNTRIES } from '../lib/picklists'

export default function PlannedGwpList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [countryFilter, setCountryFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryFilter])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('planned_gwp_bundling')
      .select('*, planned_gwp_bundling_lines(id, stock_status)')
      .order('created_at', { ascending: false })
    if (countryFilter) query = query.eq('country', countryFilter)
    const { data, error } = await query
    if (!error) setRows(data)
    setLoading(false)
  }

  function lineSummary(lines) {
    if (!lines || lines.length === 0) return { text: 'No lines yet', tone: 'muted' }
    const withIssue = lines.filter((l) => l.stock_status === 'With Issue').length
    if (withIssue > 0) return { text: `${withIssue} of ${lines.length} with issue`, tone: 'warning' }
    const pending = lines.filter((l) => l.stock_status === 'Pending').length
    if (pending > 0) return { text: `${pending} of ${lines.length} pending`, tone: 'muted' }
    return { text: `${lines.length} confirmed`, tone: 'success' }
  }

  const filtered = rows.filter(
    (r) => !search || (r.reference_no || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="toolbar">
        <input
          placeholder="Search reference no."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
          <option value="">Country: All</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Link className="btn btn-accent" to="/planned-gwp/new" style={{ marginLeft: 'auto' }}>
          + New campaign SKU
        </Link>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Ref no.</th>
              <th>Campaign tag</th>
              <th>Country/platform</th>
              <th>Promo dates</th>
              <th>Lines</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const s = lineSummary(r.planned_gwp_bundling_lines)
              return (
                <tr key={r.id} onClick={() => navigate(`/planned-gwp/${r.id}`)}>
                  <td className="mono">{r.reference_no}</td>
                  <td>{r.campaign_tag || '—'}</td>
                  <td>
                    {r.country} · {r.platform}
                  </td>
                  <td>
                    {r.promo_start_date || '—'} → {r.promo_end_date || '—'}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: `var(--${s.tone === 'muted' ? 'surface-2' : s.tone + '-bg'})`,
                        color: `var(--${s.tone === 'muted' ? 'text-muted' : s.tone})`,
                      }}
                    >
                      {s.text}
                    </span>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted">
                  No campaigns yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
