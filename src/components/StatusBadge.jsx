export const APPROVAL_COLORS = {
  'Pending Review': { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  Approved: { bg: 'var(--success-bg)', color: 'var(--success)' },
  Rejected: { bg: 'var(--danger-bg)', color: 'var(--danger)' },
}

export const SLA_COLORS = {
  Urgent: { bg: 'var(--danger-bg)', color: 'var(--danger)' },
  High: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  Normal: { bg: 'var(--surface-2)', color: 'var(--text-secondary)' },
}

export default function StatusBadge({ value, colors }) {
  if (!value) return <span className="text-muted">—</span>
  const c = colors[value] || { bg: 'var(--surface-2)', color: 'var(--text-secondary)' }
  return (
    <span className="badge" style={{ background: c.bg, color: c.color }}>
      {value}
    </span>
  )
}
