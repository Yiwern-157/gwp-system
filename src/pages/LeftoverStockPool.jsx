import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { COUNTRIES } from '../lib/picklists'

function urgencyColors(u) {
  if (u === 'Urgent') return { bg: 'var(--danger-bg)', color: 'var(--danger)' }
  if (u === 'Monitor') return { bg: 'var(--warning-bg)', color: 'var(--warning)' }
  return { bg: 'var(--success-bg)', color: 'var(--success)' }
}

export default function LeftoverStockPool({ profile }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [urgencyFilter, setUrgencyFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [picFilter, setPicFilter] = useState('')
  const [openRowId, setOpenRowId] = useState(null)
  const [usageDate, setUsageDate] = useState('')
  const [usageRemark, setUsageRemark] = useState('')
  const [usageQty, setUsageQty] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('leftover_stock_pool')
      .select('*')
      .order('days_to_expiry', { ascending: true, nullsFirst: false })
    if (!error) setRows(data)
    setLoading(false)
  }

  const filtered = rows.filter((r) => {
    if (urgencyFilter && r.urgency !== urgencyFilter) return false
    if (countryFilter && r.country !== countryFilter) return false
    if (picFilter && !(r.pic_name || '').toLowerCase().includes(picFilter.toLowerCase())) return false
    return true
  })

  function openUsageForm(row) {
    setOpenRowId(row.line_id)
    setUsageDate(new Date().toISOString().slice(0, 10))
    setUsageRemark('')
    setUsageQty('')
  }

  async function submitUsage(row) {
    const qty = Number(usageQty)
    if (!qty || qty <= 0) {
      alert('Enter how many sets are being used now.')
      return
    }
    if (qty > row.unused_qty_sets) {
      alert(`Only ${row.unused_qty_sets} sets are left — can't use more than that.`)
      return
    }
    // Pull current actual_sold_qty_sets so we can add to it (unused_qty_sets is derived).
    const { data: current } = await supabase
      .from('planned_gwp_bundling_lines')
      .select('actual_sold_qty_sets, warehouse_remark')
      .eq('id', row.line_id)
      .single()
    const newActual = (Number(current?.actual_sold_qty_sets) || 0) + qty
    const noteLine = `[${usageDate}] Used ${qty} sets from leftover${usageRemark ? ' — ' + usageRemark : ''}`
    const combinedRemark = [current?.warehouse_remark, noteLine].filter(Boolean).join('\n')

    await supabase
      .from('planned_gwp_bundling_lines')
      .update({
        actual_sold_qty_sets: newActual,
        warehouse_remark: combinedRemark,
        warehouse_remark_updated_at: new Date().toISOString(),
      })
      .eq('id', row.line_id)

    setOpenRowId(null)
    load()
  }

  return (
    <div>
      <h1>Leftover Stock Pool</h1>
      <p className="text-secondary">
        Shared between ComOps and DSP — quantities left over from completed campaigns that haven't
        been used yet. Tracking starts from Sep 2026 campaigns onward.
      </p>
      <div className="toolbar">
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
          <option value="">Country: All</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
          <option value="">Urgency: All</option>
          <option value="Urgent">Urgent</option>
          <option value="Monitor">Monitor</option>
          <option value="Fine">Fine</option>
        </select>
        <input placeholder="PIC name" value={picFilter} onChange={(e) => setPicFilter(e.target.value)} />
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ISKU</th>
              <th>Item</th>
              <th>Country</th>
              <th>PIC</th>
              <th>From request</th>
              <th>Leftover qty</th>
              <th>Batch expiry</th>
              <th>Time to expiry</th>
              <th>Urgency</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const c = urgencyColors(r.urgency)
              return (
                <Fragment key={r.line_id}>
                  <tr>
                    <td className="mono">{r.isku}</td>
                    <td>{r.item_name || '—'}</td>
                    <td>{r.country || '—'}</td>
                    <td>{r.pic_name || '—'}</td>
                    <td className="mono">{r.reference_no}</td>
                    <td>{r.unused_qty_sets} sets</td>
                    <td>{r.batch_expiry_date || '—'}</td>
                    <td>{r.days_to_expiry != null ? `~${r.days_to_expiry} days` : '—'}</td>
                    <td>
                      <span className="badge" style={{ background: c.bg, color: c.color }}>
                        {r.urgency || '—'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-accent"
                        style={{ fontSize: '12px', padding: '3px 10px' }}
                        onClick={() => openUsageForm(r)}
                      >
                        Plan next use
                      </button>
                    </td>
                  </tr>
                  {openRowId === r.line_id && (
                    <tr>
                      <td colSpan={10}>
                        <div className="detail-card" style={{ background: 'var(--surface-2)' }}>
                          <div className="grid">
                            <div>
                              <div className="hint-inline">Usage date</div>
                              <input
                                type="date"
                                value={usageDate}
                                onChange={(e) => setUsageDate(e.target.value)}
                              />
                            </div>
                            <div>
                              <div className="hint-inline">Sets used now (max {r.unused_qty_sets})</div>
                              <input
                                type="number"
                                value={usageQty}
                                onChange={(e) => setUsageQty(e.target.value)}
                              />
                            </div>
                          </div>
                          <textarea
                            placeholder="Remark — where/how this leftover is being used"
                            value={usageRemark}
                            onChange={(e) => setUsageRemark(e.target.value)}
                          />
                          <div className="action-row" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={() => setOpenRowId(null)}>
                              Cancel
                            </button>
                            <button className="btn btn-accent" onClick={() => submitUsage(r)}>
                              Save usage
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="text-muted">
                  No leftover stock matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
