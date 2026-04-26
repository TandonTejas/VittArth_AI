import { useState, useEffect } from 'react'
import { getDashboard } from '../api/client'
import { useSession } from '../context/SessionContext'
import MetricCard        from '../components/dashboard/MetricCard'
import SpendingBarChart  from '../components/dashboard/SpendingBarChart'
import CategoryPieChart  from '../components/dashboard/CategoryPieChart'
import MovingAverageChart from '../components/dashboard/MovingAverageChart'
import CategoryRegretTable from '../components/dashboard/CategoryRegretTable'
import Badge    from '../components/ui/Badge'
import Spinner  from '../components/ui/Spinner'
import ErrorAlert from '../components/ui/ErrorAlert'
import EmptyState from '../components/ui/EmptyState'
import { RefreshCw, Upload } from 'lucide-react'

export default function Dashboard() {
  const { sessionId, setBalance, setRiskTier, setSurvivalDays, balance } = useSession()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const [session] = useState(() => JSON.parse(localStorage.getItem('fg_onboard') || '{}'))
  const dailyTarget = session.daily_target || 0

  async function load() {
    setLoading(true); setError(null)
    try {
      const d = await getDashboard(sessionId)
      setData(d)
      setBalance(d.balance)
      setRiskTier(d.risk_tier)
      setSurvivalDays(d.survival_days)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading && !data) return <Spinner message="Loading dashboard…" />
  if (error && !data)   return <ErrorAlert message="Failed to load dashboard" details={error} />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, color: '#f1f5f9', fontSize: 22, fontWeight: 700 }}>Dashboard</h1>
        <button onClick={load} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: '#1e2535',
          border: 'none', borderRadius: 8, color: '#94a3b8', padding: '8px 14px',
          cursor: 'pointer', fontSize: 13
        }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Risk tier badge */}
      {data && (
        <div style={{ textAlign: 'center', marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {data.balance <= 0 && (
            <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '12px 24px', borderRadius: 8, fontWeight: 600, width: '100%', maxWidth: 600 }}>
              ⚠ Your balance is critically low (₹0 or below). Please avoid non-essential spending.
            </div>
          )}
          <Badge label={data.risk_tier} variant={data.risk_tier === 'Safe' ? 'safe' : data.risk_tier === 'Medium Risk' ? 'medium' : 'high'} />
        </div>
      )}

      {/* Metric cards */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <MetricCard label="Current Balance" value={`₹${data.balance?.toLocaleString('en-IN')}`} subtext="account" />
          <MetricCard label="Survival Days" value={`${data.survival_days?.toFixed(1)} days`}
            trend={data.survival_days > 14 ? '↑ Safe' : data.survival_days > 7 ? '⚠ Watch' : '↓ Critical'}
            trendDirection={data.survival_days > 14 ? 'up' : 'down'} />
          <MetricCard label="Daily Spend Rate" value={`₹${data.daily_spend_rate?.toFixed(0)}/day`}
            trend={data.daily_spend_rate > dailyTarget ? '▲ Over target' : '✓ On target'}
            trendDirection={data.daily_spend_rate > dailyTarget ? 'down' : 'up'} />
          <MetricCard label="Days Until Month End" value={`${data.days_until_month_end} days`} subtext="remaining" />
        </div>
      )}

      {/* Charts row */}
      {data && (
        data.daily_spend_history?.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <SpendingBarChart data={data.daily_spend_history} dailyTarget={dailyTarget} />
            <CategoryPieChart data={data.category_breakdown} />
          </div>
        ) : (
          <div style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 12, marginBottom: 16 }}>
            <EmptyState icon={<Upload size={32} />} title="No Chart Data Yet" description="Upload your bank statement to see spending charts and categories." />
          </div>
        )
      )}

      {/* Full-width moving average */}
      {data && (
        <div style={{ marginBottom: 16 }}>
          <MovingAverageChart daily={data.daily_spend_history} ma={data.moving_average_7d} />
        </div>
      )}

      {/* Regret table */}
      {data && data.category_regret_table?.length > 0 && (
        <CategoryRegretTable data={data.category_regret_table} />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
