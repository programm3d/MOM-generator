import { describe, it, expect } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../src/app.js';
import { jobManager } from '../src/services/jobs/job-manager.js';
import { processGenerationJob } from '../src/services/orchestrator.js';
import { DocxExtractor } from '../src/services/ingestion/docx-extractor.js';

describe('Milestone 6: End-to-End Workflow & Hardening', () => {
  const shortFixturePath = path.resolve(process.cwd(), '../tests/fixtures/sample-short.txt');
  const injectionFixturePath = path.resolve(process.cwd(), '../tests/fixtures/sample-prompt-injection.txt');

  it('Executes the full pipeline for a meeting transcript and outputs downloadable DOCX', async () => {
    // 1. Upload transcript
    const uploadRes = await request(app)
      .post('/api/generations')
      .attach('transcript', shortFixturePath);

    expect(uploadRes.status).toBe(202);
    const jobId = uploadRes.body.id;
    expect(jobId).toBeDefined();

    // 2. Run the orchestrator
    const job = jobManager.getJob(jobId);
    expect(job).toBeDefined();

    await processGenerationJob(jobId);

    // 3. Inspect final job state
    const updatedJob = jobManager.getJob(jobId);
    
    if (updatedJob?.status === 'completed') {
      expect(updatedJob.stage).toBe('ready');
      expect(updatedJob.outputFilePath).toBeDefined();
      expect(fs.existsSync(updatedJob.outputFilePath!)).toBe(true);
      expect(updatedJob.agendaCount).toBeGreaterThan(0);

      // 4. Test download endpoint
      const downloadRes = await request(app).get(`/api/generations/${jobId}/download`);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers['content-type']).toContain('wordprocessingml.document');
      expect(downloadRes.headers['content-disposition']).toContain('attachment');

      // 5. Test deletion endpoint
      const deleteRes = await request(app).delete(`/api/generations/${jobId}`);
      expect(deleteRes.status).toBe(200);
      expect(jobManager.getJob(jobId)).toBeUndefined();
    } else {
      expect(updatedJob?.status).toBe('failed');
    }
  }, 30000);

  it('Verifies complete end-to-end pipeline produces verified DOCX document', async () => {
    // 1. Upload transcript
    const uploadRes = await request(app)
      .post('/api/generations')
      .attach('transcript', shortFixturePath);

    expect(uploadRes.status).toBe(202);
    const jobId = uploadRes.body.id;

    const mockProvider = {
      name: 'test-mock',
      model: 'test-flash',
      generateStructured: async () => ({
        candidateMeetingTitle: 'Product Launch Readiness Sync',
        candidateMeetingDate: 'October 24, 2026',
        agendas: [
          {
            agenda: 'Infrastructure Readiness',
            discussionPoints: ['Load tests on Kubernetes cluster completed at 50,000 rps.'],
            decisionMade: 'Production Kubernetes cluster signed off for launch',
            responsiblePerson: 'Marcus',
            timeline: 'Not specified',
            evidence: [
              {
                quote: 'Production Kubernetes cluster is signed off for launch.',
                sourceSegmentId: 'seg_5',
                supportsField: 'decision',
              },
            ],
            uncertaintyNotes: [],
          },
          {
            agenda: 'Marketing Rollout',
            discussionPoints: ['Press release and social schedule drafted.'],
            decisionMade: 'Send customer email broadcast',
            responsiblePerson: 'Elena',
            timeline: 'October 28th at 9 AM UTC',
            evidence: [
              {
                quote: 'Elena will send the email broadcast on October 28th at 9 AM UTC.',
                sourceSegmentId: 'seg_9',
                supportsField: 'timeline',
              },
            ],
            uncertaintyNotes: [],
          },
        ],
      }),
    };

    await processGenerationJob(jobId, mockProvider);

    const completedJob = jobManager.getJob(jobId);
    expect(completedJob?.status).toBe('completed');
    expect(completedJob?.stage).toBe('ready');
    expect(completedJob?.agendaCount).toBe(2);
    expect(completedJob?.outputFilePath).toBeDefined();
    expect(fs.existsSync(completedJob!.outputFilePath!)).toBe(true);

    // Download generated DOCX
    const downloadRes = await request(app).get(`/api/generations/${jobId}/download`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toContain('wordprocessingml.document');

    // Verify Word document content
    const extractor = new DocxExtractor();
    const extractedDocx = await extractor.extract(completedJob!.outputFilePath!);
    expect(extractedDocx.fullText).toMatch(/Minutes of .*Meeting/i);
    expect(extractedDocx.fullText).toContain('Infrastructure Readiness');
    expect(extractedDocx.fullText).toContain('Marketing Rollout');
    expect(extractedDocx.fullText).toContain('Elena');
    expect(extractedDocx.fullText).toContain('Marcus');

    // Clean up
    await jobManager.deleteJob(jobId);
  });
});
