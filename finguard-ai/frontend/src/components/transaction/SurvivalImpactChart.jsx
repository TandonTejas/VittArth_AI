export default function SurvivalImpactChart({ before, after, delta }) {
  const max = Math.max(before, 90)
  const pctBefore = Math.min((before / max) * 100, 100)
  const pctAfter  = Math.min((after  / max) * 100, 100)

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Survival Impact</div>
      {[['Before', pctBefore, '#6366f1', before], ['After', pctAfter, '#ef4444', after]]
        .map(([label, pct, color, val]) => (
          <div key={label} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 3 }}>
              <span>{label}</span><span>{val?.toFixed(1)} days</span>
            </div>
            <div style={{ background: '#1e2535', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .5s' }} />
            </div>
          </div>
        ))}
      <div style={{ textAlign: 'right', fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
        −{delta?.toFixed(1)} days
      </div>
    </div>
  )
}
