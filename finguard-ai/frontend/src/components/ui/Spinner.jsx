export default function Spinner({ size = 32, message = '' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: 48, minHeight: 200,
    }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <div style={{
          width: size, height: size,
          border: '3px solid rgba(0,180,255,0.12)',
          borderTop: '3px solid #00b4ff',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          boxShadow: '0 0 12px rgba(0,180,255,0.25)',
        }} />
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {message && (
        <p style={{
          color: '#7b82b0', fontSize: 13, margin: 0,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {message}
        </p>
      )}
    </div>
  )
}
