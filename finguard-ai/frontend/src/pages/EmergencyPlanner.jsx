import { useState, useEffect } from 'react'
import { getEmergencyBudget } from '../api/client'
import { useSession } from '../context/SessionContext'
import BudgetDonutChart from '../components/planner/BudgetDonutChart'
import CrisisChecklist  from '../components/planner/CrisisChecklist'
import EmptyState       from '../components/ui/EmptyState'
import Spinner          from '../components/ui/Spinner'
import ErrorAlert       from '../components/ui/ErrorAlert'
import { useNavigate }  from 'react-router-dom'

export default function EmergencyPlanner() {
  const { sessionId, survivalDays } = useSession()
  const navigate = useNavigate()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    getEmergencyBudget(sessionId)
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner message="Computing emergency budget…" />
  if (error)   return <ErrorAlert message="Failed to load emergency planner" details={error} />

  if (!data?.active) return (
    <EmptyState icon="🛡️" title="You're Safe"
      description={`You have ${data?.survival_days?.toFixed(1) ?? survivalDays.toFixed(1)} days of financial runway. Emergency planner is not needed.`}
      actionLabel="Back to Dashboard" onAction={() => navigate('/dashboard')} />
  )

  const isCrisis = data.status === 'crisis'
  const pct = v => data.total_daily > 0 ? ((v / data.total_daily) * 100).toFixed(0) + '%' : '—'

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', color: isCrisis ? '#ef4444' : '#f97316', fontSize: 22, fontWeight: 700 }}>
          {isCrisis ? '🚨 Crisis Mode' : '🆘 Emergency Budget Mode'}
        </h1>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>
          {isCrisis
            ? 'No feasible budget exists. Take action now.'
            : `Your survival window: ${data.survival_days?.toFixed(1)} days. Here's your bare-minimum plan.`}
        </p>
      </div>

      {isCrisis ? (
        <CrisisChecklist actions={data.crisis_actions} shortfall={0} />
      ) : (
        <div>
          {/* Donut chart */}
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, marginBottom: 24, alignItems: 'center' }}>
            <BudgetDonutChart
              food={data.daily_food} travel={data.daily_travel}
              discretionary={data.daily_discretionary} total={data.total_daily} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Food', icon: '🍱', val: data.daily_food,         color: '#22c55e' },
                { label: 'Travel', icon: '🚌', val: data.daily_travel,     color: '#6366f1' },
                { label: 'Discretionary', icon: '☕', val: data.daily_discretionary, color: '#f59e0b' },
              ].map(({ label, icon, val, color }) => (
                <div key={label} style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color }}> ₹{val}/day</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{pct(val)} of budget</div>
                </div>
              ))}
            </div>
          </div>

          {/* Projected outcome */}
          <div style={{ background: '#0a1f1a', border: '1px solid #22c55e44', borderRadius: 10, padding: '16px 20px', fontSize: 14, color: '#bbf7d0' }}>
            Following this plan extends your runway to <strong>{data.projected_survival_days?.toFixed(1)} days</strong>
          </div>
        </div>
      )}
    </div>
  )
}
