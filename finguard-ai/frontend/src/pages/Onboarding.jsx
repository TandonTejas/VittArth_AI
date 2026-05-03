import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { onboard, uploadCSV } from '../api/client'
import { useSession } from '../context/SessionContext'
import ErrorAlert from '../components/ui/ErrorAlert'
import Spinner from '../components/ui/Spinner'
import { ShieldCheck, Upload, CheckCircle } from 'lucide-react'

/* ── Floating Finance SVGs ──────────────────────────────────────────────── */
const FloatingGraphics = () => (
  <>
    {/* Piggy Bank — top right */}
    <svg className="float-graphic" style={{ top: '8%', right: '6%', width: 130, opacity: 0.09, animationDuration: '9s', animationDelay: '0s' }} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="55" rx="32" ry="26" stroke="#00b4ff" strokeWidth="2.5"/>
      <ellipse cx="78" cy="52" rx="8" ry="7" stroke="#00b4ff" strokeWidth="2.5"/>
      <path d="M32 38 Q50 20 68 38" stroke="#00b4ff" strokeWidth="2.5" fill="none"/>
      <rect x="44" y="18" width="12" height="6" rx="3" stroke="#00b4ff" strokeWidth="2"/>
      <line x1="40" y1="75" x2="36" y2="88" stroke="#00b4ff" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="52" y1="77" x2="50" y2="90" stroke="#00b4ff" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="64" y1="75" x2="66" y2="88" stroke="#00b4ff" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="70" cy="50" r="2.5" fill="#00b4ff"/>
    </svg>

    {/* Rupee coin — bottom left */}
    <svg className="float-graphic" style={{ bottom: '15%', left: '4%', width: 85, opacity: 0.1, animationDuration: '7s', animationDelay: '1.2s' }} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" stroke="#00e5c0" strokeWidth="2.5"/>
      <text x="40" y="50" textAnchor="middle" fill="#00e5c0" fontSize="28" fontWeight="bold" fontFamily="sans-serif">₹</text>
    </svg>

    {/* Upward arrow — top left corner */}
    <svg className="float-graphic" style={{ top: '20%', left: '3%', width: 90, opacity: 0.08, animationDuration: '10s', animationDelay: '2.4s' }} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 65 L40 20 M25 35 L40 18 L55 35" stroke="#00b4ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>

    {/* Shield — bottom right */}
    <svg className="float-graphic" style={{ bottom: '10%', right: '8%', width: 75, opacity: 0.1, animationDuration: '8s', animationDelay: '3.6s' }} viewBox="0 0 70 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M35 5 L60 15 L60 40 Q60 62 35 75 Q10 62 10 40 L10 15 Z" stroke="#00e5c0" strokeWidth="2.5" fill="none"/>
      <path d="M22 38 L31 47 L48 30" stroke="#00e5c0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>

    {/* Credit card — mid right */}
    <svg className="float-graphic" style={{ top: '55%', right: '3%', width: 105, opacity: 0.08, animationDuration: '11s', animationDelay: '4.8s' }} viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="94" height="59" rx="9" stroke="#0055ff" strokeWidth="2.5"/>
      <line x1="3" y1="20" x2="97" y2="20" stroke="#0055ff" strokeWidth="2.5"/>
      <rect x="12" y="30" width="22" height="14" rx="3" stroke="#0055ff" strokeWidth="2"/>
      <line x1="48" y1="35" x2="85" y2="35" stroke="#0055ff" strokeWidth="2" strokeLinecap="round"/>
      <line x1="48" y1="42" x2="72" y2="42" stroke="#0055ff" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </>
)

/* ── Bouncing Ball Intro ─────────────────────────────────────────────── */
const WORDS = ['WE', 'MAKE', 'SHIFT', 'HAPPEN']

