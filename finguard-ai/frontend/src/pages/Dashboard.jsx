import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { RefreshCw, Upload } from 'lucide-react'

/* ── Floating Finance SVGs ─────────────────────────────────────────────── */
const DashFloatingGraphics = () => (
  <>
    <svg style={{ position: 'absolute', top: '5%', right: '2%', width: 90, opacity: 0.07, animation: 'floatGraphic 9s ease-in-out infinite', animationDelay: '0.5s', pointerEvents: 'none' }} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="36" stroke="#00b4ff" strokeWidth="2.5"/>
      <text x="40" y="50" textAnchor="middle" fill="#00b4ff" fontSize="28" fontWeight="bold" fontFamily="sans-serif">₹</text>
    </svg>
    <svg style={{ position: 'absolute', bottom: '20%', right: '4%', width: 80, opacity: 0.08, animation: 'floatGraphic 11s ease-in-out infinite', animationDelay: '2s', pointerEvents: 'none' }} viewBox="0 0 70 80" fill="none">
      <path d="M35 5 L60 15 L60 40 Q60 62 35 75 Q10 62 10 40 L10 15 Z" stroke="#00e5c0" strokeWidth="2.5" fill="none"/>
    </svg>
    <svg style={{ position: 'absolute', top: '40%', right: '1%', width: 70, opacity: 0.07, animation: 'floatGraphic 8s ease-in-out infinite', animationDelay: '3.5s', pointerEvents: 'none' }} viewBox="0 0 80 80" fill="none">
      <path d="M40 65 L40 20 M25 35 L40 18 L55 35" stroke="#0055ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </>
)

/* ── Progress Bar hook ─────────────────────────────────────────────────── */
function useProgressBar() {
  useEffect(() => {
    const bar = document.getElementById('progress-bar')
    if (!bar) return
    const update = () => {
      const scrolled = window.scrollY
      const total = document.body.scrollHeight - window.innerHeight
      bar.style.width = total > 0 ? `${(scrolled / total) * 100}%` : '0%'
    }
    window.addEventListener('scroll', update, { passive: true })
    return () => { window.removeEventListener('scroll', update); if (bar) bar.style.width = '0%' }
  }, [])
}

/* ── Scroll-reveal hook ────────────────────────────────────────────────── */
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          observer.unobserve(entry.target)
        }
      }),
      { threshold: 0.1 }
    )
    const els = document.querySelectorAll('.reveal')
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  })
}

