import { useState } from 'react'

const modules = [
  { id: 'A', name: 'OWL Ontology + Description Logic', lib: 'owlready2',
    concept: 'Knowledge Representation',
    desc: 'Classifies your vendors (e.g., Zomato → LateNightCraving) using a formal ontology. Bayesian priors encode historical regret patterns and are updated from your transaction history.' },
  { id: 'B', name: 'Rete Algorithm + Forward-Chaining Rules', lib: 'Custom rule engine',
    concept: 'Expert Systems / Rule-Based AI',
    desc: 'Nine salience-ordered rules fire in sequence to produce SPEND / PAUSE / AVOID decisions. Includes override softening: if you repeatedly override the AI, it learns to trust you more.' },
  { id: 'C', name: 'PyTorch Neural Network (MC-Dropout)', lib: 'PyTorch',
    concept: 'Deep Learning / Bayesian Uncertainty',
    desc: 'A 6-input regression network predicts financial runway in days. Monte Carlo dropout produces uncertainty bands — the wider the band, the less confident the model is.' },
  { id: 'D', name: 'Constraint Satisfaction Problem', lib: 'python-constraint',
    concept: 'Combinatorial Optimization',
    desc: 'Finds a feasible daily budget split across Food, Travel, and Discretionary spending under hard constraints (food ≥ ₹80, total ≤ daily budget, total ≥ 80% of budget).' },
]

const peas = [
  ['Performance', 'Minimize regret-inducing purchases, maximize financial runway, accuracy of AVOID decisions'],
  ['Environment', 'Bank transaction CSV, user profile, time of day, current balance, monthly cycle'],
  ['Actuators', 'SPEND / PAUSE / AVOID decision, nudge text, emergency budget allocation'],
  ['Sensors', 'Transaction amount, payee name, hour, balance, historical spending patterns'],
]

const stack = [
  ['Backend', ['Python 3.13', 'FastAPI', 'PyTorch 2.x', 'python-constraint', 'Pandas', 'Scikit-learn']],
  ['Frontend', ['React 18', 'Vite', 'Tailwind CSS v4', 'Recharts', 'React Router v6', 'Lucide Icons']],
]

export default function About() {
  const [open, setOpen] = useState(null)

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 700, margin: '0 0 8px' }}>About FinGuard AI</h1>
      <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 40px', lineHeight: 1.7 }}>
        An emotionally-aware personal finance assistant combining four classical AI paradigms to help you make better spending decisions.
      </p>

      {/* Modules accordion */}
      <h2 style={{ color: '#e2e8f0', fontSize: 16, margin: '0 0 16px' }}>AI Modules</h2>
      {modules.map(m => (
        <div key={m.id} style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
          <button onClick={() => setOpen(open === m.id ? null : m.id)}
            style={{ width: '100%', background: 'none', border: 'none', padding: '14px 20px', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
            <div>
              <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginRight: 8 }}>Module {m.id}</span>
              <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>{m.name}</span>
            </div>
            <span style={{ color: '#64748b', fontSize: 18 }}>{open === m.id ? '−' : '+'}</span>
          </button>
          {open === m.id && (
            <div style={{ padding: '0 20px 16px', borderTop: '1px solid #1e2535' }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{ background: '#1e2535', color: '#94a3b8', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>{m.concept}</span>
                <span style={{ background: '#1e2535', color: '#6366f1', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>{m.lib}</span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: 13, margin: 0, lineHeight: 1.7 }}>{m.desc}</p>
            </div>
          )}
        </div>
      ))}

      {/* PEAS */}
      <h2 style={{ color: '#e2e8f0', fontSize: 16, margin: '32px 0 16px' }}>PEAS Framework</h2>
      <div style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 10, overflow: 'hidden' }}>
        {peas.map(([k, v], i) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '140px 1fr',
            borderBottom: i < peas.length - 1 ? '1px solid #1e2535' : 'none' }}>
            <div style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: '#6366f1', background: '#0f1117' }}>{k}</div>
            <div style={{ padding: '14px 20px', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Tech stack */}
      <h2 style={{ color: '#e2e8f0', fontSize: 16, margin: '32px 0 16px' }}>Tech Stack</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {stack.map(([section, items]) => (
          <div key={section} style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 700, marginBottom: 10 }}>{section.toUpperCase()}</div>
            {items.map(item => (
              <div key={item} style={{ fontSize: 13, color: '#94a3b8', padding: '4px 0' }}>· {item}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
