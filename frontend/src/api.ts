import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  forgot: (username: string, email: string) =>
    api.post('/auth/forgot', { username, email }),
  reset: (token: string, password: string) =>
    api.post('/auth/reset', { token, password }),
}

export const userAPI = {
  list: () => api.get('/users'),
  add: (username: string, password: string, email: string, admin: boolean) =>
    api.post('/users', { username, password, email, admin }),
  remove: (username: string) => api.delete(`/users/${encodeURIComponent(username)}`),
}

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

export const fileAPI = {
  // onProgress: yukleme ilerlemesi (yuzde + bayt)
  // signal: AbortController.signal — yuklemeyi yarida durdurmak icin
  upload: (
    file: File,
    onProgress?: (p: UploadProgress) => void,
    signal?: AbortSignal,
  ) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
      onUploadProgress: (e) => {
        if (!onProgress) return
        // e.total tarayici bazi durumlarda vermez; dosya boyutuna dus
        const total = e.total ?? file.size
        if (!total) return
        onProgress({
          loaded: e.loaded,
          total,
          percent: Math.min(100, Math.round((e.loaded / total) * 100)),
        })
      },
    })
  },
  list: () => api.get('/files'),
  download: (fileId: string) =>
    api.get(`/files/${fileId}`, { responseType: 'blob' }),
  delete: (fileId: string) => api.delete(`/files/${fileId}`),
}

export default api
