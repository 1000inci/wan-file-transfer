import { useState } from 'react'
import AuthPage from './pages/AuthPage'
import ResetPage from './pages/ResetPage'
import FileTransferPage from './pages/FileTransferPage'
import AdminUsers from './pages/AdminUsers'
import './App.css'

function App() {
  const resetToken = new URLSearchParams(window.location.search).get('token')
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'))
  const [view, setView] = useState<'files' | 'users'>('files')
  const isAdmin = localStorage.getItem('isAdmin') === '1'

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('isAdmin')
    setIsAuthenticated(false)
    setView('files')
  }
  const handleAuthSuccess = () => setIsAuthenticated(true)

  if (resetToken) {
    return <div className="app"><ResetPage token={resetToken} /></div>
  }

  return (
    <div className="app">
      {!isAuthenticated ? (
        <AuthPage onAuthSuccess={handleAuthSuccess} />
      ) : (
        <>
          <header className="app-header">
            <h1>🌐 WAN File Transfer</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              {isAdmin && (
                <button className="logout-btn" onClick={() => setView(view === 'files' ? 'users' : 'files')}>
                  {view === 'files' ? '👤 Kullanıcılar' : '📁 Dosyalar'}
                </button>
              )}
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </div>
          </header>
          {isAdmin && view === 'users' ? <AdminUsers /> : <FileTransferPage />}
        </>
      )}
    </div>
  )
}

export default App
