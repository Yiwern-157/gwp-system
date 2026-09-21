import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { fetchPicklist, COUNTRIES } from '../lib/picklists'

const emptyHeader = {
  type: '',
  campaign_tag: '',
  country: '',
  platform: '',
  tier: '',
  promo_start_date: '',
  promo_end_date: '',
  stock_prep_date: '',
  stock_prep_note: '',
  remarks: '',
}

const emptyLine = { isku: '', qty_per_set: 1, requested_qty_sets: '' }

export default function PlannedGwpDetail({ profile, isNew }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const preset = location.state || null

  const [header, setHeader] = useState(emptyHeader)
  const [record, setRecord] = useState(null)
  const [lines, setLines] = useState([]) // saved lines, existing request only
  const [draftLines, setDraftLines] = useState([]) // not-yet-saved lines, new request only
  const [types, setTypes] = useState([])
  const [tags, setTags] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [references, setReferences] = useState([])
  const [addingLine, setAddingLine] = useState(false)
  const [newLine, setNewLine] = useState(emptyLine)
  const [saving, setSaving] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelBox, setShowCancelBox] = useState(false)

  const isComOps = profile?.role === 'ComOps' || profile?.role === 'Admin'
  const isDSPorWarehouse =
    profile?.role === 'DSP' || profile?.role === 'Warehouse' || profile?.role === 'Admin'

  useEffect(() => {
    fetchPicklist('planned_gwp_type').then(setTypes).catch(console.error)
    fetchPicklist('campaign_tag').then(setTags).catch(console.error)
    fetchPicklist('planned_gwp_platform').then(setPlatforms).catch(console.error)
    supabase
      .from('reference')
      .select('sku_code, item_name')
      .eq('status', 'active')
      .order('sku_code')
      .then(({ data }) => setReferences(data || []))
  }, [])

  useEffect(() => {
    if (!isNew && id) {
      load()
    } else if (isNew && preset?.presetIsku) {
      // "Plan next use" preset: start the new request with this leftover already queued as a line.
      setDraftLines([
        {
          isku: preset.presetIsku,
          qty_per_set: preset.presetQtyPerSet || 1,
          requested_qty_sets: preset.presetQtySets,
          reused_from_line_id: preset.reusedFromLineId || null,
        },
      ])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function load() {
    const { data, error } = await supabase
      .from('planned_gwp_bundling')
      .select('*')
      .eq('id', id)
      .single()
    if (!error) {
      setRecord(data)
      setHeader(data)
    }
    const { data: lineData } = await supabase
      .from('planned_gwp_bundling_lines')
      .select('*')
      .eq('request_id', id)
      .order('created_at')
    setLines(lineData || [])
  }

  function updateHeader(field, value) {
    setHeader((h) => ({ ...h, [field]: value }))
  }

  function cleanHeaderPayload() {
    const payload = { ...header }
    delete payload.id
    delete payload.reference_no
    delete payload.created_at
    ;['promo_start_date', 'promo_end_date', 'stock_prep_date'].forEach((f) => {
      if (payload[f] === '') payload[f] = null
    })
    payload.requestor_id = payload.requestor_id || profile?.id
    payload.updated_at = new Date().toISOString()
    return payload
  }

  async function handleSaveHeader() {
    setSaving(true)
    const payload = cleanHeaderPayload()

    if (isNew) {
      const { data, error } = await supabase
        .from('planned_gwp_bundling')
        .insert(payload)
        .select()
        .single()
      if (error) {
        alert(error.message)
        setSaving(false)
        return
      }

      if (draftLines.length > 0) {
        const rowsToInsert = draftLines.map((l) => ({
          request_id: data.id,
          isku: l.isku,
          qty_per_set: l.qty_per_set,
          requested_qty_sets: l.requested_qty_sets,
          reused_from_line_id: l.reused_from_line_id || null,
        }))
        const { data: insertedLines, error: lineErr } = await supabase
          .from('planned_gwp_bundling_lines')
          .insert(rowsToInsert)
          .select()
        if (lineErr) {
          alert(`Request created, but SKU lines failed to save: ${lineErr.message}`)
          navigate(`/planned-gwp/${data.id}`)
          setSaving(false)
          return
        }
        if (insertedLines.length === 1 && preset?.presetIsku) {
          navigate(`/planned-gwp/${data.id}/lines/${insertedLines[0].id}`)
          setSaving(false)
          return
        }
      }
      navigate(`/planned-gwp/${data.id}`)
    } else {
      const { error } = await supabase
        .from('planned_gwp_bundling')
        .update(payload)
        .eq('id', id)
      if (error) alert(error.message)
      else load()
    }
    setSaving(false)
  }

  async function handleAddLine() {
    if (!newLine.isku || !newLine.requested_qty_sets) {
      alert('ISKU and requested quantity are required.')
      return
    }
    if (isNew) {
      setDraftLines((d) => [...d, { ...newLine }])
      setNewLine(emptyLine)
      setAddingLine(false)
      return
    }
    const { error } = await supabase.from('planned_gwp_bundling_lines').insert({
      request_id: id,
      isku: newLine.isku,
      qty_per_set: newLine.qty_per_set,
      requested_qty_sets: newLine.requested_qty_sets,
    })
    if (error) alert(error.message)
    else {
      setNewLine(emptyLine)
      setAddingLine(false)
      load()
    }
  }

  function removeDraftLine(index) {
    setDraftLines((d) => d.filter((_, i) => i !== index))
  }

  const dspHasProcessed = lines.some((l) => l.stock_status !== 'Pending')

  async function handleDelete() {
    if (
      !window.confirm(
        'Delete this request and all its SKU lines? DSP has not processed any line yet, so this removes everything completely.'
      )
    )
      return
    const lineIds = lines.map((l) => l.id)
    if (lineIds.length) {
      await supabase.from('planned_gwp_bundling_line_history').delete().in('line_id', lineIds)
      await supabase.from('planned_gwp_bundling_lines').delete().eq('request_id', id)
    }
    await supabase.from('planned_gwp_bundling').delete().eq('id', id)
    navigate('/planned-gwp')
  }

  async function handleCancelRequest() {
    if (!cancelReason.trim()) {
      alert('A reason is required to cancel.')
      return
    }
    const notedRemarks = `${header.remarks || ''}\n\n[Canceled by ${profile?.full_name || profile?.email}] ${cancelReason}`.trim()
    await supabase
      .from('planned_gwp_bundling')
      .update({ status: 'Canceled', remarks: notedRemarks })
      .eq('id', id)
    setCancelReason('')
    setShowCancelBox(false)
    await load()
  }

  const stockColors = {
    Confirmed: { bg: 'var(--success-bg)', color: 'var(--success)' },
    'With Issue': { bg: 'var(--warning-bg)', color: 'var(--warning)' },
    Canceled: { bg: 'var(--danger-bg)', color: 'var(--danger)' },
    Pending: { bg: 'var(--surface-2)', color: 'var(--text-secondary)' },
  }

  const selectedTypeDesc = types.find((t) => t.code === header.type)?.description
  const displayLines = isNew ? draftLines : lines

  return (
    <div className="detail-card">
      {!isNew && record && (
        <div className="detail-header">
          <h2 className="mono">{record.reference_no}</h2>
          {record.status === 'Canceled' && (
            <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              Canceled
            </span>
          )}
        </div>
      )}
      {preset?.presetIsku && isNew && (
        <p className="hint">
          Planning next use of {preset.presetQtySets} leftover sets of {preset.presetIsku}.
        </p>
      )}

      {!isNew && isComOps && record?.status !== 'Canceled' && (
        <div className="action-row">
          {!dspHasProcessed ? (
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          ) : (
            <button className="btn btn-danger" onClick={() => setShowCancelBox((v) => !v)}>
              Cancel this request
            </button>
          )}
        </div>
      )}
      {showCancelBox && (
        <div className="reason-box">
          <div className="reason-label">Reason for canceling (required)</div>
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          <button className="btn btn-danger" onClick={handleCancelRequest}>
            Confirm cancel
          </button>
        </div>
      )}

      <fieldset className="section">
        <legend>
          Campaign &amp; schedule <span className="role-tag">ComOps</span>
        </legend>
        <div className="grid">
          <select value={header.type || ''} onChange={(e) => updateHeader('type', e.target.value)}>
            <option value="">Type</option>
            {types.map((t) => (
              <option key={t.code} value={t.code} title={t.description}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={header.country || ''}
            onChange={(e) => updateHeader('country', e.target.value)}
          >
            <option value="">Country</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={header.campaign_tag || ''}
            onChange={(e) => updateHeader('campaign_tag', e.target.value)}
          >
            <option value="">Campaign tag</option>
            {tags.map((t) => (
              <option key={t.code} value={t.code} title={t.description}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={header.platform || ''}
            onChange={(e) => updateHeader('platform', e.target.value)}
          >
            <option value="">Platform</option>
            {platforms.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
          <select value={header.tier || ''} onChange={(e) => updateHeader('tier', e.target.value)}>
            <option value="">Tier</option>
            <option value="Tier 1">Tier 1</option>
            <option value="Tier 2">Tier 2</option>
            <option value="Tier 3">Tier 3</option>
          </select>
          <input
            type="date"
            value={header.promo_start_date || ''}
            onChange={(e) => updateHeader('promo_start_date', e.target.value)}
          />
          <input
            type="date"
            value={header.promo_end_date || ''}
            onChange={(e) => updateHeader('promo_end_date', e.target.value)}
          />
        </div>
        {selectedTypeDesc && (
          <div className="hint" style={{ marginTop: '-4px', marginBottom: '8px' }}>
            {selectedTypeDesc}
          </div>
        )}
        <textarea
          placeholder="Remarks (optional notes for DSP / Logistic)"
          value={header.remarks || ''}
          onChange={(e) => updateHeader('remarks', e.target.value)}
        />
      </fieldset>

      <h3 style={{ marginTop: '1.5rem' }}>SKU lines in this request</h3>
      <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>ISKU</th>
            <th>Item description</th>
            <th>Qty/set</th>
            <th>Requested</th>
            <th>Total pcs</th>
            <th>Stock status</th>
            <th>Unused</th>
            <th>Batch expiry</th>
            <th>Time to expiry</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {displayLines.map((l, i) => (
            <tr
              key={l.id || `draft-${i}`}
              onClick={!isNew ? () => navigate(`/planned-gwp/${id}/lines/${l.id}`) : undefined}
              style={isNew ? { cursor: 'default' } : undefined}
            >
              <td className="mono">{l.isku}</td>
              <td>{references.find((r) => r.sku_code === l.isku)?.item_name || '—'}</td>
              <td>{l.qty_per_set}</td>
              <td>{l.requested_qty_sets} sets</td>
              <td>
                {l.conversion_pc ?? (Number(l.qty_per_set) || 0) * (Number(l.requested_qty_sets) || 0)}{' '}
                pcs
              </td>
              <td>
                <span
                  className="badge"
                  style={{
                    background: stockColors[l.stock_status || 'Pending']?.bg,
                    color: stockColors[l.stock_status || 'Pending']?.color,
                  }}
                >
                  {l.stock_status || 'Pending'}
                </span>
              </td>
              <td>{l.unused_qty_sets ?? '—'}</td>
              <td>{l.batch_expiry_date || '—'}</td>
              <td>
                {l.batch_expiry_date
                  ? `~${Math.round((new Date(l.batch_expiry_date) - new Date()) / 86400000)} days`
                  : '—'}
              </td>
              <td>
                {isNew ? (
                  <button
                    className="link-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeDraftLine(i)
                    }}
                  >
                    Remove
                  </button>
                ) : (
                  <span className="link-btn">View</span>
                )}
              </td>
            </tr>
          ))}
          {displayLines.length === 0 && (
            <tr>
              <td colSpan={10} className="text-muted">
                No SKU lines yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      {addingLine ? (
        <div className="detail-card" style={{ marginTop: '10px' }}>
          <div className="grid">
            <div>
              <div className="hint-inline">ISKU (type to search)</div>
              <input
                list="reference-options"
                value={newLine.isku}
                placeholder="Search SKU code or name…"
                onChange={(e) => setNewLine((l) => ({ ...l, isku: e.target.value }))}
              />
              <datalist id="reference-options">
                {references.map((r) => (
                  <option key={r.sku_code} value={r.sku_code}>
                    {r.sku_code} — {r.item_name}
                  </option>
                ))}
              </datalist>
            </div>
            <div>
              <div className="hint-inline">Item description (auto)</div>
              <input
                value={references.find((r) => r.sku_code === newLine.isku)?.item_name || ''}
                disabled
              />
            </div>
            <div>
              <div className="hint-inline" title="Use 1 if this product isn't split — a box is a box, a bottle is a bottle.">
                Pieces/box
              </div>
              <input
                type="number"
                value={newLine.qty_per_set}
                onChange={(e) => setNewLine((l) => ({ ...l, qty_per_set: e.target.value }))}
              />
            </div>
            <div>
              <div className="hint-inline">Requested (sets)</div>
              <input
                type="number"
                value={newLine.requested_qty_sets}
                onChange={(e) =>
                  setNewLine((l) => ({ ...l, requested_qty_sets: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="hint" style={{ marginBottom: '8px' }}>
            {(Number(newLine.qty_per_set) || 0) * (Number(newLine.requested_qty_sets) || 0)} total
            pieces for DSP/Logistic to prepare — use 1 piece per box for products that aren't
            split (a box is a box, a bottle is a bottle).
          </div>
          <div className="action-row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setAddingLine(false)}>
              Cancel
            </button>
            <button className="btn btn-accent" onClick={handleAddLine}>
              Add line
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-accent" style={{ marginTop: '10px' }} onClick={() => setAddingLine(true)}>
          + Add SKU line
        </button>
      )}

      <fieldset disabled={!isDSPorWarehouse} className="section" style={{ marginTop: '1.5rem' }}>
        <legend>
          Stock prep scheduling <span className="role-tag">DSP / Logistic</span>
        </legend>
        <div className="grid">
          <div>
            <div className="hint-inline">Stock prep date</div>
            <input
              type="date"
              value={header.stock_prep_date || ''}
              onChange={(e) => updateHeader('stock_prep_date', e.target.value)}
            />
          </div>
        </div>
        <div className="hint" style={{ marginBottom: '8px' }}>
          Pre-filled as a suggestion from country/platform/type lead time — override it if the
          warehouse inbound schedule or a shipment delay changes the real date.
        </div>
        <textarea
          placeholder="Note — why this date changed from the suggestion, if it did"
          value={header.stock_prep_note || ''}
          onChange={(e) => updateHeader('stock_prep_note', e.target.value)}
        />
      </fieldset>

      <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
        <button className="btn" onClick={() => navigate('/planned-gwp')}>
          Back
        </button>
        <button className="btn btn-accent" disabled={saving} onClick={handleSaveHeader}>
          {isNew ? 'Create request' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
