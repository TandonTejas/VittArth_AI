import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = { Food: '#00e5c0', Travel: '#0055ff', Discretionary: '#f59e0b' }

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
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={90}
            paddingAngle={3}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} opacity={0.9} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#0d0f2e',
              border: '1px solid rgba(0,180,255,0.2)',
              borderRadius: 10,
              fontSize: 12,
              fontFamily: 'DM Sans',
              color: '#f0f4ff',
            }}
            formatter={v => [`₹${v}/day`, '']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        textAlign: 'center', pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 18, fontWeight: 800,
          fontFamily: "'Syne', sans-serif",
          background: 'linear-gradient(120deg, #00b4ff, #00e5c0)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          ₹{total}/day
        </div>
        <div style={{ fontSize: 10, color: '#7b82b0', letterSpacing: '0.15em', fontFamily: 'DM Sans' }}>
          TOTAL
        </div>
      </div>
    </div>
  )
}
