import { useState, useEffect } from 'react'

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

const modules = [
  { id: 'A', name: 'OWL Ontology + Description Logic', lib: 'owlready2',
    concept: 'Knowledge Representation',
    desc: 'Classifies your vendors (e.g., Zomato → Food Delivery) using the India spending ontology. Bayesian priors encode historical regret patterns and are updated from your transaction history.' },
  { id: 'B', name: 'Rete Algorithm + Forward-Chaining Rules', lib: 'Custom rule engine',
    concept: 'Expert Systems / Rule-Based AI',
    desc: 'Nine salience-ordered rules fire in sequence to produce SPEND / PAUSE / AVOID decisions. Includes override softening: if you repeatedly override the AI, it learns to trust you more.' },
  { id: 'C', name: 'PyTorch Neural Network (MC-Dropout)', lib: 'PyTorch',
    concept: 'Deep Learning / Bayesian Uncertainty',
    desc: 'A 6-input regression network predicts financial runway in days. Monte Carlo dropout produces uncertainty bands — the wider the band, the less confident the model is.' },
]

const peas = [
  ['Performance', 'Minimize regret-inducing purchases, maximize financial runway, accuracy of AVOID decisions'],
  ['Environment', 'Bank transaction CSV, user profile, time of day, current balance, monthly cycle'],
  ['Actuators',   'SPEND / PAUSE / AVOID decision, nudge text'],
  ['Sensors',     'Transaction amount, payee name, hour, balance, historical spending patterns'],
]

const stack = [
  ['Backend',  ['Python 3.13', 'FastAPI', 'PyTorch 2.x', 'python-constraint', 'Pandas', 'Scikit-learn']],
  ['Frontend', ['React 18', 'Vite', 'Tailwind CSS v4', 'Recharts', 'React Router v6', 'Lucide Icons']],
]

const moduleAccentColors = ['#00b4ff', '#00e5c0', '#f59e0b', '#a855f7']

export default function About() {
  const [open, setOpen] = useState(null)
  useProgressBar()

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '8px 0 40px', position: 'relative' }}>
      <div id="progress-bar" />

      {/* Floating decor */}
      <svg style={{ position: 'absolute', top: 0, right: -20, width: 100, opacity: 0.06, pointerEvents: 'none', animation: 'floatGraphic 11s ease-in-out infinite' }} viewBox="0 0 80 80" fill="none">
        <path d="M35 5 L60 15 L60 40 Q60 62 35 75 Q10 62 10 40 L10 15 Z" stroke="#00e5c0" strokeWidth="2.5" fill="none"/>
      </svg>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <span className="section-tag"><span className="dot" />Under the Hood</span>
        <h1 style={{ margin: '6px 0 10px', color: '#f0f4ff', fontSize: 'clamp(2rem,4vw,3.2rem)', fontWeight: 800, fontFamily: "'Syne',sans-serif", letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          About{' '}
          <span style={{ background: 'linear-gradient(120deg,#00b4ff,#00e5c0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            VittArth AI
          </span>
        </h1>
        <p style={{ color: '#7b82b0', fontSize: 14, margin: 0, lineHeight: 1.7, fontFamily: "'DM Sans',sans-serif", maxWidth: 560 }}>
          An emotionally-aware personal finance assistant combining four classical AI paradigms to help you make better spending decisions.
        </p>
      </div>

      {/* AI Modules accordion */}
      <div style={{ marginBottom: 40 }}>
        <span className="section-tag"><span className="dot" />AI Architecture</span>
        <h2 style={{ margin: '6px 0 20px', color: '#f0f4ff', fontSize: 18, fontFamily: "'Syne',sans-serif", fontWeight: 800 }}>
          AI Modules
        </h2>
        {modules.map((m, idx) => {
          const accent = moduleAccentColors[idx]
          const isOpen = open === m.id
          return (
            <div key={m.id} className="fg-card" style={{ marginBottom: 10, overflow: 'hidden', borderColor: isOpen ? `${accent}44` : 'rgba(0,180,255,0.18)', transition: 'border-color 0.3s', boxShadow: isOpen ? `0 0 20px ${accent}15` : 'none' }}>
              <button
                onClick={() => setOpen(isOpen ? null : m.id)}
                style={{ width: '100%', background: 'none', border: 'none', padding: '16px 22px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}
              >
                <div>
                  <span style={{ fontSize: 10, color: accent, fontWeight: 700, marginRight: 10, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: "'Syne',sans-serif" }}>
                    Module {m.id}
                  </span>
                  <span style={{ color: '#f0f4ff', fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{m.name}</span>
                </div>
                <div style={{ width: 26, height: 26, borderRadius: '50%', border: `1px solid ${accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, fontSize: 16, flexShrink: 0, transition: 'all 0.3s', transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}>
                  +
                </div>
              </button>
              {isOpen && (
                <div style={{ padding: '0 22px 18px', borderTop: '1px solid rgba(0,180,255,0.08)' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, marginTop: 14, flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(0,180,255,0.08)', border: '1px solid rgba(0,180,255,0.15)', color: '#7b82b0', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontFamily: "'DM Sans',sans-serif" }}>
                      {m.concept}
                    </span>
                    <span style={{ background: `${accent}12`, border: `1px solid ${accent}33`, color: accent, fontSize: 11, padding: '3px 10px', borderRadius: 20, fontFamily: "'DM Sans',sans-serif" }}>
                      {m.lib}
                    </span>
                  </div>
                  <p style={{ color: '#7b82b0', fontSize: 13, margin: 0, lineHeight: 1.8, fontFamily: "'DM Sans',sans-serif" }}>{m.desc}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* PEAS Framework */}
      <div style={{ marginBottom: 40 }}>
        <span className="section-tag"><span className="dot" />Agent Design</span>
        <h2 style={{ margin: '6px 0 20px', color: '#f0f4ff', fontSize: 18, fontFamily: "'Syne',sans-serif", fontWeight: 800 }}>
          PEAS Framework
        </h2>
        <div className="fg-card" style={{ overflow: 'hidden' }}>
          {peas.map(([k, v], i) => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', borderBottom: i < peas.length - 1 ? '1px solid rgba(0,180,255,0.08)' : 'none' }}>
              <div style={{ padding: '15px 22px', fontSize: 11, fontWeight: 700, color: '#00b4ff', background: 'rgba(0,180,255,0.04)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Syne',sans-serif", display: 'flex', alignItems: 'center' }}>
                {k}
              </div>
              <div style={{ padding: '15px 22px', fontSize: 13, color: '#7b82b0', lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div>
        <span className="section-tag"><span className="dot" />Built With</span>
        <h2 style={{ margin: '6px 0 20px', color: '#f0f4ff', fontSize: 18, fontFamily: "'Syne',sans-serif", fontWeight: 800 }}>
          Tech Stack
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {stack.map(([section, items]) => (
            <div key={section} className="fg-card" style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 10, color: '#00e5c0', fontWeight: 700, marginBottom: 14, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: "'Syne',sans-serif" }}>
                {section}
              </div>
              {items.map(item => (
                <div key={item} style={{ fontSize: 13, color: '#7b82b0', padding: '5px 0', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'DM Sans',sans-serif", borderBottom: '1px solid rgba(0,180,255,0.05)' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00b4ff', flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
