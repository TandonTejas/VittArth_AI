import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { onboard, uploadCSV } from '../api/client'
import { useSession } from '../context/SessionContext'
import ErrorAlert from '../components/ui/ErrorAlert'
import Spinner from '../components/ui/Spinner'
import { ShieldCheck, Upload, CheckCircle } from 'lucide-react'

const inp = { background: '#131720', border: '1px solid #1e2535', borderRadius: 8,
  color: '#e2e8f0', padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none' }
const label = { fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 500 }

export default function Onboarding() {
  const navigate = useNavigate()
  const { setSessionId, setBalance, setIsOnboarded, setSurvivalDays } = useSession()
  const [step, setStep]     = useState(1)
  const [error, setError]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [sessionId, setLocalSid] = useState(null)
  const [csvResult, setCsvResult] = useState(null)
  const [file, setFile]     = useState(null)
  const [dragging, setDragging] = useState(false)

  const [form, setForm] = useState({
    monthly_income: '', rent: '', subscriptions: '', other_fixed: '',
    daily_target: '', current_balance: '', user_profile: 'Early-Career',
    days_until_month_end: new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate() - new Date().getDate()
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const totalFixed = (parseFloat(form.rent)||0) + (parseFloat(form.subscriptions)||0) + (parseFloat(form.other_fixed)||0)

  async function handleStep1(e) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      const r = await onboard({
        monthly_income:       parseFloat(form.monthly_income),
        fixed_expenses:       totalFixed,
        daily_target:         parseFloat(form.daily_target),
        user_profile:         form.user_profile,
        current_balance:      parseFloat(form.current_balance),
        days_until_month_end: parseInt(form.days_until_month_end)
      })
      setLocalSid(r.session_id)
      setSessionId(r.session_id)
      setBalance(parseFloat(form.current_balance))
      setStep(2)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleCSV() {
    if (!file) return
    setError(null); setLoading(true)
    try {
      const r = await uploadCSV(sessionId, file)
      setCsvResult(r)
      setSurvivalDays(r.avg_daily_spend > 0 ? parseFloat(form.current_balance) / r.avg_daily_spend : 30)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function goToDashboard() {
    setIsOnboarded(true)
    navigate('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <ShieldCheck size={40} color="#6366f1" style={{ marginBottom: 12 }} />
          <h1 style={{ color: '#f1f5f9', margin: '0 0 8px', fontSize: 28, fontWeight: 700 }}>FinGuard AI</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Your intelligent financial companion</p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, justifyContent: 'center' }}>
          {[1,2].map(s => (
            <div key={s} style={{
              width: s === step ? 32 : 8, height: 8, borderRadius: 4,
              background: s === step ? '#6366f1' : s < step ? '#22c55e' : '#1e2535',
              transition: 'all .3s'
            }} />
          ))}
        </div>

        <div style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 16, padding: 32 }}>
          {error && <ErrorAlert message={error} />}

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ margin: '0 0 4px', color: '#f1f5f9', fontSize: 18 }}>Financial Profile</h2>
              <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: 13 }}>Step 1 of 2 — tell us about your finances</p>

              <div>
                <label style={label}>Monthly Net Income (₹)</label>
                <input style={inp} type="number" min="1" required value={form.monthly_income} onChange={e => set('monthly_income', e.target.value)} placeholder="e.g. 50000" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Rent / EMI (₹)</label>
                  <input style={inp} type="number" min="0" value={form.rent} onChange={e => set('rent', e.target.value)} placeholder="15000" />
                </div>
                <div>
                  <label style={label}>Subscriptions (₹)</label>
                  <input style={inp} type="number" min="0" value={form.subscriptions} onChange={e => set('subscriptions', e.target.value)} placeholder="1500" />
                </div>
              </div>
              <div>
                <label style={label}>Other Fixed Expenses (₹)</label>
                <input style={inp} type="number" min="0" value={form.other_fixed} onChange={e => set('other_fixed', e.target.value)} placeholder="2000" />
              </div>
              <div style={{ background: '#0f1117', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#94a3b8' }}>
                Total Fixed: <strong style={{ color: '#f1f5f9' }}>₹{totalFixed.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Daily Target (₹)</label>
                  <input style={inp} type="number" min="1" required value={form.daily_target} onChange={e => set('daily_target', e.target.value)} placeholder="500" />
                </div>
                <div>
                  <label style={label}>Current Balance (₹)</label>
                  <input style={inp} type="number" min="0" required value={form.current_balance} onChange={e => set('current_balance', e.target.value)} placeholder="25000" />
                </div>
              </div>
              <div>
                <label style={label}>User Profile</label>
                <select style={inp} value={form.user_profile} onChange={e => set('user_profile', e.target.value)}>
                  {['Student','Early-Career','Freelancer','Remote Worker'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              {totalFixed > parseFloat(form.monthly_income || 0) && (
                <div style={{ color: '#ef4444', fontSize: 13, background: '#1c1010', padding: '8px 12px', borderRadius: 8, border: '1px solid #7f1d1d' }}>
                  ⚠ Your fixed expenses exceed your monthly income.
                </div>
              )}
              <button type="submit" disabled={loading} style={{
                background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8,
                padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8
              }}>
                {loading ? 'Creating session…' : 'Next →'}
              </button>
            </form>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && !csvResult && (
            <div>
              <h2 style={{ margin: '0 0 4px', color: '#f1f5f9', fontSize: 18 }}>Upload Bank Statement</h2>
              <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 13 }}>Step 2 of 2 — CSV with Date, Amount, Payee, TransactionType columns</p>

              {/* Drag-drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); setFile(e.dataTransfer.files[0]) }}
                style={{
                  border: `2px dashed ${dragging ? '#6366f1' : '#1e2535'}`,
                  borderRadius: 12, padding: '40px 24px', textAlign: 'center',
                  cursor: 'pointer', transition: 'border-color .2s', marginBottom: 16,
                  background: dragging ? '#1e2535' : 'transparent'
                }}
                onClick={() => document.getElementById('csv-input').click()}
              >
                <Upload size={32} color="#64748b" style={{ marginBottom: 12 }} />
                <p style={{ color: '#94a3b8', margin: 0, fontSize: 13 }}>
                  {file ? `${file.name} (${(file.size/1024).toFixed(1)} KB)` : 'Drop CSV here or click to select'}
                </p>
                <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => setFile(e.target.files[0])} />
              </div>

              <button onClick={handleCSV} disabled={!file || loading} style={{
                background: file && !loading ? '#6366f1' : '#374151', color: '#fff',
                border: 'none', borderRadius: 8, padding: '12px', width: '100%',
                fontSize: 14, fontWeight: 600, cursor: file && !loading ? 'pointer' : 'not-allowed'
              }}>
                {loading ? <><Spinner size={16} /> Analyzing…</> : 'Analyze My Spending'}
              </button>
            </div>
          )}

          {/* ── CSV SUCCESS ── */}
          {step === 2 && csvResult && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <CheckCircle size={24} color="#22c55e" />
                <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: 18 }}>Analysis Complete</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {[
                  ['Transactions loaded', csvResult.total_transactions],
                  ['Top category', csvResult.top_category || 'N/A'],
                  ['Avg daily spend', `₹${csvResult.avg_daily_spend?.toFixed(0)}`],
                  ['Data quality', csvResult.data_quality],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between',
                    background: '#0f1117', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>{k}</span>
                    <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
              {csvResult.data_quality === 'Sparse' && (
                <div style={{ background: '#1a160a', border: '1px solid #f59e0b55', borderRadius: 8,
                  padding: '10px 14px', fontSize: 12, color: '#fde68a', marginBottom: 16 }}>
                  ⚠ Sparse data detected. Using Bayesian priors to estimate regret probabilities.
                </div>
              )}
              <button onClick={goToDashboard} style={{
                background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8,
                padding: '12px', width: '100%', fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}>Go to Dashboard →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
