import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#a855f7','#ec4899','#14b8a6']

export default function CategoryPieChart({ data = [] }) {
  const chartData = data.map(d => ({ name: d.category, value: d.amount, regret: d.regret_prob }))
  return (
    <div style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 12, padding: 20 }}>
      <h3 style={{ margin: '0 0 16px', color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Category Breakdown</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%"
            innerRadius={50} outerRadius={80} paddingAngle={2}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: '#1e2535', border: 'none', fontSize: 12 }}
            formatter={(v, n, p) => [`₹${v.toFixed(0)} (Regret: ${(p.payload.regret * 100).toFixed(0)}%)`, n]} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
