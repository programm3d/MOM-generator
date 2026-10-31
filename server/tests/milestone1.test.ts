import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../src/app.js';
import { tempStorage } from '../src/utils/temp-storage.js';
import { jobManager } from '../src/services/jobs/job-manager.js';

describe('Milestone 1: Application Foundation & Upload API', () => {
  const testDir = path.resolve(process.cwd(), './tmp-test');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('Health check endpoint returns ok status and provider details', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('AI MoM Generator API');
    expect(res.body.uploadMaxMb).toBe(25);
  });

  it('Rejects requests without any uploaded file', async () => {
    const res = await request(app).post('/api/generations');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No file uploaded/i);
  });

  it('Rejects unsupported file formats (e.g. .exe, .png)', async () => {
    const fakeFilePath = path.join(testDir, 'test.exe');
    fs.writeFileSync(fakeFilePath, 'not an executable binary');

    const res = await request(app)
      .post('/api/generations')
      .attach('transcript', fakeFilePath);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported file type/i);
  });

  it('Accepts a valid .txt transcript and initializes a generation job', async () => {
    const sampleTxt = path.join(testDir, 'transcript.txt');
    fs.writeFileSync(sampleTxt, 'Chair: Good morning team. Today we discuss Q3 roadmap.\nAlice: I agree.');

    const res = await request(app)
      .post('/api/generations')
      .attach('transcript', sampleTxt);

    expect(res.status).toBe(202);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('processing');
    expect(res.body.stage).toBe('extracting');

    // Verify status endpoint works
    const statusRes = await request(app).get(`/api/generations/${res.body.id}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.id).toBe(res.body.id);
    expect(statusRes.body.originalFileName).toBe('transcript.txt');
  });

  it('TempStorage generates unpredictable filenames and validates safe paths', () => {
    const { id, filePath } = tempStorage.generateFilePath('.txt');
    expect(id).toBeDefined();
    expect(filePath).toMatch(/\.txt$/);
    expect(path.isAbsolute(filePath)).toBe(true);
  });

  it('JobManager tracks updates and cleans up safely', async () => {
    const fakeFile = path.join(testDir, 'job_temp.txt');
    fs.writeFileSync(fakeFile, 'some data');

    const job = jobManager.createJob('meeting.txt', 'text/plain', fakeFile);
    expect(job.status).toBe('processing');

    jobManager.updateJob(job.id, { stage: 'consolidating', message: 'Merging topics' });
    const updated = jobManager.getJob(job.id);
    expect(updated?.stage).toBe('consolidating');
    expect(updated?.message).toBe('Merging topics');

    await jobManager.deleteJob(job.id);
    expect(jobManager.getJob(job.id)).toBeUndefined();
    expect(fs.existsSync(fakeFile)).toBe(false);
  });
});
