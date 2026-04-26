import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { getProfile, updateProfile } from '../../api/client'
import { useSession } from '../../context/SessionContext'
import ErrorAlert from '../ui/ErrorAlert'
import Spinner from '../ui/Spinner'

const inp = { background: '#0f1117', border: '1px solid #1e2535', borderRadius: 8,
  color: '#e2e8f0', padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none', marginBottom: 12 }
const label = { fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 500 }

export default function ProfileModal({ onClose }) {
  const { sessionId, setBalance } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  
  const [form, setForm] = useState({
    monthly_income: '', fixed_expenses: '', daily_target: '', current_balance: ''
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    getProfile(sessionId).then(data => {
      setForm({
        monthly_income: data.monthly_income || '',
        fixed_expenses: data.fixed_expenses || '',
        daily_target: data.daily_target || '',
        current_balance: data.current_balance || ''
      })
      setLoading(false)
    }).catch(err => {
      setError(err.message)
      setLoading(false)
    })
  }, [sessionId])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await updateProfile({
        session_id: sessionId,
        monthly_income: parseFloat(form.monthly_income),
        fixed_expenses: parseFloat(form.fixed_expenses),
        daily_target: parseFloat(form.daily_target),
        current_balance: parseFloat(form.current_balance)
      })
      setBalance(parseFloat(form.current_balance))
      window.location.reload() // Reload to fetch fresh dashboard data
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 12, width: 400, padding: 24, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
          <X size={20} />
        </button>
        <h2 style={{ margin: '0 0 20px', color: '#f1f5f9', fontSize: 18 }}>Update Profile</h2>
        {error && <ErrorAlert message={error} />}

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spinner size={24} /></div>
        ) : (
          <div>
            <label style={label}>Monthly Income (₹)</label>
            <input style={inp} type="number" value={form.monthly_income} onChange={e => set(e.target.name, e.target.value)} name="monthly_income" />

            <label style={label}>Fixed Expenses (₹)</label>
            <input style={inp} type="number" value={form.fixed_expenses} onChange={e => set(e.target.name, e.target.value)} name="fixed_expenses" />

            <label style={label}>Daily Spending Target (₹)</label>
            <input style={inp} type="number" value={form.daily_target} onChange={e => set(e.target.name, e.target.value)} name="daily_target" />

            <label style={label}>Current Balance (₹)</label>
            <input style={inp} type="number" value={form.current_balance} onChange={e => set(e.target.name, e.target.value)} name="current_balance" />

            <button onClick={handleSave} disabled={saving} style={{
              width: '100%', padding: 12, borderRadius: 8, background: '#22c55e',
              color: '#0f1117', border: 'none', fontWeight: 600, cursor: 'pointer',
              display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12
            }}>
              {saving ? <Spinner size={16} /> : 'Save Profile'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
