import { useState, useRef, useEffect } from 'react'
import { evaluateTransaction, confirmTransaction, ingestBankMessage, correctCategory } from '../api/client'
import { useSession } from '../context/SessionContext'
import TransactionForm from '../components/transaction/TransactionForm'
import DecisionCard    from '../components/transaction/DecisionCard'
import CategoryCorrection from '../components/transaction/CategoryCorrection'
import ErrorAlert      from '../components/ui/ErrorAlert'

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

export default function TransactionSimulator() {
  const { sessionId, setBalance, setSurvivalDays } = useSession()
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [toast, setToast]     = useState(null)
  const [mode, setMode]       = useState(null)
  const [lastAnalysisForm, setLastAnalysisForm] = useState(null)
  const [confirmModal, setConfirmModal] = useState(false)
  const toastTimer = useRef(null)

  useProgressBar()

  async function handleEvaluate(form) {
    setError(null); setLoading(true); setResult(null)
    try {
      const r = await evaluateTransaction({ session_id: sessionId, ...form })
      setLastAnalysisForm(form)
      setResult(r)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleCategoryUpdate(newCategory) {
    if (!result) return
    const vendorName = lastAnalysisForm?.payee || result.parsed?.payee || ''
    const updated = await correctCategory({
      session_id: sessionId,
      transaction_id: result.transaction_id,
      vendor_name: vendorName,
      category: newCategory,
    })
    setResult(prev => ({ ...prev, ...updated }))
  }

  async function handleMessageIngest(message) {
    setError(null); setLoading(true); setResult(null)
    try {
      const r = await ingestBankMessage({ session_id: sessionId, message })
      setLastAnalysisForm(null)
      setBalance(r.new_balance)
      setSurvivalDays(r.new_survival_days)
      setResult({ ...r, recorded: true })
      setToast(`Recorded ${r.parsed.payee} · ₹${Math.round(r.parsed.amount).toLocaleString('en-IN')}`)
      clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToast(null), 2400)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function doProceed() {
    if (!result) return
    if (result.recorded) { setResult(null); return }
    if (result.decision === 'AVOID' && !confirmModal) { setConfirmModal(true); return }
    setConfirmModal(false); setLoading(true)
    try {
      const r = await confirmTransaction({ session_id: sessionId, transaction_id: result.transaction_id, action: 'proceed' })
      setBalance(r.new_balance); setSurvivalDays(r.new_survival_days)
      setToast('Transaction recorded ✓')
      clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => { setToast(null); setResult(null) }, 2000)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function doCancel() {
    if (!result) return
    if (result.recorded || result.decision === 'BLOCKED') { setResult(null); return }
    setLoading(true)
    try {
      await confirmTransaction({ session_id: sessionId, transaction_id: result.transaction_id, action: 'cancel' })
      setResult(null)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div id="progress-bar" />

      <div style={{ marginBottom: 28 }}>
        <span className="section-tag"><span className="dot" />AI Decision Engine</span>
        <h1 style={{
          margin: '6px 0 0',
          color: '#f0f4ff',
          fontSize: 'clamp(2rem, 4vw, 3.2rem)',
          fontWeight: 800,
          fontFamily: "'Syne', sans-serif",
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}>
          Transaction Simulator
        </h1>
        <p style={{ margin: '8px 0 0', color: '#7b82b0', fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
          Let AI evaluate your next spending decision
        </p>
      </div>
      {!mode && (
        <p style={{
          margin: '-12px 0 32px',
          color: '#00b4ff',
          fontSize: 24,
          fontWeight: 800,
          fontFamily: "'Syne', sans-serif",
          fontStyle: 'italic',
          borderLeft: '5px solid #00b4ff',
          paddingLeft: 20,
          opacity: 1,
          maxWidth: 800,
          lineHeight: 1.3,
          letterSpacing: '-0.01em'
        }}>
          "Every rupee you spend is a choice, know what you’re choosing."
        </p>
      )}

      {error && <ErrorAlert message={error} />}

      {!mode ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))', gap: 18 }}>
          <button type="button" onClick={() => { setMode('analysis'); setResult(null); setError(null) }} style={choiceCard('#00b4ff')}>
            <span style={choiceKicker}>Understand Spending</span>
            <span style={choiceTitle}>Analyze Before Paying</span>
            <span style={choiceText}>Enter the transaction details and see the regret score.</span>
          </button>
          <button type="button" onClick={() => { setMode('message'); setResult(null); setError(null) }} style={choiceCard('#00e5c0')}>
            <span style={choiceKicker}>Skip Insight</span>
            <span style={choiceTitle}>Parse Bank Message</span>
            <span style={choiceText}>Paste an SMS and record it directly.</span>
          </button>
        </div>
      ) : (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
          }}>
            <button
              type="button"
              onClick={() => { setMode(null); setResult(null); setError(null) }}
              style={{
                background: 'rgba(0,180,255,0.08)',
                border: '1px solid rgba(0,180,255,0.25)',
                color: '#dbeafe',
                borderRadius: 10,
                padding: '10px 14px',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 800,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Back to choices
            </button>
            <span style={{
              color: '#9aa3c7',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {mode === 'message' ? 'Message parsing mode' : 'Spending analysis mode'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>
          <div className="fg-card" style={{ padding: 24 }}>
            <h3 style={{
              margin: '0 0 16px', color: '#f0f4ff',
              fontSize: 15, fontWeight: 800,
              fontFamily: "'Syne', sans-serif",
            }}>
              {mode === 'message' ? 'Message Parsing' : 'Spending Analysis'}
            </h3>
            <TransactionForm
              mode={mode}
              onBack={() => { setMode(null); setResult(null); setError(null) }}
              onEvaluate={handleEvaluate}
              onMessageIngest={handleMessageIngest}
              loading={loading}
              correctionResult={result}
              correctionVendor={lastAnalysisForm?.payee || result?.parsed?.payee || ''}
              onCategoryUpdate={handleCategoryUpdate}
            />
          </div>

          <div>
            {!result && !loading && (
              <div className="fg-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>{mode === 'message' ? '✉️' : '🤔'}</div>
                <p style={{
                  fontSize: 14, color: '#7b82b0',
                  fontFamily: "'DM Sans', sans-serif",
                  lineHeight: 1.6, margin: 0,
                }}>
                  {mode === 'message'
                    ? 'Paste a bank message to extract vendor, amount, date, and regret score.'
                    : 'Fill in the details to get a decision before you spend.'}
                </p>
              </div>
            )}
            {result && (
              <>
                <DecisionCard result={result} onProceed={doProceed} onCancel={doCancel} loading={loading} />
                {mode === 'message' && result.category && (
                  <CategoryCorrection
                    currentCategory={result.category}
                    vendorName={result.parsed?.payee || ''}
                    onCategoryUpdate={handleCategoryUpdate}
                  />
                )}
              </>
            )}
          </div>
          </div>
        </>
      )}

      {/* AVOID confirm modal */}
      {confirmModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(5,6,26,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="fg-card" style={{ padding: 32, maxWidth: 400, width: '90%' }}>
            <h3 style={{
              color: '#ef4444', margin: '0 0 12px',
              fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20,
            }}>
              Are you sure?
            </h3>
            <p style={{
              color: '#7b82b0', fontSize: 14, margin: '0 0 24px', lineHeight: 1.7,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              AI strongly recommends avoiding this. Overriding may significantly reduce your runway.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={doProceed} style={{
                flex: 1, background: '#ef4444', color: '#fff',
                border: 'none', borderRadius: 10, padding: 11,
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                Yes, proceed
              </button>
              <button onClick={() => setConfirmModal(false)} style={{
                flex: 1,
                background: 'rgba(0,180,255,0.08)',
                border: '1px solid rgba(0,180,255,0.18)',
                color: '#b0b8d4', borderRadius: 10, padding: 11,
                cursor: 'pointer', fontSize: 13,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                Go back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'linear-gradient(135deg, #00e5c0, #0055ff)',
          color: '#fff', borderRadius: 12,
          padding: '13px 22px', fontSize: 13, fontWeight: 600,
          zIndex: 1000, boxShadow: '0 8px 24px rgba(0,229,192,0.3)',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

const choiceCard = color => ({
  minHeight: 230,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'flex-end',
  textAlign: 'left',
  background: 'rgba(13,15,46,0.85)',
  border: `1px solid ${color}44`,
  borderRadius: 16,
  padding: 30,
  cursor: 'pointer',
  boxShadow: `0 0 28px ${color}18`,
  fontFamily: "'DM Sans', sans-serif",
})

const choiceKicker = {
  color: '#aeb8df',
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'none',
  marginBottom: 12,
}

const choiceTitle = {
  color: '#f0f4ff',
  fontSize: 30,
  fontWeight: 800,
  fontFamily: "'Syne', sans-serif",
  marginBottom: 12,
  lineHeight: 1.08,
}

const choiceText = {
  color: '#c5ccef',
  fontSize: 16,
  fontWeight: 600,
  lineHeight: 1.55,
}
