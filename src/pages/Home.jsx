import { Link } from 'react-router-dom'

const MODULES = [
  {
    to: '/sku-requests',
    title: 'SKU & Barcode Request',
    desc: 'Submit, approve, generate SKU codes',
    ready: true,
  },
  { title: 'Planned GWP/Bundling', desc: 'M+1 schedule & payout', ready: false },
  { title: 'Forecast GWP', desc: 'M2-M4 long-range plan', ready: false },
  { title: 'Analysis', desc: 'Submission gaps & trends', ready: false },
  { title: 'Reference', desc: 'Master SKU list', ready: false },
  { title: 'Admin', desc: 'Activity log & dropdown lists', ready: false },
]

export default function Home() {
  return (
    <div>
      <h1>Home</h1>
      <p className="text-secondary">
        Phase 1 covers SKU &amp; Barcode Request end to end. The other five modules from the
        navigation map come next.
      </p>
      <div className="card-grid">
        {MODULES.map((m) => (
          <div className="module-card" key={m.title}>
            <div className="module-title">{m.title}</div>
            <div className="module-desc">{m.desc}</div>
            {m.ready ? (
              <Link className="btn btn-accent" to={m.to}>
                Open →
              </Link>
            ) : (
              <span className="badge badge-muted">Coming soon</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
