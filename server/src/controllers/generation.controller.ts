import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { jobManager } from '../services/jobs/job-manager.js';
import { config } from '../config/index.js';

export class GenerationController {
  public static async uploadAndStart(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      if ((req as any).fileValidationError) {
        return res.status(400).json({ error: (req as any).fileValidationError });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Please upload a transcript file.' });
      }

      if (req.file.size === 0) {
        return res.status(400).json({ error: 'Uploaded file is empty.' });
      }

      const job = jobManager.createJob(
        req.file.originalname,
        req.file.mimetype,
        req.file.path
      );

      // Start processing asynchronously in background
      // Lazy import or call orchestrator
      GenerationController.runOrchestrator(job.id).catch((err) => {
        console.error(`Unhandled error in job ${job.id}:`, err);
        jobManager.updateJob(job.id, {
          status: 'failed',
          message: 'An unexpected processing failure occurred.',
          error: err.message || String(err),
        });
      });

      return res.status(202).json({
        id: job.id,
        status: job.status,
        stage: job.stage,
        message: job.message,
      });
    } catch (err) {
      return next(err);
    }
  }

  public static async getStatus(req: Request, res: Response): Promise<any> {
    const { id } = req.params;
    const job = jobManager.getJob(id);

    if (!job) {
      return res.status(404).json({
        error: 'Generation job not found or expired. Please upload your transcript again.',
      });
    }

    return res.json({
      id: job.id,
      status: job.status,
      stage: job.stage,
      message: job.message,
      originalFileName: job.originalFileName,
      resultFileName: job.resultFileName,
      totalChunks: job.totalChunks,
      completedChunks: job.completedChunks,
      agendaCount: job.agendaCount,
      meetingTitle: job.meetingTitle,
      meetingDate: job.meetingDate,
      meetingTime: job.meetingTime,
      meetingMode: job.meetingMode,
      attendees: job.attendees,
      error: job.error,
    });
  }

  public static async downloadResult(req: Request, res: Response): Promise<any> {
    const { id } = req.params;
    const job = jobManager.getJob(id);

    if (!job) {
      return res.status(404).json({ error: 'Generation job not found.' });
    }

    if (job.status !== 'completed' || !job.outputFilePath) {
      return res.status(400).json({
        error: 'Document generation is not yet complete or has failed.',
      });
    }

    if (!fs.existsSync(job.outputFilePath)) {
      return res.status(404).json({
        error: 'Generated file has expired or was removed from temporary storage.',
      });
    }

    const downloadName = job.resultFileName || 'Minutes_of_Meeting.docx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    return res.sendFile(path.resolve(job.outputFilePath));
  }

  public static async cancelOrDelete(req: Request, res: Response): Promise<any> {
    const { id } = req.params;
    const deleted = await jobManager.deleteJob(id);
    return res.json({ success: deleted });
  }

  public static health(_req: Request, res: Response): any {
    return res.json({
      status: 'ok',
      service: 'AI MoM Generator API',
      provider: config.llmProvider,
      model: config.llmProvider === 'gemini' ? config.llmModel : config.groqModel,
      uploadMaxMb: config.uploadMaxMb,
    });
  }

  private static async runOrchestrator(jobId: string): Promise<void> {
    try {
      const { processGenerationJob } = await import('../services/orchestrator.js');
      await processGenerationJob(jobId);
    } catch (err: any) {
      jobManager.updateJob(jobId, {
        status: 'failed',
        message: 'Generation failed during processing.',
        error: err.message || String(err),
      });
    }
  }
}
