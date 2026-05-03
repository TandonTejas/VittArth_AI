import { useState } from 'react'

const regretColor = r => r > 0.6 ? '#ef4444' : r > 0.3 ? '#f59e0b' : '#00e5c0'

export default function CategoryRegretTable({ data = [] }) {
  const [sort, setSort] = useState('regret_prob')
  const sorted = [...data].sort((a, b) => b[sort] - a[sort])

  const th = {
    padding: '10px 14px',
    fontSize: '0.72rem',
    color: '#00e5c0',
    fontWeight: 700,
    textAlign: 'left',
    cursor: 'pointer',
    userSelect: 'none',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    fontFamily: "'Syne', sans-serif",
    transition: 'color 0.2s',
  }
  const td = {
    padding: '12px 14px',
    fontSize: 13,
    color: '#b0b8d4',
    borderTop: '1px solid rgba(0,180,255,0.08)',
    fontFamily: "'DM Sans', sans-serif",
  }

  return (
    <div className="fg-card" style={{ overflow: 'hidden' }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(0,180,255,0.1)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span className="section-tag"><span className="dot" />Regret Analysis</span>
        <h3 style={{
          margin: 0, color: '#f0f4ff',
          fontSize: 15, fontWeight: 800,
          fontFamily: "'Syne', sans-serif",
          flex: 1,
        }}>
          Category Regret Profile
        </h3>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(5,6,26,0.4)' }}>
            {[['Category','category'],['Txns','count'],['Avg ₹','avg_amount'],['Regret %','regret_prob'],['Overrides','overrides']]
              .map(([l, k]) => (
                <th
                  key={k}
                  style={{ ...th, color: sort === k ? '#00b4ff' : '#7b82b0' }}
                  onClick={() => setSort(k)}
                >
                  {l} {sort === k ? '↓' : '↕'}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={i}
              style={{ background: i % 2 ? 'rgba(0,180,255,0.02)' : 'transparent', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,180,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 ? 'rgba(0,180,255,0.02)' : 'transparent'}
            >
              <td style={{ ...td, color: '#f0f4ff', fontWeight: 500 }}>{r.category}</td>
              <td style={td}>{r.count}</td>
              <td style={{ ...td, color: '#b0b8d4' }}>₹{r.avg_amount?.toFixed(0)}</td>
              <td style={{ ...td }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: regretColor(r.regret_prob),
                    boxShadow: `0 0 5px ${regretColor(r.regret_prob)}`,
                    flexShrink: 0,
                  }} />
                  <span style={{ color: regretColor(r.regret_prob), fontWeight: 600 }}>
                    {(r.regret_prob * 100).toFixed(0)}%
                  </span>
                </div>
              </td>
              <td style={td}>{r.overrides}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
