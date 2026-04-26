export default function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 32px', color: '#64748b' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ color: '#e2e8f0', margin: '0 0 8px' }}>{title}</h3>
      <p style={{ margin: '0 0 24px', fontSize: 14 }}>{description}</p>
      {actionLabel && (
        <button onClick={onAction} style={{
          background: '#6366f1', color: '#fff', border: 'none',
          padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14
        }}>{actionLabel}</button>
      )}
    </div>
  )
}
