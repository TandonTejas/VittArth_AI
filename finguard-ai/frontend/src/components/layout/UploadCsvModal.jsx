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
    setLoading(true); setError(null)
    try {
      await uploadCSV(sessionId, file)
      window.location.reload()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(5,6,26,0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="fg-card" style={{ width: 420, padding: 28, position: 'relative' }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(0,180,255,0.08)',
            border: '1px solid rgba(0,180,255,0.18)',
            borderRadius: 8, color: '#7b82b0',
            cursor: 'pointer', width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f0f4ff'; e.currentTarget.style.borderColor = 'rgba(0,180,255,0.4)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#7b82b0'; e.currentTarget.style.borderColor = 'rgba(0,180,255,0.18)' }}
        >
          <X size={16} />
        </button>

        <span className="section-tag"><span className="dot" />Import</span>
        <h2 style={{ margin: '4px 0 20px', color: '#f0f4ff', fontSize: 20, fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
          Upload New Transactions
        </h2>

        {error && <ErrorAlert message={error} />}

        {/* Drag-drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault(); setDragging(false)
            if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0])
          }}
          style={{
            border: `2px dashed ${dragging ? '#00b4ff' : 'rgba(0,180,255,0.25)'}`,
            background: dragging ? 'rgba(0,180,255,0.06)' : 'rgba(5,6,26,0.4)',
            borderRadius: 12, padding: 32, textAlign: 'center',
            marginBottom: 20, transition: 'all 0.3s', cursor: 'pointer',
            boxShadow: dragging ? '0 0 20px rgba(0,180,255,0.15)' : 'none',
          }}
          onClick={() => document.getElementById('modal_file_upload').click()}
        >
          <Upload size={36} color={dragging ? '#00b4ff' : '#7b82b0'} style={{ marginBottom: 12, transition: 'color 0.3s' }} />
          <div style={{
            color: file ? '#00e5c0' : '#b0b8d4',
            fontWeight: file ? 500 : 400,
            marginBottom: 4, fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {file ? file.name : 'Click or drag CSV here'}
          </div>
          <div style={{ fontSize: 12, color: '#7b82b0', fontFamily: "'DM Sans', sans-serif" }}>
            .csv, .xls, .xlsx
          </div>
          <input
            type="file" id="modal_file_upload" style={{ display: 'none' }}
            accept=".csv,.xls,.xlsx"
            onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]) }}
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="btn-primary"
          style={{
            width: '100%',
            opacity: file && !loading ? 1 : 0.5,
            cursor: file && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', justifyContent: 'center', gap: 8,
          }}
        >
          {loading ? <><Spinner size={16} /> Processing…</> : 'Process File'}
        </button>
      </div>
    </div>
  )
}
