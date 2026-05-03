import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useSession } from '../../context/SessionContext'
import { LayoutDashboard, Zap, AlertTriangle, Info, ShieldCheck, Upload, User } from 'lucide-react'
import Badge from '../ui/Badge'
import UploadCsvModal from './UploadCsvModal'
import ProfileModal from './ProfileModal'

const nav = [
  { to: '/dashboard', icon: <LayoutDashboard size={18}/>, label: 'Dashboard' },
  { to: '/simulate',  icon: <Zap size={18}/>,             label: 'Simulate' },
  { to: '/about',     icon: <Info size={18}/>,            label: 'About' },
]

const tierColor = {
  Safe:         '#00e5c0',
  'Medium Risk': '#f59e0b',
  'High Risk':   '#ef4444',
}

export default function Sidebar() {
  const { balance, riskTier, survivalDays } = useSession()
  const color = tierColor[riskTier] || '#00e5c0'
  const [showUpload, setShowUpload] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  return (
    <>
      {showUpload && <UploadCsvModal onClose={() => setShowUpload(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}

      <aside style={{
        width: 220,
        minHeight: '100vh',
        background: '#0d0f2e',
        borderRight: `2px solid ${color}33`,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0',
        transition: 'border-color .3s',
        position: 'relative',
        flexShrink: 0,
      }}>
        {/* Subtle inner glow */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 200,
          background: `radial-gradient(ellipse at top left, ${color}12 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ padding: '0 18px 24px', borderBottom: '1px solid rgba(0,180,255,0.12)', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0055ff, #00b4ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(0,85,255,0.4)',
              flexShrink: 0,
            }}>
              <ShieldCheck size={22} color="#fff" />
            </div>
            <span style={{
              fontWeight: 800, fontSize: 22,
              color: '#f0f4ff',
              fontFamily: "'Syne', sans-serif",
              letterSpacing: 0,
              lineHeight: 1.02,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}>
              <span>VittArth</span>
              <span style={{
                background: 'linear-gradient(120deg, #4f8cff, #66f0dc)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>AI</span>
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', position: 'relative' }}>
          {nav.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              marginBottom: 4,
              background: isActive ? 'rgba(0,180,255,0.08)' : 'transparent',
              borderLeft: isActive ? '3px solid #00b4ff' : '3px solid transparent',
              color: isActive ? '#f0f4ff' : '#7b82b0',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: isActive ? 500 : 400,
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all .2s',
            })}>
              <span style={{ color: 'inherit', display: 'flex' }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Modal Triggers */}
        <div style={{ padding: '0 12px 16px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
          <button onClick={() => setShowProfile(true)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '9px 12px', borderRadius: 8, background: 'transparent',
            color: '#7b82b0', border: '1px solid rgba(123,130,176,0.25)',
            cursor: 'pointer', fontSize: 13, fontWeight: 400,
            fontFamily: "'DM Sans', sans-serif",
            transition: 'all .2s',
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'rgba(123,130,176,0.1)'; e.currentTarget.style.color = '#f0f4ff' }}
          onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#7b82b0' }}>
            <User size={15} /> Update Profile
          </button>

          <button onClick={() => setShowUpload(true)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '9px 12px', borderRadius: 8, background: 'transparent',
            color: '#00b4ff', border: '1px solid rgba(0,180,255,0.25)',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif",
            transition: 'all .2s',
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'rgba(0,180,255,0.08)' }}
          onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}>
            <Upload size={15} /> Upload New CSV
          </button>
        </div>

        {/* Footer balance panel */}
        <div style={{
          margin: '0 12px 4px',
          padding: '14px 16px',
          background: 'rgba(13,15,46,0.85)',
          border: '1px solid rgba(0,180,255,0.18)',
          borderRadius: 14,
          backdropFilter: 'blur(16px)',
          position: 'relative',
        }}>
          <div style={{ fontSize: 10, color: '#7b82b0', marginBottom: 4, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>
            Balance
          </div>
          <div style={{
            fontSize: 20, fontWeight: 800,
            fontFamily: "'Syne', sans-serif",
            background: 'linear-gradient(120deg, #00b4ff, #00e5c0)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 8,
          }}>
            ₹{balance.toLocaleString('en-IN')}
          </div>
          <Badge label={riskTier}
            variant={riskTier === 'Safe' ? 'safe' : riskTier === 'Medium Risk' ? 'medium' : 'high'} />
          <div style={{ fontSize: 11, color: '#7b82b0', marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>
            {survivalDays.toFixed(1)} days runway
          </div>
        </div>
      </aside>
    </>
  )
}
