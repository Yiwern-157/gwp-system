import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const LIST_TYPES = [
  'sku_request_type',
  'sku_request_platform',
  'planned_gwp_type',
  'campaign_tag',
  'planned_gwp_platform',
  'forecast_breakdown_type',
]

function safeParseJSON(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function summarizeSnapshot(tableName, snap) {
  if (!snap) return ''
  switch (tableName) {
    case 'sku_barcode_request':
      return `Item: ${snap.item_description || '—'}`
    case 'planned_gwp_bundling':
      return `Ref No: ${snap.reference_no || '—'}`
    case 'planned_gwp_bundling_lines':
      return `ISKU: ${snap.isku || '—'}, Qty: ${snap.requested_qty_sets ?? '—'} sets`
    case 'forecast_gwp':
      return `ISKU: ${snap.isku || '—'}, Month: ${snap.target_month || '—'}`
    default:
      return ''
  }
}

function refFromSnapshot(tableName, snap) {
  if (!snap) return null
  if (tableName === 'sku_barcode_request') return snap.item_description
  if (tableName === 'planned_gwp_bundling') return snap.reference_no
  if (tableName === 'planned_gwp_bundling_lines') return snap.isku
  if (tableName === 'forecast_gwp') return `${snap.isku} · ${snap.target_month}`
  return null
}

function ActivityLogTab() {
  const [rows, setRows] = useState([])
  const [refMap, setRefMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [nameFilter, setNameFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('activity_log')
      .select('*, actor:actor_id(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(300)
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59')
    const { data, error } = await query
    if (!error) {
      setRows(data)
      await enrichRefs(data)
    }
    setLoading(false)
  }

  // Live-lookup each table's identifying label (Ref No / Item / ISKU) so
  // "view"/"update" rows on records that still exist show something
  // meaningful, not just a UUID fragment.
  async function enrichRefs(data) {
    const ids = {
      sku_barcode_request: new Set(),
      planned_gwp_bundling: new Set(),
      planned_gwp_bundling_lines: new Set(),
      forecast_gwp: new Set(),
    }
    data.forEach((r) => {
      if (ids[r.table_name]) ids[r.table_name].add(r.record_id)
    })
    const map = {}

    if (ids.sku_barcode_request.size) {
      const { data: d } = await supabase
        .from('sku_barcode_request')
        .select('id, item_description')
        .in('id', [...ids.sku_barcode_request])
      d?.forEach((row) => (map[`sku_barcode_request:${row.id}`] = row.item_description))
    }
    if (ids.planned_gwp_bundling.size) {
      const { data: d } = await supabase
        .from('planned_gwp_bundling')
        .select('id, reference_no')
        .in('id', [...ids.planned_gwp_bundling])
      d?.forEach((row) => (map[`planned_gwp_bundling:${row.id}`] = row.reference_no))
    }
    if (ids.planned_gwp_bundling_lines.size) {
      const { data: d } = await supabase
        .from('planned_gwp_bundling_lines')
        .select('id, isku, request:request_id(reference_no)')
        .in('id', [...ids.planned_gwp_bundling_lines])
      d?.forEach(
        (row) => (map[`planned_gwp_bundling_lines:${row.id}`] = `${row.request?.reference_no || ''} · ${row.isku}`)
      )
    }
    if (ids.forecast_gwp.size) {
      const { data: d } = await supabase
        .from('forecast_gwp')
        .select('id, isku, target_month')
        .in('id', [...ids.forecast_gwp])
      d?.forEach((row) => (map[`forecast_gwp:${row.id}`] = `${row.isku} · ${row.target_month}`))
    }
    setRefMap(map)
  }

  function refFor(r) {
    const live = refMap[`${r.table_name}:${r.record_id}`]
    if (live) return live
    if (r.action === 'create') return refFromSnapshot(r.table_name, safeParseJSON(r.new_value)) || '—'
    if (r.action === 'delete') return refFromSnapshot(r.table_name, safeParseJSON(r.old_value)) || '—'
    return '—'
  }

  function detailsFor(r) {
    if (r.action === 'create') {
      return `Created — ${summarizeSnapshot(r.table_name, safeParseJSON(r.new_value))}`
    }
    if (r.action === 'delete') {
      return `Deleted — ${summarizeSnapshot(r.table_name, safeParseJSON(r.old_value))}`
    }
    if (r.action === 'update' && r.field_changed) {
      return `Changed ${r.field_changed}: "${r.old_value ?? '—'}" → "${r.new_value ?? '—'}"`
    }
    return r.action
  }

  const filtered = rows.filter((r) => {
    if (!nameFilter) return true
    const needle = nameFilter.toLowerCase()
    return (r.actor?.full_name || r.actor?.email || '').toLowerCase().includes(needle)
  })

  return (
    <div>
      <div className="toolbar">
        <input
          placeholder="Filter by name"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
        />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span className="text-secondary">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Table</th>
                <th>Ref No</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.actor?.full_name || r.actor?.email || 'Unknown'}</td>
                  <td className="mono">{r.table_name}</td>
                  <td className="mono">{refFor(r)}</td>
                  <td>{detailsFor(r)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted">
                    No activity matches these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint" style={{ marginTop: '10px' }}>
        Showing the most recent 300 rows within the selected date range.
      </p>
    </div>
  )
}

function PicklistsTab() {
  const [listType, setListType] = useState(LIST_TYPES[0])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [newOption, setNewOption] = useState({ code: '', label: '', description: '', sort_order: 0 })

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listType])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('picklist_options')
      .select('*')
      .eq('list_type', listType)
      .order('label')
    if (!error) setRows(data)
    setLoading(false)
  }

  async function toggleActive(row) {
    await supabase.from('picklist_options').update({ active: !row.active }).eq('id', row.id)
    load()
  }

  async function addOption() {
    if (!newOption.code || !newOption.label) {
      alert('Code and label are required.')
      return
    }
    const { error } = await supabase
      .from('picklist_options')
      .insert({ ...newOption, list_type: listType, description: newOption.description || null })
    if (error) alert(error.message)
    else {
      setNewOption({ code: '', label: '', description: '', sort_order: 0 })
      load()
    }
  }

  return (
    <div>
      <div className="toolbar">
        <select value={listType} onChange={(e) => setListType(e.target.value)}>
          {LIST_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="table-scroll">
<table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Label</th>
              <th>Description</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.code}</td>
                <td>{r.label}</td>
                <td className="text-secondary">{r.description || '—'}</td>
                <td>
                  <span className={`badge ${r.active ? '' : 'badge-muted'}`}>
                    {r.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button className="link-btn" onClick={() => toggleActive(r)}>
                    {r.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      )}

      <div className="detail-card" style={{ marginTop: '1rem' }}>
        <div className="grid">
          <input
            placeholder="Code, e.g. BFCM"
            value={newOption.code}
            onChange={(e) => setNewOption((o) => ({ ...o, code: e.target.value }))}
          />
          <input
            placeholder="Label"
            value={newOption.label}
            onChange={(e) => setNewOption((o) => ({ ...o, label: e.target.value }))}
          />
          <input
            placeholder="Description (optional)"
            value={newOption.description}
            onChange={(e) => setNewOption((o) => ({ ...o, description: e.target.value }))}
          />
        </div>
        <div className="action-row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-accent" onClick={addOption}>
            + Add option to {listType}
          </button>
        </div>
      </div>
    </div>
  )
}

