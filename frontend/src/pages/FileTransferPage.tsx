import { useState, useEffect } from 'react'
import { fileAPI } from '../api'
import './FileTransferPage.css'

interface FileInfo {
  fileId: string
  fileName: string
  fileSize: number
  uploadedAt: string
}

export default function FileTransferPage() {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { loadFiles() }, [])

  const loadFiles = async () => {
    try {
      const response = await fileAPI.list()
      setFiles(response.data)
    } catch (err) { console.error('Failed to load files') }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) return
    setUploading(true)
    try {
      await fileAPI.upload(selectedFile)
      setMessage(`✅ ${selectedFile.name} uploaded!`)
      setSelectedFile(null)
      await loadFiles()
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage('Upload failed')
    } finally {
      setUploading(false)
    }
  }

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
            <input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
            {selectedFile ? selectedFile.name : 'Choose file'}
          </label>
          <button type="submit" disabled={!selectedFile || uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
        </form>
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
