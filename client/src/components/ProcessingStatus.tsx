import React from 'react';
import { CheckCircle2, Loader2, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { JobStage, JobStatus } from '../types';

interface ProcessingStatusProps {
  status: JobStatus;
  stage: JobStage;
  message: string;
  error?: string;
  totalChunks?: number;
  completedChunks?: number;
  onRetry: () => void;
  onReset: () => void;
}

interface StageStep {
  key: JobStage;
  label: string;
  description: string;
}

const STAGES: StageStep[] = [
  { key: 'uploading', label: '1. Ingestion', description: 'Receiving file and validating format' },
  { key: 'extracting', label: '2. Text Extraction', description: 'Extracting paragraphs, speaker turns & timestamps' },
  { key: 'chunking', label: '3. Transcript Chunking', description: 'Segmenting text with token-aware overlap' },
  { key: 'extracting_facts', label: '4. AI Extraction', description: 'Extracting candidate agendas, decisions & evidence' },
  { key: 'consolidating', label: '5. Consolidation', description: 'Merging duplicate topics and grouping discussion points' },
  { key: 'validating', label: '6. Schema & Evidence Validation', description: 'Checking 6-column structure and verifying quotes' },
  { key: 'rendering_docx', label: '7. DOCX Generation', description: 'Rendering controlled Word document' },
];

const STAGE_ORDER: Record<JobStage, number> = {
  uploading: 0,
  extracting: 1,
  chunking: 2,
  extracting_facts: 3,
  consolidating: 4,
  validating: 5,
  rendering_docx: 6,
  ready: 7,
};

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  status,
  stage,
  message,
  error,
  totalChunks,
  completedChunks,
  onRetry,
  onReset,
}) => {
  const currentStageIndex = STAGE_ORDER[stage] ?? 0;
  const isFailed = status === 'failed';

  return (
    <div className="processing-card">
      <div className="processing-header">
        <div className="header-status-badge">
          {isFailed ? (
            <span className="badge badge-error">
              <AlertCircle size={14} /> Failed
            </span>
          ) : (
            <span className="badge badge-active">
              <Loader2 size={14} className="spin" /> Processing
            </span>
          )}
        </div>
        <h3 className="processing-title">Generating Minutes of Meeting</h3>
        <p className="processing-current-message">{message}</p>
        
        {totalChunks && totalChunks > 1 && (
          <div className="chunks-badge">
            <Clock size={14} />
            <span>
              Transcript chunks: {completedChunks ?? 0} / {totalChunks} processed
            </span>
          </div>
        )}
      </div>

      <div className="timeline-stages">
        {STAGES.map((step, idx) => {
          let stepStatus: 'completed' | 'current' | 'pending' | 'failed' = 'pending';
          
          if (idx < currentStageIndex) {
            stepStatus = 'completed';
          } else if (idx === currentStageIndex) {
            stepStatus = isFailed ? 'failed' : 'current';
          } else {
            stepStatus = 'pending';
          }

          return (
            <div key={step.key} className={`timeline-item ${stepStatus}`}>
              <div className="timeline-marker">
                {stepStatus === 'completed' && <CheckCircle2 size={18} className="icon-success" />}
                {stepStatus === 'current' && <Loader2 size={18} className="icon-current spin" />}
                {stepStatus === 'failed' && <AlertCircle size={18} className="icon-error" />}
                {stepStatus === 'pending' && <span className="marker-dot" />}
              </div>
              <div className="timeline-content">
                <span className="timeline-label">{step.label}</span>
                <span className="timeline-desc">{step.description}</span>
              </div>
            </div>
          );
        })}
      </div>

      {isFailed && (
        <div className="error-box">
          <div className="error-title">
            <AlertCircle size={18} />
            <span>Generation Stopped</span>
          </div>
          <p className="error-text">{error || message}</p>
          <div className="error-actions">
            <button type="button" className="btn btn-secondary" onClick={onRetry}>
              <RefreshCw size={16} /> Retry Generation
            </button>
            <button type="button" className="btn btn-outline" onClick={onReset}>
              Upload Different File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
