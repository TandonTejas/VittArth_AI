import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'

const formatDayMonth = value => {
  const text = String(value || '')
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}-${match[2]}` : text
}

export default function SpendingBarChart({ data = [], dailyTarget = 0, height = 240 }) {
  return (
    <div className="fg-card" style={{ padding: 24 }}>
      <span className="section-tag"><span className="dot" />30-Day View</span>
      <h3 style={{
        margin: '0 0 18px', color: '#f0f4ff',
        fontSize: 18, fontWeight: 800,
        fontFamily: "'Syne', sans-serif",
      }}>
        Daily Spending
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 18, left: 4, bottom: 8 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#7b82b0', fontFamily: 'DM Sans' }}
            tickFormatter={formatDayMonth}
            interval={data.length > 18 ? 2 : 0}
            minTickGap={10}
          />
          <YAxis tick={{ fontSize: 11, fill: '#7b82b0', fontFamily: 'DM Sans' }} width={54} />
          <Tooltip
            contentStyle={{
              background: '#0d0f2e',
              border: '1px solid rgba(0,180,255,0.2)',
              borderRadius: 10,
              fontSize: 12,
              fontFamily: 'DM Sans',
              color: '#f0f4ff',
            }}
            labelStyle={{ color: '#dbeafe', fontWeight: 800, marginBottom: 6 }}
            itemStyle={{ color: '#c5ccef', fontWeight: 700 }}
            formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, 'Spend']}
            labelFormatter={formatDayMonth}
          />
          {dailyTarget > 0 && (
            <ReferenceLine
              y={dailyTarget}
              stroke="#f59e0b"
              strokeDasharray="4 2"
              label={{ value: 'Target', fill: '#f59e0b', fontSize: 10 }}
            />
          )}
          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.amount > dailyTarget ? '#ef4444' : '#0055ff'}
                opacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
