import { useState, useEffect } from 'react'

const SK = 'fg_crisis_checks'

export default function CrisisChecklist({ actions = [], shortfall = 0 }) {
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SK) || '{}') } catch { return {} }
  })

  useEffect(() => { localStorage.setItem(SK, JSON.stringify(checked)) }, [checked])

  const toggle = i => setChecked(p => ({ ...p, [i]: !p[i] }))
  const doneCount = Object.values(checked).filter(Boolean).length

  return (
    <div>
      {shortfall > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20,
          color: '#fca5a5', fontSize: 14,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          You are <strong style={{ color: '#ef4444' }}>₹{shortfall.toLocaleString('en-IN')}</strong> short of covering fixed expenses.
        </div>
      )}

      {/* Progress bar */}
      {actions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#7b82b0', fontFamily: "'DM Sans',sans-serif", textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Progress
            </span>
            <span style={{ fontSize: 11, color: '#00e5c0', fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>
              {doneCount}/{actions.length} done
            </span>
          </div>
          <div style={{ background: 'rgba(0,180,255,0.08)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
            <div style={{
              width: `${(doneCount / actions.length) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #0055ff, #00e5c0)',
              borderRadius: 6,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {actions.map((action, i) => (
          <label
            key={i}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              cursor: 'pointer',
              background: checked[i] ? 'rgba(0,229,192,0.05)' : 'rgba(0,180,255,0.04)',
              border: `1px solid ${checked[i] ? 'rgba(0,229,192,0.2)' : 'rgba(0,180,255,0.1)'}`,
              borderRadius: 10, padding: '12px 16px',
              transition: 'all 0.25s',
            }}
            onMouseEnter={e => { if (!checked[i]) e.currentTarget.style.borderColor = 'rgba(0,180,255,0.25)' }}
            onMouseLeave={e => { if (!checked[i]) e.currentTarget.style.borderColor = 'rgba(0,180,255,0.1)' }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: 5,
              border: `2px solid ${checked[i] ? '#00e5c0' : 'rgba(0,180,255,0.3)'}`,
              background: checked[i] ? '#00e5c0' : 'transparent',
              flexShrink: 0, marginTop: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}>
              {checked[i] && <span style={{ fontSize: 11, color: '#05061a', fontWeight: 900 }}>✓</span>}
            </div>
            <input type="checkbox" checked={!!checked[i]} onChange={() => toggle(i)} style={{ display: 'none' }} />
            <span style={{
              fontSize: 13, lineHeight: 1.6,
              color: checked[i] ? '#7b82b0' : '#b0b8d4',
              textDecoration: checked[i] ? 'line-through' : 'none',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'color 0.2s',
            }}>
              {action}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
