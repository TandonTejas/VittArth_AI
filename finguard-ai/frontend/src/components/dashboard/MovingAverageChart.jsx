import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function MovingAverageChart({ daily = [], ma = [] }) {
  const merged = daily.map((d, i) => ({
    date: d.date, actual: d.amount, moving: ma[i]?.amount ?? null
  }))
  return (
    <div style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 12, padding: 20 }}>
      <h3 style={{ margin: '0 0 16px', color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>7-Day Moving Average</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={merged} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={d => d.slice(5)} interval={4} />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
          <Tooltip contentStyle={{ background: '#1e2535', border: 'none', fontSize: 12 }}
            formatter={v => [`₹${v?.toFixed(0)}`, '']} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          <Line type="monotone" dataKey="actual"  stroke="#6366f1" dot={false} name="Daily Spend" strokeWidth={1.5} />
          <Line type="monotone" dataKey="moving"  stroke="#f59e0b" dot={false} name="7d Average"  strokeWidth={2} strokeDasharray="5 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
