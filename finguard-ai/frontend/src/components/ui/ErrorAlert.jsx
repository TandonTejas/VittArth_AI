export default function ErrorAlert({ message, details }) {
  return (
    <div style={{
      borderLeft: '4px solid #ef4444', background: '#1c1010',
      borderRadius: 8, padding: '12px 16px', margin: '8px 0'
    }}>
      <div style={{ color: '#fca5a5', fontWeight: 600, fontSize: 14 }}>{message}</div>
      {details && <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{details}</div>}
    </div>
  )
}
