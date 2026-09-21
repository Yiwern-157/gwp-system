import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { fetchPicklist, COUNTRIES } from '../lib/picklists'

const emptyForm = {
  target_month: '',
  country: '',
  platform: '',
  isku: '',
  qty_per_set: 1,
  confirmed_qty_sets: '',
  remarks: '',
}

export default function ForecastGwpDetail({ profile, isNew }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [record, setRecord] = useState(null)
  const [breakdown, setBreakdown] = useState([])
  const [breakdownTypes, setBreakdownTypes] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [references, setReferences] = useState([])
  const [suggestion, setSuggestion] = useState(null)
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [saving, setSaving] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelBox, setShowCancelBox] = useState(false)

  const isComOps = profile?.role === 'ComOps' || profile?.role === 'Admin'
  const isDSP = profile?.role === 'DSP' || profile?.role === 'Admin'

  useEffect(() => {
    fetchPicklist('forecast_breakdown_type').then(setBreakdownTypes).catch(console.error)
    fetchPicklist('planned_gwp_platform').then(setPlatforms).catch(console.error)
    supabase
      .from('reference')
      .select('sku_code, item_name')
      .eq('status', 'active')
      .order('sku_code')
      .then(({ data }) => setReferences(data || []))
  }, [])

  useEffect(() => {
    if (!isNew && id) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (form.country && form.isku) loadSuggestion(form.country, form.isku)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.country, form.isku])

  async function load() {
    const { data, error } = await supabase.from('forecast_gwp').select('*').eq('id', id).single()
    if (!error) {
      setRecord(data)
      setForm(data)
    }
    const { data: bd } = await supabase
      .from('forecast_gwp_breakdown')
      .select('*')
      .eq('forecast_id', id)
    setBreakdown(bd || [])
  }

  async function loadSuggestion(country, isku) {
    const { data } = await supabase
      .from('planned_gwp_bundling_lines')
      .select('actual_sold_qty_sets, requested_qty_sets, created_at, planned_gwp_bundling!inner(country)')
      .eq('isku', isku)
      .eq('planned_gwp_bundling.country', country)
      .not('actual_sold_qty_sets', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3)
    if (!data || data.length === 0) {
      setSuggestion(null)
      return
    }
    const avg = data.reduce((sum, l) => sum + Number(l.actual_sold_qty_sets), 0) / data.length
    const confidence = data.length >= 3 ? 'High' : data.length === 2 ? 'Medium' : 'Low'
    setSuggestion({
      qty: Math.round(avg),
      confidence,
      basis: `Average of the last ${data.length} matching campaign${data.length > 1 ? 's' : ''} for ${isku} in ${country}`,
      samples: data.map((d) => Number(d.actual_sold_qty_sets)),
    })
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function applySuggestion() {
    if (suggestion) update('confirmed_qty_sets', suggestion.qty)
  }

  function cleanPayload() {
    const payload = { ...form }
    ;[
      'id', 'created_at', 'breakdown_total', 'match_status', 'graduation_status',
      'graduated_to_request_id', 'status', 'dsp_ack_required', 'dsp_acknowledged_at',
    ].forEach((f) => delete payload[f])
    if (payload.target_month === '') payload.target_month = null
    payload.requestor_id = payload.requestor_id || profile?.id
    payload.updated_at = new Date().toISOString()
    if (suggestion) {
      payload.system_suggested_qty_sets = suggestion.qty
      payload.system_suggestion_basis = suggestion.basis
      payload.system_suggestion_confidence = suggestion.confidence
    }
    return payload
  }

  async function handleSave() {
    if (!form.target_month || !form.country || !form.isku) {
      alert('Target month, country and ISKU are required.')
      return
    }
    setSaving(true)
    const payload = cleanPayload()
    if (isNew) {
      const { data, error } = await supabase.from('forecast_gwp').insert(payload).select().single()
      if (error) alert(error.message)
      else navigate(`/forecast-gwp/${data.id}`)
    } else {
      const { error } = await supabase.from('forecast_gwp').update(payload).eq('id', id)
      if (error) alert(error.message)
      else await load()
    }
    setSaving(false)
  }

  async function addBreakdownRow() {
    const { error } = await supabase
      .from('forecast_gwp_breakdown')
      .insert({ forecast_id: id, campaign_type: breakdownTypes[0]?.code, qty: 0 })
    if (!error) load()
  }

  async function updateBreakdownRow(rowId, field, value) {
    await supabase.from('forecast_gwp_breakdown').update({ [field]: value }).eq('id', rowId)
    load()
  }

  async function removeBreakdownRow(rowId) {
    await supabase.from('forecast_gwp_breakdown').delete().eq('id', rowId)
    load()
  }

  async function handleSubmitToM1() {
    setDuplicateWarning(null)
    const monthStart = record.target_month
    const [y, m] = monthStart.split('-')
    const monthEnd = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10)

    const { data: existingHeaders } = await supabase
      .from('planned_gwp_bundling')
      .select('id, reference_no, planned_gwp_bundling_lines(id, isku)')
      .eq('country', record.country)
      .eq('platform', record.platform)
      .gte('promo_start_date', monthStart)
      .lte('promo_start_date', monthEnd)

    const dup = (existingHeaders || []).find((h) =>
      (h.planned_gwp_bundling_lines || []).some((l) => l.isku === record.isku)
    )
    if (dup) {
      setDuplicateWarning(dup)
      return
    }
    await createM1Request()
  }

  async function createM1Request() {
    const { data: newHeader, error } = await supabase
      .from('planned_gwp_bundling')
      .insert({
        country: record.country,
        platform: record.platform,
        promo_start_date: record.target_month,
        requestor_id: profile?.id,
        remarks: `Graduated from forecast (${record.system_suggestion_basis || 'manual'})`,
      })
      .select()
      .single()
    if (error) {
      alert(error.message)
      return
    }
    await supabase.from('planned_gwp_bundling_lines').insert({
      request_id: newHeader.id,
      isku: record.isku,
      qty_per_set: record.qty_per_set || 1,
      requested_qty_sets: record.confirmed_qty_sets,
    })
    await supabase
      .from('forecast_gwp')
      .update({ graduation_status: 'Submitted', graduated_to_request_id: newHeader.id })
      .eq('id', id)
    navigate(`/planned-gwp/${newHeader.id}`)
  }

  function daysUntilCampaign() {
    if (!record?.target_month) return null
    const target = new Date(record.target_month)
    const today = new Date()
    return Math.round((target - today) / 86400000)
  }

  async function handleCancelForecast() {
    if (!cancelReason.trim()) {
      alert('A reason is required to cancel.')
      return
    }
    const daysLeft = daysUntilCampaign()
    const lateCanel = daysLeft != null && daysLeft <= 14
    const notedRemarks = `${form.remarks || ''}\n\n[Canceled by ${profile?.full_name || profile?.email}] ${cancelReason}`.trim()

    await supabase
      .from('forecast_gwp')
      .update({
        status: 'Canceled',
        remarks: notedRemarks,
        dsp_ack_required: lateCanel,
      })
      .eq('id', id)

    if (lateCanel) {
      await supabase.from('notifications_log').insert({
        recipient_id: null,
        channel: 'email',
        context: `Forecast for ${record.isku} (${record.country}/${record.platform}, ${record.target_month}) canceled with ${daysLeft} days to go — needs DSP acknowledgment. Reason: ${cancelReason}`,
        related_table: 'forecast_gwp',
        related_id: id,
      })
    }
    setCancelReason('')
    setShowCancelBox(false)
    await load()
  }

  async function handleAcknowledge() {
    await supabase.from('forecast_gwp').update({ dsp_acknowledged_at: new Date().toISOString() }).eq('id', id)
    await load()
  }

  const totalPieces =
    (Number(form.qty_per_set) || 0) * (Number(form.confirmed_qty_sets) || 0)

  return (
    <div className="detail-card">
      {!isNew && record && (
        <div className="detail-header">
          <h2>
            {record.target_month} · {record.country} · {record.platform} · {record.isku}
          </h2>
          <div style={{ display: 'flex', gap: '6px' }}>
            {record.status === 'Canceled' && (
              <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                Canceled
              </span>
            )}
            <span
              className="badge"
              style={{
                background: record.match_status === 'Matched' ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: record.match_status === 'Matched' ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {record.match_status}
            </span>
          </div>
        </div>
      )}

      {!isNew && record?.dsp_ack_required && !record?.dsp_acknowledged_at && (
        <div className="detail-card" style={{ background: 'var(--danger-bg)', marginBottom: '1rem' }}>
          <div style={{ color: 'var(--danger)', fontWeight: 500, fontSize: '13px', marginBottom: '4px' }}>
            Canceled with less than 2 weeks to the campaign
          </div>
          <div className="text-secondary" style={{ fontSize: '13px', marginBottom: '8px' }}>
            DSP needs to acknowledge this late cancellation — stock or logistics may already be in motion.
          </div>
          {isDSP && (
            <button className="btn btn-danger" onClick={handleAcknowledge}>
              Acknowledge
            </button>
          )}
        </div>
      )}
      {!isNew && record?.dsp_ack_required && record?.dsp_acknowledged_at && (
        <p className="hint">
          Acknowledged by DSP on {new Date(record.dsp_acknowledged_at).toLocaleString()}.
        </p>
      )}

      {!isNew && isComOps && record?.status !== 'Canceled' && (
        <div className="action-row">
          <button className="btn btn-danger" onClick={() => setShowCancelBox((v) => !v)}>
            Cancel this forecast
          </button>
        </div>
      )}
      {showCancelBox && (
        <div className="reason-box">
          <div className="reason-label">Reason for canceling (required)</div>
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          {daysUntilCampaign() != null && daysUntilCampaign() <= 14 && (
            <div className="hint" style={{ color: 'var(--danger)' }}>
              Only {daysUntilCampaign()} days to the campaign — DSP will be notified to acknowledge.
            </div>
          )}
          <button className="btn btn-danger" onClick={handleCancelForecast}>
            Confirm cancel
          </button>
        </div>
      )}

      {suggestion && (
        <div className="detail-card" style={{ background: 'var(--surface-2)', marginBottom: '1rem' }}>
          <div className="hint-inline">System-suggested direction</div>
          <div style={{ fontSize: '20px', fontWeight: 500 }}>
            ~{suggestion.qty} sets{' '}
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 400 }}>
              · {suggestion.confidence} confidence
            </span>
          </div>
          <div className="text-secondary" style={{ fontSize: '13px' }}>{suggestion.basis}</div>
          <button className="link-btn" style={{ marginTop: '6px' }} onClick={applySuggestion}>
            Use this number →
          </button>
        </div>
      )}

      <fieldset disabled={!isComOps} className="section">
        <legend>
          Confirm forecast <span className="role-tag">ComOps</span>
        </legend>
        <div className="grid">
          <input
            type="month"
            value={form.target_month || ''}
            onChange={(e) => update('target_month', e.target.value)}
          />
          <select value={form.country || ''} onChange={(e) => update('country', e.target.value)}>
            <option value="">Country</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={form.platform || ''} onChange={(e) => update('platform', e.target.value)}>
            <option value="">Platform</option>
            {platforms.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
          <select value={form.isku || ''} onChange={(e) => update('isku', e.target.value)}>
            <option value="">ISKU</option>
            {references.map((r) => (
              <option key={r.sku_code} value={r.sku_code}>
                {r.sku_code} — {r.item_name}
              </option>
            ))}
          </select>
          <div>
            <div className="hint-inline" title="Use 1 if this product isn't split — a box is a box, a bottle is a bottle.">
              Pieces/box
            </div>
            <input
              type="number"
              value={form.qty_per_set ?? 1}
              onChange={(e) => update('qty_per_set', e.target.value)}
            />
          </div>
          <div>
            <div className="hint-inline">Confirmed (sets)</div>
            <input
              type="number"
              value={form.confirmed_qty_sets ?? ''}
              onChange={(e) => update('confirmed_qty_sets', e.target.value)}
            />
          </div>
        </div>
        <div className="hint" style={{ marginBottom: '8px' }}>
          {totalPieces} total pieces for boosters/sachets — use 1 piece per box for products that
          aren't split.
        </div>
        <textarea
          placeholder="Remarks — why this differs from the system suggestion, if it does"
          value={form.remarks || ''}
          onChange={(e) => update('remarks', e.target.value)}
        />
      </fieldset>

      {!isNew && (
        <fieldset disabled={!isComOps} className="section">
          <legend>Breakdown by campaign type</legend>
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign type</th>
                <th>Qty</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.id}>
                  <td>
                    <select
                      value={b.campaign_type || ''}
                      onChange={(e) => updateBreakdownRow(b.id, 'campaign_type', e.target.value)}
                    >
                      {breakdownTypes.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={b.qty}
                      onChange={(e) => updateBreakdownRow(b.id, 'qty', Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <button className="link-btn" onClick={() => removeBreakdownRow(b.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn" onClick={addBreakdownRow}>
            + Add row
          </button>
          {record && (
            <p className="hint" style={{ marginTop: '8px' }}>
              Breakdown total: <strong>{record.breakdown_total}</strong> · Confirmed qty:{' '}
              <strong>{record.confirmed_qty_sets}</strong> — {record.match_status}
            </p>
          )}
        </fieldset>
      )}

      {!isNew && record && record.status !== 'Canceled' && (
        <div className="detail-card" style={{ background: 'var(--warning-bg)', marginBottom: '1rem' }}>
          <div className="hint-inline" style={{ color: 'var(--warning)' }}>
            When {record.target_month} becomes next month, submit this to create the Planned
            GWP/Bundling draft. It won't happen automatically.
          </div>
          <div className="action-row" style={{ marginTop: '8px' }}>
            <button
              className="btn btn-accent"
              disabled={record.graduation_status === 'Submitted'}
              onClick={handleSubmitToM1}
            >
              {record.graduation_status === 'Submitted' ? 'Already submitted' : 'Submit to M+1'}
            </button>
            {record.graduated_to_request_id && (
              <button className="link-btn" onClick={() => navigate(`/planned-gwp/${record.graduated_to_request_id}`)}>
                Open the M+1 request →
              </button>
            )}
          </div>
        </div>
      )}

      {duplicateWarning && (
        <div className="detail-card" style={{ background: 'var(--danger-bg)', marginBottom: '1rem' }}>
          <div style={{ color: 'var(--danger)', fontWeight: 500, fontSize: '13px' }}>
            Possible duplicate found
          </div>
          <div className="text-secondary" style={{ fontSize: '13px', marginBottom: '8px' }}>
            An M+1 entry already exists for this country/platform/ISKU this month (
            {duplicateWarning.reference_no}). Submitting again would create a duplicate.
          </div>
          <div className="action-row">
            <button className="btn" onClick={() => navigate(`/planned-gwp/${duplicateWarning.id}`)}>
              Open existing
            </button>
            <button className="btn btn-danger" onClick={createM1Request}>
              Create anyway
            </button>
          </div>
        </div>
      )}

      <div className="action-row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => navigate('/forecast-gwp')}>
          Back
        </button>
        <button className="btn btn-accent" disabled={saving} onClick={handleSave}>
          {isNew ? 'Save forecast' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
