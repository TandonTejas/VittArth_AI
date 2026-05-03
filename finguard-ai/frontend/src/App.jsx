import { Routes, Route, Navigate } from 'react-router-dom'
import { useSession } from './context/SessionContext'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import TransactionSimulator from './pages/TransactionSimulator'
import About from './pages/About'
import Sidebar from './components/layout/Sidebar'
import RiskTierBanner from './components/layout/RiskTierBanner'

function Protected({ children }) {
  const { sessionId } = useSession()
  if (!sessionId) return <Navigate to="/onboarding" replace />
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--fg-bg)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        <RiskTierBanner />
        <main style={{
          flex: 1,
          padding: '28px 32px',
          overflowY: 'auto',
          position: 'relative',
          background: 'var(--fg-bg)',
        }}>
          {/* Subtle background orbs for all protected pages */}
          <div style={{
            position: 'fixed', top: 0, left: 220, right: 0, bottom: 0,
            pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -200, right: -200,
              width: 600, height: 600, borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(0,85,255,0.06) 0%,transparent 65%)',
              filter: 'blur(80px)',
            }} />
            <div style={{
              position: 'absolute', bottom: -150, left: -100,
              width: 500, height: 500, borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(0,229,192,0.05) 0%,transparent 65%)',
              filter: 'blur(90px)',
            }} />
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/onboarding" replace />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/simulate" element={<Protected><TransactionSimulator /></Protected>} />
      <Route path="/about" element={<Protected><About /></Protected>} />
    </Routes>
  )
}
