import { useState, useRef } from 'react'
import { evaluateTransaction, confirmTransaction } from '../api/client'
import { useSession } from '../context/SessionContext'
import TransactionForm from '../components/transaction/TransactionForm'
import DecisionCard    from '../components/transaction/DecisionCard'
import ErrorAlert      from '../components/ui/ErrorAlert'

export default function TransactionSimulator() {
  const { sessionId, setBalance, setSurvivalDays } = useSession()
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [toast, setToast]     = useState(null)
  const [confirmModal, setConfirmModal] = useState(false)
  const toastTimer = useRef(null)

  async function handleEvaluate(form) {
    setError(null); setLoading(true); setResult(null)
    try {
      const r = await evaluateTransaction({ session_id: sessionId, ...form })
      setResult(r)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function doProceed() {
    if (!result) return
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
    if (result.decision === 'BLOCKED') {
      setResult(null)
      return
    }
    setLoading(true)
    try {
      await confirmTransaction({ session_id: sessionId, transaction_id: result.transaction_id, action: 'cancel' })
      setResult(null)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', color: '#f1f5f9', fontSize: 22, fontWeight: 700 }}>Transaction Simulator</h1>
      {error && <ErrorAlert message={error} />}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>
        <div style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Transaction Details</h3>
          <TransactionForm onEvaluate={handleEvaluate} loading={loading} />
        </div>
        <div>
          {!result && !loading && (
            <div style={{ textAlign: 'center', padding: '64px 32px', color: '#374151' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🤔</div>
              <p style={{ fontSize: 13 }}>Fill in the form and hit Evaluate to get an AI decision</p>
            </div>
          )}
          {result && <DecisionCard result={result} onProceed={doProceed} onCancel={doCancel} loading={loading} />}
        </div>
      </div>

      {confirmModal && (
        <div style={{ position:'fixed',inset:0,background:'#000000aa',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }}>
          <div style={{ background:'#131720',border:'1px solid #ef4444',borderRadius:12,padding:32,maxWidth:400,width:'90%' }}>
            <h3 style={{ color:'#ef4444',margin:'0 0 12px' }}>Are you sure?</h3>
            <p style={{ color:'#94a3b8',fontSize:13,margin:'0 0 24px',lineHeight:1.6 }}>AI strongly recommends avoiding this. Overriding may significantly reduce your runway.</p>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={doProceed} style={{ flex:1,background:'#ef4444',color:'#fff',border:'none',borderRadius:8,padding:10,cursor:'pointer',fontSize:13,fontWeight:600 }}>Yes, proceed</button>
              <button onClick={() => setConfirmModal(false)} style={{ flex:1,background:'#1e2535',color:'#e2e8f0',border:'none',borderRadius:8,padding:10,cursor:'pointer',fontSize:13 }}>Go back</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div style={{ position:'fixed',bottom:24,right:24,background:'#22c55e',color:'#fff',borderRadius:8,padding:'12px 20px',fontSize:13,fontWeight:600,zIndex:1000 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