const COUNTRIES = ['AU', 'MY', 'PH', 'SG', 'US']
const PLATFORMS = ['ALL', 'LZD', 'RTL', 'SHP', 'SPY', 'SPY SUBS', 'TTS']
const ROLES = ['ComOps', 'DSP', 'Warehouse', 'Admin']

function ManageUsersTab() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').order('full_name')
    if (!error) setProfiles(data)
    setLoading(false)
  }

  async function updateRole(id, role) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    load()
  }

  async function toggleTag(row, field, value) {
    const current = row[field] || []
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    await supabase.from('profiles').update({ [field]: next }).eq('id', row.id)
    load()
  }

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <p className="hint">
        Any number of people can be Admin — an Admin can change anyone's role, including making
        someone else Admin. Country/platform tags are informational (everyone can still see every
        country); they just say who's the PIC for filtering and the Analysis dashboard.
      </p>
      {profiles.map((p) => (
        <div key={p.id} className="detail-card" style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontWeight: 500 }}>{p.full_name || p.email}</div>
              <div className="text-muted" style={{ fontSize: '12px' }}>{p.email}</div>
            </div>
            <select value={p.role} onChange={(e) => updateRole(p.id, e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: '10px', fontSize: '12px' }}>
            <div className="hint-inline" style={{ marginBottom: '4px' }}>Countries this PIC covers</div>
            {COUNTRIES.map((c) => (
              <label key={c} style={{ marginRight: '10px' }}>
                <input
                  type="checkbox"
                  checked={(p.assigned_countries || []).includes(c)}
                  onChange={() => toggleTag(p, 'assigned_countries', c)}
                />{' '}
                {c}
              </label>
            ))}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px' }}>
            <div className="hint-inline" style={{ marginBottom: '4px' }}>Platforms this PIC covers</div>
            {PLATFORMS.map((pl) => (
              <label key={pl} style={{ marginRight: '10px' }}>
                <input
                  type="checkbox"
                  checked={(p.assigned_platforms || []).includes(pl)}
                  onChange={() => toggleTag(p, 'assigned_platforms', pl)}
                />{' '}
                {pl}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdminPage({ profile }) {
  const [tab, setTab] = useState('log')

  if (profile?.role !== 'Admin') {
    return (
      <div>
        <h1>Admin</h1>
        <p className="text-secondary">This section is only available to the Admin role.</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Admin</h1>
      <div className="action-row">
        <button className={`btn ${tab === 'log' ? 'btn-accent' : ''}`} onClick={() => setTab('log')}>
          Activity Log
        </button>
        <button
          className={`btn ${tab === 'lists' ? 'btn-accent' : ''}`}
          onClick={() => setTab('lists')}
        >
          Manage Dropdown Lists
        </button>
        <button className={`btn ${tab === 'users' ? 'btn-accent' : ''}`} onClick={() => setTab('users')}>
          Manage Users
        </button>
      </div>
      {tab === 'log' && <ActivityLogTab />}
      {tab === 'lists' && <PicklistsTab />}
      {tab === 'users' && <ManageUsersTab />}
    </div>
  )
}
