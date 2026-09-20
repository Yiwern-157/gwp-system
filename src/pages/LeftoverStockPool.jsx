import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function urgencyColors(u) {
  if (u === 'Urgent') return { bg: 'var(--danger-bg)', color: 'var(--danger)' }
  if (u === 'Monitor') return { bg: 'var(--warning-bg)', color: 'var(--warning)' }
  return { bg: 'var(--success-bg)', color: 'var(--success)' }
}

export default function LeftoverStockPool() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [urgencyFilter, setUrgencyFilter] = useState('')

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

  const filtered = rows.filter((r) => !urgencyFilter || r.urgency === urgencyFilter)

  return (
    <div>
      <h1>Leftover Stock Pool</h1>
      <p className="text-secondary">
        Shared between ComOps and DSP — quantities left over from completed campaigns that haven't
        been used yet.
      </p>
      <div className="toolbar">
        <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
          <option value="">Urgency: All</option>
          <option value="Urgent">Urgent</option>
          <option value="Monitor">Monitor</option>
          <option value="Fine">Fine</option>
        </select>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ISKU</th>
              <th>Item</th>
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
                <tr key={r.line_id}>
                  <td className="mono">{r.isku}</td>
                  <td>{r.item_name || '—'}</td>
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
                      onClick={() =>
                        navigate('/planned-gwp/new', {
                          state: {
                            presetIsku: r.isku,
                            presetQtySets: r.unused_qty_sets,
                            reusedFromLineId: r.line_id,
                          },
                        })
                      }
                    >
                      Plan next use
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-muted">
                  No leftover stock right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
