export default function Badge({ label, variant = 'neutral' }) {
  const styles = {
    safe:    { background: 'rgba(0,229,192,0.12)', color: '#00e5c0', border: '1px solid rgba(0,229,192,0.3)' },
    medium:  { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' },
    high:    { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' },
    info:    { background: 'rgba(0,180,255,0.1)', color: '#00b4ff', border: '1px solid rgba(0,180,255,0.3)' },
    neutral: { background: 'rgba(123,130,176,0.12)', color: '#7b82b0', border: '1px solid rgba(123,130,176,0.25)' },
  }
  const s = styles[variant] || styles.neutral
  return (
    <span style={{
      ...s,
      fontSize: 11,
      fontWeight: 700,
      padding: '3px 10px',
      borderRadius: 20,
      display: 'inline-block',
      letterSpacing: '0.05em',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {label}
    </span>
  )
}
