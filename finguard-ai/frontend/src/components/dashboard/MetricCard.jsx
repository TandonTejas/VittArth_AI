export default function MetricCard({ label, value, subtext, trend, trendDirection }) {
  const trendColor = trendDirection === 'up' ? '#22c55e' : '#ef4444'
  return (
    <div style={{
      background: '#131720', border: '1px solid #1e2535',
      borderRadius: 12, padding: '20px 24px'
    }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {trend && <span style={{ fontSize: 12, color: trendColor, fontWeight: 600 }}>{trend}</span>}
        {subtext && <span style={{ fontSize: 12, color: '#64748b' }}>{subtext}</span>}
      </div>
    </div>
  )
}
