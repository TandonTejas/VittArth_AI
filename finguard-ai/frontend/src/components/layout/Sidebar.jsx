import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useSession } from '../../context/SessionContext'
import { LayoutDashboard, Zap, AlertTriangle, Info, ShieldCheck, Upload, User } from 'lucide-react'
import Badge from '../ui/Badge'
import UploadCsvModal from './UploadCsvModal'
import ProfileModal from './ProfileModal'

const nav = [
  { to: '/dashboard', icon: <LayoutDashboard size={18}/>, label: 'Dashboard' },
  { to: '/simulate',  icon: <Zap size={18}/>,             label: 'Simulate' },
  { to: '/emergency', icon: <AlertTriangle size={18}/>,   label: 'Emergency' },
  { to: '/about',     icon: <Info size={18}/>,            label: 'About' },
]

const tierColor = { Safe: '#22c55e', 'Medium Risk': '#f59e0b', 'High Risk': '#ef4444' }

export default function Sidebar() {
  const { balance, riskTier, survivalDays, setSessionId, setBalance, setIsOnboarded } = useSession()
  const color = tierColor[riskTier] || '#22c55e'
  const [showUpload, setShowUpload] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  return (
    <>
      {showUpload && <UploadCsvModal onClose={() => setShowUpload(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      
      <aside style={{
        width: 220, minHeight: '100vh', background: '#131720',
        borderRight: `2px solid ${color}`,
        display: 'flex', flexDirection: 'column', padding: '24px 0',
        transition: 'border-color .3s'
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #1e2535' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={22} color={color} />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>FinGuard AI</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {nav.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8, marginBottom: 4,
              background: isActive ? '#1e2535' : 'transparent',
              color: isActive ? '#f1f5f9' : '#94a3b8',
              textDecoration: 'none', fontSize: 14, fontWeight: isActive ? 600 : 400,
              transition: 'all .2s'
            })}>
              {icon}{label}
            </NavLink>
          ))}
        </nav>

        {/* Modals Triggers */}
        <div style={{ padding: '0 12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => setShowProfile(true)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '10px 12px', borderRadius: 8, background: 'transparent',
            color: '#a8b8d8', border: '1px solid #a8b8d844', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, transition: 'all .2s'
          }} onMouseOver={e => e.currentTarget.style.background = '#a8b8d822'}
             onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
            <User size={16} /> Update Profile
          </button>
          
          <button onClick={() => setShowUpload(true)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '10px 12px', borderRadius: 8, background: 'transparent',
            color: '#38bdf8', border: '1px solid #38bdf844', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, transition: 'all .2s'
          }} onMouseOver={e => e.currentTarget.style.background = '#38bdf822'}
             onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
            <Upload size={16} /> Upload New CSV
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #1e2535' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>BALANCE</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
            ₹{balance.toLocaleString('en-IN')}
          </div>
          <Badge label={riskTier}
            variant={riskTier === 'Safe' ? 'safe' : riskTier === 'Medium Risk' ? 'medium' : 'high'} />
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
            {survivalDays.toFixed(1)} days runway
          </div>
        </div>
      </aside>
    </>
  )
}
