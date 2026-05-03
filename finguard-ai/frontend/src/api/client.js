import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:8001/api' })

const handleErr = (e) => {
  const msg = e.response?.data?.detail || e.response?.data?.error || e.message || 'Unknown error'
  if (import.meta.env.DEV) {
    console.error('[VittArth API]', e.config?.method?.toUpperCase(), e.config?.url, '→', e.response?.status, msg)
  }
  throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
}


export const onboard     = (data)            => api.post('/onboard', data).then(r => r.data).catch(handleErr)
export const getDashboard= (sid)             => api.get(`/dashboard?session_id=${sid}`).then(r => r.data).catch(handleErr)
export const evaluateTransaction = (data)    => api.post('/evaluate', data).then(r => r.data).catch(handleErr)
export const confirmTransaction  = (data)    => api.post('/confirm', data).then(r => r.data).catch(handleErr)
export const ingestBankMessage   = (data)    => api.post('/ingest-bank-message', data).then(r => r.data).catch(handleErr)
export const getCategories       = ()        => api.get('/categories').then(r => r.data).catch(handleErr)
export const correctCategory     = (data)    => api.post('/correct-category', data).then(r => r.data).catch(handleErr)
export const getProfile          = (sid)     => api.get(`/profile/${sid}`).then(r => r.data).catch(handleErr)
export const updateProfile       = (data)    => api.put('/profile', data).then(r => r.data).catch(handleErr)

export const uploadCSV = (sessionId, file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      api.post('/upload-csv', {
        session_id: sessionId,
        filename: file.name,
        file_base64: base64
      }).then(r => resolve(r.data)).catch(e => {
        try { reject(handleErr(e)) } catch(err) { reject(err) }
      });
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
}
