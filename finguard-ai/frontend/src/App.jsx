import { Routes, Route, Navigate } from 'react-router-dom'
import { useSession } from './context/SessionContext'
import Onboarding          from './pages/Onboarding'
import Dashboard           from './pages/Dashboard'
import TransactionSimulator from './pages/TransactionSimulator'
import EmergencyPlanner    from './pages/EmergencyPlanner'
import About               from './pages/About'
import Sidebar             from './components/layout/Sidebar'
import RiskTierBanner      from './components/layout/RiskTierBanner'

function Protected({ children }) {
  const { sessionId } = useSession()
  if (!sessionId) return <Navigate to="/onboarding" replace />
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <RiskTierBanner />
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const { sessionId } = useSession()
  return (
    <Routes>
      <Route path="/" element={<Navigate to={sessionId ? '/dashboard' : '/onboarding'} replace />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/dashboard"  element={<Protected><Dashboard /></Protected>} />
      <Route path="/simulate"   element={<Protected><TransactionSimulator /></Protected>} />
      <Route path="/emergency"  element={<Protected><EmergencyPlanner /></Protected>} />
      <Route path="/about"      element={<About />} />
    </Routes>
  )
}
