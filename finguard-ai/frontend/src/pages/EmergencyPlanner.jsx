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
  }, [sessionId])

  if (loading) return <Spinner message="Computing emergency budget…" />
  if (error)   return <ErrorAlert message="Failed to load emergency planner" details={error} />

  if (!data?.active) return (
    <EmptyState icon="🛡️" title="You're Safe"
      description={`You have ${data?.survival_days?.toFixed(1) ?? survivalDays.toFixed(1)} days of financial runway. Emergency planner is not needed.`}
      actionLabel="Back to Dashboard" onAction={() => navigate('/dashboard')} />
  )

  const isCrisis = data.status === 'crisis'
  const pct = v => data.total_daily > 0 ? ((v / data.total_daily) * 100).toFixed(0) + '%' : '—'
  const accentColor = isCrisis ? '#ef4444' : '#f97316'

  return (
    <div style={{ position: 'relative' }}>
      {/* Floating piggy bank SVG */}
      <svg style={{ position: 'absolute', top: '5%', right: '3%', width: 130, opacity: 0.08, pointerEvents: 'none', animation: 'floatGraphic 9s ease-in-out infinite' }} viewBox="0 0 100 100" fill="none">
        <ellipse cx="50" cy="55" rx="32" ry="26" stroke={accentColor} strokeWidth="2.5"/>
        <ellipse cx="78" cy="52" rx="8" ry="7" stroke={accentColor} strokeWidth="2.5"/>
        <path d="M32 38 Q50 20 68 38" stroke={accentColor} strokeWidth="2.5" fill="none"/>
        <rect x="44" y="18" width="12" height="6" rx="3" stroke={accentColor} strokeWidth="2"/>
        <circle cx="70" cy="50" r="2.5" fill={accentColor}/>
      </svg>

      {/* Orb */}
      <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: isCrisis ? 'radial-gradient(circle,rgba(239,68,68,0.12) 0%,transparent 65%)' : 'radial-gradient(circle,rgba(245,158,11,0.1) 0%,transparent 65%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 28 }}>
          <span className="section-tag" style={{ borderColor: `${accentColor}55`, color: accentColor }}>
            <span className="dot" style={{ background: accentColor }} />
            {isCrisis ? 'Crisis Mode Active' : 'Emergency Budget Mode'}
          </span>
          <h1 style={{ margin: '6px 0 6px', color: accentColor, fontSize: 'clamp(2rem,4vw,3.2rem)', fontWeight: 800, fontFamily: "'Syne',sans-serif", letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            {isCrisis ? '🚨 Crisis Mode' : '🆘 Emergency Budget'}
          </h1>
          <p style={{ margin: 0, color: '#7b82b0', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>
            {isCrisis ? 'No feasible budget exists. Take action now.' : `Your survival window: ${data.survival_days?.toFixed(1)} days. Here's your bare-minimum plan.`}
          </p>
        </div>

        {isCrisis ? (
          <CrisisChecklist actions={data.crisis_actions} shortfall={0} />
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, marginBottom: 24, alignItems: 'center' }}>
              <div className="fg-card" style={{ padding: 16 }}>
                <BudgetDonutChart food={data.daily_food} travel={data.daily_travel} discretionary={data.daily_discretionary} total={data.total_daily} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Food', icon: '🍱', val: data.daily_food, color: '#00e5c0' },
                  { label: 'Travel', icon: '🚌', val: data.daily_travel, color: '#0055ff' },
                  { label: 'Discretionary', icon: '☕', val: data.daily_discretionary, color: '#f59e0b' },
                ].map(({ label, icon, val, color }) => (
                  <div key={label} className="fg-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: `${color}22`, transition: 'all 0.3s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}55`; e.currentTarget.style.transform = 'translateX(4px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = `${color}22`; e.currentTarget.style.transform = 'translateX(0)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 24 }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: 11, color: '#7b82b0', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: "'DM Sans',sans-serif" }}>{label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'Syne',sans-serif" }}>₹{val}/day</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#7b82b0', background: 'rgba(0,180,255,0.06)', border: '1px solid rgba(0,180,255,0.1)', borderRadius: 8, padding: '4px 10px', fontFamily: "'DM Sans',sans-serif" }}>
                      {pct(val)} of budget
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'rgba(0,229,192,0.07)', border: '1px solid rgba(0,229,192,0.25)', borderRadius: 12, padding: '16px 22px', fontSize: 14, color: '#a7f3d0', fontFamily: "'DM Sans',sans-serif" }}>
              Following this plan extends your runway to <strong style={{ color: '#00e5c0', fontFamily: "'Syne',sans-serif" }}>{data.projected_survival_days?.toFixed(1)} days</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
