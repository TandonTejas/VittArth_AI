import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'

export default function SpendingBarChart({ data = [], dailyTarget = 0 }) {
  return (
    <div style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 12, padding: 20 }}>
      <h3 style={{ margin: '0 0 16px', color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Daily Spending — Last 30 Days</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={d => d.slice(5)} interval={4} />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
          <Tooltip contentStyle={{ background: '#1e2535', border: 'none', fontSize: 12 }}
            formatter={v => [`₹${v}`, 'Spend']} />
          {dailyTarget > 0 && <ReferenceLine y={dailyTarget} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Target', fill: '#f59e0b', fontSize: 10 }} />}
          <Bar dataKey="amount" radius={[3,3,0,0]}>
            {data.map((d, i) => <Cell key={i} fill={d.amount > dailyTarget ? '#ef4444' : '#6366f1'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
