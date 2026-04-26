export default function Spinner({ size = 32, message = '' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 32 }}>
      <div style={{
        width: size, height: size, border: '3px solid #1e2535',
        borderTop: '3px solid #6366f1', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {message && <p style={{ color: '#94a3b8', fontSize: 13 }}>{message}</p>}
    </div>
  )
}
