import { useNavigate } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'

export default function RiskTierBanner() {
  const { riskTier, survivalDays } = useSession()
  const navigate = useNavigate()

  const configs = {
    Safe: {
      bg: 'rgba(0,229,192,0.1)',
      border: '1px solid rgba(0,229,192,0.3)',
      text: '#00e5c0',
      dot: '#00e5c0',
      msg: `You're on track — ${survivalDays.toFixed(1)} survival days remaining`,
      icon: '🛡️',
    },
    'Medium Risk': {
      bg: 'rgba(245,158,11,0.1)',
      border: '1px solid rgba(245,158,11,0.3)',
      text: '#f59e0b',
      dot: '#f59e0b',
      msg: `Watch your spending — ${survivalDays.toFixed(1)} days remaining`,
      icon: '⚠️',
    },
    'High Risk': {
      bg: 'rgba(239,68,68,0.12)',
      border: '1px solid rgba(239,68,68,0.4)',
      text: '#ef4444',
      dot: '#ef4444',
      msg: `Emergency mode — ${survivalDays.toFixed(1)} days remaining`,
      icon: '🚨',
    },
  }
  const c = configs[riskTier] || configs.Safe

  return (
    <div style={{
      background: c.bg,
      borderBottom: c.border,
      color: c.text,
      padding: '8px 24px',
      fontSize: 13,
      fontFamily: "'DM Sans', sans-serif",
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      position: 'relative',
      zIndex: 10,
    }}>
      <span>{c.icon}</span>
      <span style={{ flex: 1 }}>{c.msg}</span>
    </div>
  )
}
