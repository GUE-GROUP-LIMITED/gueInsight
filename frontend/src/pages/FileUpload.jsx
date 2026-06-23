import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './FileUpload.css';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.txt,.log,.csv,.json';

export default function FileUpload() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const pickFile = (file) => {
    if (!file) {
      return;
    }

    setSelectedFile(file);
    setError('');
    setStatus('');
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    pickFile(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedFile || submitting) {
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setSubmitting(true);
    setError('');
    setStatus('Uploading and analyzing file...');

    try {
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const redirectUrl = response.data?.redirect_url;
      if (redirectUrl) {
        navigate(redirectUrl);
        return;
      }

      setStatus('Upload complete.');
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'File upload failed.');
      setStatus('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="file-upload-page">
      <section className="file-upload-card">
        <p className="file-upload-eyebrow">File analysis</p>
        <h1>Upload a file for review</h1>
        <p className="file-upload-lead">
          Submit a document, log, CSV, or JSON file and the platform will analyze it against your plan limits.
        </p>

        <form className="file-upload-form" onSubmit={handleSubmit}>
          <label
            className={`file-upload-dropzone${isDragging ? ' file-upload-dropzone--active' : ''}${selectedFile ? ' file-upload-dropzone--selected' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={(event) => pickFile(event.target.files?.[0] || null)}
            />
            <span className="file-upload-dropzone__label">
              {isDragging ? 'Drop the file here' : 'Choose a file or drag one here'}
            </span>
            <span className="file-upload-dropzone__hint">PDF, DOCX, TXT, LOG, CSV, JSON</span>
            {selectedFile ? (
              <strong className="file-upload-dropzone__file">
                {selectedFile.name} · {(selectedFile.size / 1024).toFixed(1)} KB
              </strong>
            ) : (
              <span className="file-upload-dropzone__empty">Drag a file from your desktop or click to browse.</span>
            )}
          </label>

          <div className="file-upload-actions">
            <button type="button" className="file-upload-button file-upload-button--ghost" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </button>
            <button type="submit" className="file-upload-button file-upload-button--primary" disabled={!selectedFile || submitting}>
              {submitting ? 'Uploading...' : 'Upload and analyze'}
            </button>
          </div>
        </form>

        {status ? <p className="file-upload-status">{status}</p> : null}
        {error ? <p className="file-upload-error">{error}</p> : null}
      </section>
    </main>
  );
}
