import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { COUNTRIES, fetchPicklist } from '../lib/picklists'
import StatusBadge, { APPROVAL_COLORS, SLA_COLORS } from '../components/StatusBadge'

export default function SkuRequestList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [picFilter, setPicFilter] = useState('')
  const [search, setSearch] = useState('')
  const [platforms, setPlatforms] = useState([])

  useEffect(() => {
    fetchPicklist('sku_request_platform').then(setPlatforms).catch(console.error)
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, countryFilter, platformFilter])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('sku_barcode_request')
      .select('*, requestor:requestor_id(full_name)')
      .order('date_requested', { ascending: false, nullsFirst: false }) // newest first, oldest at the bottom
      .order('created_at', { ascending: false })
    if (statusFilter) query = query.eq('approval_status', statusFilter)
    if (countryFilter) query = query.eq('country', countryFilter)
    if (platformFilter) query = query.eq('platform', platformFilter)
    const { data, error } = await query
    if (!error) setRows(data)
    setLoading(false)
  }

  const filtered = rows.filter((r) => {
    const needle = search.toLowerCase()
    if (
      search &&
      !(r.item_description || '').toLowerCase().includes(needle) &&
      !(r.sku_code || '').toLowerCase().includes(needle)
    )
      return false
    if (picFilter && !(r.requestor?.full_name || '').toLowerCase().includes(picFilter.toLowerCase()))
      return false
    return true
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
          <option value="Canceled">Canceled</option>
        </select>
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
              <th>PIC</th>
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
                <td>{r.requestor?.full_name || '—'}</td>
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
                <td colSpan={7} className="text-muted">
                  No requests match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
