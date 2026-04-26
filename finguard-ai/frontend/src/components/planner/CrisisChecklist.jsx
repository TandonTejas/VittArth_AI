import { useState, useEffect } from 'react'

const SK = 'fg_crisis_checks'

export default function CrisisChecklist({ actions = [], shortfall = 0 }) {
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SK) || '{}') } catch { return {} }
  })

  useEffect(() => { localStorage.setItem(SK, JSON.stringify(checked)) }, [checked])

  const toggle = i => setChecked(p => ({ ...p, [i]: !p[i] }))

  return (
    <div>
      {shortfall > 0 && (
        <div style={{ background: '#1a0a0a', border: '1px solid #ef444455', borderRadius: 8,
          padding: '12px 16px', marginBottom: 20, color: '#fca5a5', fontSize: 14 }}>
          You are <strong>₹{shortfall.toLocaleString('en-IN')}</strong> short of covering fixed expenses.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {actions.map((action, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!checked[i]} onChange={() => toggle(i)}
              style={{ marginTop: 2, accentColor: '#6366f1', width: 16, height: 16 }} />
            <span style={{
              fontSize: 13, color: checked[i] ? '#4b5563' : '#e2e8f0',
              textDecoration: checked[i] ? 'line-through' : 'none', lineHeight: 1.5
            }}>{action}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
