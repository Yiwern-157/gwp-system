import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { fetchPicklist, COUNTRIES } from '../lib/picklists'
import StatusBadge, { APPROVAL_COLORS } from '../components/StatusBadge'

const emptyForm = {
  date_requested: new Date().toISOString().slice(0, 10),
  target_launch_date: '',
  item_description: '',
  sku_creation: '',
  remarks: '',
  sku_status_type: '',
  country: '',
  platform: '',
  barcode: '',
  wms_enrollment_status: '',
  listing_link: '',
  listing_status: '',
  stock_prep_date: '',
  stock_prep_status: '',
}

// Fields the schema computes automatically (generated columns) — never sent on write.
const GENERATED_FIELDS = [
  'id',
  'created_at',
  'submission_type',
  'sku_category_prefix',
  'sku_code',
  'estimated_inbound_date',
]

export default function SkuRequestDetail({ profile, isNew }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [record, setRecord] = useState(null)
  const [history, setHistory] = useState([])
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [types, setTypes] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [saving, setSaving] = useState(false)

  const isComOps = profile?.role === 'ComOps' || profile?.role === 'Admin'
  const isDSP = profile?.role === 'DSP' || profile?.role === 'Admin'
  const isWarehouse = profile?.role === 'Warehouse' || profile?.role === 'Admin'

  useEffect(() => {
    fetchPicklist('sku_request_type').then(setTypes).catch(console.error)
    fetchPicklist('sku_request_platform').then(setPlatforms).catch(console.error)
  }, [])

  useEffect(() => {
    if (!isNew && id) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function load() {
    const { data, error } = await supabase
      .from('sku_barcode_request')
      .select('*')
      .eq('id', id)
      .single()
    if (!error) {
      setRecord(data)
      setForm(data)
    }

    const { data: hist } = await supabase
      .from('sku_barcode_request_history')
      .select('*, actor:actor_id(full_name)')
      .eq('request_id', id)
      .order('created_at', { ascending: false })
    setHistory(hist || [])

    if (profile?.id) {
      await supabase
        .from('activity_log')
        .insert({ actor_id: profile.id, table_name: 'sku_barcode_request', record_id: id, action: 'view' })
    }
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function cleanPayload() {
    const payload = { ...form }
    GENERATED_FIELDS.forEach((f) => delete payload[f])
    payload.requestor_id = payload.requestor_id || profile?.id
    payload.updated_at = new Date().toISOString()
    // Postgres rejects "" for a date column — an empty date input must become null.
    ;['date_requested', 'target_launch_date', 'stock_prep_date'].forEach((f) => {
      if (payload[f] === '') payload[f] = null
    })
    return payload
  }

  async function handleSave() {
    if (!form.target_launch_date || !form.country) {
      alert('Target launch date and country are required.')
      return
    }
    setSaving(true)
    const payload = cleanPayload()

    if (isNew) {
      const { data, error } = await supabase
        .from('sku_barcode_request')
        .insert(payload)
        .select()
        .single()
      if (error) {
        alert(error.message)
      } else {
        await supabase
          .from('sku_barcode_request_history')
          .insert({ request_id: data.id, action: 'Submitted', actor_id: profile?.id })
        navigate(`/sku-requests/${data.id}`)
      }
    } else {
      const { error } = await supabase.from('sku_barcode_request').update(payload).eq('id', id)
      if (error) {
        alert(error.message)
      } else {
        await supabase
          .from('sku_barcode_request_history')
          .insert({ request_id: id, action: 'Edited', actor_id: profile?.id })
        await load()
      }
    }
    setSaving(false)
  }

  async function handleApprove() {
    await supabase.from('sku_barcode_request').update({ approval_status: 'Approved' }).eq('id', id)
    await supabase
      .from('sku_barcode_request_history')
      .insert({ request_id: id, action: 'Approved', actor_id: profile?.id })
    await load()
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      alert('A reason is required to reject.')
      return
    }
    await supabase.from('sku_barcode_request').update({ approval_status: 'Rejected' }).eq('id', id)
    await supabase.from('sku_barcode_request_history').insert({
      request_id: id,
      action: 'Rejected',
      actor_id: profile?.id,
      reason: rejectReason,
    })
    if (record?.requestor_id) {
      // Recorded here; actually sending the email/Slack message is a Supabase
      // Edge Function to be wired up in Phase 2 once sender credentials exist.
      await supabase.from('notifications_log').insert({
        recipient_id: record.requestor_id,
        channel: 'email',
        context: `SKU request rejected: ${rejectReason}`,
        related_table: 'sku_barcode_request',
        related_id: id,
      })
    }
    setRejectReason('')
    setShowRejectBox(false)
    await load()
  }

  const visibleHistory = showAllHistory ? history : history.slice(0, 1)

  return (
    <div className="detail-card">
      {!isNew && (
        <div className="detail-header">
          <h2>{form.item_description || 'SKU request'}</h2>
          <StatusBadge value={form.approval_status} colors={APPROVAL_COLORS} />
        </div>
      )}
      <p className="hint">
        This request stays editable at any stage, including after submission and approval.
      </p>

      {!isNew && isDSP && form.approval_status === 'Pending Review' && (
        <div className="action-row">
          <button className="btn btn-success" onClick={handleApprove}>
            Approve
          </button>
          <button className="btn btn-danger" onClick={() => setShowRejectBox((v) => !v)}>
            Reject
          </button>
        </div>
      )}
      {showRejectBox && (
        <div className="reason-box">
          <div className="reason-label">Reason for rejection (required)</div>
          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <button className="btn btn-danger" onClick={handleReject}>
            Confirm reject
          </button>
        </div>
      )}

      <fieldset disabled={!isComOps} className="section">
        <legend>
          1. Basic info <span className="role-tag">ComOps</span>
        </legend>
        <div className="grid">
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
          <input
            type="date"
            value={form.date_requested || ''}
            onChange={(e) => update('date_requested', e.target.value)}
          />
          <input
            type="date"
            value={form.target_launch_date || ''}
            onChange={(e) => update('target_launch_date', e.target.value)}
          />
          <select
            value={form.sku_status_type || ''}
            onChange={(e) => update('sku_status_type', e.target.value)}
          >
            <option value="">SKU status type</option>
            {types.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
          {record && <span className="hint-inline">SLA: {record.submission_type} (auto)</span>}
        </div>
        <input
          placeholder="Item description"
          value={form.item_description || ''}
          onChange={(e) => update('item_description', e.target.value)}
          style={{ width: '100%', marginBottom: '10px' }}
        />
        <textarea
          placeholder="SKU composition, e.g. CGB30+STG30+SOSE30"
          value={form.sku_creation || ''}
          onChange={(e) => update('sku_creation', e.target.value)}
        />
        <textarea
          placeholder="Remarks (optional notes for DSP / L&W)"
          value={form.remarks || ''}
          onChange={(e) => update('remarks', e.target.value)}
        />
      </fieldset>

      <fieldset disabled={!isDSP} className="section">
        <legend>
          2. DSP processing <span className="role-tag">DSP</span>
        </legend>
        <div className="grid">
          <input value={record?.sku_code || ''} disabled placeholder="SKU code (auto)" />
          <input
            placeholder="Barcode"
            value={form.barcode || ''}
            onChange={(e) => update('barcode', e.target.value)}
          />
          <input
            placeholder="WMS enrollment status"
            value={form.wms_enrollment_status || ''}
            onChange={(e) => update('wms_enrollment_status', e.target.value)}
          />
        </div>
      </fieldset>

      <fieldset disabled={!(isComOps || isDSP)} className="section">
        <legend>3. Listing</legend>
        <div className="grid">
          <input
            placeholder="Listing link"
            value={form.listing_link || ''}
            onChange={(e) => update('listing_link', e.target.value)}
          />
          <input
            placeholder="Listing status"
            value={form.listing_status || ''}
            onChange={(e) => update('listing_status', e.target.value)}
          />
        </div>
      </fieldset>

      <fieldset disabled={!isWarehouse} className="section">
        <legend>
          4. L&amp;W stock prep <span className="role-tag">Warehouse</span>
        </legend>
        <div className="grid">
          <input
            type="date"
            value={form.stock_prep_date || ''}
            onChange={(e) => update('stock_prep_date', e.target.value)}
          />
          <input
            placeholder="Stock prep status"
            value={form.stock_prep_status || ''}
            onChange={(e) => update('stock_prep_status', e.target.value)}
          />
          {record && (
            <span className="hint-inline">ETA: {record.estimated_inbound_date || '—'} (auto)</span>
          )}
        </div>
      </fieldset>

      {!isNew && (
        <div className="history">
          <div className="history-title">Activity</div>
          {visibleHistory.map((h) => (
            <div key={h.id} className="history-row">
              {new Date(h.created_at).toLocaleString()} · {h.actor?.full_name || 'Someone'}{' '}
              {h.action}
              {h.reason ? `: ${h.reason}` : ''}
            </div>
          ))}
          {history.length === 0 && <div className="text-muted">No activity yet.</div>}
          {history.length > 1 && !showAllHistory && (
            <button className="link-btn" onClick={() => setShowAllHistory(true)}>
              Show {history.length - 1} older {history.length - 1 === 1 ? 'entry' : 'entries'} ↓
            </button>
          )}
        </div>
      )}

      <div className="action-row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => navigate('/sku-requests')}>
          Cancel
        </button>
        <button className="btn btn-accent" disabled={saving} onClick={handleSave}>
          {isNew ? 'Submit request' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
