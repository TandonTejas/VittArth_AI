export default function SurvivalImpactChart({ before, after, delta }) {
  const max = Math.max(before, 90)
  const pctBefore = Math.min((before / max) * 100, 100)
  const pctAfter  = Math.min((after  / max) * 100, 100)

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 11, color: '#7b82b0', marginBottom: 10,
        fontFamily: "'DM Sans', sans-serif",
        textTransform: 'uppercase', letterSpacing: '0.15em',
      }}>
        Survival Impact
      </div>
      {[
        ['Before', pctBefore, '#00b4ff', before],
        ['After',  pctAfter,  '#ef4444', after],
      ].map(([label, pct, color, val]) => (
        <div key={label} style={{ marginBottom: 10 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 11, color: '#7b82b0', marginBottom: 5,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            <span>{label}</span>
            <span style={{ color, fontWeight: 600 }}>{val?.toFixed(1)} days</span>
          </div>
          <div style={{
            background: 'rgba(0,180,255,0.08)',
            borderRadius: 6, height: 8, overflow: 'hidden',
            border: '1px solid rgba(0,180,255,0.1)',
          }}>
            <div style={{
              width: `${pct}%`, height: '100%',
              background: color,
              borderRadius: 6,
              transition: 'width .6s cubic-bezier(0.34,1.56,0.64,1)',
              boxShadow: `0 0 8px ${color}66`,
            }} />
          </div>
        </div>
      ))}
      <div style={{
        textAlign: 'right', fontSize: 12,
        color: '#ef4444', fontWeight: 700,
        fontFamily: "'Syne', sans-serif",
      }}>
        −{delta?.toFixed(1)} days runway
      </div>
    </div>
  )
}
