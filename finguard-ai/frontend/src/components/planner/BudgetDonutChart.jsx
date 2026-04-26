import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = { Food: '#22c55e', Travel: '#6366f1', Discretionary: '#f59e0b' }

export default function BudgetDonutChart({ food, travel, discretionary, total }) {
  const data = [
    { name: 'Food',          value: food,          color: COLORS.Food },
    { name: 'Travel',        value: travel,        color: COLORS.Travel },
    { name: 'Discretionary', value: discretionary, color: COLORS.Discretionary },
  ].filter(d => d.value > 0)

  return (
    <div style={{ position: 'relative', width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={3}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip contentStyle={{ background: '#1e2535', border: 'none', fontSize: 12 }}
            formatter={v => [`₹${v}/day`, '']} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>₹{total}/day</div>
        <div style={{ fontSize: 10, color: '#64748b' }}>TOTAL</div>
      </div>
    </div>
  )
}
