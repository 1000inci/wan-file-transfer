import { useState } from 'react'
import { authAPI } from '../api'
import './AuthPage.css'

export default function ResetPage({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return }
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return }
    setLoading(true)
    try {
      await authAPI.reset(token, password)
      setDone(true)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Sıfırlama başarısız.')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>🔑 Yeni Şifre Belirle</h1>
        {done ? (
          <>
            <p className="info" style={{ color: '#2e7d32' }}>✓ Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.</p>
            <button type="button" onClick={() => { window.location.href = '/' }}>Girişe git</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <input type="password" placeholder="Yeni şifre" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <input type="password" placeholder="Yeni şifre (tekrar)" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading}>{loading ? 'Kaydediliyor...' : 'Şifreyi güncelle'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
