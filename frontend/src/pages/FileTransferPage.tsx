import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { fileAPI } from '../api'
import './FileTransferPage.css'

interface FileInfo {
  fileId: string
  fileName: string
  fileSize: number
  uploadedAt: string
}

// Cloudflare (ucretsiz plan) proxy'li isteklerde govde boyutunu 100 MB ile
// sinirlar. transfer.1000inci.com tunelden gectigi icin bu esigi asan dosya
// yuklenemez; istek kenarda kesilir ve tarayici ilerleme uretmeyi birakir.
// Kullanici 4 dakika bekleyip basarisizligi gormesin diye onden uyariyoruz.
const CLOUDFLARE_MAX_BYTES = 100 * 1024 * 1024

export default function FileTransferPage() {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [percent, setPercent] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [speed, setSpeed] = useState(0)
  // yukleme %100'e ulastiktan sonra sunucu dosyayi yazip cevap verene kadar gecen sure
  const [finishing, setFinishing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const startedAtRef = useRef(0)

  useEffect(() => { loadFiles() }, [])

  // sayfa kapanirsa/bilesen sokulurse acik istegi birak
  useEffect(() => () => abortRef.current?.abort(), [])

  const loadFiles = async () => {
    try {
      const response = await fileAPI.list()
      setFiles(response.data)
    } catch (err) { console.error('Failed to load files') }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) return
    if (selectedFile.size > CLOUDFLARE_MAX_BYTES) return

    const controller = new AbortController()
    abortRef.current = controller
    startedAtRef.current = Date.now()

    setUploading(true)
    setFinishing(false)
    setMessage('')
    setPercent(0)
    setLoaded(0)
    setSpeed(0)

    try {
      await fileAPI.upload(
        selectedFile,
        (p) => {
          setPercent(p.percent)
          setLoaded(p.loaded)
          const elapsed = (Date.now() - startedAtRef.current) / 1000
          if (elapsed > 0.5) setSpeed(p.loaded / elapsed)
          // bayt akisi bitti, sunucunun cevabi bekleniyor
          if (p.loaded >= p.total) setFinishing(true)
        },
        controller.signal,
      )
      setMessage(`✅ ${selectedFile.name} uploaded!`)
      setSelectedFile(null)
      await loadFiles()
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      if (axios.isCancel(err)) {
        setMessage('⏹️ Upload cancelled')
      } else {
        setMessage('Upload failed')
      }
    } finally {
      abortRef.current = null
      setUploading(false)
      setFinishing(false)
      setPercent(0)
      setLoaded(0)
      setSpeed(0)
    }
  }

  const handleCancel = () => abortRef.current?.abort()

  const tooLarge = !!selectedFile && selectedFile.size > CLOUDFLARE_MAX_BYTES

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const response = await fileAPI.download(fileId)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.parentElement?.removeChild(link)
    } catch (err) {
      setMessage('Download failed')
    }
  }

  const handleDelete = async (fileId: string) => {
    if (!window.confirm('Delete this file?')) return
    try {
      await fileAPI.delete(fileId)
      setMessage('✅ File deleted')
      await loadFiles()
    } catch (err) {
      setMessage('Delete failed')
    }
  }

  const formatSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="transfer-container">
      <div className="upload-section">
        <h2>📤 Upload File</h2>
        <form onSubmit={handleUpload}>
          <label className="file-input">
            <input
              type="file"
              disabled={uploading}
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
            {selectedFile ? selectedFile.name : 'Choose file'}
          </label>
          <button type="submit" disabled={!selectedFile || uploading || tooLarge}>{uploading ? 'Uploading...' : 'Upload'}</button>
        </form>

        {tooLarge && selectedFile && (
          <p className="size-warning">
            ⚠️ {formatSize(selectedFile.size)} — too large to upload.
            The Cloudflare tunnel accepts at most {formatSize(CLOUDFLARE_MAX_BYTES)} per request.
            Please choose a smaller file or split it into parts.
          </p>
        )}

        {uploading && (
          <div className="upload-progress">
            <div className="progress-track">
              <div
                className={`progress-bar${finishing ? ' finishing' : ''}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="progress-info">
              <span className="progress-percent">%{percent}</span>
              <span className="progress-detail">
                {finishing
                  ? 'Processing on server...'
                  : `${formatSize(loaded)}${selectedFile ? ` / ${formatSize(selectedFile.size)}` : ''}` +
                    (speed > 0 ? ` · ${formatSize(speed)}/s` : '')}
              </span>
              <button type="button" className="cancel-btn" onClick={handleCancel}>
                ⏹️ Cancel
              </button>
            </div>
          </div>
        )}

        {message && <p className={message.includes('✅') ? 'success' : 'error'}>{message}</p>}
      </div>

      <div className="files-section">
        <h2>📁 Files ({files.length})</h2>
        {files.length === 0 ? (
          <p>No files uploaded</p>
        ) : (
          <div className="files-list">
            {files.map((file) => (
              <div key={file.fileId} className="file-item">
                <div><strong>{file.fileName}</strong><br/><small>{formatSize(file.fileSize)}</small></div>
                <div className="actions">
                  <button onClick={() => handleDownload(file.fileId, file.fileName)}>⬇️</button>
                  <button onClick={() => handleDelete(file.fileId)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
