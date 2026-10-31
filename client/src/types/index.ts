export type JobStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

export type JobStage =
  | 'uploading'
  | 'extracting'
  | 'chunking'
  | 'extracting_facts'
  | 'consolidating'
  | 'validating'
  | 'rendering_docx'
  | 'ready';

export interface GenerationStatusResponse {
  id: string;
  status: JobStatus;
  stage: JobStage;
  message: string;
  originalFileName?: string;
  resultFileName?: string;
  totalChunks?: number;
  completedChunks?: number;
  agendaCount?: number;
  meetingTitle?: string | null;
  meetingDate?: string | null;
  meetingTime?: string | null;
  meetingMode?: string | null;
  attendees?: string | null;
  error?: string;
}
