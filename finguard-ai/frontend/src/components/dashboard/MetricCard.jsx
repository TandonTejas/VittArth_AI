export default function MetricCard({ label, value, subtext, trend, trendDirection }) {
  const isUp = trendDirection === 'up'
  const dotColor = isUp ? '#00e5c0' : '#ef4444'

  return (
    <div
      className="fg-card"
      style={{
        padding: '22px 24px',
        transition: 'all 0.3s ease',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(0,180,255,0.4)'
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 0 40px rgba(0,85,255,0.15)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(0,180,255,0.18)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Subtle top glow accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, transparent, rgba(0,180,255,0.4), transparent)',
        borderRadius: '20px 20px 0 0',
      }} />

      <div style={{
        fontSize: '0.72rem',
        color: '#00e5c0',
        fontWeight: 700,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        fontFamily: "'Syne', sans-serif",
        marginBottom: 10,
      }}>
        {label}
      </div>

      <div style={{
        fontSize: 28,
        fontWeight: 800,
        fontFamily: "'Syne', sans-serif",
        background: 'linear-gradient(120deg, #00b4ff, #00e5c0)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        marginBottom: 8,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {trend && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Glowing dot indicator */}
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: dotColor,
              boxShadow: `0 0 6px ${dotColor}`,
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 12, color: dotColor, fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {trend}
            </span>
          </div>
        )}
        {subtext && (
          <span style={{ fontSize: 12, color: '#7b82b0', fontFamily: "'DM Sans', sans-serif" }}>
            {subtext}
          </span>
        )}
      </div>
    </div>
  )
}
