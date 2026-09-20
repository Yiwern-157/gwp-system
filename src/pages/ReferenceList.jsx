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
  const [selected, setSelected] = useState(new Set())
  const [batchSeason, setBatchSeason] = useState('')

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

  function toggleSelect(id) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllVisible() {
    setSelected((s) => {
      const allVisible = filtered.every((r) => s.has(r.id))
      if (allVisible) return new Set()
      return new Set(filtered.map((r) => r.id))
    })
  }

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

  async function batchSetStatus(status) {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    await supabase.from('reference').update({ status }).in('id', ids)
    setSelected(new Set())
    load()
  }

  async function batchSetSeason() {
    const ids = Array.from(selected)
    if (ids.length === 0 || !batchSeason) return
    await supabase
      .from('reference')
      .update({ season: batchSeason === 'clear' ? null : batchSeason })
      .in('id', ids)
    setSelected(new Set())
    setBatchSeason('')
    load()
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

      {selected.size > 0 && (
        <div className="detail-card" style={{ marginBottom: '1rem', background: 'var(--accent-bg)' }}>
          <div className="action-row" style={{ marginBottom: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>{selected.size} selected</span>
            <select value={batchSeason} onChange={(e) => setBatchSeason(e.target.value)}>
              <option value="">Set season to…</option>
              <option value="Jan-Jun">Jan-Jun</option>
              <option value="Nov-Mar">Nov-Mar</option>
              <option value="clear">(clear)</option>
            </select>
            <button className="btn" onClick={batchSetSeason}>
              Apply season
            </button>
            <button className="btn btn-success" onClick={() => batchSetStatus('active')}>
              Activate selected
            </button>
            <button className="btn btn-danger" onClick={() => batchSetStatus('inactive')}>
              Deactivate selected
            </button>
            <button className="btn btn-ghost" onClick={() => setSelected(new Set())}>
              Clear selection
            </button>
          </div>
        </div>
      )}

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
              <th style={{ width: '28px' }}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                  onChange={toggleSelectAllVisible}
                />
              </th>
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
                  <td></td>
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
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                    />
                  </td>
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
                <td colSpan={6} className="text-muted">
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
