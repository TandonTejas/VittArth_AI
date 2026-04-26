import { useNavigate } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'

export default function RiskTierBanner() {
  const { riskTier, survivalDays } = useSession()
  const navigate = useNavigate()

  const configs = {
    Safe:          { bg: '#14532d', text: '#bbf7d0', msg: `You're on track — ${survivalDays.toFixed(1)} survival days remaining` },
    'Medium Risk': { bg: '#78350f', text: '#fde68a', msg: `Watch your spending — ${survivalDays.toFixed(1)} days remaining` },
    'High Risk':   { bg: '#7f1d1d', text: '#fecaca', msg: `Emergency mode — ${survivalDays.toFixed(1)} days remaining`, action: true },
  }
  const c = configs[riskTier] || configs.Safe

  return (
    <div style={{
      background: c.bg, color: c.text,
      padding: '8px 24px', fontSize: 13, fontWeight: 500,
      display: 'flex', alignItems: 'center', gap: 12
    }}>
      <span>{c.msg}</span>
      {c.action && (
        <button onClick={() => navigate('/emergency')} style={{
          background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 6,
          color: c.text, padding: '2px 10px', cursor: 'pointer', fontSize: 12
        }}>
          View Emergency Planner →
        </button>
      )}
    </div>
  )
}
