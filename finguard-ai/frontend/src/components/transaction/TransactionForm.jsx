import { useState } from 'react'
import CategoryCorrection from './CategoryCorrection'

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

export default function TransactionForm({
  onEvaluate,
  onMessageIngest,
  loading,
  mode = 'analysis',
  onBack,
  correctionResult,
  correctionVendor,
  onCategoryUpdate,
}) {
  const [form, setForm] = useState({
    amount: '', payee: '',
    date: new Date().toISOString().slice(0, 10),
    hour: 12,
  })
  const [bankMessage, setBankMessage] = useState('')

  const hourLabel = h =>
    h < 6 ? 'Late Night 🌙' : h < 12 ? 'Morning ☀️' : h < 17 ? 'Afternoon 🌤' : h < 22 ? 'Evening 🌆' : 'Late Night 🌙'

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const submit = e => {
    e.preventDefault()
    const amt = parseFloat(form.amount) || 0
    if (amt < 0) return
    onEvaluate({ ...form, amount: amt, payee: form.payee.trim(), hour: parseInt(form.hour) })
  }

  const submitMessage = () => {
    const message = bankMessage.trim()
    if (!message) return
    onMessageIngest(message)
  }

  const focusStyle = e => { e.target.style.borderColor = 'rgba(0,180,255,0.5)' }
  const blurStyle  = e => { e.target.style.borderColor = 'rgba(0,180,255,0.18)' }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            alignSelf: 'flex-start',
            background: 'transparent',
            border: 'none',
            color: '#00b4ff',
            cursor: 'pointer',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            padding: 0,
          }}
        >
          Back
        </button>
      )}

      {mode === 'message' && (
        <div style={{
          border: '1px solid rgba(0,229,192,0.18)',
          borderRadius: 12,
          background: 'rgba(0,229,192,0.04)',
          padding: 12,
        }}>
          <label style={labelStyle}>Bank Message</label>
          <textarea
            style={{ ...inp, minHeight: 132, resize: 'vertical', lineHeight: 1.45 }}
            value={bankMessage}
            onChange={e => setBankMessage(e.target.value)}
            placeholder="Paste bank SMS, e.g. Rs.849 debited to Zomato on 03-May-2026 at 23:45"
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
          <button
            type="button"
            onClick={submitMessage}
            disabled={loading || !bankMessage.trim()}
            style={{
              width: '100%',
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(0,229,192,0.28)',
              background: bankMessage.trim() ? 'rgba(0,229,192,0.12)' : 'rgba(123,130,176,0.08)',
              color: bankMessage.trim() ? '#00e5c0' : '#7b82b0',
              cursor: loading || !bankMessage.trim() ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {loading ? 'Parsing...' : 'Parse & Record Bank Message'}
          </button>
        </div>
      )}

      {mode === 'analysis' && (
        <>
          <div>
            <label style={labelStyle}>Amount (₹)</label>
            <input
              type="number" style={inp} value={form.amount}
              onChange={e => set('amount', e.target.value)}
              placeholder="e.g. 349" required min="0"
              onFocus={focusStyle} onBlur={blurStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Vendor / Payee</label>
            <input
              type="text" style={inp} value={form.payee}
              onChange={e => set('payee', e.target.value)}
              placeholder="e.g. Zomato, Netflix, DMart" required
              onFocus={focusStyle} onBlur={blurStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date" style={inp} value={form.date}
              onChange={e => set('date', e.target.value)}
              onFocus={focusStyle} onBlur={blurStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>
              Hour —{' '}
              <span style={{ color: '#00b4ff', fontWeight: 600 }}>
                {hourLabel(parseInt(form.hour))}
              </span>
            </label>
            <input
              type="range" min="0" max="23" value={form.hour}
              onChange={e => set('hour', e.target.value)}
              style={{ width: '100%', accentColor: '#00b4ff' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7b82b0', marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
              <span>0:00</span>
              <span style={{ color: '#00b4ff', fontWeight: 600 }}>{form.hour}:00</span>
              <span>23:00</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Evaluating...' : 'Evaluate Transaction'}
          </button>

          {correctionResult?.category && onCategoryUpdate && (
            <CategoryCorrection
              currentCategory={correctionResult.category}
              vendorName={correctionVendor}
              onCategoryUpdate={onCategoryUpdate}
            />
          )}

        </>
      )}
    </form>
  )
}
