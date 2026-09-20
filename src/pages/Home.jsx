import { Link } from 'react-router-dom'

const MODULES = [
  { to: '/sku-requests', title: 'SKU & Barcode Request', desc: 'Submit, approve, generate SKU codes' },
  { to: '/planned-gwp', title: 'Planned GWP/Bundling', desc: 'M+1 schedule, stock confirm, actual sales' },
  { to: '/leftover-stock', title: 'Leftover Stock Pool', desc: 'Unused stock, sorted by expiry urgency' },
  { to: '/forecast-gwp', title: 'Forecast GWP', desc: 'M2-M4 long-range plan with system suggestions' },
  { to: '/analysis', title: 'Analysis', desc: 'Submission gaps & utilization trends' },
  { to: '/reference', title: 'Reference', desc: 'Master SKU list' },
]

export default function Home() {
  return (
    <div>
      <h1>Home</h1>
      <div className="card-grid">
        {MODULES.map((m) => (
          <div className="module-card" key={m.title}>
            <div className="module-title">{m.title}</div>
            <div className="module-desc">{m.desc}</div>
            <Link className="btn btn-accent" to={m.to}>
              Open →
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
