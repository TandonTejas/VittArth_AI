import { useState } from 'react'

const regretColor = r => r > 0.6 ? '#ef4444' : r > 0.3 ? '#f59e0b' : '#22c55e'

export default function CategoryRegretTable({ data = [] }) {
  const [sort, setSort] = useState('regret_prob')
  const sorted = [...data].sort((a, b) => b[sort] - a[sort])

  const th = { padding: '8px 12px', fontSize: 11, color: '#64748b', fontWeight: 600,
    textAlign: 'left', cursor: 'pointer', userSelect: 'none' }
  const td = { padding: '10px 12px', fontSize: 13, color: '#e2e8f0', borderTop: '1px solid #1e2535' }

  return (
    <div style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2535' }}>
        <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Category Regret Profile</h3>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#0f1117' }}>
            {[['Category','category'],['Txns','count'],['Avg ₹','avg_amount'],['Regret %','regret_prob'],['Overrides','overrides']]
              .map(([l, k]) => (
                <th key={k} style={{ ...th, color: sort === k ? '#6366f1' : '#64748b' }} onClick={() => setSort(k)}>{l} ↕</th>
              ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i} style={{ background: i % 2 ? '#0f1117' : 'transparent' }}>
              <td style={td}>{r.category}</td>
              <td style={td}>{r.count}</td>
              <td style={td}>₹{r.avg_amount?.toFixed(0)}</td>
              <td style={{ ...td, color: regretColor(r.regret_prob), fontWeight: 600 }}>
                {(r.regret_prob * 100).toFixed(0)}%
              </td>
              <td style={td}>{r.overrides}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
