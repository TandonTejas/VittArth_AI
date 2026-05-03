export default function ErrorAlert({ message, details }) {
  return (
    <div style={{
      borderLeft: '3px solid #ef4444',
      background: 'rgba(239,68,68,0.07)',
      border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 12,
      padding: '14px 18px',
      margin: '8px 0',
    }}>
      <div style={{
        color: '#fca5a5', fontWeight: 600, fontSize: 14,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {message}
      </div>
      {details && (
        <div style={{
          color: '#7b82b0', fontSize: 12, marginTop: 6,
          fontFamily: "'DM Sans', sans-serif",
          lineHeight: 1.5,
        }}>
          {details}
        </div>
      )}
    </div>
  )
}
