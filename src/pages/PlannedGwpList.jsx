import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { COUNTRIES, fetchPicklist } from '../lib/picklists'
import { useResizableColumns, ColResizer } from '../lib/useResizableColumns'

const COLUMNS = ['Ref no.', 'Campaign tag', 'Country', 'Platform', 'Promo dates', 'ISKUs (qty)', 'PIC', 'Waiting on']
const DEFAULT_WIDTHS = [170, 110, 80, 90, 170, 260, 120, 150]

export default function PlannedGwpList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [countryFilter, setCountryFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [picFilter, setPicFilter] = useState('')
  const [search, setSearch] = useState('')
  const [platforms, setPlatforms] = useState([])
  const { widths, startResize } = useResizableColumns(DEFAULT_WIDTHS)

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
      .from('planned_gwp_bundling')
      .select(
        '*, planned_gwp_bundling_lines(id, isku, requested_qty_sets, stock_status, actual_sold_qty_sets), requestor:requestor_id(full_name)'
      )
      .order('promo_start_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (countryFilter) query = query.eq('country', countryFilter)
    if (platformFilter) query = query.eq('platform', platformFilter)
    const { data, error } = await query
    if (!error) setRows(data)
    setLoading(false)
  }

  // "Who is this waiting on right now" — the whole point of this indicator
  // is that nobody has to open the request to find out.
  function pendingOn(row) {
    if (row.status === 'Canceled') return { text: 'Canceled', tone: 'muted' }
    const lines = row.planned_gwp_bundling_lines || []
    if (lines.length === 0) return { text: 'No lines yet', tone: 'muted' }
    if (lines.some((l) => l.stock_status === 'With Issue'))
      return { text: 'DSP flagged an issue', tone: 'warning' }
    if (lines.some((l) => l.stock_status === 'Pending'))
      return { text: 'Pending DSP', tone: 'warning' }
    if (lines.some((l) => l.stock_status === 'Canceled') && lines.every((l) => l.stock_status === 'Canceled'))
      return { text: 'All lines canceled', tone: 'muted' }
    if (!row.stock_prep_date) return { text: 'Pending stock prep date', tone: 'warning' }
    const campaignEnded = row.promo_end_date && row.promo_end_date < new Date().toISOString().slice(0, 10)
    if (campaignEnded && lines.some((l) => l.actual_sold_qty_sets == null))
      return { text: 'Pending actual sales update', tone: 'warning' }
    return { text: 'On track', tone: 'success' }
  }

  const filtered = rows.filter((r) => {
    if (search && !(r.reference_no || '').toLowerCase().includes(search.toLowerCase())) return false
    const picName = r.requestor?.full_name || r.legacy_requestor || ''
    if (picFilter && !picName.toLowerCase().includes(picFilter.toLowerCase())) return false
    return true
  })

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
        <Link className="btn btn-accent" to="/planned-gwp/new" style={{ marginLeft: 'auto' }}>
          + New campaign SKU
        </Link>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table fixed-layout" style={{ width: widths.reduce((a, b) => a + b, 0) }}>
            <colgroup>
              {widths.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLUMNS.map((label, i) => (
                  <th key={label}>
                    {label}
                    <ColResizer onMouseDown={startResize(i)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const s = pendingOn(r)
                const lines = r.planned_gwp_bundling_lines || []
                return (
                  <tr key={r.id} onClick={() => navigate(`/planned-gwp/${r.id}`)}>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{r.reference_no}</td>
                    <td>{r.campaign_tag || '—'}</td>
                    <td>{r.country}</td>
                    <td>{r.platform}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.promo_start_date || '—'} → {r.promo_end_date || '—'}
                    </td>
                    <td className="mono" style={{ fontSize: '11px' }}>
                      {lines.length === 0
                        ? '—'
                        : lines.map((l) => `${l.isku} (${l.requested_qty_sets})`).join(', ')}
                    </td>
                    <td>{r.requestor?.full_name || r.legacy_requestor || '—'}</td>
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
                  <td colSpan={8} className="text-muted">
                    No campaigns match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
