import { useState } from 'react'
import { authAPI } from '../api'
import './AuthPage.css'

export default function AuthPage({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setInfo(''); setLoading(true)
    try {
      const response = await authAPI.login(username, password)
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('isAdmin', response.data.isAdmin ? '1' : '')
      onAuthSuccess()
    } catch {
      setError('Giriş başarısız: kullanıcı adı veya şifre hatalı')
    } finally { setLoading(false) }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setInfo('')
    if (!username || !email) { setError('Kullanıcı adı ve e-posta gerekli.'); return }
    setLoading(true)
    try {
      const res = await authAPI.forgot(username, email)
      setInfo(res.data?.message || '✓ Sıfırlama bağlantısı e-posta adresinize gönderildi.')
    } catch (err: any) {
      const msg = err?.response?.data?.message
      setError(msg ? `Hata: ${msg}` : 'İşlem başarısız, tekrar deneyin.')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>🔐 WAN File Transfer</h1>
        {mode === 'login' ? (
          <>
            <form onSubmit={handleLogin}>
              <input type="text" placeholder="Kullanıcı adı" value={username} onChange={(e) => setUsername(e.target.value)} required />
              <input type="password" placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} required />
              {error && <p className="error">{error}</p>}
              {info && <p className="info" style={{ color: '#2e7d32' }}>{info}</p>}
              <button type="submit" disabled={loading}>{loading ? 'Lütfen bekleyin...' : 'Giriş'}</button>
            </form>
            <button type="button" onClick={() => { setMode('forgot'); setError(''); setInfo('') }} disabled={loading} style={{ background: 'transparent', color: '#667eea', textDecoration: 'underline' }}>
              Şifremi unuttum
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: '#555' }}>Kullanıcı adınızı ve kayıtlı e-postanızı girin. Eşleşirse sıfırlama bağlantısı e-postanıza gönderilir.</p>
            <form onSubmit={handleForgot}>
              <input type="text" placeholder="Kullanıcı adı" value={username} onChange={(e) => setUsername(e.target.value)} required />
              <input type="email" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} required />
              {error && <p className="error">{error}</p>}
              {info && <p className="info" style={{ color: '#2e7d32' }}>{info}</p>}
              <button type="submit" disabled={loading}>{loading ? 'Gönderiliyor...' : 'Sıfırlama bağlantısı gönder'}</button>
            </form>
            <button type="button" onClick={() => { setMode('login'); setError(''); setInfo('') }} disabled={loading} style={{ background: 'transparent', color: '#667eea', textDecoration: 'underline' }}>
              ← Girişe dön
            </button>
          </>
        )}
      </div>
    </div>
  )
}
