import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#0055ff', '#00e5c0', '#f59e0b', '#ef4444', '#00b4ff', '#a855f7', '#ec4899', '#14b8a6', '#84cc16']
const MAX_VISIBLE_SLICES = 8

function titleCase(value) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

function categoryLabel(category = '') {
  const [, subcategory = category] = String(category).split(':')
  return titleCase(subcategory || 'Uncategorized')
}

function compactCategoryData(data) {
  const sorted = data
    .filter(d => Number(d.amount) > 0)
    .sort((a, b) => Number(b.amount) - Number(a.amount))

  const visible = sorted.slice(0, MAX_VISIBLE_SLICES)
  const rest = sorted.slice(MAX_VISIBLE_SLICES)

  if (!rest.length) {
    return visible.map(d => ({
      name: categoryLabel(d.category),
      rawName: d.category,
      value: Number(d.amount),
      regret: d.regret_prob ?? 0,
    }))
  }

  const otherTotal = rest.reduce((sum, d) => sum + Number(d.amount), 0)
  const weightedRegret = rest.reduce((sum, d) => sum + Number(d.amount) * (d.regret_prob ?? 0), 0)

  return [
    ...visible.map(d => ({
      name: categoryLabel(d.category),
      rawName: d.category,
      value: Number(d.amount),
      regret: d.regret_prob ?? 0,
    })),
    {
      name: 'Other Categories',
      rawName: `${rest.length} smaller categories`,
      value: otherTotal,
      regret: otherTotal > 0 ? weightedRegret / otherTotal : 0,
    },
  ]
}

export default function CategoryPieChart({ data = [] }) {
  const chartData = compactCategoryData(data)
  const total = chartData.reduce((sum, d) => sum + d.value, 0)

  if (!chartData.length) {
    return (
      <div className="fg-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
        <span className="section-tag"><span className="dot" />Category Split</span>
        <p style={{ color: '#7b82b0', fontSize: 13, marginTop: 24, textAlign: 'center' }}>
          No category data available yet.<br />Upload a bank statement to see your breakdown.
        </p>
      </div>
    )
  }

  return (
    <div className="fg-card category-pie-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <span className="section-tag"><span className="dot" />Category Split</span>
          <h3 style={{
            margin: '0', color: '#f0f4ff',
            fontSize: 18, fontWeight: 800,
            fontFamily: "'Syne', sans-serif",
          }}>
            Category Breakdown
          </h3>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ color: '#7b82b0', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>
            Total Spend
          </div>
          <div style={{ color: '#f0f4ff', fontSize: 20, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>
            ₹{Math.round(total).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <div className="category-pie-layout">
        <div className="category-pie-visual">
          <ResponsiveContainer width="100%" height={360}>
            <PieChart margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="48%"
                outerRadius="78%"
                paddingAngle={2}
                stroke="#0d0f2e"
                strokeWidth={2}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.92} />
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
                formatter={(v, n, p) => {
                  const regret = p?.payload?.regret
                  const pct = total > 0 ? Number(v) / total * 100 : 0
                  const regretStr = (regret != null && !isNaN(regret))
                    ? ` · Regret ${(regret * 100).toFixed(0)}%`
                    : ''
                  return [`₹${Number(v).toLocaleString('en-IN')} (${pct.toFixed(1)}%)${regretStr}`, n]
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="category-pie-center">
            <span>{chartData.length}</span>
            <small>groups</small>
          </div>
        </div>

        <div className="category-pie-legend">
          {chartData.map((item, i) => {
            const percentage = total > 0 ? item.value / total * 100 : 0
            return (
              <div className="category-pie-row" key={`${item.name}-${i}`}>
                <div className="category-pie-row-main">
                  <span className="category-pie-dot" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="category-pie-name" title={item.rawName}>{item.name}</span>
                </div>
                <div className="category-pie-row-meta">
                  <span>₹{Math.round(item.value).toLocaleString('en-IN')}</span>
                  <strong>{percentage.toFixed(1)}%</strong>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
