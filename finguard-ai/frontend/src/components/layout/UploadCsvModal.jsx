import { useState } from 'react'
import { Upload, X } from 'lucide-react'
import { uploadCSV } from '../../api/client'
import { useSession } from '../../context/SessionContext'
import ErrorAlert from '../ui/ErrorAlert'
import Spinner from '../ui/Spinner'

export default function UploadCsvModal({ onClose }) {
  const { sessionId } = useSession()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      await uploadCSV(sessionId, file)
      window.location.reload() // Reload to fetch fresh dashboard data
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 12, width: 400, padding: 24, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
          <X size={20} />
        </button>
        <h2 style={{ margin: '0 0 16px', color: '#f1f5f9', fontSize: 18 }}>Upload New Transactions</h2>
        {error && <ErrorAlert message={error} />}

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); if(e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]) }}
          style={{
            border: `2px dashed ${dragging ? '#38bdf8' : '#1e2535'}`,
            background: dragging ? '#38bdf811' : '#0f1117',
            borderRadius: 8, padding: 32, textAlign: 'center', marginBottom: 20,
            transition: 'all 0.2s', cursor: 'pointer'
          }}
          onClick={() => document.getElementById('modal_file_upload').click()}
        >
          <Upload size={32} color={dragging ? '#38bdf8' : '#64748b'} style={{ marginBottom: 12 }} />
          <div style={{ color: '#e2e8f0', fontWeight: 500, marginBottom: 4 }}>
            {file ? file.name : 'Click or drag CSV here'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>.csv, .xls, .xlsx</div>
          <input type="file" id="modal_file_upload" style={{ display: 'none' }} accept=".csv,.xls,.xlsx"
            onChange={e => { if(e.target.files[0]) setFile(e.target.files[0]) }} />
        </div>

        <button onClick={handleUpload} disabled={!file || loading} style={{
          width: '100%', padding: 12, borderRadius: 8, background: file ? '#38bdf8' : '#1e2535',
          color: file ? '#0f1117' : '#64748b', border: 'none', fontWeight: 600, cursor: file ? 'pointer' : 'not-allowed',
          display: 'flex', justifyContent: 'center', gap: 8
        }}>
          {loading ? <Spinner size={16} /> : 'Process File'}
        </button>
      </div>
    </div>
  )
}
