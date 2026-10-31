import { nanoid } from 'nanoid';
import { tempStorage } from '../../utils/temp-storage.js';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type JobStage =
  | 'uploading'
  | 'extracting'
  | 'chunking'
  | 'extracting_facts'
  | 'consolidating'
  | 'validating'
  | 'rendering_docx'
  | 'ready';

export interface GenerationJob {
  id: string;
  status: JobStatus;
  stage: JobStage;
  message: string;
  originalFileName: string;
  mimeType: string;
  sourceFilePath: string;
  outputFilePath?: string;
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
  createdAt: number;
  updatedAt: number;
}

export class JobManager {
  private jobs: Map<string, GenerationJob> = new Map();

  public createJob(
    originalFileName: string,
    mimeType: string,
    sourceFilePath: string
  ): GenerationJob {
    const id = nanoid(12);
    const now = Date.now();
    const job: GenerationJob = {
      id,
      status: 'processing',
      stage: 'extracting',
      message: 'File received. Preparing to extract text...',
      originalFileName,
      mimeType,
      sourceFilePath,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(id, job);
    return job;
  }

  public getJob(id: string): GenerationJob | undefined {
    return this.jobs.get(id);
  }

  public updateJob(
    id: string,
    updates: Partial<Omit<GenerationJob, 'id' | 'createdAt'>>
  ): GenerationJob | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    Object.assign(job, updates, { updatedAt: Date.now() });
    this.jobs.set(id, job);
    return job;
  }

  public async cleanupJobFiles(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;

    if (job.sourceFilePath) {
      await tempStorage.deleteFile(job.sourceFilePath);
    }
  }

  public async deleteJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;

    if (job.sourceFilePath) {
      await tempStorage.deleteFile(job.sourceFilePath);
    }
    if (job.outputFilePath) {
      await tempStorage.deleteFile(job.outputFilePath);
    }

    return this.jobs.delete(id);
  }

  public purgeExpiredJobs(maxAgeMinutes: number): number {
    const now = Date.now();
    const maxAgeMs = maxAgeMinutes * 60 * 1000;
    let purged = 0;

    for (const [id, job] of this.jobs.entries()) {
      if (now - job.createdAt > maxAgeMs) {
        this.deleteJob(id).catch(console.error);
        purged++;
      }
    }
    return purged;
  }
}

export const jobManager = new JobManager();
