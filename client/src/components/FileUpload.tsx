import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, FileText, X, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onStartGeneration: (file: File) => void;
  isUploading: boolean;
  maxSizeMb?: number;
}

const ACCEPTED_EXTENSIONS = ['.docx', '.pdf', '.txt'];
const ACCEPTED_MIMES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'text/plain',
];

export const FileUpload: React.FC<FileUploadProps> = ({
  onStartGeneration,
  isUploading,
  maxSizeMb = 25,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (file: File) => {
    setError(null);
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type "${ext}". Only .docx, .pdf, and .txt files are accepted.`);
      setSelectedFile(null);
      return;
    }

    // MIME type check if provided by browser
    if (file.type && !ACCEPTED_MIMES.includes(file.type)) {
      // In some OS/browsers, .docx might have empty or generic octet-stream MIME, so allow if extension matches
      if (file.type !== 'application/octet-stream') {
        // Warning or validation
      }
    }

    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum limit of ${maxSizeMb} MB.`);
      setSelectedFile(null);
      return;
    }

    if (file.size === 0) {
      setError('The selected file is empty. Please upload a transcript containing meeting text.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || isUploading) return;
    onStartGeneration(selectedFile);
  };

  return (
    <div className="upload-container">
      <form onSubmit={handleSubmit}>
        {!selectedFile ? (
          <div
            className={`dropzone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".docx,.pdf,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain"
              style={{ display: 'none' }}
            />
            <div className="dropzone-icon">
              <UploadCloud size={48} />
            </div>
            <h3 className="dropzone-title">Upload meeting transcript</h3>
            <p className="dropzone-sub">
              Drag & drop your file here, or <span className="browse-link">browse</span>
            </p>
            <div className="dropzone-meta">
              <span>Accepted: <strong>.docx, .pdf, .txt</strong></span>
              <span>Max size: <strong>{maxSizeMb} MB</strong></span>
            </div>
          </div>
        ) : (
          <div className="file-preview-card">
            <div className="file-info">
              <FileText className="file-icon" size={32} />
              <div className="file-details">
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-size">
                  {(selectedFile.size / 1024).toFixed(1)} KB ({selectedFile.name.split('.').pop()?.toUpperCase()})
                </span>
              </div>
            </div>
            <button
              type="button"
              className="remove-btn"
              onClick={handleRemove}
              disabled={isUploading}
              aria-label="Remove file"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {error && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {selectedFile && (
          <div className="action-row">
            <button
              type="submit"
              className="generate-btn"
              disabled={isUploading}
            >
              {isUploading ? 'Starting Generation...' : 'Generate Minutes of Meeting (DOCX)'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
