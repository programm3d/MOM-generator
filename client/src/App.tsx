import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { FileUpload } from './components/FileUpload';
import { ProcessingStatus } from './components/ProcessingStatus';
import { DownloadResult } from './components/DownloadResult';
import { uploadTranscript, getGenerationStatus } from './services/api';
import { GenerationStatusResponse, JobStage, JobStatus } from './types';
import { FileSpreadsheet } from 'lucide-react';

export const App: React.FC = () => {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>('idle');
  const [stage, setStage] = useState<JobStage>('uploading');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [totalChunks, setTotalChunks] = useState<number | undefined>(undefined);
  const [completedChunks, setCompletedChunks] = useState<number | undefined>(undefined);
  const [resultFileName, setResultFileName] = useState<string | undefined>(undefined);
  const [meetingTitle, setMeetingTitle] = useState<string | null | undefined>(undefined);
  const [meetingDate, setMeetingDate] = useState<string | null | undefined>(undefined);
  const [meetingTime, setMeetingTime] = useState<string | null | undefined>(undefined);
  const [meetingMode, setMeetingMode] = useState<string | null | undefined>(undefined);
  const [attendees, setAttendees] = useState<string | null | undefined>(undefined);
  const [agendaCount, setAgendaCount] = useState<number | undefined>(undefined);

  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearPolling();
  }, []);

  const startPolling = (id: string) => {
    clearPolling();
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const data: GenerationStatusResponse = await getGenerationStatus(id);
        setStatus(data.status);
        setStage(data.stage);
        setStatusMessage(data.message);
        setTotalChunks(data.totalChunks);
        setCompletedChunks(data.completedChunks);
        setResultFileName(data.resultFileName);
        setMeetingTitle(data.meetingTitle);
        setMeetingDate(data.meetingDate);
        setMeetingTime(data.meetingTime);
        setMeetingMode(data.meetingMode);
        setAttendees(data.attendees);
        setAgendaCount(data.agendaCount);

        if (data.status === 'completed' || data.status === 'failed') {
          clearPolling();
          if (data.status === 'failed') {
            setError(data.error || data.message);
          }
        }
      } catch (err: any) {
        clearPolling();
        setStatus('failed');
        setError(err.message || 'Lost connection to generation service.');
      }
    }, 1500);
  };

  const handleStartGeneration = async (file: File) => {
    setCurrentFile(file);
    setStatus('uploading');
    setStage('uploading');
    setStatusMessage('Uploading transcript to server...');
    setError(undefined);

    try {
      const response = await uploadTranscript(file);
      setJobId(response.id);
      setStatus('processing');
      setStage('extracting');
      setStatusMessage('File uploaded. Starting text extraction...');
      startPolling(response.id);
    } catch (err: any) {
      setStatus('failed');
      setStage('uploading');
      setError(err.message || 'Failed to upload transcript file.');
    }
  };

  const handleRetry = () => {
    if (currentFile) {
      handleStartGeneration(currentFile);
    } else {
      handleReset();
    }
  };

  const handleReset = () => {
    clearPolling();
    setJobId(null);
    setStatus('idle');
    setStage('uploading');
    setStatusMessage('');
    setError(undefined);
    setTotalChunks(undefined);
    setCompletedChunks(undefined);
    setResultFileName(undefined);
    setMeetingTitle(undefined);
    setMeetingDate(undefined);
    setAgendaCount(undefined);
    setCurrentFile(null);
  };

  return (
    <div className="app-wrapper">
      <header className="navbar">
        <div className="nav-container">
          <div className="brand">
            <div className="brand-icon">
              <FileSpreadsheet size={20} />
            </div>
            <span className="brand-title">AI MoM Generator</span>
            <span className="brand-tag">MVP</span>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="hero-section">
          <h1 className="hero-title">Meeting Minutes Made Simple</h1>
          <p className="hero-subtitle">
            Upload any .docx, .pdf, or .txt meeting transcript to generate a structured,
            evidence-backed Microsoft Word document in the standard 6-column format.
          </p>
        </section>

        {status === 'idle' && (
          <FileUpload
            onStartGeneration={handleStartGeneration}
            isUploading={false}
            maxSizeMb={25}
          />
        )}

        {(status === 'uploading' || status === 'processing' || status === 'failed') && (
          <ProcessingStatus
            status={status}
            stage={stage}
            message={statusMessage}
            error={error}
            totalChunks={totalChunks}
            completedChunks={completedChunks}
            onRetry={handleRetry}
            onReset={handleReset}
          />
        )}

        {status === 'completed' && jobId && (
          <DownloadResult
            generationId={jobId}
            resultFileName={resultFileName}
            meetingTitle={meetingTitle}
            meetingDate={meetingDate}
            meetingTime={meetingTime}
            meetingMode={meetingMode}
            attendees={attendees}
            agendaCount={agendaCount}
            onReset={handleReset}
          />
        )}
      </main>

      <footer className="footer">
        <p>AI Minutes of Meeting Generator • Single-user local-first MVP</p>
      </footer>
    </div>
  );
};

export default App;
