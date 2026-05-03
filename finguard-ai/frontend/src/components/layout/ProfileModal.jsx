import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { getProfile, updateProfile } from '../../api/client'
import { useSession } from '../../context/SessionContext'
import ErrorAlert from '../ui/ErrorAlert'
import Spinner from '../ui/Spinner'

const inp = {
  background: 'rgba(5,6,26,0.6)',
  border: '1px solid rgba(0,180,255,0.18)',
  borderRadius: 10,
  color: '#f0f4ff',
  padding: '11px 14px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  marginBottom: 12,
  fontFamily: "'DM Sans', sans-serif",
  transition: 'border-color 0.2s',
}
const labelStyle = {
  fontSize: 12, color: '#7b82b0', display: 'block',
  marginBottom: 6, fontWeight: 500,
  fontFamily: "'DM Sans', sans-serif",
  letterSpacing: '0.05em',
}

export default function ProfileModal({ onClose }) {
  const { sessionId, setBalance } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    monthly_income: '', fixed_expenses: '', daily_target: '', current_balance: ''
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const spendableBalance = Math.max(
    0,
    (parseFloat(form.monthly_income) || 0) - (parseFloat(form.fixed_expenses) || 0)
  )

  useEffect(() => {
    getProfile(sessionId).then(data => {
      setForm({
        monthly_income: data.monthly_income || '',
        fixed_expenses: data.fixed_expenses || '',
        daily_target: data.daily_target || '',
        current_balance: data.current_balance || '',
      })
      setLoading(false)
    }).catch(err => {
      setError(err.message)
      setLoading(false)
    })
  }, [sessionId])

  useEffect(() => {
    // Only autocalculate if loading is finished
    if (loading) return
    const income = parseFloat(form.monthly_income) || 0
    const fixed = parseFloat(form.fixed_expenses) || 0
    set('current_balance', Math.max(0, income - fixed).toString())
  }, [form.monthly_income, form.fixed_expenses])

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      await updateProfile({
        session_id: sessionId,
        monthly_income: parseFloat(form.monthly_income),
        fixed_expenses: parseFloat(form.fixed_expenses),
        daily_target: parseFloat(form.daily_target),
        current_balance: spendableBalance,
      })
      setBalance(spendableBalance)
      window.location.reload()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const focusStyle = e => { e.target.style.borderColor = 'rgba(0,180,255,0.5)' }
  const blurStyle  = e => { e.target.style.borderColor = 'rgba(0,180,255,0.18)' }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(5,6,26,0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="fg-card" style={{ width: 420, padding: 28, position: 'relative' }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(0,180,255,0.08)',
            border: '1px solid rgba(0,180,255,0.18)',
            borderRadius: 8, color: '#7b82b0',
            cursor: 'pointer', width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f0f4ff'; e.currentTarget.style.borderColor = 'rgba(0,180,255,0.4)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#7b82b0'; e.currentTarget.style.borderColor = 'rgba(0,180,255,0.18)' }}
        >
          <X size={16} />
        </button>

        <span className="section-tag"><span className="dot" />Profile</span>
        <h2 style={{ margin: '4px 0 20px', color: '#f0f4ff', fontSize: 20, fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
          Update Profile
        </h2>

        {error && <ErrorAlert message={error} />}

        {loading ? (
          <Spinner size={28} />
        ) : (
          <div>
            {[
              { label: 'Monthly Income (₹)', name: 'monthly_income' },
              { label: 'Fixed Expenses (₹)', name: 'fixed_expenses' },
              { label: 'Daily Spending Target (₹)', name: 'daily_target' },
              { label: 'Spendable Balance (₹)', name: 'current_balance', readOnly: true },
            ].map(({ label, name, readOnly }) => (
              <div key={name}>
                <label style={labelStyle}>{label}</label>
                <input
                  style={readOnly ? { ...inp, opacity: 0.78, cursor: 'not-allowed' } : inp}
                  type="number" name={name}
                  readOnly={readOnly}
                  value={form[name]}
                  onChange={e => set(e.target.name, e.target.value)}
                  onFocus={readOnly ? undefined : focusStyle}
                  onBlur={readOnly ? undefined : blurStyle}
                />
              </div>
            ))}

            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
              style={{
                width: '100%', marginTop: 8,
                background: 'linear-gradient(135deg, #00e5c0, #0055ff)',
                opacity: saving ? 0.7 : 1,
                display: 'flex', justifyContent: 'center', gap: 8,
              }}
            >
              {saving ? <><Spinner size={16} /> Saving…</> : 'Save Profile'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
