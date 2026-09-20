import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { COUNTRIES } from '../lib/picklists'
import StatusBadge, { APPROVAL_COLORS, SLA_COLORS } from '../components/StatusBadge'

export default function SkuRequestList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, countryFilter])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('sku_barcode_request')
      .select('*')
      .order('created_at', { ascending: false })
    if (statusFilter) query = query.eq('approval_status', statusFilter)
    if (countryFilter) query = query.eq('country', countryFilter)
    const { data, error } = await query
    if (!error) setRows(data)
    setLoading(false)
  }

  const filtered = rows.filter((r) => {
    if (!search) return true
    const needle = search.toLowerCase()
    return (
      (r.item_description || '').toLowerCase().includes(needle) ||
      (r.sku_code || '').toLowerCase().includes(needle)
    )
  })

  return (
    <div>
      <div className="toolbar">
        <input
          placeholder="Search item or SKU code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Status: All</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
          <option value="">Country: All</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Link className="btn btn-accent" to="/sku-requests/new" style={{ marginLeft: 'auto' }}>
          + New request
        </Link>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Type</th>
              <th>Country</th>
              <th>SLA</th>
              <th>Status</th>
              <th>SKU code</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} onClick={() => navigate(`/sku-requests/${r.id}`)}>
                <td>{r.item_description || '—'}</td>
                <td>{r.sku_status_type || '—'}</td>
                <td>{r.country || '—'}</td>
                <td>
                  <StatusBadge value={r.submission_type} colors={SLA_COLORS} />
                </td>
                <td>
                  <StatusBadge value={r.approval_status} colors={APPROVAL_COLORS} />
                </td>
                <td className="mono">{r.sku_code || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted">
                  No requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
