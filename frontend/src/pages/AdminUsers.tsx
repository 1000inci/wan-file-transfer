import { useEffect, useState } from 'react'
import { userAPI } from '../api'

type U = { username: string; email: string; admin: boolean }

export default function AdminUsers() {
  const [users, setUsers] = useState<U[]>([])
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [admin, setAdmin] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try { const r = await userAPI.list(); setUsers(r.data) }
    catch { setErr('Kullanıcılar yüklenemedi.') }
  }
  useEffect(() => { load() }, [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setErr('')
    if (!username || !email || !password) { setErr('Tüm alanlar gerekli.'); return }
    setLoading(true)
    try {
      await userAPI.add(username, password, email, admin)
      setMsg(`✓ ${username} eklendi`)
      setUsername(''); setEmail(''); setPassword(''); setAdmin(false)
      await load()
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Eklenemedi')
    } finally { setLoading(false) }
  }

  const remove = async (name: string) => {
    if (!window.confirm(`${name} silinsin mi?`)) return
    setMsg(''); setErr('')
    try { await userAPI.remove(name); setMsg(`✓ ${name} silindi`); await load() }
    catch (e: any) { setErr(e?.response?.data?.message || 'Silinemedi') }
  }

  return (
    <div className="transfer-container">
      <div className="upload-section">
        <h2>👤 Yeni Kullanıcı</h2>
        <form onSubmit={add}>
          <input type="text" placeholder="Kullanıcı adı" value={username} onChange={e => setUsername(e.target.value)} />
          <input type="email" placeholder="E-posta" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0' }}>
            <input type="checkbox" checked={admin} onChange={e => setAdmin(e.target.checked)} /> Admin yetkisi ver
          </label>
          <button type="submit" disabled={loading}>{loading ? 'Ekleniyor...' : 'Ekle'}</button>
        </form>
        {msg && <p className="success">{msg}</p>}
        {err && <p className="error">{err}</p>}
      </div>
      <div className="files-section">
        <h2>📋 Kullanıcılar ({users.length})</h2>
        <div className="files-list">
          {users.map(u => (
            <div className="file-item" key={u.username}>
              <div>
                <strong>{u.username}</strong>{u.admin && <span style={{ color: '#667eea' }}> (admin)</span>}
                <br /><small>{u.email}</small>
              </div>
              <div className="actions">
                <button onClick={() => remove(u.username)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
