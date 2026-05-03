import Badge from '../ui/Badge'
import SurvivalImpactChart from './SurvivalImpactChart'

const configs = {
  SPEND:   { border: '#00e5c0', glow: 'rgba(0,229,192,0.2)',  icon: '✅', heading: 'Good to go',          badgeBg: 'linear-gradient(135deg,#00e5c0,#0055ff)' },
  PAUSE:   { border: '#f59e0b', glow: 'rgba(245,158,11,0.2)', icon: '⚠️', heading: 'Hold on',              badgeBg: 'linear-gradient(135deg,#f59e0b,#f97316)' },
  AVOID:   { border: '#ef4444', glow: 'rgba(239,68,68,0.2)',  icon: '🚫', heading: "Don't do it",          badgeBg: 'linear-gradient(135deg,#ef4444,#b91c1c)' },
  BLOCKED: { border: '#ef4444', glow: 'rgba(239,68,68,0.2)',  icon: '🔒', heading: 'Transaction Blocked',  badgeBg: 'linear-gradient(135deg,#ef4444,#b91c1c)' },
}

export default function DecisionCard({ result, onProceed, onCancel, loading }) {
  if (!result) return null
  const { decision, nudge_text, category, regret_probability, opportunity_cost,
    survival_before, survival_after, survival_delta, commitment_device, confidence_band } = result
  const c = configs[decision] || configs.PAUSE
  const recorded = Boolean(result.recorded)

  // ── HARD BLOCK ─────────────────────────────────────────────────────────────
  if (decision === 'BLOCKED') {
    return (
      <div style={{
        background: 'rgba(13,15,46,0.85)',
        border: `2px solid ${c.border}`,
        borderRadius: 20,
        padding: 28,
        backdropFilter: 'blur(16px)',
        boxShadow: `0 0 40px ${c.glow}`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* glow orb */}
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 200, height: 200, borderRadius: '50%',
          background: `radial-gradient(circle, ${c.glow} 0%, transparent 65%)`,
          filter: 'blur(30px)', pointerEvents: 'none',
        }} />

        <div style={{ textAlign: 'center', marginBottom: 20, position: 'relative' }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🔒</div>
          <h2 style={{
            color: c.border, margin: '0 0 6px',
            fontSize: 22, fontFamily: "'Syne', sans-serif", fontWeight: 800,
          }}>Transaction Blocked</h2>
          <p style={{ color: '#7b82b0', fontSize: 13, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
            Insufficient balance
          </p>
        </div>

        <div style={{
          background: 'rgba(5,6,26,0.6)',
          border: `1px solid ${c.border}44`,
          borderRadius: 12, padding: '16px 20px', marginBottom: 20,
        }}>
          <p style={{ color: '#fca5a5', fontSize: 14, margin: 0, lineHeight: 1.8, fontFamily: "'DM Sans', sans-serif" }}>
            {nudge_text}
          </p>
        </div>

        <div style={{
          background: 'rgba(5,6,26,0.4)',
          borderRadius: 10, padding: '12px 16px',
          marginBottom: 20, fontSize: 13,
          color: '#7b82b0', textAlign: 'center',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          💡 Reduce your transaction amount or top up your account balance to proceed.
        </div>

        <button onClick={onCancel} style={btn('#374151')}>
          Got it, go back
        </button>
      </div>
    )
  }

  // ── Normal SPEND / PAUSE / AVOID ───────────────────────────────────────────
  return (
    <div style={{
      background: 'rgba(13,15,46,0.85)',
      border: `1px solid ${c.border}55`,
      borderRadius: 20,
      padding: 24,
      backdropFilter: 'blur(16px)',
      boxShadow: `0 0 30px ${c.glow}`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow orb */}
      <div style={{
        position: 'absolute', top: -80, right: -80,
        width: 260, height: 260, borderRadius: '50%',
        background: `radial-gradient(circle, ${c.glow} 0%, transparent 65%)`,
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />

      <div style={{ textAlign: 'center', marginBottom: 20, position: 'relative' }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>{c.icon}</div>
        <h2 style={{
          color: c.border, margin: '8px 0 12px',
          fontSize: 22, fontFamily: "'Syne', sans-serif", fontWeight: 800,
        }}>
          {c.heading}
        </h2>

        {/* Decision badge with pulse ring */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* Main decision pill */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="pulse-ring" style={{ background: c.border }} />
            <span style={{
              display: 'inline-block',
              background: c.badgeBg,
              color: '#fff',
              padding: '4px 14px',
              borderRadius: 50,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              fontFamily: "'Syne', sans-serif",
              position: 'relative',
              zIndex: 1,
            }}>
              {decision}
            </span>
          </div>
          <Badge label={category} variant="neutral" />
          <Badge
            label={`Regret: ${(regret_probability * 100).toFixed(0)}%`}
            variant={regret_probability > 0.6 ? 'high' : regret_probability > 0.3 ? 'medium' : 'safe'}
          />
          <Badge label={confidence_band === 'wide' ? 'Uncertain estimate' : 'High confidence'} variant="info" />
        </div>
      </div>

      <p style={{
        color: '#b0b8d4', fontSize: 14, lineHeight: 1.7, marginBottom: 16,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {nudge_text}
      </p>

      {/* Opportunity cost row */}
      <div style={{
        background: 'rgba(5,6,26,0.5)',
        border: '1px solid rgba(0,180,255,0.1)',
        borderRadius: 10, padding: '10px 14px', fontSize: 12,
        color: '#7b82b0', marginBottom: 16,
        display: 'flex', gap: 16, flexWrap: 'wrap',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <span>≈ {opportunity_cost?.meals}</span>
        <span>· {opportunity_cost?.work_hours}</span>
        <span>· −{survival_delta?.toFixed(1)} days runway</span>
      </div>

      {!recorded && result.forward_chain && (
        <ForwardChainTree trace={result.forward_chain} />
      )}

      {/* Commitment device box */}
      {commitment_device && (
        <div style={{
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 10, padding: '10px 14px', fontSize: 13,
          color: '#fde68a', marginBottom: 16,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          ⏱ 48-hour pause activated for late-night purchases. Come back tomorrow to proceed.
        </div>
      )}

      {recorded && (
        <div style={{
          background: 'rgba(0,229,192,0.08)',
          border: '1px solid rgba(0,229,192,0.28)',
          borderRadius: 10, padding: '10px 14px', fontSize: 13,
          color: '#99f6e4', marginBottom: 16,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          Recorded from bank message. Your balance and dashboard data have already been updated.
        </div>
      )}

      {/* Survival impact (PAUSE / AVOID) */}
      {decision !== 'SPEND' && (
        <SurvivalImpactChart before={survival_before} after={survival_after} delta={survival_delta} />
      )}

      {/* Survival callout for AVOID */}
      {decision === 'AVOID' && (
        <div style={{
          background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '10px 14px', fontSize: 13,
          color: '#fca5a5', marginBottom: 16,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          This reduces your runway from {survival_before?.toFixed(1)} → {survival_after?.toFixed(1)} days
          <span style={{ color: '#ef4444', fontWeight: 700 }}> (−{survival_delta?.toFixed(1)} days)</span>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        {recorded ? (
          <button onClick={onCancel} disabled={loading} style={btn('#00e5c0', false, true)}>
            Done
          </button>
        ) : decision === 'SPEND' && (
          <button onClick={onProceed} disabled={loading} style={btn('#00e5c0', false, true)}>
            Confirm Purchase
          </button>
        )}
        {!recorded && decision === 'PAUSE' && (
          <button onClick={onProceed} disabled={loading} style={btn('#f59e0b')}>
            Proceed Anyway
          </button>
        )}
        {!recorded && decision === 'AVOID' && (
          <button onClick={onProceed} disabled={loading} style={btn('#ef4444', true)}>
            Override (Not Recommended)
          </button>
        )}
        {!recorded && (
          <button onClick={onCancel} disabled={loading} style={btn('#1e2a4a')}>
            {decision === 'AVOID' ? 'Good call, cancel' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  )
}

const btn = (bg, outline = false, isGreen = false) => ({
  flex: 1, padding: '11px', borderRadius: 10,
  border: outline ? `1px solid ${bg}` : 'none',
  background: outline ? 'transparent' : isGreen
    ? 'linear-gradient(135deg, #00e5c0, #0055ff)'
    : bg,
  color: outline ? bg : '#fff',
  cursor: 'pointer', fontSize: 13, fontWeight: 600,
  fontFamily: "'DM Sans', sans-serif",
  transition: 'all 0.2s ease',
})

function ForwardChainTree({ trace }) {
  const facts = trace.base_facts || []
  const rules = trace.rules || []
  const fired = trace.fired_rule || {}

  return (
    <div style={{
      marginBottom: 16,
      border: '1px solid rgba(0,180,255,0.18)',
      borderRadius: 12,
      background: 'rgba(5,6,26,0.42)',
      padding: 14,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        color: '#f0f4ff',
        fontSize: 15,
        fontWeight: 800,
        marginBottom: 10,
        fontFamily: "'Syne', sans-serif",
      }}>
        Forward Chaining Tree
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 8,
        marginBottom: 12,
      }}>
        {facts.map(fact => (
          <div key={fact.label} style={{
            border: '1px solid rgba(123,130,176,0.14)',
            borderRadius: 8,
            padding: '8px 10px',
            background: 'rgba(13,15,46,0.62)',
          }}>
            <div style={{ color: '#7b82b0', fontSize: 11, fontWeight: 700 }}>{fact.label}</div>
            <div style={{
              color: '#dbeafe',
              fontSize: 13,
              fontWeight: 800,
              overflowWrap: 'anywhere',
              marginTop: 2,
            }}>
              {String(fact.value)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rules.map(rule => {
          const active = rule.status === 'fired'
          const checked = rule.status === 'checked'
          return (
            <div key={rule.rule} style={{
              display: 'grid',
              gridTemplateColumns: '36px 1fr auto',
              alignItems: 'center',
              gap: 10,
              border: `1px solid ${active ? 'rgba(0,229,192,0.45)' : 'rgba(123,130,176,0.14)'}`,
              borderRadius: 8,
              padding: '9px 10px',
              background: active ? 'rgba(0,229,192,0.08)' : 'rgba(13,15,46,0.48)',
              opacity: rule.status === 'not_reached' ? 0.58 : 1,
            }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                display: 'grid',
                placeItems: 'center',
                background: active ? '#00e5c0' : checked ? 'rgba(0,180,255,0.18)' : 'rgba(123,130,176,0.12)',
                color: active ? '#06111d' : '#b0b8d4',
                fontSize: 12,
                fontWeight: 900,
              }}>
                {rule.salience}
              </div>
              <div>
                <div style={{ color: active ? '#99f6e4' : '#f0f4ff', fontSize: 13, fontWeight: 800 }}>
                  {rule.rule}
                </div>
                <div style={{ color: '#7b82b0', fontSize: 12, lineHeight: 1.4 }}>
                  {rule.condition}
                </div>
              </div>
              <div style={{
                color: active ? '#00e5c0' : checked ? '#7dd3fc' : '#7b82b0',
                fontSize: 11,
                fontWeight: 900,
                textTransform: 'uppercase',
              }}>
                {active ? 'Fired' : checked ? 'Checked' : 'Skipped'}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop: 12,
        color: '#c5ccef',
        fontSize: 13,
        lineHeight: 1.5,
      }}>
        Fired rule: <strong style={{ color: '#00e5c0' }}>{fired.rule || 'Default'}</strong>. Decision: <strong>{trace.decision}</strong>.
      </div>
    </div>
  )
}
