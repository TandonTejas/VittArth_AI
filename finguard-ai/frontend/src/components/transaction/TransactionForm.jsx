import { useState, useCallback } from 'react'
import { Upload, FileText } from 'lucide-react'

export default function TransactionForm({ onEvaluate, loading }) {
  const [form, setForm] = useState({ amount: '', payee: '', date: new Date().toISOString().slice(0,10), hour: 12 })
  const hourLabel = h => h < 6 ? 'Late Night 🌙' : h < 12 ? 'Morning ☀️' : h < 17 ? 'Afternoon 🌤' : h < 22 ? 'Evening 🌆' : 'Late Night 🌙'

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const submit = e => { 
    e.preventDefault(); 
    const amt = parseFloat(form.amount) || 0;
    if (amt < 0) return;
    onEvaluate({ ...form, amount: amt, payee: form.payee.trim(), hour: parseInt(form.hour) }) 
  }

  const inp = { background: '#0f1117', border: '1px solid #1e2535', borderRadius: 8,
    color: '#e2e8f0', padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none' }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Amount (₹)</label>
        <input type="number" style={inp} value={form.amount} onChange={e => set('amount', e.target.value)}
          placeholder="e.g. 349" required min="0" />
      </div>
      <div>
        <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Vendor / Payee</label>
        <input type="text" style={inp} value={form.payee} onChange={e => set('payee', e.target.value)}
          placeholder="e.g. Zomato, Netflix, DMart" required />
      </div>
      <div>
        <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Date</label>
        <input type="date" style={inp} value={form.date} onChange={e => set('date', e.target.value)} />
      </div>
      <div>
        <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
          Hour — <span style={{ color: '#6366f1' }}>{hourLabel(parseInt(form.hour))}</span>
        </label>
        <input type="range" min="0" max="23" value={form.hour} onChange={e => set('hour', e.target.value)}
          style={{ width: '100%', accentColor: '#6366f1' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginTop: 2 }}>
          <span>0:00</span><span>{form.hour}:00</span><span>23:00</span>
        </div>
      </div>
      <button type="submit" disabled={loading} style={{
        background: loading ? '#374151' : '#6366f1', color: '#fff', border: 'none',
        borderRadius: 8, padding: '12px', cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: 14, fontWeight: 600, transition: 'background .2s'
      }}>
        {loading ? 'Evaluating…' : 'Evaluate Transaction'}
      </button>
    </form>
  )
}
