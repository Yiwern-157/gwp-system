import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const emptyRow = { sku_code: '', item_name: '', season: '', status: 'active' }

export default function ReferenceList() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [seasonFilter, setSeasonFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState(emptyRow)
  const [editingId, setEditingId] = useState(null)
  const [editRow, setEditRow] = useState(emptyRow)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('reference').select('*').order('sku_code')
    if (!error) setRows(data)
    setLoading(false)
  }

  const filtered = rows.filter((r) => {
    if (search && !`${r.sku_code} ${r.item_name}`.toLowerCase().includes(search.toLowerCase()))
      return false
    if (seasonFilter && r.season !== seasonFilter) return false
    if (statusFilter && r.status !== statusFilter) return false
    return true
  })

  async function handleAdd() {
    if (!newRow.sku_code || !newRow.item_name) {
      alert('SKU code and item name are required.')
      return
    }
    const { error } = await supabase
      .from('reference')
      .insert({ ...newRow, season: newRow.season || null })
    if (error) alert(error.message)
    else {
      setNewRow(emptyRow)
      setAdding(false)
      load()
    }
  }

  function startEdit(row) {
    setEditingId(row.id)
    setEditRow(row)
  }

  async function saveEdit() {
    const { error } = await supabase
      .from('reference')
      .update({
        item_name: editRow.item_name,
        season: editRow.season || null,
        status: editRow.status,
      })
      .eq('id', editingId)
    if (error) alert(error.message)
    else {
      setEditingId(null)
      load()
    }
  }

  return (
    <div>
      <h1>Reference — Master SKU list</h1>
      <div className="toolbar">
        <input
          placeholder="Search SKU code or item name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
          <option value="">Season: All</option>
          <option value="Jan-Jun">Jan-Jun</option>
          <option value="Nov-Mar">Nov-Mar</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Status: All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="btn btn-accent" style={{ marginLeft: 'auto' }} onClick={() => setAdding((v) => !v)}>
          + Add SKU
        </button>
      </div>

      {adding && (
        <div className="detail-card" style={{ marginBottom: '1rem' }}>
          <div className="grid">
            <input
              placeholder="SKU code, e.g. CGB-1"
              value={newRow.sku_code}
              onChange={(e) => setNewRow((r) => ({ ...r, sku_code: e.target.value }))}
            />
            <input
              placeholder="Item name"
              value={newRow.item_name}
              onChange={(e) => setNewRow((r) => ({ ...r, item_name: e.target.value }))}
            />
            <select
              value={newRow.season}
              onChange={(e) => setNewRow((r) => ({ ...r, season: e.target.value }))}
            >
              <option value="">Season (optional)</option>
              <option value="Jan-Jun">Jan-Jun</option>
              <option value="Nov-Mar">Nov-Mar</option>
            </select>
          </div>
          <div className="action-row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="btn btn-accent" onClick={handleAdd}>
              Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU code</th>
              <th>Item name</th>
              <th>Season</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) =>
              editingId === r.id ? (
                <tr key={r.id}>
                  <td className="mono">{r.sku_code}</td>
                  <td>
                    <input
                      value={editRow.item_name}
                      onChange={(e) => setEditRow((x) => ({ ...x, item_name: e.target.value }))}
                    />
                  </td>
                  <td>
                    <select
                      value={editRow.season || ''}
                      onChange={(e) => setEditRow((x) => ({ ...x, season: e.target.value }))}
                    >
                      <option value="">—</option>
                      <option value="Jan-Jun">Jan-Jun</option>
                      <option value="Nov-Mar">Nov-Mar</option>
                    </select>
                  </td>
                  <td>
                    <select
                      value={editRow.status}
                      onChange={(e) => setEditRow((x) => ({ ...x, status: e.target.value }))}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-accent" onClick={saveEdit}>
                      Save
                    </button>{' '}
                    <button className="btn" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={r.id}>
                  <td className="mono">{r.sku_code}</td>
                  <td>{r.item_name}</td>
                  <td>{r.season || '—'}</td>
                  <td>
                    <span className={`badge ${r.status === 'active' ? '' : 'badge-muted'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>
                    <button className="link-btn" onClick={() => startEdit(r)}>
                      Edit
                    </button>
                  </td>
                </tr>
              )
            )}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted">
                  No SKUs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      <p className="hint" style={{ marginTop: '10px' }}>
        Inactive SKUs stay in history for past requests but drop out of new ISKU dropdowns.
      </p>
    </div>
  )
}
