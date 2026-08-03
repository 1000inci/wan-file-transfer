import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync, writeFileSync, unlinkSync, readdirSync, statSync, existsSync } from 'fs'
import { mkdirSync } from 'fs'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(cors())
app.use(express.json())

const uploadsDir = join(__dirname, 'uploads')
const metadataFile = join(__dirname, 'metadata.json')
const usersFile = join(__dirname, 'users.json')
mkdirSync(uploadsDir, { recursive: true })

let metadata = {}
if (existsSync(metadataFile)) metadata = JSON.parse(readFileSync(metadataFile, 'utf-8'))

let users = {}
if (existsSync(usersFile)) users = JSON.parse(readFileSync(usersFile, 'utf-8'))

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const id = crypto.randomUUID()
    const ext = file.originalname.substring(file.originalname.lastIndexOf('.'))
    const name = `${id}${ext}`
    // istemci yuklemeyi yarida keserse silebilmek icin yolu kaydet
    ;(req.yazilanDosyalar ||= []).push(join(uploadsDir, name))
    cb(null, name)
  }
})
const upload = multer({ storage })

// Yukleme yarida kesilirse (istemci "Durdur" dedi veya baglanti koptu) diskte
// yarim dosya kalir. Yanit tamamlanmadan baglanti kapanirsa onlari sil.
function temizlemeyiBagla(req, res, next) {
  req.yazilanDosyalar = []
  res.on('close', () => {
    if (res.writableFinished) return // normal tamamlandi, dokunma
    req.yuklemeIptal = true
    // multer'in yazma akisi kapansin diye kisa bir gecikme
    setTimeout(() => {
      for (const yol of req.yazilanDosyalar) {
        try { unlinkSync(yol) } catch { /* zaten yok */ }
      }
    }, 500)
  })
  next()
}

const tokens = {}
const resetTokens = {}

function hashPassword(p) { return crypto.createHash('sha256').update(p).digest('base64') }
function generateToken(u) { return Buffer.from(`${u}:${crypto.randomUUID()}`).toString('base64') }

function getUser(username) {
  const u = users[username]
  if (!u) return null
  if (typeof u === 'string') return { pass: u, email: '', admin: false }
  return u
}
function isAdmin(username) { const u = getUser(username); return !!(u && u.admin) }

const ADMIN_SECRET = process.env.ADMIN_SECRET || ''
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://transfer.1000inci.com'

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
})

async function sendResetLinkMail(toEmail, username, link) {
  await mailer.sendMail({
    from: process.env.SMTP_USER,
    to: toEmail,
    subject: 'WAN Dosya Transfer — Sifre Sifirlama',
    text: `Merhaba,\n\n"${username}" hesabi icin sifre sifirlama talebi alindi.\n\nYeni sifrenizi belirlemek icin asagidaki baglantiya tiklayin (1 saat gecerli):\n\n${link}\n\nBu talebi siz yapmadiysaniz bu e-postayi yok sayin; sifreniz degismez.`
  })
}

function checkAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token || !tokens[token]) return res.status(401).json({ message: 'Unauthorized' })
  req.username = tokens[token]
  next()
}
function checkAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const username = token && tokens[token]
  if (!username || !isAdmin(username)) return res.status(403).json({ message: 'Yetki yok' })
  req.username = username
  next()
}

// CLI icin (add_user.sh) — admin secret ile
app.post('/api/auth/register', (req, res) => {
  if (!ADMIN_SECRET || req.headers['x-admin-secret'] !== ADMIN_SECRET) return res.status(403).json({ message: 'Kayit kapali' })
  const { username, password, email, admin } = req.body
  if (!username || !password || !email) return res.status(400).json({ message: 'Kullanici, sifre ve e-posta gerekli' })
  if (users[username]) return res.status(400).json({ message: 'Exists' })
  users[username] = { pass: hashPassword(password), email, admin: !!admin }
  writeFileSync(usersFile, JSON.stringify(users))
  res.json({ message: 'Success' })
})

app.post('/api/auth/forgot', async (req, res) => {
  const { username, email } = req.body
  if (!username || !email) return res.status(400).json({ message: 'Kullanici adi ve e-posta gerekli' })
  const user = getUser(username)
  const generic = { message: 'Bilgiler dogruysa, sifirlama baglantisi e-posta adresinize gonderildi.' }
  if (!user || !user.email || user.email.toLowerCase() !== String(email).toLowerCase()) return res.json(generic)
  const token = crypto.randomBytes(24).toString('hex')
  resetTokens[token] = { username, expires: Date.now() + 60 * 60 * 1000 }
  const link = `${PUBLIC_URL}/?token=${token}`
  try { await sendResetLinkMail(user.email, username, link) }
  catch (e) { console.error('Mail hatasi:', e.message); delete resetTokens[token]; return res.status(500).json({ message: 'Mail gonderilemedi, tekrar deneyin.' }) }
  res.json(generic)
})