/* ── Marquee Strip ─────────────────────────────────────────────────────── */
const MarqueeStrip = () => {
  const text = 'AI-Powered Decisions  ✦  Track Every Rupee  ✦  Know Your Runway  ✦  Spend Smarter  ✦  Protect Your Future  ✦  '
  return (
    <div className="marquee-strip">
      <div className="marquee-track">
        <span className="marquee-content">{text}{text}</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { sessionId, setSessionId, setIsOnboarded, setBalance, setRiskTier, setSurvivalDays } = useSession()
  const navigate = useNavigate()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const [session] = useState(() => JSON.parse(localStorage.getItem('fg_onboard') || '{}'))
  const dailyTarget = session.daily_target || 0

  useProgressBar()
  useScrollReveal()

  const load = useCallback(async () => {
    if (!sessionId) {
      navigate('/onboarding', { replace: true })
      return
    }
    setLoading(true); setError(null)
    try {
      const d = await getDashboard(sessionId)
      setData(d)
      setBalance(d.balance)
      setRiskTier(d.risk_tier)
      setSurvivalDays(d.survival_days)
    } catch (e) {
      const message = e.message || ''
      if (message.includes('Session') && message.includes('not found')) {
        localStorage.removeItem('fg_session')
        setSessionId(null)
        setIsOnboarded(false)
        navigate('/onboarding', { replace: true })
        return
      }
      setError(message)
    }
    finally { setLoading(false) }
  }, [navigate, sessionId, setBalance, setIsOnboarded, setRiskTier, setSessionId, setSurvivalDays])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  if (loading && !data) return <Spinner message="Loading dashboard…" />
  if (error && !data)   return <ErrorAlert message="Failed to load dashboard" details={error} />

  return (
    <div style={{ position: 'relative' }}>
      {/* Progress Bar */}
      <div id="progress-bar" />

      {/* Marquee */}
      <div className="reveal">
        <MarqueeStrip />
      </div>

      {/* Floating background graphics */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <DashFloatingGraphics />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header row */}
        <div className="reveal" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, marginTop: 8 }}>
          <div>
            <span className="section-tag"><span className="dot" />Your Financial Health</span>
            <h1 style={{
              margin: '6px 0 0',
              color: '#f0f4ff',
              fontSize: 'clamp(2rem, 4vw, 3.2rem)',
              fontWeight: 800,
              fontFamily: "'Syne', sans-serif",
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}>
              Dashboard
            </h1>
          </div>
          <button onClick={load} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(13,15,46,0.85)',
            border: '1px solid rgba(0,180,255,0.18)',
            borderRadius: 10, color: '#7b82b0',
            padding: '9px 16px', cursor: 'pointer', fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s',
            marginTop: 8,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,180,255,0.4)'; e.currentTarget.style.color = '#00b4ff' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,180,255,0.18)'; e.currentTarget.style.color = '#7b82b0' }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* Risk badge */}
        {data && (
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {data.balance <= 0 && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5', padding: '12px 24px',
                borderRadius: 10, fontWeight: 600,
                width: '100%', maxWidth: 600,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
              }}>
                ⚠ Your balance is critically low (₹0 or below). Please avoid non-essential spending.
              </div>
            )}
            <Badge label={data.risk_tier} variant={data.risk_tier === 'Safe' ? 'safe' : data.risk_tier === 'Medium Risk' ? 'medium' : 'high'} />
          </div>
        )}

        {/* Metric cards */}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Current Balance', value: `₹${data.balance?.toLocaleString('en-IN')}`, subtext: 'account' },
              { label: 'Survival Days', value: `${data.survival_days?.toFixed(1)} days`,
                trend: data.survival_days > 14 ? '↑ Safe' : data.survival_days > 7 ? '⚠ Watch' : '↓ Critical',
                trendDirection: data.survival_days > 14 ? 'up' : 'down' },
              { label: 'Daily Spend Rate', value: `₹${data.daily_spend_rate?.toFixed(0)}/day`,
                trend: data.daily_spend_rate > dailyTarget ? '▲ Over target' : '✓ On target',
                trendDirection: data.daily_spend_rate > dailyTarget ? 'down' : 'up' },
              { label: 'Days Until Month End', value: `${data.days_until_month_end} days`, subtext: 'remaining' },
            ].map((card, i) => (
              <div key={i} className="reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
                <MetricCard {...card} />
              </div>
            ))}
          </div>
        )}

        {/* Daily spending — full width */}
        {data && (
          <div className="reveal" style={{ marginBottom: 16 }}>
            {data.daily_spend_history?.length > 0 ? (
              <SpendingBarChart data={data.daily_spend_history} dailyTarget={dailyTarget} height={320} />
            ) : (
              <div className="fg-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
                <Upload size={32} color="#7b82b0" />
                <p style={{ color: '#7b82b0', fontSize: 13, marginTop: 12, textAlign: 'center' }}>
                  No recent spend data.<br />
                  <span style={{ fontSize: 11, opacity: 0.7 }}>Transactions from the last 30 days will appear here.</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Category breakdown — full width */}
        {data && (
          <div className="reveal" style={{ marginBottom: 16 }}>
            <CategoryPieChart data={data.category_breakdown} />
          </div>
        )}

        {/* Moving average */}
        {data && data.daily_spend_history?.length > 0 && (
          <div className="reveal" style={{ marginBottom: 16 }}>
            <MovingAverageChart daily={data.daily_spend_history} ma={data.moving_average_7d} />
          </div>
        )}

        {/* Regret table */}
        {data && data.category_regret_table?.length > 0 && (
          <div className="reveal">
            <CategoryRegretTable data={data.category_regret_table} />
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
