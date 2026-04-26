import { createContext, useContext, useState, useEffect } from 'react'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [sessionId,     setSessionId]     = useState(() => localStorage.getItem('fg_session') || null)
  const [balance,       setBalance]       = useState(0)
  const [riskTier,      setRiskTier]      = useState('Safe')
  const [isOnboarded,   setIsOnboarded]   = useState(() => !!localStorage.getItem('fg_session'))
  const [survivalDays,  setSurvivalDays]  = useState(0)
  const [overrideCounts,setOverrideCounts]= useState({})

  useEffect(() => {
    if (sessionId) localStorage.setItem('fg_session', sessionId)
    else           localStorage.removeItem('fg_session')
  }, [sessionId])

  return (
    <SessionContext.Provider value={{
      sessionId, setSessionId, balance, setBalance,
      riskTier,  setRiskTier,  isOnboarded, setIsOnboarded,
      survivalDays, setSurvivalDays, overrideCounts, setOverrideCounts
    }}>
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = () => useContext(SessionContext)
