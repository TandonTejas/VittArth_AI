export default function Badge({ label, variant = 'neutral' }) {
  const styles = {
    safe:    { background: '#14532d', color: '#bbf7d0' },
    medium:  { background: '#78350f', color: '#fde68a' },
    high:    { background: '#7f1d1d', color: '#fecaca' },
    info:    { background: '#1e3a5f', color: '#93c5fd' },
    neutral: { background: '#1e2535', color: '#94a3b8' },
  }
  const s = styles[variant] || styles.neutral
  return (
    <span style={{
      ...s, fontSize: 11, fontWeight: 600, padding: '2px 8px',
      borderRadius: 20, display: 'inline-block', letterSpacing: .5
    }}>
      {label}
    </span>
  )
}
