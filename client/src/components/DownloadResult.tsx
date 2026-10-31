import React from 'react';
import { Download, CheckCircle, FileText, ArrowLeft, Calendar, Tag } from 'lucide-react';
import { getDownloadUrl } from '../services/api';

interface DownloadResultProps {
  generationId: string;
  resultFileName?: string;
  meetingTitle?: string | null;
  meetingDate?: string | null;
  meetingTime?: string | null;
  meetingMode?: string | null;
  attendees?: string | null;
  agendaCount?: number;
  onReset: () => void;
}

export const DownloadResult: React.FC<DownloadResultProps> = ({
  generationId,
  resultFileName,
  meetingTitle,
  meetingDate,
  meetingTime,
  meetingMode,
  attendees,
  agendaCount,
  onReset,
}) => {
  const downloadUrl = getDownloadUrl(generationId);

  return (
    <div className="result-card">
      <div className="result-header">
        <div className="success-icon-wrapper">
          <CheckCircle size={44} className="icon-success-large" />
        </div>
        <h2 className="result-title">Minutes of Meeting Ready!</h2>
        <p className="result-sub">
          The meeting transcript was processed into an executive landscape 6-column DOCX document.
        </p>
      </div>

      <div className="result-details-box">
        <div className="result-detail-item">
          <FileText size={18} className="detail-icon" />
          <div className="detail-content">
            <span className="detail-label">Generated File</span>
            <span className="detail-value">{resultFileName || 'Minutes_of_Meeting.docx'}</span>
          </div>
        </div>

        {meetingTitle && (
          <div className="result-detail-item">
            <Tag size={18} className="detail-icon" />
            <div className="detail-content">
              <span className="detail-label">Meeting Topic</span>
              <span className="detail-value">{meetingTitle}</span>
            </div>
          </div>
        )}

        {meetingDate && (
          <div className="result-detail-item">
            <Calendar size={18} className="detail-icon" />
            <div className="detail-content">
              <span className="detail-label">Meeting Date</span>
              <span className="detail-value">
                {meetingDate}
                {meetingTime ? ` (${meetingTime})` : ''}
              </span>
            </div>
          </div>
        )}

        {meetingMode && (
          <div className="result-detail-item">
            <div className="detail-content">
              <span className="detail-label">Mode</span>
              <span className="detail-value">{meetingMode}</span>
            </div>
          </div>
        )}

        {attendees && (
          <div className="result-detail-item">
            <div className="detail-content">
              <span className="detail-label">Attendees</span>
              <span className="detail-value">{attendees}</span>
            </div>
          </div>
        )}

        {agendaCount !== undefined && (
          <div className="result-detail-item">
            <div className="detail-pill">
              <strong>{agendaCount}</strong> structured agenda items generated
            </div>
          </div>
        )}
      </div>

      <div className="result-actions">
        <a
          href={downloadUrl}
          download={resultFileName || 'Minutes_of_Meeting.docx'}
          className="btn btn-primary download-btn"
        >
          <Download size={20} /> Download Word Document (.docx)
        </a>

        <button type="button" className="btn btn-secondary new-file-btn" onClick={onReset}>
          <ArrowLeft size={16} /> Process Another Transcript
        </button>
      </div>
    </div>
  );
};
