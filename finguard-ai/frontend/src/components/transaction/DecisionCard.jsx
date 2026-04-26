import Badge from '../ui/Badge'
import SurvivalImpactChart from './SurvivalImpactChart'

const configs = {
  SPEND:   { bg: '#0a1f1a', accent: '#22c55e', icon: '✅', heading: 'Good to go' },
  PAUSE:   { bg: '#1a160a', accent: '#f59e0b', icon: '⚠️', heading: 'Hold on' },
  AVOID:   { bg: '#1a0a0a', accent: '#ef4444', icon: '🚫', heading: "Don't do it" },
  BLOCKED: { bg: '#1a0a0a', accent: '#ef4444', icon: '🔒', heading: 'Transaction Blocked' },
}

export default function DecisionCard({ result, onProceed, onCancel, loading }) {
  if (!result) return null
  const { decision, nudge_text, category, regret_probability, opportunity_cost,
    survival_before, survival_after, survival_delta, commitment_device, confidence_band } = result
  const c = configs[decision] || configs.PAUSE

  // ── HARD BLOCK: insufficient balance ──────────────────────────────────────
  if (decision === 'BLOCKED') {
    return (
      <div style={{ background: '#1a0a0a', border: '2px solid #ef4444', borderRadius: 12, padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48 }}>🔒</div>
          <h2 style={{ color: '#ef4444', margin: '10px 0 6px', fontSize: 22 }}>Transaction Blocked</h2>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Insufficient balance</p>
        </div>

        <div style={{
          background: '#0f1117', border: '1px solid #ef444455',
          borderRadius: 10, padding: '16px 20px', marginBottom: 20
        }}>
          <p style={{ color: '#fca5a5', fontSize: 14, margin: 0, lineHeight: 1.8 }}>
            {nudge_text}
          </p>
        </div>

        <div style={{ background: '#0f1117', borderRadius: 10, padding: '12px 16px',
          marginBottom: 20, fontSize: 13, color: '#64748b', textAlign: 'center' }}>
          💡 Reduce your transaction amount or top up your account balance to proceed.
        </div>

        <button onClick={onCancel} style={{
          width: '100%', padding: '12px', borderRadius: 8,
          background: '#374151', border: 'none', color: '#e2e8f0',
          fontSize: 14, fontWeight: 600, cursor: 'pointer'
        }}>
          Got it, go back
        </button>
      </div>
    )
  }

  // ── Normal SPEND / PAUSE / AVOID ──────────────────────────────────────────
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.accent}33`, borderRadius: 12, padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 40 }}>{c.icon}</div>
        <h2 style={{ color: c.accent, margin: '8px 0 4px', fontSize: 22 }}>{c.heading}</h2>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Badge label={category} variant="neutral" />
          <Badge label={`Regret: ${(regret_probability*100).toFixed(0)}%`}
            variant={regret_probability > 0.6 ? 'high' : regret_probability > 0.3 ? 'medium' : 'safe'} />
          <Badge label={confidence_band === 'wide' ? 'Wide CI' : 'Narrow CI'} variant="info" />
        </div>
      </div>

      <p style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>{nudge_text}</p>

      {/* Opportunity cost row */}
      <div style={{ background: '#0f1117', borderRadius: 8, padding: '10px 14px', fontSize: 12,
        color: '#94a3b8', marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>≈ {opportunity_cost?.meals}</span>
        <span>· {opportunity_cost?.work_hours}</span>
        <span>· −{survival_delta?.toFixed(1)} days runway</span>
      </div>

      {/* Commitment device box */}
      {commitment_device && (
        <div style={{ background: '#1a160a', border: '1px solid #f59e0b55', borderRadius: 8,
          padding: '10px 14px', fontSize: 12, color: '#fde68a', marginBottom: 16 }}>
          ⏱ 48-hour pause activated for late-night purchases. Come back tomorrow to proceed.
        </div>
      )}

      {/* Survival impact (PAUSE / AVOID) */}
      {decision !== 'SPEND' && (
        <SurvivalImpactChart before={survival_before} after={survival_after} delta={survival_delta} />
      )}

      {/* Survival callout for AVOID */}
      {decision === 'AVOID' && (
        <div style={{ background: '#1a0a0a', border: '1px solid #ef444455', borderRadius: 8,
          padding: '10px 14px', fontSize: 12, color: '#fca5a5', marginBottom: 16 }}>
          This reduces your runway from {survival_before?.toFixed(1)} → {survival_after?.toFixed(1)} days
          <span style={{ color: '#ef4444', fontWeight: 700 }}> (−{survival_delta?.toFixed(1)} days)</span>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        {decision === 'SPEND' && (
          <button onClick={onProceed} disabled={loading} style={btn('#22c55e')}>Confirm Purchase</button>
        )}
        {decision === 'PAUSE' && (
          <button onClick={onProceed} disabled={loading} style={btn('#f59e0b')}>Proceed Anyway</button>
        )}
        {decision === 'AVOID' && (
          <button onClick={onProceed} disabled={loading} style={btn('#ef4444', true)}>Override (Not Recommended)</button>
        )}
        <button onClick={onCancel} disabled={loading} style={btn('#374151')}>
          {decision === 'AVOID' ? 'Good call, cancel' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}

const btn = (bg, outline = false) => ({
  flex: 1, padding: '10px', borderRadius: 8, border: outline ? `1px solid ${bg}` : 'none',
  background: outline ? 'transparent' : bg,
  color: outline ? bg : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600
})

