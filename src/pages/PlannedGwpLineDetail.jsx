import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function PlannedGwpLineDetail({ profile }) {
  const { id, lineId } = useParams()
  const navigate = useNavigate()

  const [line, setLine] = useState(null)
  const [form, setForm] = useState({})
  const [history, setHistory] = useState([])
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [reason, setReason] = useState('')
  const [showReasonBox, setShowReasonBox] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [saving, setSaving] = useState(false)

  const isDSP = profile?.role === 'DSP' || profile?.role === 'Admin'
  const isWarehouse = profile?.role === 'Warehouse' || profile?.role === 'Admin'
  const isComOps = profile?.role === 'ComOps' || profile?.role === 'Admin'

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId])

  async function load() {
    const { data, error } = await supabase
      .from('planned_gwp_bundling_lines')
      .select('*')
      .eq('id', lineId)
      .single()
    if (!error) {
      setLine(data)
      setForm(data)
    }
    const { data: hist } = await supabase
      .from('planned_gwp_bundling_line_history')
      .select('*, actor:actor_id(full_name)')
      .eq('line_id', lineId)
      .order('created_at', { ascending: false })
    setHistory(hist || [])
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function cleanPayload() {
    const payload = { ...form }
    ;[
      'id',
      'request_id',
      'isku',
      'conversion_pc',
      'actual_conversion_pc',
      'variance_pc',
      'unused_qty_sets',
      'estimated_inbound_date',
      'created_at',
    ].forEach((f) => delete payload[f])
    ;['ship_out_date_planned', 'ship_out_date_actual', 'batch_expiry_date'].forEach((f) => {
      if (payload[f] === '') payload[f] = null
    })
    if (payload.actual_sold_qty_sets === '') payload.actual_sold_qty_sets = null
    payload.updated_at = new Date().toISOString()
    return payload
  }

  async function handleSave() {
    setSaving(true)
    const payload = cleanPayload()
    const { error } = await supabase.from('planned_gwp_bundling_lines').update(payload).eq('id', lineId)
    if (error) alert(error.message)
    else {
      await supabase
        .from('planned_gwp_bundling_line_history')
        .insert({ line_id: lineId, action: 'Edited', actor_id: profile?.id })
      await load()
    }
    setSaving(false)
  }

  async function runStatusAction(action, needsReason) {
    if (needsReason) {
      setPendingAction(action)
      setShowReasonBox(true)
      return
    }
    await applyStatusAction(action, '')
  }

  async function applyStatusAction(action, reasonText) {
    const statusMap = { Confirmed: 'Confirmed', 'Flagged Issue': 'With Issue', Canceled: 'Canceled' }
    await supabase
      .from('planned_gwp_bundling_lines')
      .update({ stock_status: statusMap[action] })
      .eq('id', lineId)
    await supabase.from('planned_gwp_bundling_line_history').insert({
      line_id: lineId,
      action,
      actor_id: profile?.id,
      reason: reasonText || null,
    })
    if (action !== 'Confirmed') {
      // Recorded for now; actually sending email/Slack is a Phase-2 Edge Function.
      await supabase.from('notifications_log').insert({
        recipient_id: null,
        channel: 'email',
        context: `Line ${form.isku} ${action.toLowerCase()}: ${reasonText}`,
        related_table: 'planned_gwp_bundling_lines',
        related_id: lineId,
      })
    }
    setReason('')
    setShowReasonBox(false)
    setPendingAction(null)
    await load()
  }

  async function confirmReasonSubmit() {
    if (!reason.trim()) {
      alert('A reason is required.')
      return
    }
    await applyStatusAction(pendingAction, reason)
  }

  const visibleHistory = showAllHistory ? history : history.slice(0, 1)
  const stockColors = {
    Confirmed: { bg: 'var(--success-bg)', color: 'var(--success)' },
    'With Issue': { bg: 'var(--warning-bg)', color: 'var(--warning)' },
    Canceled: { bg: 'var(--danger-bg)', color: 'var(--danger)' },
    Pending: { bg: 'var(--surface-2)', color: 'var(--text-secondary)' },
  }

  if (!line) return <p>Loading…</p>

  return (
    <div className="detail-card">
      <div className="hint" style={{ marginBottom: '10px' }}>
        <span className="link-btn" onClick={() => navigate(`/planned-gwp/${id}`)}>
          ← Back to request
        </span>
      </div>
      <div className="detail-header">
        <h2 className="mono">{line.isku}</h2>
        <span
          className="badge"
          style={{ background: stockColors[line.stock_status]?.bg, color: stockColors[line.stock_status]?.color }}
        >
          {line.stock_status}
        </span>
      </div>

      <fieldset disabled={!isDSP} className="section">
        <legend>
          Stock confirmation <span className="role-tag">DSP</span>
        </legend>
        <div className="action-row">
          <button className="btn btn-success" onClick={() => runStatusAction('Confirmed', false)}>
            Confirm
          </button>
          <button className="btn btn-danger" style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }} onClick={() => runStatusAction('Flagged Issue', true)}>
            Flag issue
          </button>
          <button className="btn btn-danger" onClick={() => runStatusAction('Canceled', true)}>
            Cancel
          </button>
        </div>
        {showReasonBox && (
          <div className="reason-box">
            <div className="reason-label">Reason (required)</div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="btn btn-danger" onClick={confirmReasonSubmit}>
              Confirm {pendingAction}
            </button>
          </div>
        )}
        <div className="history">
          {visibleHistory.map((h) => (
            <div key={h.id} className="history-row">
              {new Date(h.created_at).toLocaleString()} · {h.actor?.full_name || 'Someone'} {h.action}
              {h.reason ? `: ${h.reason}` : ''}
            </div>
          ))}
          {history.length > 1 && !showAllHistory && (
            <button className="link-btn" onClick={() => setShowAllHistory(true)}>
              Show {history.length - 1} older entries ↓
            </button>
          )}
        </div>
      </fieldset>

      <fieldset disabled={!isWarehouse} className="section">
        <legend>
          Warehouse movement <span className="role-tag">Warehouse</span>
        </legend>
        <div className="grid">
          <div>
            <div className="hint-inline">Ship-out date (planned)</div>
            <input
              type="date"
              value={form.ship_out_date_planned || ''}
              onChange={(e) => update('ship_out_date_planned', e.target.value)}
            />
          </div>
          <div>
            <div className="hint-inline">Ship-out date (actual)</div>
            <input
              type="date"
              value={form.ship_out_date_actual || ''}
              onChange={(e) => update('ship_out_date_actual', e.target.value)}
            />
          </div>
          <input
            type="number"
            placeholder="Actual shipped qty"
            value={form.actual_shipped_qty || ''}
            onChange={(e) => update('actual_shipped_qty', e.target.value)}
          />
          <div>
            <div className="hint-inline">Batch expiry date</div>
            <input
              type="date"
              value={form.batch_expiry_date || ''}
              onChange={(e) => update('batch_expiry_date', e.target.value)}
            />
          </div>
          <span className="hint-inline">Est. inbound: {line.estimated_inbound_date || '—'} (auto)</span>
        </div>
        <textarea
          placeholder="Delay remark"
          value={form.warehouse_remark || ''}
          onChange={(e) => update('warehouse_remark', e.target.value)}
        />
        {line.warehouse_remark_updated_at && (
          <div className="hint-inline">
            Last updated by Warehouse: {new Date(line.warehouse_remark_updated_at).toLocaleString()}
          </div>
        )}
      </fieldset>

      <fieldset disabled={!(isComOps || isDSP)} className="section">
        <legend>Actual sales</legend>
        <div className="grid">
          <input
            type="number"
            placeholder="Actual sold qty (sets)"
            value={form.actual_sold_qty_sets ?? ''}
            onChange={(e) => update('actual_sold_qty_sets', e.target.value)}
          />
          <span className="hint-inline">Conversion (pc): {line.actual_conversion_pc ?? '—'} (auto)</span>
          <span className="hint-inline">Variance: {line.variance_pc ?? '—'} (auto)</span>
        </div>
        {line.unused_qty_sets > 0 && (
          <div className="detail-card" style={{ background: 'var(--surface-2)', marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div className="hint-inline">Unused, carries into next planning round</div>
                <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--warning)' }}>
                  {line.unused_qty_sets} sets
                </div>
              </div>
              <button
                className="btn btn-accent"
                onClick={() =>
                  navigate('/planned-gwp/new', {
                    state: {
                      presetIsku: line.isku,
                      presetQtyPerSet: line.qty_per_set,
                      presetQtySets: line.unused_qty_sets,
                      reusedFromLineId: line.id,
                    },
                  })
                }
              >
                Plan next use
              </button>
            </div>
          </div>
        )}
      </fieldset>

      <div className="action-row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => navigate(`/planned-gwp/${id}`)}>
          Back to request
        </button>
        <button className="btn btn-accent" disabled={saving} onClick={handleSave}>
          Save changes
        </button>
      </div>
    </div>
  )
}