app.post('/api/auth/reset', (req, res) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ message: 'Token ve yeni sifre gerekli' })
  if (String(password).length < 6) return res.status(400).json({ message: 'Sifre en az 6 karakter olmali' })
  const entry = resetTokens[token]
  if (!entry || entry.expires < Date.now()) { delete resetTokens[token]; return res.status(400).json({ message: 'Baglanti gecersiz veya suresi dolmus. Tekrar talep edin.' }) }
  const user = getUser(entry.username)
  if (!user) return res.status(400).json({ message: 'Kullanici bulunamadi' })
  users[entry.username] = { pass: hashPassword(password), email: user.email, admin: !!user.admin }
  writeFileSync(usersFile, JSON.stringify(users))
  delete resetTokens[token]
  res.json({ message: 'Sifreniz guncellendi. Yeni sifrenizle giris yapabilirsiniz.' })
})

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ message: 'Required' })
  const user = getUser(username)
  if (!user || user.pass !== hashPassword(password)) return res.status(401).json({ message: 'Invalid' })
  const token = generateToken(username)
  tokens[token] = username
  res.json({ token, message: 'Success', username, isAdmin: !!user.admin })
})

// --- Admin: kullanici yonetimi ---
app.get('/api/users', checkAdmin, (req, res) => {
  res.json(Object.keys(users).map(name => { const u = getUser(name); return { username: name, email: u.email || '', admin: !!u.admin } }))
})
app.post('/api/users', checkAdmin, (req, res) => {
  const { username, password, email, admin } = req.body
  if (!username || !password || !email) return res.status(400).json({ message: 'Kullanici, sifre ve e-posta gerekli' })
  if (users[username]) return res.status(400).json({ message: 'Bu kullanici zaten var' })
  users[username] = { pass: hashPassword(password), email, admin: !!admin }
  writeFileSync(usersFile, JSON.stringify(users))
  res.json({ message: 'Eklendi' })
})
app.delete('/api/users/:username', checkAdmin, (req, res) => {
  const target = req.params.username
  if (!users[target]) return res.status(404).json({ message: 'Kullanici yok' })
  const admins = Object.keys(users).filter(n => isAdmin(n))
  if (isAdmin(target) && admins.length <= 1) return res.status(400).json({ message: 'Son admin silinemez' })
  delete users[target]
  writeFileSync(usersFile, JSON.stringify(users))
  res.json({ message: 'Silindi' })
})

// --- Dosya uclari ---
app.post('/api/files/upload', checkAuth, temizlemeyiBagla, upload.single('file'), (req, res) => {
  // iptal edilmisse metadata yazma; dosyayi res 'close' temizleyecek
  if (req.yuklemeIptal) return
  if (!req.file) return res.status(400).json({ message: 'No file' })
  const fileId = req.file.filename.split('.')[0]
  req.file.originalname = Buffer.from(req.file.originalname, "latin1").toString("utf8")
  metadata[fileId] = { originalName: req.file.originalname, uploadedAt: new Date() }
  writeFileSync(metadataFile, JSON.stringify(metadata))
  res.json({ message: 'Success', fileName: req.file.originalname, size: req.file.size, fileId })
})
app.get('/api/files', checkAuth, (req, res) => {
  const files = readdirSync(uploadsDir).map(filename => {
    const fileId = filename.split('.')[0]
    const stat = statSync(join(uploadsDir, filename))
    const originalName = metadata[fileId]?.originalName || filename
    return { fileId, fileName: originalName, fileSize: stat.size, uploadedAt: stat.birthtimeMs }
  })
  res.json(files)
})
app.get('/api/files/:fileId', checkAuth, (req, res) => {
  const file = readdirSync(uploadsDir).find(f => f.startsWith(req.params.fileId))
  if (!file) return res.status(404).json({ message: 'Not found' })
  res.download(join(uploadsDir, file))
})
app.delete('/api/files/:fileId', checkAuth, (req, res) => {
  const file = readdirSync(uploadsDir).find(f => f.startsWith(req.params.fileId))
  if (!file) return res.status(404).json({ message: 'Not found' })
  unlinkSync(join(uploadsDir, file))
  delete metadata[req.params.fileId]
  writeFileSync(metadataFile, JSON.stringify(metadata))
  res.json({ message: 'Deleted' })
})

app.get('/api/health', (req, res) => res.json({ status: 'Running' }))
app.listen(8000, '0.0.0.0', () => console.log('Backend: http://0.0.0.0:8000'))