function BouncingBallIntro({ onDone }) {
  const ballRef = useRef(null)
  const wordRefs = useRef([])
  const containerRef = useRef(null)
  const [ballPos, setBallPos] = useState({ x: 0, y: -80 })
  const [ballScale, setBallScale] = useState({ x: 1, y: 1 })
  const [dippedWord, setDippedWord] = useState(null)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const delay = ms => new Promise(r => setTimeout(r, ms))

    async function runSequence() {
      await delay(300)
      if (cancelled) return

      // Get word positions
      const getWordY = (i) => {
        const el = wordRefs.current[i]
        const container = containerRef.current
        if (!el || !container) return 0
        const elRect = el.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        return (elRect.top - containerRect.top) + elRect.height / 2
      }

      const ballStartX = 60
      let lastWordY = -80

      // Ball drops in from top
      setBallPos({ x: ballStartX, y: -80 })
      await delay(50)

      for (let i = 0; i < WORDS.length; i++) {
        if (cancelled) return
        // Stretch downward during fall
        setBallScale({ x: 0.75, y: 1.35 })
        const wordY = getWordY(i)
        lastWordY = wordY
        setBallPos({ x: ballStartX, y: wordY })

        await delay(280)
        if (cancelled) return

        // Squash on impact
        setBallScale({ x: 1.55, y: 0.5 })
        setDippedWord(i)

        await delay(90)
        if (cancelled) return

        // Bounce back to round
        setBallScale({ x: 1, y: 1 })

        await delay(400)
        if (cancelled) return
        setDippedWord(null)

        if (i < WORDS.length - 1) {
          // Stretch upward
          setBallScale({ x: 0.75, y: 1.35 })
          await delay(150)
        }
      }

      if (cancelled) return
      // Roll off right
      setBallScale({ x: 1, y: 1 })
      setBallPos({ x: window.innerWidth + 100, y: lastWordY })

      await delay(350)
      if (cancelled) return

      // Panel exits
      setExiting(true)
      await delay(650)
      if (!cancelled) onDone()
    }

    runSequence()
    return () => { cancelled = true }
  }, [onDone])

  return (
    <div
      ref={containerRef}
      className={`ball-intro${exiting ? ' exit' : ''}`}
      style={{ position: 'fixed', inset: 0, background: '#05061a', zIndex: 9998, overflow: 'hidden' }}
    >
      {/* Orbs */}
      <div className="orb-container">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      {/* Ball */}
      <div
        ref={ballRef}
        style={{
          position: 'absolute',
          left: ballPos.x,
          top: ballPos.y,
          transform: `translate(-50%, -50%) scaleX(${ballScale.x}) scaleY(${ballScale.y})`,
          width: 70,
          height: 70,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0055ff, #00b4ff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          boxShadow: '0 0 30px rgba(0,85,255,0.7), 0 0 60px rgba(0,85,255,0.3)',
          transition: 'left 0.28s cubic-bezier(0.36,0.07,0.19,0.97), top 0.28s cubic-bezier(0.36,0.07,0.19,0.97), transform 0.1s ease',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        ₹
      </div>

      {/* Words */}
      <div className="ball-words" style={{ paddingLeft: '8vw', position: 'relative', zIndex: 1 }}>
        {WORDS.map((word, i) => (
          <span
            key={word}
            ref={el => wordRefs.current[i] = el}
            className={`ball-word${dippedWord === i ? ' dip' : ''}`}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Input / Label styles ────────────────────────────────────────────── */
const inp = {
  background: 'rgba(5,6,26,0.6)',
  border: '1px solid rgba(0,180,255,0.18)',
  borderRadius: 10,
  color: '#f0f4ff',
  padding: '11px 14px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  fontFamily: "'DM Sans', sans-serif",
  transition: 'border-color 0.2s',
}
const labelStyle = {
  fontSize: 12,
  color: '#7b82b0',
  display: 'block',
  marginBottom: 6,
  fontWeight: 500,
  fontFamily: "'DM Sans', sans-serif",
  letterSpacing: '0.05em',
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { setSessionId, setBalance, setIsOnboarded, setSurvivalDays } = useSession()
  const [showIntro, setShowIntro] = useState(true)
  const [step, setStep] = useState(1)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sessionId, setLocalSid] = useState(null)
  const [csvResult, setCsvResult] = useState(null)
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)

  const [form, setForm] = useState({
    monthly_income: '', rent: '', subscriptions: '', other_fixed: '',
    daily_target: '', current_balance: '', user_profile: 'Early-Career',
    days_until_month_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const monthlyIncome = parseFloat(form.monthly_income) || 0
  const totalFixed = (parseFloat(form.rent) || 0) + (parseFloat(form.subscriptions) || 0) + (parseFloat(form.other_fixed) || 0)
  const spendableBalance = Math.max(0, monthlyIncome - totalFixed)

  useEffect(() => {
    set('current_balance', spendableBalance ? spendableBalance.toString() : '')
  }, [spendableBalance])

  async function handleStep1(e) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      const r = await onboard({
        monthly_income: parseFloat(form.monthly_income),
        fixed_expenses: totalFixed,
        daily_target: parseFloat(form.daily_target),
        user_profile: form.user_profile,
        current_balance: spendableBalance,
        days_until_month_end: parseInt(form.days_until_month_end)
      })
      setLocalSid(r.session_id)
      setSessionId(r.session_id)
      setBalance(spendableBalance)
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
      const spendRate = r.avg_daily_spend || parseFloat(form.daily_target) || 1
      setSurvivalDays(spendRate > 0 ? spendableBalance / spendRate : 30)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function goToDashboard() {
    setIsOnboarded(true)
    navigate('/dashboard')
  }

  const focusStyle = e => { e.target.style.borderColor = 'rgba(0,180,255,0.5)' }
  const blurStyle = e => { e.target.style.borderColor = 'rgba(0,180,255,0.18)' }

  return (
    <>
      {showIntro && <BouncingBallIntro onDone={() => setShowIntro(false)} />}

      <div style={{
        minHeight: '100vh',
        background: 'var(--fg-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, position: 'relative', overflow: 'hidden',
      }}>
        {/* Orbs */}
        <div className="orb-container">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>

        {/* Floating Graphics */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <FloatingGraphics />
        </div>

        <div style={{ width: '100%', maxWidth: 520, position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0055ff, #00b4ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 0 30px rgba(0,85,255,0.4)',
            }}>
              <ShieldCheck size={28} color="#fff" />
            </div>
            <h1 style={{
              color: '#f0f4ff', margin: '0 0 8px',
              fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
              fontWeight: 800, fontFamily: "'Syne', sans-serif",
              letterSpacing: '-0.03em',
            }}>
              VittArth{' '}
              <span style={{
                background: 'linear-gradient(120deg, #00b4ff, #00e5c0)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>AI</span>
            </h1>
            <p style={{ color: '#7b82b0', fontSize: 14, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
              Your intelligent financial companion
            </p>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, justifyContent: 'center' }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                width: s === step ? 36 : 8, height: 8, borderRadius: 4,
                background: s === step
                  ? 'linear-gradient(90deg, #0055ff, #00b4ff)'
                  : s < step ? '#00e5c0' : 'rgba(0,180,255,0.15)',
                transition: 'all .4s cubic-bezier(0.34,1.56,0.64,1)',
              }} />
            ))}
          </div>

          {/* Card */}
          <div className="fg-card" style={{ padding: 32 }}>
            {error && <ErrorAlert message={error} />}

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <span className="section-tag"><span className="dot" />Step 1 of 2</span>
                  <h2 style={{ margin: '4px 0 4px', color: '#f0f4ff', fontSize: 20, fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
                    Financial Profile
                  </h2>
                  <p style={{ margin: '0 0 4px', color: '#7b82b0', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
                    Tell us about your finances
                  </p>
                </div>

                <div>
                  <label style={labelStyle}>Monthly Net Income (₹)</label>
                  <input style={inp} type="number" min="1" required value={form.monthly_income}
                    onChange={e => set('monthly_income', e.target.value)} placeholder="e.g. 50000"
                    onFocus={focusStyle} onBlur={blurStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Rent / EMI (₹)</label>
                    <input style={inp} type="number" min="0" value={form.rent}
                      onChange={e => set('rent', e.target.value)} placeholder="15000"
                      onFocus={focusStyle} onBlur={blurStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Subscriptions (₹)</label>
                    <input style={inp} type="number" min="0" value={form.subscriptions}
                      onChange={e => set('subscriptions', e.target.value)} placeholder="1500"
                      onFocus={focusStyle} onBlur={blurStyle} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Other Fixed Expenses (₹)</label>
                  <input style={inp} type="number" min="0" value={form.other_fixed}
                    onChange={e => set('other_fixed', e.target.value)} placeholder="2000"
                    onFocus={focusStyle} onBlur={blurStyle} />
                </div>

                <div style={{
                  background: 'rgba(0,180,255,0.06)',
                  border: '1px solid rgba(0,180,255,0.14)',
                  borderRadius: 10, padding: '10px 14px',
                  fontSize: 13, color: '#7b82b0',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  Total Fixed: <strong style={{ color: '#00b4ff' }}>₹{totalFixed.toLocaleString('en-IN')}</strong>
                </div>
                <div style={{
                  background: 'rgba(0,229,192,0.06)',
                  border: '1px solid rgba(0,229,192,0.14)',
                  borderRadius: 10, padding: '10px 14px',
                  fontSize: 13, color: '#7b82b0',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  Spendable Balance: <strong style={{ color: '#00e5c0' }}>₹{spendableBalance.toLocaleString('en-IN')}</strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Daily Target (₹)</label>
                    <input style={inp} type="number" min="1" required value={form.daily_target}
                      onChange={e => set('daily_target', e.target.value)} placeholder="500"
                      onFocus={focusStyle} onBlur={blurStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Spendable Balance (₹)</label>
                    <input
                      style={{ ...inp, opacity: 0.78, cursor: 'not-allowed' }}
                      type="number"
                      min="0"
                      required
                      readOnly
                      value={form.current_balance}
                      placeholder="Income - fixed"
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>User Profile</label>
                  <select style={{ ...inp, cursor: 'pointer' }} value={form.user_profile}
                    onChange={e => set('user_profile', e.target.value)}
                    onFocus={focusStyle} onBlur={blurStyle}>
                    {['Student', 'Early-Career', 'Freelancer', 'Remote Worker'].map(p => (
                      <option key={p} style={{ background: '#0d0f2e' }}>{p}</option>
                    ))}
                  </select>
                </div>

                {totalFixed > parseFloat(form.monthly_income || 0) && (
                  <div style={{
                    color: '#ef4444', fontSize: 13,
                    background: 'rgba(239,68,68,0.07)',
                    padding: '10px 14px', borderRadius: 10,
                    border: '1px solid rgba(239,68,68,0.25)',
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    ⚠ Your fixed expenses exceed your monthly income.
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 8 }}>
                  {loading ? 'Creating session…' : 'Next →'}
                </button>
              </form>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && !csvResult && (
              <div>
                <span className="section-tag"><span className="dot" />Step 2 of 2</span>
                <h2 style={{ margin: '4px 0 4px', color: '#f0f4ff', fontSize: 20, fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
                  Upload Bank Statement
                </h2>
                <p style={{ margin: '0 0 20px', color: '#7b82b0', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
                  CSV with Date, Amount, Payee, TransactionType columns
                </p>

                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); setFile(e.dataTransfer.files[0]) }}
                  style={{
                    border: `2px dashed ${dragging ? '#00b4ff' : 'rgba(0,180,255,0.25)'}`,
                    borderRadius: 14, padding: '40px 24px', textAlign: 'center',
                    cursor: 'pointer', transition: 'all .3s',
                    marginBottom: 16,
                    background: dragging ? 'rgba(0,180,255,0.06)' : 'transparent',
                    boxShadow: dragging ? '0 0 20px rgba(0,180,255,0.15)' : 'none',
                  }}
                  onClick={() => document.getElementById('csv-input').click()}
                >
                  <Upload size={36} color={dragging ? '#00b4ff' : '#7b82b0'} style={{ marginBottom: 12, transition: 'color 0.3s' }} />
                  <p style={{ color: '#7b82b0', margin: 0, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
                    {file ? (
                      <span style={{ color: '#00e5c0', fontWeight: 500 }}>
                        {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    ) : 'Drop CSV here or click to select'}
                  </p>
                  <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }}
                    onChange={e => setFile(e.target.files[0])} />
                </div>

                <button onClick={handleCSV} disabled={!file || loading} className="btn-primary"
                  style={{ width: '100%', opacity: file && !loading ? 1 : 0.5, cursor: file && !loading ? 'pointer' : 'not-allowed' }}>
                  {loading ? <><Spinner size={16} /> Analyzing…</> : 'Analyze My Spending'}
                </button>
              </div>
            )}

            {/* ── CSV SUCCESS ── */}
            {step === 2 && csvResult && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(0,229,192,0.15)',
                    border: '1px solid rgba(0,229,192,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CheckCircle size={20} color="#00e5c0" />
                  </div>
                  <h2 style={{ margin: 0, color: '#f0f4ff', fontSize: 20, fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
                    Analysis Complete
                  </h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {[
                    ['Transactions loaded', csvResult.total_transactions],
                    ['Top category', csvResult.top_category || 'N/A'],
                    ['Other daily spend', `₹${csvResult.avg_daily_spend?.toFixed(0)}`],
                    ['Fixed rows ignored', csvResult.fixed_expense_transactions || 0],
                    ['Data quality', csvResult.data_quality],
                  ].map(([k, v]) => (
                    <div key={k} style={{
                      display: 'flex', justifyContent: 'space-between',
                      background: 'rgba(0,180,255,0.05)',
                      border: '1px solid rgba(0,180,255,0.1)',
                      borderRadius: 10, padding: '11px 16px', fontSize: 13,
                    }}>
                      <span style={{ color: '#7b82b0', fontFamily: "'DM Sans', sans-serif" }}>{k}</span>
                      <span style={{ color: '#f0f4ff', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{v}</span>
                    </div>
                  ))}
                </div>

                {csvResult.data_quality === 'Sparse' && (
                  <div style={{
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 10, padding: '10px 14px',
                    fontSize: 12, color: '#fde68a', marginBottom: 16,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    ⚠ Sparse data detected. Using Bayesian priors to estimate regret probabilities.
                  </div>
                )}

                <button onClick={goToDashboard} className="btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, #00e5c0, #0055ff)' }}>
                  Go to Dashboard →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
