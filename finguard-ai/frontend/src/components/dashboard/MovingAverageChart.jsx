import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const formatDayMonth = value => {
  const text = String(value || '')
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}-${match[2]}` : text
}

export default function MovingAverageChart({ daily = [], ma = [] }) {
  const merged = daily.map((d, i) => ({
    date: d.date, actual: d.amount, moving: ma[i]?.amount ?? null
  }))
  return (
    <div className="fg-card" style={{ padding: 20 }}>
      <span className="section-tag"><span className="dot" />Trend Analysis</span>
      <h3 style={{
        margin: '0 0 16px', color: '#f0f4ff',
        fontSize: 15, fontWeight: 800,
        fontFamily: "'Syne', sans-serif",
      }}>
        7-Day Moving Average
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={merged} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#7b82b0', fontFamily: 'DM Sans' }}
            tickFormatter={formatDayMonth}
            interval={4}
          />
          <YAxis tick={{ fontSize: 10, fill: '#7b82b0', fontFamily: 'DM Sans' }} />
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
            formatter={v => [`₹${v?.toFixed(0)}`, '']}
            labelFormatter={formatDayMonth}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: '#7b82b0', fontFamily: 'DM Sans' }} />
          <Line type="monotone" dataKey="actual" stroke="#0055ff" dot={false} name="Daily Spend" strokeWidth={1.5} />
          <Line type="monotone" dataKey="moving" stroke="#00e5c0" dot={false} name="7d Average" strokeWidth={2} strokeDasharray="5 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
