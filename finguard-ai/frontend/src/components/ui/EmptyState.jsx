export default function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '60px 32px',
      color: '#7b82b0',
    }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>{icon}</div>
      <h3 style={{
        color: '#f0f4ff', margin: '0 0 10px',
        fontFamily: "'Syne', sans-serif",
        fontWeight: 800, fontSize: 20,
      }}>
        {title}
      </h3>
      <p style={{
        margin: '0 0 28px', fontSize: 14, lineHeight: 1.7,
        fontFamily: "'DM Sans', sans-serif",
        color: '#7b82b0',
        maxWidth: 360, marginLeft: 'auto', marginRight: 'auto',
      }}>
        {description}
      </p>
      {actionLabel && (
        <button
          onClick={onAction}
          className="btn-primary"
          style={{ display: 'inline-block' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
